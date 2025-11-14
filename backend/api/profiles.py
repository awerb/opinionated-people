"""Profile stats endpoints used by the dashboard UI."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List


@dataclass
class ProfileStats:
    player_id: str
    username: str
    elo: int
    win_rate: int
    debates: int
    decisive_votes: int
    streak: int


@dataclass
class Badge:
    id: str
    name: str
    description: str
    earned_at: str


PROFILES: Dict[str, ProfileStats] = {
    "player-one": ProfileStats(
        player_id="player-one",
        username="player-one",
        elo=1524,
        win_rate=64,
        debates=31,
        decisive_votes=16,
        streak=4,
    )
}

BADGES: Dict[str, List[Badge]] = {
    "player-one": [
        Badge(id="b-1", name="Closer", description="Won 3 debates in a row", earned_at="today"),
        Badge(id="b-2", name="Consensus Crafter", description="Earned 10 decisive votes", earned_at="this week"),
        Badge(id="b-3", name="Night Owl", description="Finished a match after midnight", earned_at="last week"),
    ]
}


def get_profile(player_id: str) -> Dict[str, int | str]:
    """Return the persisted stats for a player."""

    profile = PROFILES.get(player_id)
    if not profile:
        raise KeyError(f"Unknown player_id={player_id}")
    return asdict(profile)


def list_badges(player_id: str) -> List[Dict[str, str]]:
    """Return the badges earned by the player."""

    return [asdict(badge) for badge in BADGES.get(player_id, [])]


def build_profile_response(player_id: str) -> Dict[str, object]:
    """Aggregates stats and badges into a single payload."""

    profile = get_profile(player_id)
    badges = list_badges(player_id)
    return {"profile": profile, "badges": badges}
