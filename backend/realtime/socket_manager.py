"""Minimal WebSocket manager that exposes semantic broadcast helpers."""
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, Dict, Iterable

from fastapi import WebSocket


class SocketManager:
    """Tracks websocket connections and emits opinionated events."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, room: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[room].add(websocket)

    async def disconnect(self, room: str, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self._connections.get(room, set()):
                self._connections[room].remove(websocket)
            if not self._connections.get(room):
                self._connections.pop(room, None)

    async def broadcast_question_start(
        self,
        room: str,
        *,
        question_id: str,
        duration: int,
        players: Iterable[str],
        round_id: str,
    ) -> None:
        payload = {
            "event": "question:start",
            "roundId": round_id,
            "questionId": question_id,
            "duration": duration,
            "players": list(players),
        }
        await self._emit(room, payload)

    async def broadcast_countdown(self, room: str, *, round_id: str, remaining: int) -> None:
        payload = {"event": "question:countdown", "roundId": round_id, "remaining": remaining}
        await self._emit(room, payload)

    async def broadcast_round_results(
        self,
        room: str,
        *,
        round_id: str,
        question_id: str,
        results: Iterable[Dict[str, Any]],
    ) -> None:
        payload = {
            "event": "round:results",
            "roundId": round_id,
            "questionId": question_id,
            "results": list(results),
        }
        await self._emit(room, payload)

    async def _emit(self, room: str, payload: Dict[str, Any]) -> None:
        targets = list(self._connections.get(room, set()))
        await asyncio.gather(*[self._send(websocket, payload) for websocket in targets], return_exceptions=True)

    async def _send(self, websocket: WebSocket, payload: Dict[str, Any]) -> None:
        await websocket.send_json(payload)


__all__ = ["SocketManager"]
