import type { GameSettings } from '../types/game'

interface WinnerScreenProps {
  game: GameSettings
  winners: string[]
  onReset: () => void
}

const WinnerScreen = ({ game, winners, onReset }: WinnerScreenProps) => (
  <section className="card winner-card">
    <header className="card-header">
      <div>
        <p className="eyebrow">Final standings</p>
        <h2>Congratulations to our winners!</h2>
        <p className="helper-text">Share this screen in the stream to prove payouts are in motion.</p>
      </div>
      <div className={`pill pill-${game.payoutStatus}`}>{game.payoutStatus}</div>
    </header>

    <div className="prize-summary">
      <div>
        <p className="summary-label">Total payout</p>
        <p className="summary-value">
          {game.prizeCurrency} {(game.prizePool + game.bonusPrize).toLocaleString(undefined, { minimumFractionDigits: 0 })}
        </p>
      </div>
      <div>
        <p className="summary-label">Payout structure</p>
        <p className="summary-value">{game.payoutStructure.replace(/-/g, ' ')}</p>
      </div>
      <div>
        <p className="summary-label">Payout window</p>
        <p className="summary-value">{game.payoutWindowHours}h SLA</p>
      </div>
    </div>

    <ol className="winners-list">
      {winners.map((winner, index) => (
        <li key={winner}>
          <span className="position">#{index + 1}</span>
          <span className="name">{winner}</span>
        </li>
      ))}
    </ol>

    <div className="actions">
      <button type="button" className="primary-button" onClick={onReset}>
        Configure another game
      </button>
    </div>
  </section>
)

export default WinnerScreen
