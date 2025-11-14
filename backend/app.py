"""ASGI entrypoint that exposes websocket + health endpoints."""
from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from backend.realtime.socket_manager import SocketManager
from backend.services.timer import RoundTimer

socket_manager = SocketManager()
timer = RoundTimer(socket_manager)

app = FastAPI()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str) -> None:
    await socket_manager.connect(room_id, websocket)
    try:
        while True:
            payload = await websocket.receive_json()
            message_type = payload.get("type")
            if message_type == "start_round":
                await timer.start_round(
                    payload["roundId"],
                    room=room_id,
                    question_id=payload.get("questionId", "question"),
                    duration=int(payload.get("duration", 30)),
                    players=payload.get("players", [player_id]),
                    options=payload.get("options"),
                )
            elif message_type == "submit_answer":
                await timer.submit_player_answer(payload["roundId"], player_id, payload.get("answer", ""))
    except WebSocketDisconnect:
        await socket_manager.disconnect(room_id, websocket)
