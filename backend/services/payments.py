from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from uuid import uuid4

from ..models import Game, PrizeConfig
from .audit import AuditEvent, AuditLogger


@dataclass(slots=True)
class DepositRequest:
  player_id: str
  amount: float
  currency: str
  game_id: str


@dataclass(slots=True)
class DepositResponse:
  success: bool
  provider_reference: str
  message: str


@dataclass(slots=True)
class PayoutRequest:
  winner_id: str
  amount: float
  currency: str
  game_id: str


@dataclass(slots=True)
class PayoutResponse:
  success: bool
  provider_reference: str
  status: str


class PaymentProviderSDK:
  """Stub implementation of a provider integration."""

  def __init__(self, provider_name: str = 'MockPay', audit_logger: Optional[AuditLogger] = None) -> None:
    self.provider_name = provider_name
    self.audit_logger = audit_logger or AuditLogger()

  def deposit(self, request: DepositRequest) -> DepositResponse:
    reference = f'dep_{uuid4().hex}'
    self.audit_logger.log_transaction(
      AuditEvent(
        event_type='deposit',
        reference=reference,
        actor=request.player_id,
        amount=request.amount,
        currency=request.currency,
        status='authorized',
        metadata={'game_id': request.game_id, 'provider': self.provider_name},
      )
    )
    return DepositResponse(success=True, provider_reference=reference, message='Deposit authorized')

  def payout(self, request: PayoutRequest) -> PayoutResponse:
    reference = f'pay_{uuid4().hex}'
    status = 'queued'
    self.audit_logger.log_transaction(
      AuditEvent(
        event_type='payout',
        reference=reference,
        actor=request.winner_id,
        amount=request.amount,
        currency=request.currency,
        status=status,
        metadata={'game_id': request.game_id, 'provider': self.provider_name},
      )
    )
    return PayoutResponse(success=True, provider_reference=reference, status=status)


class PaymentService:
  """High level orchestration around deposit and payout stubs."""

  def __init__(self, provider: Optional[PaymentProviderSDK] = None) -> None:
    self.provider = provider or PaymentProviderSDK()

  def collect_entry_fee(self, player_id: str, game: Game) -> DepositResponse:
    game.validate()
    request = DepositRequest(player_id=player_id, amount=game.prize.entry_fee, currency=game.prize.prize_currency, game_id=game.title)
    return self.provider.deposit(request)

  def issue_payout(self, winner_id: str, amount: float, game: Game) -> PayoutResponse:
    if amount > game.total_prize:
      raise ValueError('Payout amount cannot exceed the total prize pool')
    request = PayoutRequest(winner_id=winner_id, amount=amount, currency=game.prize.prize_currency, game_id=game.title)
    return self.provider.payout(request)

  def configure_prize(self, prize: PrizeConfig) -> PrizeConfig:
    prize.validate()
    return prize
