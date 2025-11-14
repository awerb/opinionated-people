"""Dataclasses mirroring the SQLite schema."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

RowMapping = Mapping[str, Any]


@dataclass
class User:
    id: int
    email: str
    display_name: str
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: RowMapping) -> "User":
        return cls(**row)


@dataclass
class Game:
    id: int
    title: str
    host_id: int
    status: str
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: RowMapping) -> "Game":
        return cls(**row)


@dataclass
class Question:
    id: int
    prompt: str
    category: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: RowMapping) -> "Question":
        return cls(**row)


@dataclass
class Round:
    id: int
    game_id: int
    question_id: int
    status: str
    started_at: str | None
    ended_at: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: RowMapping) -> "Round":
        return cls(**row)


@dataclass
class Participant:
    id: int
    game_id: int
    user_id: int
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: RowMapping) -> "Participant":
        return cls(**row)


@dataclass
class Invitation:
    id: int
    game_id: int
    email: str
    token: str
    status: str
    accepted: int
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: RowMapping) -> "Invitation":
        return cls(**row)


@dataclass
class Response:
    id: int
    round_id: int
    participant_id: int
    answer: str
    points: int
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: RowMapping) -> "Response":
        return cls(**row)
