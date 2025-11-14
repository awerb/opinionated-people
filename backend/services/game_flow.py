"""Simple state machine for transitioning between rounds and the championship."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional

from .models import GameParticipant
from .scoring import ScoringService


class GamePhase(Enum):
    LOBBY = "lobby"
    GENERAL_ROUND = "general_round"
    CHAMPIONSHIP = "championship"
    COMPLETE = "complete"


@dataclass
class GameFlowState:
    phase: GamePhase = GamePhase.LOBBY
    round_number: int = 0
    finalists: List[str] = field(default_factory=list)
    eliminated: List[str] = field(default_factory=list)
    champion: Optional[str] = None


class GameFlowService:
    """Controls the lifecycle of a game session."""

    def __init__(self, handles: List[str], finalist_threshold: int = 3):
        if finalist_threshold < 1:
            raise ValueError("Finalist threshold must be at least one player")
        self.state = GameFlowState()
        self.finalist_threshold = finalist_threshold
        self.participants: Dict[str, GameParticipant] = {
            handle: GameParticipant(handle=handle) for handle in handles
        }
        self.scoring = ScoringService(self.participants)

    def start_game(self) -> GameFlowState:
        if self.state.phase != GamePhase.LOBBY:
            return self.state
        self.state.phase = GamePhase.GENERAL_ROUND
        return self.state

    def set_finalist_threshold(self, value: int) -> None:
        if value < 1:
            raise ValueError("Finalist threshold must be positive")
        self.finalist_threshold = value

    def eliminate_player(self, handle: str) -> None:
        participant = self.participants.get(handle)
        if not participant:
            return
        participant.eliminated = True
        participant.reset_to_competitor()
        self._refresh_eliminated()

    def restore_player(self, handle: str) -> None:
        participant = self.participants.get(handle)
        if not participant:
            return
        participant.eliminated = False
        self._refresh_eliminated()

    def record_round(self, scores: Dict[str, int]) -> GameFlowState:
        if self.state.phase == GamePhase.LOBBY:
            self.start_game()
        if self.state.phase != GamePhase.GENERAL_ROUND:
            raise RuntimeError("Cannot record a general round during finals")
        self.scoring.apply_round_scores(scores)
        self.state.round_number += 1
        self._auto_transition_to_championship()
        return self.state

    def transition_to_championship(self) -> GameFlowState:
        finalists = self._select_finalists()
        if len(finalists) < self.finalist_threshold:
            raise RuntimeError("Not enough finalists to start the championship")
        self.state.finalists = finalists
        self.state.phase = GamePhase.CHAMPIONSHIP
        self.scoring.mark_finalists(finalists)
        return self.state

    def record_championship_ballots(self, ballots: Dict[str, int]) -> str:
        if self.state.phase != GamePhase.CHAMPIONSHIP:
            raise RuntimeError("Championship votes can only be recorded during finals")
        self.scoring.apply_round_scores(ballots)
        finalists = {handle: self.participants[handle] for handle in self.state.finalists}
        winner = max(finalists.values(), key=lambda p: p.score)
        self.state.champion = winner.handle
        self.state.phase = GamePhase.COMPLETE
        return winner.handle

    def _auto_transition_to_championship(self) -> None:
        if self.state.phase != GamePhase.GENERAL_ROUND:
            return
        finalists = self._select_finalists()
        if len(finalists) >= self.finalist_threshold:
            self.transition_to_championship()

    def _select_finalists(self) -> List[str]:
        active_players = [p for p in self.participants.values() if not p.eliminated]
        ordered = sorted(active_players, key=lambda p: (-p.score, p.handle))
        return [p.handle for p in ordered[: self.finalist_threshold]]

    def _refresh_eliminated(self) -> None:
        self.state.eliminated = [handle for handle, p in self.participants.items() if p.eliminated]
