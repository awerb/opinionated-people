import asyncio
from typing import Any, Dict, List

import pytest

from backend.realtime.socket_manager import SocketManager
from backend.services.timer import RoundTimer


class DummyServer:
    def __init__(self) -> None:
        self.events: List[Dict[str, Any]] = []

    async def emit(self, room: str, payload: Dict[str, Any]) -> None:
        self.events.append({"room": room, "payload": payload})


@pytest.mark.asyncio
async def test_round_timer_broadcasts_and_auto_submits(monkeypatch: pytest.MonkeyPatch) -> None:
    server = DummyServer()
    manager = SocketManager()
    monkeypatch.setattr(manager, "_emit", server.emit)

    submissions: List[Dict[str, Any]] = []

    async def sink(round_id: str, player_id: str, answer: str, is_auto: bool) -> None:
        submissions.append(
            {"roundId": round_id, "playerId": player_id, "answer": answer, "isAuto": is_auto}
        )

    timer = RoundTimer(manager, answer_sink=sink)

    await timer.start_round(
        "round-1",
        room="room-a",
        question_id="question-42",
        duration=2,
        players=["alice", "bob", "carol"],
        options=["A", "B", "C"],
    )

    await asyncio.sleep(0.5)
    await timer.submit_player_answer("round-1", "alice", "B")

    await timer.wait_for_round("round-1")

    countdown_events = [
        event["payload"]["remaining"]
        for event in server.events
        if event["payload"].get("event") == "question:countdown"
    ]
    assert countdown_events == [2, 1]

    result_events = [event for event in server.events if event["payload"].get("event") == "round:results"]
    assert len(result_events) == 1
    results_payload = result_events[0]["payload"]
    assert {result["playerId"] for result in results_payload["results"]} == {"alice", "bob", "carol"}

    auto_submissions = [result for result in results_payload["results"] if result["isAutoSubmitted"]]
    assert len(auto_submissions) == 2
    assert submissions[0]["isAuto"] is False


@pytest.mark.asyncio
async def test_multiple_rounds_do_not_leak_state(monkeypatch: pytest.MonkeyPatch) -> None:
    server = DummyServer()
    manager = SocketManager()
    monkeypatch.setattr(manager, "_emit", server.emit)
    timer = RoundTimer(manager)

    await timer.start_round(
        "round-alpha",
        room="room-alpha",
        question_id="question-a",
        duration=1,
        players=["p1"],
    )
    await timer.wait_for_round("round-alpha")

    await timer.start_round(
        "round-beta",
        room="room-beta",
        question_id="question-b",
        duration=1,
        players=["p2"],
    )
    await timer.wait_for_round("round-beta")

    result_events = [event for event in server.events if event["payload"].get("event") == "round:results"]
    assert len(result_events) == 2
    assert result_events[0]["payload"]["roundId"] == "round-alpha"
    assert result_events[1]["payload"]["roundId"] == "round-beta"
