import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { GameSettings, PayoutStructure } from '../types/game'

interface CreateGameProps {
  onCreate: (settings: GameSettings) => void
}

const payoutStructures: Array<{ value: PayoutStructure; label: string; description: string }> = [
  {
    value: 'winner-takes-all',
    label: 'Winner takes all',
    description: 'Single champion receives 100% of the pool.',
  },
  {
    value: 'top-three',
    label: 'Top three',
    description: '50/30/20 payout split for the podium.',
  },
  {
    value: 'fifty-fifty',
    label: '50 / 50 teams',
    description: 'Even split between the winning side.',
  },
]

const currencyOptions = ['USD', 'EUR', 'GBP', 'CAD']

const defaultValues: GameSettings = {
  title: 'Weekend Showdown',
  maxPlayers: 12,
  entryFee: 20,
  prizePool: 200,
  bonusPrize: 0,
  prizeCurrency: 'USD',
  payoutStructure: 'top-three',
  payoutWindowHours: 24,
  requiresKyc: true,
  payoutStatus: 'pending',
}

const CreateGame = ({ onCreate }: CreateGameProps) => {
  const [values, setValues] = useState<GameSettings>(defaultValues)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const totalPrize = useMemo(() => values.prizePool + (values.bonusPrize || 0), [values])

  const setField = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!values.title.trim()) {
      nextErrors.title = 'Game title is required'
    }

    if (values.maxPlayers < 2) {
      nextErrors.maxPlayers = 'At least two players are required'
    }

    if (values.entryFee < 0) {
      nextErrors.entryFee = 'Entry fee cannot be negative'
    }

    if (values.prizePool <= 0) {
      nextErrors.prizePool = 'Prize pool must be greater than zero'
    }

    if (values.bonusPrize < 0) {
      nextErrors.bonusPrize = 'Bonus prize cannot be negative'
    }

    if (values.entryFee > values.prizePool) {
      nextErrors.entryFee = 'Entry fee cannot be greater than prize pool'
    }

    if (values.payoutWindowHours < 1) {
      nextErrors.payoutWindowHours = 'Payout window must be at least one hour'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) {
      return
    }
    onCreate({ ...values, payoutStatus: 'pending' })
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit} noValidate>
      <h2>Create a new match</h2>
      <p className="helper-text">Configure entry fee, prize pool and payout expectations before inviting players.</p>

      <div className="field-group">
        <label htmlFor="title">Game title</label>
        <input
          id="title"
          name="title"
          value={values.title}
          onChange={(event) => setField('title', event.target.value)}
          placeholder="Opinionated Arena"
        />
        {errors.title && <span className="error">{errors.title}</span>}
      </div>

      <div className="field-grid">
        <div className="field-group">
          <label htmlFor="maxPlayers">Max players</label>
          <input
            id="maxPlayers"
            type="number"
            min={2}
            value={values.maxPlayers}
            onChange={(event) => setField('maxPlayers', Number(event.target.value))}
          />
          {errors.maxPlayers && <span className="error">{errors.maxPlayers}</span>}
        </div>
        <div className="field-group">
          <label htmlFor="entryFee">Entry fee ({values.prizeCurrency})</label>
          <input
            id="entryFee"
            type="number"
            min={0}
            step={1}
            value={values.entryFee}
            onChange={(event) => setField('entryFee', Number(event.target.value))}
          />
          {errors.entryFee && <span className="error">{errors.entryFee}</span>}
        </div>
        <div className="field-group">
          <label htmlFor="prizePool">Prize pool ({values.prizeCurrency})</label>
          <input
            id="prizePool"
            type="number"
            min={1}
            step={1}
            value={values.prizePool}
            onChange={(event) => setField('prizePool', Number(event.target.value))}
          />
          {errors.prizePool && <span className="error">{errors.prizePool}</span>}
        </div>
      </div>

      <div className="field-grid">
        <div className="field-group">
          <label htmlFor="bonusPrize">Bonus prize ({values.prizeCurrency})</label>
          <input
            id="bonusPrize"
            type="number"
            min={0}
            value={values.bonusPrize}
            onChange={(event) => setField('bonusPrize', Number(event.target.value))}
          />
          {errors.bonusPrize && <span className="error">{errors.bonusPrize}</span>}
        </div>
        <div className="field-group">
          <label htmlFor="currency">Currency</label>
          <select id="currency" value={values.prizeCurrency} onChange={(event) => setField('prizeCurrency', event.target.value)}>
            {currencyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="payoutWindowHours">Payout window (hours)</label>
          <input
            id="payoutWindowHours"
            type="number"
            min={1}
            value={values.payoutWindowHours}
            onChange={(event) => setField('payoutWindowHours', Number(event.target.value))}
          />
          {errors.payoutWindowHours && <span className="error">{errors.payoutWindowHours}</span>}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="payoutStructure">Payout structure</label>
        <select
          id="payoutStructure"
          value={values.payoutStructure}
          onChange={(event) => setField('payoutStructure', event.target.value as PayoutStructure)}
        >
          {payoutStructures.map((structure) => (
            <option key={structure.value} value={structure.value}>
              {structure.label}
            </option>
          ))}
        </select>
        <small className="helper-text">
          {payoutStructures.find((structure) => structure.value === values.payoutStructure)?.description}
        </small>
      </div>

      <div className="toggle-row">
        <label htmlFor="requiresKyc">Require KYC for payouts</label>
        <input
          id="requiresKyc"
          type="checkbox"
          checked={values.requiresKyc}
          onChange={(event) => setField('requiresKyc', event.target.checked)}
        />
      </div>

      <section className="summary-card">
        <div>
          <p className="summary-label">Potential payout</p>
          <p className="summary-value">
            {values.prizeCurrency} {totalPrize.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="summary-label">Payout SLA</p>
          <p className="summary-value">{values.payoutWindowHours} hours</p>
        </div>
        <div>
          <p className="summary-label">Compliance</p>
          <p className="summary-value">{values.requiresKyc ? 'KYC required' : 'KYC optional'}</p>
        </div>
      </section>

      <button type="submit" className="primary-button">
        Launch lobby
      </button>
    </form>
  )
}

export default CreateGame
