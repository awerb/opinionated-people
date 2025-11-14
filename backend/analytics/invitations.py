"""Analytics helpers for invitation flows."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass
class InvitationEvent:
    """Serializable structure describing an invitation event."""

    event: str
    metadata: Dict[str, object]


class InvitationAnalytics:
    """Collects lightweight analytics for reporting."""

    def __init__(self) -> None:
        self.events: List[InvitationEvent] = []

    def record_invite_sent(
        self,
        *,
        inviter_id: str,
        invitee_email: str,
        mode: str,
        chain: List[Dict[str, str]],
    ) -> None:
        """Stores a record that the given inviter sent an invite."""

        self.events.append(
            InvitationEvent(
                event="invite_sent",
                metadata={
                    "inviter_id": inviter_id,
                    "invitee_email": invitee_email,
                    "mode": mode,
                    "chain": chain,
                    "depth": len(chain),
                },
            )
        )

    def record_invite_accepted(
        self,
        *,
        player_id: str,
        chain: List[Dict[str, str]],
    ) -> None:
        """Stores when an invitation has been accepted."""

        self.events.append(
            InvitationEvent(
                event="invite_accepted",
                metadata={
                    "player_id": player_id,
                    "chain": chain,
                    "depth": len(chain),
                },
            )
        )

    def summarize(self) -> Dict[str, object]:
        """Simple summary useful for debugging or exporting."""

        return {
            "total_events": len(self.events),
            "sent": [event.metadata for event in self.events if event.event == "invite_sent"],
            "accepted": [event.metadata for event in self.events if event.event == "invite_accepted"],
        }


invitation_analytics = InvitationAnalytics()
