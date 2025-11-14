from __future__ import annotations

import sqlite3
from dataclasses import asdict

import pytest

from backend.api import GameCreate, GamesAPI, GraphQLResult, ResponseCreate, RoundCreate, schema
from backend.models import run_migrations


@pytest.fixture
def connection():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    run_migrations(conn, drop_existing=True)
    yield conn
    conn.close()


@pytest.fixture
def api() -> GamesAPI:
    return GamesAPI()


def _insert_user(conn: sqlite3.Connection, email: str, name: str) -> int:
    cursor = conn.execute(
        "INSERT INTO users (email, display_name, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        (email, name),
    )
    conn.commit()
    return cursor.lastrowid


def _insert_question(conn: sqlite3.Connection, prompt: str, category: str) -> int:
    cursor = conn.execute(
        "INSERT INTO questions (prompt, category, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        (prompt, category),
    )
    conn.commit()
    return cursor.lastrowid


def _add_participant(conn: sqlite3.Connection, game_id: int, user_id: int) -> int:
    cursor = conn.execute(
        "INSERT INTO participants (game_id, user_id, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        (game_id, user_id),
    )
    conn.commit()
    return cursor.lastrowid


def test_round_lifecycle_and_scoring(api: GamesAPI, connection: sqlite3.Connection):
    host_id = _insert_user(connection, "host@example.com", "Host")
    alice_id = _insert_user(connection, "alice@example.com", "Alice")
    bob_id = _insert_user(connection, "bob@example.com", "Bob")
    q1_id = _insert_question(connection, "Is pineapple acceptable on pizza?", "food")
    q2_id = _insert_question(connection, "Cats or dogs?", "pets")

    game = api.create_game(GameCreate(title="Friday Night Opinions", host_id=host_id), connection=connection)
    alice_participant = _add_participant(connection, game.id, alice_id)
    bob_participant = _add_participant(connection, game.id, bob_id)
    host_participant = connection.execute(
        "SELECT id FROM participants WHERE game_id = ? AND user_id = ?",
        (game.id, host_id),
    ).fetchone()["id"]

    round1 = api.create_round(game.id, RoundCreate(question_id=q1_id), connection=connection)

    api.submit_response(round1.id, ResponseCreate(participant_id=host_participant, answer="Absolutely"), connection=connection)
    api.submit_response(round1.id, ResponseCreate(participant_id=alice_participant, answer="Absolutely"), connection=connection)
    api.submit_response(round1.id, ResponseCreate(participant_id=bob_participant, answer="Never"), connection=connection)

    close_payload = api.close_round(round1.id, connection=connection)
    assert close_payload.majority_answer.lower() == "absolutely"
    assert close_payload.is_tie is False
    assert set(close_payload.awarded_participant_ids) == {host_participant, alice_participant}
    assert close_payload.leaderboard[0]["points"] == 2

    round1_points = {
        row["participant_id"]: row["points"]
        for row in connection.execute("SELECT participant_id, points FROM responses WHERE round_id = ?", (round1.id,))
    }
    assert round1_points[host_participant] == 2
    assert round1_points[alice_participant] == 2
    assert round1_points[bob_participant] == 0

    # Second round yields a tie.
    round2 = api.create_round(game.id, RoundCreate(question_id=q2_id), connection=connection)
    api.submit_response(round2.id, ResponseCreate(participant_id=host_participant, answer="Cats"), connection=connection)
    api.submit_response(round2.id, ResponseCreate(participant_id=alice_participant, answer="Dogs"), connection=connection)
    api.submit_response(round2.id, ResponseCreate(participant_id=bob_participant, answer="Birds"), connection=connection)

    tie_payload = api.close_round(round2.id, connection=connection)
    assert tie_payload.is_tie is True
    assert tie_payload.majority_answer is None
    assert tie_payload.awarded_participant_ids == []
    assert tie_payload.leaderboard == close_payload.leaderboard

    graphql_result: GraphQLResult = schema.execute_sync(
        "query GetGame($id: Int!) { game(gameId: $id) { id title status leaderboard { participantId displayName points } } }",
        variable_values={"id": game.id},
        context_value={"connection": connection},
    )
    assert graphql_result.errors is None
    assert graphql_result.data["game"]["leaderboard"][0]["points"] == 2
