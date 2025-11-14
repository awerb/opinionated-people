from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

EventType = Literal['deposit', 'payout']


@dataclass(slots=True)
class AuditEvent:
  event_type: EventType
  reference: str
  actor: str
  amount: float
  currency: str
  status: str
  metadata: dict[str, object] = field(default_factory=dict)
  occurred_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AuditLogger:
  """Append-only audit log for finance operations."""

  def __init__(self, path: str | Path | None = None) -> None:
    self.path = Path(path or Path('backend/logs/financial_audit.log'))
    self.path.parent.mkdir(parents=True, exist_ok=True)

  def log_transaction(self, event: AuditEvent) -> None:
    payload = asdict(event)
    with self.path.open('a', encoding='utf-8') as handle:
      handle.write(json.dumps(payload) + '\n')

  def log(self, **kwargs: object) -> None:
    event = AuditEvent(**kwargs)  # type: ignore[arg-type]
    self.log_transaction(event)
