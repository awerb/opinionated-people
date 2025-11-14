"""Utility helpers that encapsulate scoring rules for the prototype backend."""

from __future__ import annotations

from typing import Dict, Iterable, List

from .models import GameParticipant


class ScoringService:
    """Tracks and updates scores for each participant."""

    def __init__(self, participants: Dict[str, GameParticipant]):
        self._participants = participants

    @property
    def participants(self) -> Dict[str, GameParticipant]:
        return self._participants

    def apply_round_scores(self, scores: Dict[str, int]) -> None:
        """Applies a batch of score updates from the latest round."""

        for handle, delta in scores.items():
            participant = self._participants.get(handle)
            if not participant or participant.eliminated:
                continue
            participant.score += delta

    def mark_finalists(self, finalist_handles: Iterable[str]) -> List[GameParticipant]:
        """Assigns finalist/voter_only roles on the participant model."""

        finalist_handles = set(finalist_handles)
        updated: List[GameParticipant] = []
        for participant in self._participants.values():
            if participant.handle in finalist_handles:
                participant.promote_to_finalist()
            else:
                participant.demote_to_voter()
            updated.append(participant)
        return updated

    def reset_roles(self) -> None:
        for participant in self._participants.values():
            participant.reset_to_competitor()
