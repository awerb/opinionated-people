"""Core data models shared across backend services.

The real production system would persist players in a database, but for the
purposes of local prototyping we keep the objects lightweight so that they can
be easily unit tested.  These models intentionally avoid any framework-specific
base classes which keeps them portable between FastAPI, Flask, or any
serverless entry point.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GameParticipant:
    """Represents a single person in the game.

    The `finalist` flag is mutually exclusive with `voter_only` which lets the
    scoring service quickly reason about which players are still competing for
    the championship and which players should only vote once the finals begin.
    """

    handle: str
    score: int = 0
    eliminated: bool = False
    finalist: bool = False
    voter_only: bool = False

    def promote_to_finalist(self) -> None:
        """Marks the participant as a finalist.

        This helper ensures that we consistently clear the `voter_only` flag
        whenever a player earns their spot in the finals.
        """

        self.finalist = True
        self.voter_only = False

    def demote_to_voter(self) -> None:
        """Marks the participant as a voter-only attendee."""

        self.finalist = False
        self.voter_only = True

    def reset_to_competitor(self) -> None:
        """Resets the participant to the default competitor role."""

        self.finalist = False
        self.voter_only = False
