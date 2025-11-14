"""Round timer that synchronises countdowns and auto-submits missing answers."""
from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Dict, Iterable, List, Optional, Set

from backend.realtime.socket_manager import SocketManager

AnswerSink = Callable[[str, str, str, bool], Awaitable[None]]


@dataclass
class RoundState:
    round_id: str
    room: str
    question_id: str
    duration: int
    players: Set[str]
    options: Optional[List[str]] = None
    answers: Dict[str, "RecordedAnswer"] = field(default_factory=dict)
    task: Optional[asyncio.Task[None]] = None


@dataclass
class RecordedAnswer:
    value: str
    is_auto: bool = False


class RoundTimer:
    """Coordinates countdowns and delegates network broadcasts."""

    def __init__(
        self,
        socket_manager: SocketManager,
        *,
        answer_sink: Optional[AnswerSink] = None,
        random_source: Optional[random.Random] = None,
    ) -> None:
        self._socket_manager = socket_manager
        self._answer_sink = answer_sink or (lambda round_id, player_id, answer, is_auto: asyncio.sleep(0))
        self._random = random_source or random.Random()
        self._rounds: Dict[str, RoundState] = {}
        self._lock = asyncio.Lock()

    async def start_round(
        self,
        round_id: str,
        *,
        room: str,
        question_id: str,
        duration: int,
        players: Iterable[str],
        options: Optional[List[str]] = None,
    ) -> None:
        async with self._lock:
            if round_id in self._rounds:
                raise ValueError(f"Round {round_id} already running")
            state = RoundState(
                round_id=round_id,
                room=room,
                question_id=question_id,
                duration=duration,
                players=set(players),
                options=options,
            )
            state.task = asyncio.create_task(self._run_round(state))
            self._rounds[round_id] = state

    async def submit_player_answer(self, round_id: str, player_id: str, answer: str) -> None:
        state = self._rounds.get(round_id)
        if not state:
            raise ValueError(f"Round {round_id} does not exist")
        if player_id not in state.players:
            raise ValueError(f"Player {player_id} is not part of round {round_id}")
        state.answers[player_id] = RecordedAnswer(value=answer, is_auto=False)
        await self._answer_sink(round_id, player_id, answer, False)

    async def wait_for_round(self, round_id: str) -> None:
        state = self._rounds.get(round_id)
        if state and state.task:
            await state.task

    async def _run_round(self, state: RoundState) -> None:
        await self._socket_manager.broadcast_question_start(
            state.room,
            question_id=state.question_id,
            duration=state.duration,
            players=state.players,
            round_id=state.round_id,
        )
        for remaining in range(state.duration, 0, -1):
            await self._socket_manager.broadcast_countdown(
                state.room, round_id=state.round_id, remaining=remaining
            )
            await asyncio.sleep(1)
        await self._finalise_round(state)

    async def _finalise_round(self, state: RoundState) -> None:
        for missing_player in state.players - state.answers.keys():
            answer = self._generate_auto_answer(state)
            state.answers[missing_player] = RecordedAnswer(value=answer, is_auto=True)
            await self._answer_sink(state.round_id, missing_player, answer, True)
        results = [
            {
                "playerId": player_id,
                "answer": record.value,
                "isAutoSubmitted": record.is_auto,
            }
            for player_id, record in sorted(state.answers.items())
        ]
        await self._socket_manager.broadcast_round_results(
            state.room,
            round_id=state.round_id,
            question_id=state.question_id,
            results=results,
        )
        async with self._lock:
            self._rounds.pop(state.round_id, None)

    def _generate_auto_answer(self, state: RoundState) -> str:
        if state.options:
            return self._random.choice(state.options)
        return ""


__all__ = ["RoundTimer"]
