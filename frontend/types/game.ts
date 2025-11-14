export type PayoutStructure = 'winner-takes-all' | 'top-three' | 'fifty-fifty'
export type PayoutStatus = 'pending' | 'processing' | 'paid'

export interface PrizeConfig {
  entryFee: number
  prizePool: number
  bonusPrize: number
  prizeCurrency: string
  payoutStructure: PayoutStructure
  payoutWindowHours: number
  requiresKyc: boolean
  payoutStatus: PayoutStatus
}

export interface GameSettings extends PrizeConfig {
  title: string
  maxPlayers: number
}
