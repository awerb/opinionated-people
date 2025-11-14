import { useMemo, useState } from 'react'
import CreateGame from '../frontend/pages/CreateGame'
import GameLobby from '../frontend/components/GameLobby'
import WinnerScreen from '../frontend/components/WinnerScreen'
import type { GameSettings, PayoutStatus } from '../frontend/types/game'
import './App.css'

type View = 'create' | 'lobby' | 'winner'

const mockNames = ['Nova', 'Drift', 'Echo', 'Atlas', 'Reign', 'Vega', 'Blitz', 'Rook', 'Lyric', 'Crux']

function App() {
  const [view, setView] = useState<View>('create')
  const [game, setGame] = useState<GameSettings | null>(null)
  const [winners, setWinners] = useState<string[]>([])

  const handleCreate = (settings: GameSettings) => {
    setGame(settings)
    setView('lobby')
    setWinners([])
  }

  const handleLaunch = () => {
    if (!game) return
    const topWinners = [...mockNames]
      .sort(() => Math.random() - 0.5)
      .slice(0, game.payoutStructure === 'top-three' ? 3 : 2)
    setWinners(topWinners)
    setView('winner')
  }

  const handleReset = () => {
    setGame(null)
    setView('create')
    setWinners([])
  }

  const handlePayoutStatusChange = (status: PayoutStatus) => {
    setGame((prev) => (prev ? { ...prev, payoutStatus: status } : prev))
  }

  const subtitle = useMemo(() => {
    if (!game) {
      return 'Create tournaments with transparent prize expectations.'
    }
    return `${game.prizeCurrency} ${(game.prizePool + game.bonusPrize).toLocaleString()} prize live.`
  }, [game])

  return (
    <div className="app-shell">
      <header className="page-header">
        <h1>Opinionated People</h1>
        <p>{subtitle}</p>
      </header>

      {view === 'create' && <CreateGame onCreate={handleCreate} />}
      {view === 'lobby' && game && (
        <GameLobby game={game} onLaunch={handleLaunch} onPayoutStatusChange={handlePayoutStatusChange} />
      )}
      {view === 'winner' && game && <WinnerScreen game={game} winners={winners} onReset={handleReset} />}
    </div>
  )
}

export default App
