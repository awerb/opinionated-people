"""Game administration helpers for invitation control.

This module keeps a minimal in-memory representation of the game state so
that API routes can reason about who is allowed to invite or start a game.
The structure is intentionally lightweight so it can be swapped for a real
persistence layer without changing the public surface area.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional
import uuid


@dataclass
class Player:
    """Registered player record."""

    player_id: str
    display_name: str
    invited_by: Optional[str] = None


@dataclass
class Invitation:
    """Represents an invitation token sent to a prospective player."""

    token: str
    inviter_id: str
    invitee_email: str
    status: str = "pending"
    invitee_id: Optional[str] = None


class GameAdmin:
    """Encapsulates invite/start permissions for a game session."""

    def __init__(self, *, min_players: int = 4) -> None:
        self.min_players = min_players
        self.players: Dict[str, Player] = {}
        self.invitations: Dict[str, Invitation] = {}
        self.invite_mode: str = "locked"  # "locked" or "open"
        self.host_id: Optional[str] = None

    # ------------------------------------------------------------------
    # Player management helpers
    # ------------------------------------------------------------------
    def register_host(self, player_id: str, display_name: str) -> Player:
        """Registers the host who is always allowed to invite and start."""

        if self.host_id is not None:
            raise ValueError("Host already registered")
        player = Player(player_id=player_id, display_name=display_name)
        self.players[player_id] = player
        self.host_id = player_id
        return player

    def _require_host(self) -> str:
        if self.host_id is None:
            raise ValueError("Host has not been registered")
        return self.host_id

    def set_invite_mode(self, *, requestor_id: str, locked: bool) -> None:
        """Toggles between locked and open invitation modes."""

        host_id = self._require_host()
        if requestor_id != host_id:
            raise ValueError("Only the host can toggle invitation mode")
        self.invite_mode = "locked" if locked else "open"

    # ------------------------------------------------------------------
    # Invitation helpers
    # ------------------------------------------------------------------
    def _validate_inviter(self, inviter_id: str) -> Player:
        if inviter_id not in self.players:
            raise ValueError("Inviter must be a registered player")
        if self.invite_mode == "locked" and inviter_id != self._require_host():
            raise ValueError("Invites are locked to the host right now")
        return self.players[inviter_id]

    def send_invitation(self, *, inviter_id: str, invitee_email: str) -> Invitation:
        """Creates a new invitation token from the inviter to the email."""

        self._validate_inviter(inviter_id)
        token = uuid.uuid4().hex
        invitation = Invitation(token=token, inviter_id=inviter_id, invitee_email=invitee_email)
        self.invitations[token] = invitation
        return invitation

    def accept_invitation(
        self,
        *,
        token: str,
        player_id: str,
        display_name: str,
    ) -> Player:
        """Marks an invitation as accepted and registers a new player."""

        invitation = self.invitations.get(token)
        if invitation is None:
            raise ValueError("Invitation token is invalid")
        if invitation.status == "accepted":
            raise ValueError("Invitation has already been accepted")

        player = Player(player_id=player_id, display_name=display_name, invited_by=invitation.inviter_id)
        self.players[player_id] = player

        invitation.status = "accepted"
        invitation.invitee_id = player_id
        return player

    def get_invite_tree(self) -> Dict[str, Dict[str, object]]:
        """Returns a nested representation of players keyed by their ids."""

        tree_nodes: Dict[str, Dict[str, object]] = {}
        for player in self.players.values():
            tree_nodes[player.player_id] = {
                "player_id": player.player_id,
                "display_name": player.display_name,
                "invited_by": player.invited_by,
                "children": [],
            }

        for node in tree_nodes.values():
            parent_id = node["invited_by"]
            if parent_id and parent_id in tree_nodes:
                tree_nodes[parent_id]["children"].append(node)

        root_id = self.host_id or next(iter(tree_nodes.keys()), None)
        return tree_nodes.get(root_id, {"children": []})

    def get_invitation_chain(self, player_id: str) -> List[Dict[str, str]]:
        """Builds a host -> ... -> player chain for analytics."""

        chain: List[Dict[str, str]] = []
        current_id: Optional[str] = player_id
        while current_id:
            player = self.players.get(current_id)
            if player is None:
                break
            chain.append({"player_id": player.player_id, "display_name": player.display_name})
            current_id = player.invited_by
        return list(reversed(chain))

    # ------------------------------------------------------------------
    # Game start helpers
    # ------------------------------------------------------------------
    def start_game(self, *, requestor_id: str) -> None:
        """Validates whether the requestor can start the game."""

        host_id = self._require_host()
        if requestor_id != host_id:
            raise ValueError("Only the host can start the game")
        if len(self.players) < self.min_players:
            raise ValueError(f"At least {self.min_players} players are required to start the game")


# Default singleton used by API routes. In production this could be swapped
# for a dependency-injected instance backed by a database.
game_admin = GameAdmin()

# Prototype convenience: register a placeholder host so that invites can be
# issued without persisting any additional state.
try:
    game_admin.register_host("host", "Session Host")
except ValueError:
    # If a host was registered elsewhere we can safely ignore the error.
    pass
