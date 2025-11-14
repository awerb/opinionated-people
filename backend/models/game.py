from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

PayoutStructure = Literal['winner-takes-all', 'top-three', 'fifty-fifty']
PayoutStatus = Literal['pending', 'processing', 'paid']


def _require_positive(value: float, label: str) -> None:
  if value < 0:
    raise ValueError(f"{label} must be positive, received {value}")


@dataclass(slots=True)
class PrizeConfig:
  entry_fee: float
  prize_pool: float
  bonus_prize: float
  prize_currency: str
  payout_structure: PayoutStructure
  payout_window_hours: int
  requires_kyc: bool = True
  payout_status: PayoutStatus = 'pending'

  def validate(self) -> None:
    _require_positive(self.entry_fee, 'Entry fee')
    if self.prize_pool <= 0:
      raise ValueError('Prize pool must be greater than zero')
    _require_positive(self.bonus_prize, 'Bonus prize')
    if self.entry_fee > self.prize_pool:
      raise ValueError('Entry fee cannot exceed prize pool')
    if self.payout_window_hours < 1:
      raise ValueError('Payout window must be at least one hour')
    if not self.prize_currency:
      raise ValueError('Prize currency is required')


@dataclass(slots=True)
class Game:
  title: str
  max_players: int
  prize: PrizeConfig

  def validate(self) -> None:
    if not self.title:
      raise ValueError('Game title is required')
    if self.max_players < 2:
      raise ValueError('At least two players are required')
    self.prize.validate()

  @property
  def total_prize(self) -> float:
    return self.prize.prize_pool + self.prize.bonus_prize

  def to_dict(self) -> dict[str, object]:
    return {
      'title': self.title,
      'maxPlayers': self.max_players,
      'prize': {
        'entryFee': self.prize.entry_fee,
        'prizePool': self.prize.prize_pool,
        'bonusPrize': self.prize.bonus_prize,
        'prizeCurrency': self.prize.prize_currency,
        'payoutStructure': self.prize.payout_structure,
        'payoutWindowHours': self.prize.payout_window_hours,
        'requiresKyc': self.prize.requires_kyc,
        'payoutStatus': self.prize.payout_status,
      },
      'totalPrize': self.total_prize,
    }
