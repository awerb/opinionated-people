"""REST-like and GraphQL-style APIs implemented directly on SQLite."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional

import sqlite3

from backend.db import connection_scope, get_connection
from backend.models import Game, Participant, Question, Response, Round
from backend.services import MajorityVoteScorer, build_leaderboard


@dataclass
class GameCreate:
    title: str
    host_id: int


@dataclass
class RoundCreate:
    question_id: int | None = None


@dataclass
class ResponseCreate:
    participant_id: int
    answer: str


@dataclass
class CloseRoundResult:
    round_id: int
    majority_answer: str | None
    is_tie: bool
    awarded_participant_ids: List[int]
    leaderboard: List[Dict[str, int | str]]


class APIError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class GamesAPI:
    def __init__(self, connection_factory: Callable[[], sqlite3.Connection] | None = None) -> None:
        self.connection_factory = connection_factory or get_connection
        self.scorer = MajorityVoteScorer()

    def _run(self, handler: Callable[[sqlite3.Connection], Any], connection: sqlite3.Connection | None) -> Any:
        with connection_scope(connection) as (conn, managed):
            try:
                result = handler(conn)
                if not managed:
                    conn.commit()
                return result
            except Exception:
                if not managed:
                    conn.rollback()
                raise

    # ------------------------------------------------------------------
    # CRUD helpers
    # ------------------------------------------------------------------

    def _fetch_user(self, conn: sqlite3.Connection, user_id: int) -> sqlite3.Row:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            raise APIError(404, "User not found")
        return row

    def _fetch_game(self, conn: sqlite3.Connection, game_id: int) -> Game:
        row = conn.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
        if not row:
            raise APIError(404, "Game not found")
        return Game.from_row(row)

    def _fetch_round(self, conn: sqlite3.Connection, round_id: int) -> Round:
        row = conn.execute("SELECT * FROM rounds WHERE id = ?", (round_id,)).fetchone()
        if not row:
            raise APIError(404, "Round not found")
        return Round.from_row(row)

    def _fetch_participant(self, conn: sqlite3.Connection, participant_id: int) -> Participant:
        row = conn.execute("SELECT * FROM participants WHERE id = ?", (participant_id,)).fetchone()
        if not row:
            raise APIError(404, "Participant not found")
        return Participant.from_row(row)

    def _select_question(self, conn: sqlite3.Connection, game_id: int, explicit_question_id: int | None) -> Question:
        if explicit_question_id is not None:
            row = conn.execute("SELECT * FROM questions WHERE id = ?", (explicit_question_id,)).fetchone()
            if not row:
                raise APIError(404, "Question not found")
            return Question.from_row(row)

        used_ids = [row[0] for row in conn.execute("SELECT question_id FROM rounds WHERE game_id = ?", (game_id,))]
        placeholder = ""
        params: Iterable[Any] = ()
        if used_ids:
            placeholder = " AND id NOT IN ({})".format(",".join("?" for _ in used_ids))
            params = tuple(used_ids)
        query = f"SELECT * FROM questions WHERE 1=1{placeholder} ORDER BY RANDOM() LIMIT 1"
        row = conn.execute(query, params).fetchone()
        if not row:
            raise APIError(409, "No unused questions remain")
        return Question.from_row(row)

    def get_game(self, game_id: int, connection: sqlite3.Connection | None = None) -> Game:
        return self._run(lambda conn: self._fetch_game(conn, game_id), connection)

    def get_leaderboard(self, game_id: int, connection: sqlite3.Connection | None = None) -> List[Dict[str, int | str]]:
        return self._run(lambda conn: build_leaderboard(conn, game_id), connection)

    # ------------------------------------------------------------------
    # REST-like endpoints
    # ------------------------------------------------------------------

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

    def create_game(self, payload: GameCreate, connection: sqlite3.Connection | None = None) -> Game:
        def handler(conn: sqlite3.Connection) -> Game:
            self._fetch_user(conn, payload.host_id)
            now = self._now()
            cursor = conn.execute(
                "INSERT INTO games (title, host_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (payload.title, payload.host_id, "active", now, now),
            )
            game_id = cursor.lastrowid
            conn.execute(
                "INSERT OR IGNORE INTO participants (game_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (game_id, payload.host_id, now, now),
            )
            row = conn.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
            return Game.from_row(row)

        return self._run(handler, connection)

    def create_round(
        self, game_id: int, payload: RoundCreate, connection: sqlite3.Connection | None = None
    ) -> Round:
        def handler(conn: sqlite3.Connection) -> Round:
            game = self._fetch_game(conn, game_id)
            question = self._select_question(conn, game.id, payload.question_id)
            now = self._now()
            cursor = conn.execute(
                """
                INSERT INTO rounds (game_id, question_id, status, started_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (game.id, question.id, "active", now, now, now),
            )
            round_id = cursor.lastrowid
            row = conn.execute("SELECT * FROM rounds WHERE id = ?", (round_id,)).fetchone()
            return Round.from_row(row)

        return self._run(handler, connection)

    def submit_response(
        self, round_id: int, payload: ResponseCreate, connection: sqlite3.Connection | None = None
    ) -> Response:
        def handler(conn: sqlite3.Connection) -> Response:
            round_obj = self._fetch_round(conn, round_id)
            if round_obj.status != "active":
                raise APIError(409, "Round is not accepting responses")
            participant = self._fetch_participant(conn, payload.participant_id)
            if participant.game_id != round_obj.game_id:
                raise APIError(404, "Participant not in round's game")
            now = self._now()
            existing = conn.execute(
                "SELECT id FROM responses WHERE round_id = ? AND participant_id = ?",
                (round_obj.id, participant.id),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE responses SET answer = ?, updated_at = ? WHERE id = ?",
                    (payload.answer, now, existing["id"]),
                )
                response_id = existing["id"]
            else:
                cursor = conn.execute(
                    """
                    INSERT INTO responses (round_id, participant_id, answer, points, created_at, updated_at)
                    VALUES (?, ?, ?, 0, ?, ?)
                    """,
                    (round_obj.id, participant.id, payload.answer, now, now),
                )
                response_id = cursor.lastrowid
            row = conn.execute("SELECT * FROM responses WHERE id = ?", (response_id,)).fetchone()
            return Response.from_row(row)

        return self._run(handler, connection)

    def close_round(self, round_id: int, connection: sqlite3.Connection | None = None) -> CloseRoundResult:
        def handler(conn: sqlite3.Connection) -> CloseRoundResult:
            round_obj = self._fetch_round(conn, round_id)
            if round_obj.status != "active":
                raise APIError(409, "Round already closed")
            result = self.scorer.score_round(conn, round_obj.id)
            now = self._now()
            conn.execute(
                "UPDATE rounds SET status = ?, ended_at = ?, updated_at = ? WHERE id = ?",
                ("closed", now, now, round_obj.id),
            )
            leaderboard = build_leaderboard(conn, round_obj.game_id)
            return CloseRoundResult(
                round_id=round_obj.id,
                majority_answer=result.majority_answer,
                is_tie=result.is_tie,
                awarded_participant_ids=result.awarded_participant_ids,
                leaderboard=leaderboard,
            )

        return self._run(handler, connection)


# ----------------------------------------------------------------------
# Minimal GraphQL façade
# ----------------------------------------------------------------------


@dataclass
class GraphQLResult:
    data: Dict[str, Any] | None
    errors: List[str] | None = None


class GamesGraphQLSchema:
    """A deliberately tiny GraphQL-like executor for leaderboard lookups."""

    def __init__(self, api: GamesAPI | None = None) -> None:
        self.api = api or GamesAPI()

    def execute_sync(
        self,
        query: str,
        variable_values: Dict[str, Any] | None = None,
        context_value: Dict[str, Any] | None = None,
    ) -> GraphQLResult:
        variables = variable_values or {}
        game_id = variables.get("id") or variables.get("gameId")
        if game_id is None:
            return GraphQLResult(data=None, errors=["gameId variable is required"])

        connection = context_value.get("connection") if context_value else None
        try:
            game = self.api.get_game(game_id, connection=connection)
            leaderboard = self.api.get_leaderboard(game.id, connection=connection)
        except APIError as exc:
            return GraphQLResult(data={"game": None}, errors=[exc.detail])

        data = {
            "game": {
                "id": game.id,
                "title": game.title,
                "status": game.status,
                "leaderboard": leaderboard,
            }
        }
        return GraphQLResult(data=data, errors=None)


schema = GamesGraphQLSchema()
