"""Majority vote scoring utilities built directly on SQLite."""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Dict, List

import sqlite3


@dataclass
class MajorityVoteResult:
    round_id: int
    majority_answer: str | None
    awarded_participant_ids: List[int]
    is_tie: bool


class MajorityVoteScorer:
    def __init__(self, majority_points: int = 2) -> None:
        self.majority_points = majority_points

    def score_round(self, connection: sqlite3.Connection, round_id: int) -> MajorityVoteResult:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT id, participant_id, answer FROM responses WHERE round_id = ?",
            (round_id,),
        )
        responses = cursor.fetchall()
        if not responses:
            raise ValueError("Cannot score a round without responses.")

        normalized_answers = Counter(row["answer"].strip().lower() for row in responses)
        most_common = normalized_answers.most_common()
        top_count = most_common[0][1]
        leaders = [answer for answer, count in most_common if count == top_count]
        is_tie = len(leaders) > 1
        normalized_majority = None if is_tie else leaders[0]

        awarded: List[int] = []
        for row in responses:
            normalized = row["answer"].strip().lower()
            points = self.majority_points if (normalized_majority and normalized == normalized_majority) else 0
            cursor.execute("UPDATE responses SET points = ? WHERE id = ?", (points, row["id"]))
            if points:
                awarded.append(row["participant_id"])

        majority_answer = None
        if normalized_majority is not None:
            for row in responses:
                if row["answer"].strip().lower() == normalized_majority:
                    majority_answer = row["answer"]
                    break

        return MajorityVoteResult(
            round_id=round_id,
            majority_answer=majority_answer,
            awarded_participant_ids=awarded,
            is_tie=is_tie,
        )


def build_leaderboard(connection: sqlite3.Connection, game_id: int) -> List[Dict[str, int | str]]:
    cursor = connection.cursor()
    cursor.execute(
        """
        SELECT participants.id AS participant_id,
               users.display_name AS display_name,
               COALESCE(SUM(responses.points), 0) AS points
        FROM participants
        JOIN users ON users.id = participants.user_id
        LEFT JOIN responses ON responses.participant_id = participants.id
        WHERE participants.game_id = ?
        GROUP BY participants.id
        ORDER BY points DESC, participants.id ASC
        """,
        (game_id,),
    )
    rows = cursor.fetchall()
    return [dict(row) for row in rows]
