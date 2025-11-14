import { addSeconds } from "date-fns";
import {
  GameStatus,
  InviteMode,
  InviteStatus,
  ParticipantStatus,
  Response,
  RoundStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import { generateGameCode, sanitizeString } from "./utils";

export type CreateGameInput = {
  creatorName: string;
  inviteMode: InviteMode;
  timerSeconds: number;
  generalRoundCount: number;
  finalistCount: number;
  prizeAmount: number;
  questionIds: string[];
};

export type JoinGameInput = {
  username: string;
  inviteId?: string;
  invitedByParticipantId?: string;
};

export type InvitationInput = {
  inviteeContact: string;
  inviterParticipantId: string;
};

export type ResponseInput = {
  participantId: string;
  selectedOption: string;
};

const ACTIVE_INCLUDE = {
  rounds: {
    include: { question: true },
    orderBy: { index: "asc" as const },
  },
  participants: {
    include: {
      user: true,
      invitedBy: { include: { user: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  invitations: {
    include: {
      inviter: { include: { user: true } },
      inviteeUser: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export const serializeGame = async (gameId: string) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: ACTIVE_INCLUDE,
  });
  if (!game) return null;
  const responses = await prisma.response.findMany({
    where: { round: { gameId } },
  });
  return {
    id: game.id,
    code: game.code,
    status: game.status,
    inviteMode: game.inviteMode,
    prizeAmount: game.prizeAmount,
    timerSeconds: game.timerSeconds,
    generalRoundCount: game.generalRoundCount,
    finalistCount: game.finalistCount,
    currentRoundId: game.currentRoundId,
    createdAt: game.createdAt,
    rounds: game.rounds.map((round) => ({
      id: round.id,
      index: round.index,
      isChampionship: round.isChampionship,
      status: round.status,
      endsAt: round.endsAt,
      question: round.question,
    })),
    participants: game.participants.map((participant) => ({
      id: participant.id,
      status: participant.status,
      totalPoints: participant.totalPoints,
      isFinalist: participant.isFinalist,
      isCreator: participant.isCreator,
      invitedById: participant.invitedById,
      invitedByName: participant.invitedBy?.user.username ?? null,
      user: participant.user,
    })),
    invitations: game.invitations.map((invite) => ({
      id: invite.id,
      inviteeContact: invite.inviteeContact,
      status: invite.status,
      inviterId: invite.inviterId,
      inviterName: invite.inviter.user.username,
      lastReminderAt: invite.lastReminderAt,
    })),
    responses: responses.reduce<Record<string, { participantId: string; roundId: string; selectedOption: string }>>(
      (acc, response) => {
        acc[`${response.roundId}:${response.participantId}`] = {
          participantId: response.participantId,
          roundId: response.roundId,
          selectedOption: response.selectedOption,
        };
        return acc;
      },
      {},
    ),
  };
};

const buildUniqueCode = async () => {
  let code = generateGameCode();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.game.findUnique({ where: { code } });
    if (!existing) break;
    code = generateGameCode();
  }
  return code;
};

const pickQuestions = async (questionIds: string[], minimum: number) => {
  const questions = await prisma.question.findMany({ where: { id: { in: questionIds } } });
  if (questions.length < minimum) {
    throw new Error("Not enough questions selected for the configured number of rounds");
  }
  return questions;
};

export const createGame = async (input: CreateGameInput) => {
  const creatorName = sanitizeString(input.creatorName) || "Creator";
  const code = await buildUniqueCode();
  const questions = await pickQuestions(input.questionIds, input.generalRoundCount + 1);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { username: creatorName } });
    const game = await tx.game.create({
      data: {
        code,
        creatorId: user.id,
        inviteMode: input.inviteMode,
        timerSeconds: input.timerSeconds,
        generalRoundCount: input.generalRoundCount,
        finalistCount: input.finalistCount,
        prizeAmount: input.prizeAmount,
        rounds: {
          create: questions.map((question, index) => ({
            questionId: question.id,
            index,
            isChampionship: index === questions.length - 1,
          })),
        },
      },
    });
    const participant = await tx.gameParticipant.create({
      data: {
        gameId: game.id,
        userId: user.id,
        status: ParticipantStatus.ACTIVE,
        isCreator: true,
      },
      include: { user: true },
    });
    return { gameId: game.id, code: game.code, participantId: participant.id };
  });
};

export const startGame = async (gameId: string) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { rounds: { orderBy: { index: "asc" } } },
  });
  if (!game) throw new Error("Game not found");
  const firstRound = game.rounds[0];
  if (!firstRound) throw new Error("No rounds configured");
  await prisma.game.update({
    where: { id: gameId },
    data: {
      status: GameStatus.RUNNING,
      currentRoundId: firstRound.id,
    },
  });
  await prisma.gameRound.update({
    where: { id: firstRound.id },
    data: {
      status: RoundStatus.ACTIVE,
      endsAt: addSeconds(new Date(), game.timerSeconds),
    },
  });
  return serializeGame(gameId);
};

export const joinGame = async (gameId: string, input: JoinGameInput) => {
  const name = sanitizeString(input.username) || "Guest";
  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { participants: true } });
  if (!game) throw new Error("Game not found");
  if (game.status === GameStatus.COMPLETE) {
    throw new Error("Game already complete");
  }
  const inviteGate = game.inviteMode === InviteMode.LOCKED;
  if (inviteGate && !input.inviteId && !input.invitedByParticipantId) {
    throw new Error("Invite required to join this game");
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { username: name } });
    const participant = await tx.gameParticipant.create({
      data: {
        gameId,
        userId: user.id,
        invitedById: input.invitedByParticipantId,
        status: ParticipantStatus.ACTIVE,
      },
    });
    if (input.inviteId) {
      await tx.invitation.update({
        where: { id: input.inviteId },
        data: { status: InviteStatus.ACCEPTED, inviteeUserId: user.id },
      });
    }
    return { participantId: participant.id };
  });
};

export const createInvitation = async (gameId: string, payload: InvitationInput) => {
  const inviteeContact = sanitizeString(payload.inviteeContact);
  if (!inviteeContact) throw new Error("Invite contact required");
  const inviter = await prisma.gameParticipant.findUnique({ where: { id: payload.inviterParticipantId } });
  if (!inviter || inviter.gameId !== gameId) throw new Error("Inviter not found in game");
  return prisma.invitation.create({
    data: {
      gameId,
      inviterId: payload.inviterParticipantId,
      inviteeContact,
    },
  });
};

export const remindInvitation = async (inviteId: string) =>
  prisma.invitation.update({
    where: { id: inviteId },
    data: { lastReminderAt: new Date() },
  });

export const recordResponse = async (gameId: string, roundId: string, payload: ResponseInput) => {
  const round = await prisma.gameRound.findUnique({
    where: { id: roundId },
    include: { game: true },
  });
  if (!round || round.gameId !== gameId) {
    throw new Error("Round not found for game");
  }
  if (round.status !== RoundStatus.ACTIVE) {
    throw new Error("Round not active");
  }
  const participant = await prisma.gameParticipant.findUnique({ where: { id: payload.participantId } });
  if (!participant || participant.gameId !== gameId) {
    throw new Error("Participant not part of this game");
  }
  await prisma.response.upsert({
    where: { roundId_participantId: { roundId, participantId: payload.participantId } },
    update: { selectedOption: payload.selectedOption },
    create: {
      roundId,
      participantId: payload.participantId,
      selectedOption: payload.selectedOption,
    },
  });
  return serializeGame(gameId);
};

export const finalizeRound = async (gameId: string, roundId: string) => {
  await prisma.$transaction(async (tx) => {
    const round = await tx.gameRound.findUnique({
      where: { id: roundId },
      include: {
        game: { include: { participants: true } },
        responses: true,
      },
    });
    if (!round || round.gameId !== gameId) throw new Error("Round not found");
    const responses: Response[] = ((round.responses ?? []) as Response[]);
    const tally = responses.reduce<Record<string, number>>((acc: Record<string, number>, response: Response) => {
      acc[response.selectedOption] = (acc[response.selectedOption] ?? 0) + 1;
      return acc;
    }, {});
    const top = Object.values(tally).length ? Math.max(...Object.values(tally)) : 0;
    const winningOptions = Object.entries(tally)
      .filter(([, count]) => count === top && top > 0)
      .map(([option]) => option);
    const eligibleIds = round.game.participants
      .filter((participant) =>
        round.isChampionship ? participant.isFinalist : participant.status === ParticipantStatus.ACTIVE,
      )
      .map((participant) => participant.id);
    await tx.gameRound.update({ where: { id: roundId }, data: { status: RoundStatus.COMPLETE, endsAt: null } });
    await tx.game.update({ where: { id: gameId }, data: { currentRoundId: null } });
    if (winningOptions.length && eligibleIds.length) {
      const winningResponses = await tx.response.findMany({
        where: { roundId, selectedOption: { in: winningOptions }, participantId: { in: eligibleIds } },
      });
      await Promise.all(
        winningResponses.map((response) =>
          tx.gameParticipant.update({
            where: { id: response.participantId },
            data: { totalPoints: { increment: 1 } },
          }),
        ),
      );
    }
  });
  return serializeGame(gameId);
};

export const progressGame = async (gameId: string) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      rounds: { orderBy: { index: "asc" } },
      participants: true,
    },
  });
  if (!game) throw new Error("Game not found");
  const activeRound = game.rounds.find((round) => round.status === RoundStatus.ACTIVE);
  if (activeRound) {
    throw new Error("Resolve the current round before advancing");
  }
  const remaining = game.rounds.filter((round) => round.status === RoundStatus.IDLE);
  if (!remaining.length) {
    await prisma.game.update({ where: { id: gameId }, data: { status: GameStatus.COMPLETE, currentRoundId: null } });
    return serializeGame(gameId);
  }
  const nextRound = remaining[0];
  if (nextRound.isChampionship && game.status !== GameStatus.CHAMPIONSHIP) {
    const sorted = [...game.participants].sort((a, b) => b.totalPoints - a.totalPoints);
    const cutoffIndex = Math.max(0, Math.min(game.finalistCount - 1, sorted.length - 1));
    const cutoffScore = sorted[cutoffIndex]?.totalPoints ?? 0;
    const finalistIds = sorted
      .filter((participant) => participant.totalPoints >= cutoffScore)
      .slice(0, game.finalistCount)
      .map((participant) => participant.id);
    await prisma.gameParticipant.updateMany({
      where: { gameId, id: { in: finalistIds } },
      data: { isFinalist: true, status: ParticipantStatus.ACTIVE },
    });
    await prisma.gameParticipant.updateMany({
      where: { gameId, id: { notIn: finalistIds } },
      data: { status: ParticipantStatus.VOTER },
    });
    await prisma.game.update({ where: { id: gameId }, data: { status: GameStatus.CHAMPIONSHIP } });
  }
  await prisma.gameRound.updateMany({
    where: { gameId, status: RoundStatus.ACTIVE, id: { not: nextRound.id } },
    data: { status: RoundStatus.COMPLETE, endsAt: null },
  });
  await prisma.gameRound.update({
    where: { id: nextRound.id },
    data: { status: RoundStatus.ACTIVE, endsAt: addSeconds(new Date(), game.timerSeconds) },
  });
  await prisma.game.update({ where: { id: gameId }, data: { currentRoundId: nextRound.id } });
  return serializeGame(gameId);
};

export const fetchGameByCodeOrId = async (identifier: string) => {
  const game = await prisma.game.findFirst({
    where: {
      OR: [{ id: identifier }, { code: identifier.toUpperCase() }],
    },
  });
  return game ? serializeGame(game.id) : null;
};

export const listQuestions = () =>
  prisma.question.findMany({
    orderBy: { createdAt: "asc" },
  });
