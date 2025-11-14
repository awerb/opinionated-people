"""Notification hooks for invites, timers, and results."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Protocol


class PushProvider(Protocol):
    """Simplified push provider interface."""

    def send(self, payload: Dict[str, Any]) -> None:  # pragma: no cover - transport specific
        ...


class EmailProvider(Protocol):
    """Simplified e-mail provider interface."""

    def send(self, *, subject: str, body: str, to: str) -> None:  # pragma: no cover - transport specific
        ...


@dataclass
class NotificationPreference:
    user_id: str
    email: str
    enable_push: bool = True
    enable_email: bool = True


class ConsolePushProvider:
    """Fallback provider that logs to stdout for local development."""

    def send(self, payload: Dict[str, Any]) -> None:  # pragma: no cover - side-effect
        print(f"[push] {payload}")


class ConsoleEmailProvider:
    def send(self, *, subject: str, body: str, to: str) -> None:  # pragma: no cover - side-effect
        print(f"[email to={to}] {subject}: {body}")


class NotificationService:
    """Dispatches push and e-mail notifications for key lifecycle events."""

    def __init__(
        self,
        *,
        push_provider: PushProvider | None = None,
        email_provider: EmailProvider | None = None,
    ) -> None:
        self._push = push_provider or ConsolePushProvider()
        self._email = email_provider or ConsoleEmailProvider()

    def invite(self, pref: NotificationPreference, *, opponent: str, topic: str, expires_at: datetime) -> None:
        payload = {
            "type": "invite",
            "opponent": opponent,
            "topic": topic,
            "expires_at": expires_at.isoformat(),
        }
        subject = f"New invite from {opponent}"
        body = f"{opponent} challenged you to '{topic}'. Respond before {expires_at:%H:%M}."
        self._dispatch(pref, payload, subject, body)

    def timer(self, pref: NotificationPreference, *, game_id: str, remaining_seconds: int) -> None:
        payload = {
            "type": "timer",
            "game_id": game_id,
            "remaining_seconds": remaining_seconds,
        }
        subject = "Timer alert"
        body = f"Game {game_id} has {remaining_seconds // 60} minutes left."
        self._dispatch(pref, payload, subject, body)

    def result(self, pref: NotificationPreference, *, game_id: str, verdict: str) -> None:
        payload = {
            "type": "result",
            "game_id": game_id,
            "verdict": verdict,
        }
        subject = f"Debate {game_id} resolved"
        body = f"Final verdict: {verdict}."
        self._dispatch(pref, payload, subject, body)

    def _dispatch(self, pref: NotificationPreference, payload: Dict[str, Any], subject: str, body: str) -> None:
        if pref.enable_push:
            self._push.send({**payload, "user_id": pref.user_id})
        if pref.enable_email and pref.email:
            self._email.send(subject=subject, body=body, to=pref.email)


def invite_hook(pref: NotificationPreference, **kwargs: Any) -> None:
    NotificationService().invite(pref, **kwargs)


def timer_hook(pref: NotificationPreference, **kwargs: Any) -> None:
    NotificationService().timer(pref, **kwargs)


def result_hook(pref: NotificationPreference, **kwargs: Any) -> None:
    NotificationService().result(pref, **kwargs)
