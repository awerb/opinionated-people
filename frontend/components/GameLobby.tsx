import type { GameSettings, PayoutStatus } from '../types/game'

interface GameLobbyProps {
  game: GameSettings
  onLaunch: () => void
  onPayoutStatusChange: (status: PayoutStatus) => void
}

const payoutStatusLabels: Record<PayoutStatus, string> = {
  pending: 'Awaiting payout approval',
  processing: 'Payout processing',
  paid: 'Payout completed',
}

const GameLobby = ({ game, onLaunch, onPayoutStatusChange }: GameLobbyProps) => {
  const statuses: PayoutStatus[] = ['pending', 'processing', 'paid']

  return (
    <section className="card lobby-card">
      <header className="card-header">
        <div>
          <p className="eyebrow">Lobby ready</p>
          <h2>{game.title}</h2>
          <p className="helper-text">Invite players and collect entries. Prize details update live for all participants.</p>
        </div>
        <div className="pill">{game.maxPlayers} player capacity</div>
      </header>

      <div className="prize-summary">
        <div>
          <p className="summary-label">Prize pool</p>
          <p className="summary-value">
            {game.prizeCurrency} {(game.prizePool + game.bonusPrize).toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="summary-label">Entry fee</p>
          <p className="summary-value">
            {game.prizeCurrency} {game.entryFee.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="summary-label">Payout structure</p>
          <p className="summary-value">{game.payoutStructure.replace(/-/g, ' ')}</p>
        </div>
        <div>
          <p className="summary-label">Payout window</p>
          <p className="summary-value">{game.payoutWindowHours} hours</p>
        </div>
      </div>

      <section className="status-panel">
        <p className="eyebrow">Payout status</p>
        <h3>{payoutStatusLabels[game.payoutStatus]}</h3>
        <div className="status-buttons">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              className={`chip ${status === game.payoutStatus ? 'chip-active' : ''}`}
              onClick={() => onPayoutStatusChange(status)}
              aria-pressed={status === game.payoutStatus}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      <div className="actions">
        <button type="button" className="secondary-button" onClick={onLaunch}>
          Simulate winners
        </button>
      </div>
    </section>
  )
}

export default GameLobby
