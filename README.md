# Opinionated People – facilitation sandbox

This repo hosts a React + TypeScript single-page experience that lets you simulate an "Opinionated People" debate: add players, run timed rounds, surface ties, track invites, and progress through a lightweight championship bracket. It also includes:

- **Live telemetry** hooks that log simulated WebSocket lifecycle events and scoring latency.
- **End-to-end coverage** powered by Playwright so critical flows stay reliable.
- **Load scripts** to fan out between 10 and 100 virtual participants for quick stress signals.

## Getting started

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to interact with the lobby, timer, scoreboard, invites, and telemetry feed.

## End-to-end (Playwright) tests

| Scenario | Coverage |
| --- | --- |
| Minimum players | Validates that rounds cannot start until three players join. |
| Tie cases | Drives scoring buttons until multiple leaders share the top score and confirms the UI tie callouts. |
| Timer expiry | Confirms the five-second round timer flips into the "Timer expired" recovery copy. |
| Invites | Sends and accepts invites to ensure lifecycle state is persisted. |
| Championship flow | Advances through qualifiers → semifinals → finals while confirming the champion callout once the bracket locks. |

Run the suite (browsers installed via `npx playwright install --with-deps`):

```bash
npm run test:e2e
```

## Load simulation (`tests/load`)

`tests/load/playerLoadTest.js` emits in-process WebSocket-style events so you can gauge how quickly simulated players progress from handshake to scoring. Pass any number between 10 and 100 to size the lobby:

```bash
# Default 10 players
npm run test:load

# Spike to 80 parallel participants
npm run test:load 80
```

Example output:

```json
{
  "playersSimulated": 80,
  "durationMs": 933,
  "averageScoreLatencyMs": 122.33
}
```

## Monitoring + logging

- `src/utils/telemetry.ts` centralizes log formatting for WebSocket-style events and latency snapshots.
- The UI keeps the latest 25 events visible under **Live Telemetry** so operators can reason about player joins, invite states, timer expiration, and scoring delays in real time.
- Scoring buttons compute the delta between the round start timestamp and the moment points are applied; those values stream into the telemetry list so latency regressions are obvious.

## Recovery behaviors

| Failure mode | Behavior |
| --- | --- |
| **Creator drop-off** | Championship progression is host-agnostic: stages remain in the UI, timers reset to idle, and any facilitator can resume rounds because all lobby state is stored locally in React. Invitees that were marked as accepted stay visible so another facilitator can re-seat them. |
| **Network interruptions** | If a connection breaks mid-round, the five-second timer snaps back to `Timer idle` and telemetry logs a `timer-expired` event. When the network stabilizes, pressing **Start Round** rehydrates `roundStartTime`, ensuring new latency metrics ignore the prior failure window. Invites and score tallies are client-side, so transient drops do not wipe the lobby. |

## Useful npm scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Launches Vite locally. |
| `npm run build` | Type-checks and bundles the SPA. |
| `npm run preview` | Serves the production build. |
| `npm run test:e2e` | Executes Playwright against the running dev server. |
| `npm run test:load [count]` | Simulates `count` (10–100) players exchanging WebSocket messages. |
