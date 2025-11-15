# Opinionated People

A lightweight React + TypeScript prototype that explores an interactive "Opinionated People" game loop. The current build renders a centered landing screen with a **Start Game** button and provides the scaffolding for expanding into richer gameplay while allowing QA to validate the UI shell early.

## Prerequisites
- **Node.js**: 18.18.0 or 20.9.0 and newer (matches Vite 7.x engine requirements)
- **npm**: 9.x or 10.x (ships with the supported Node LTS releases)

Verify your versions with `node -v` and `npm -v` before installing dependencies.

## Project setup
1. Install packages:
   ```bash
   npm install
   ```
2. Start the development server with hot module reloading:
   ```bash
   npm run dev
   ```
3. Create a production build (runs TypeScript project references and bundles with Vite):
   ```bash
   npm run build
   ```
4. Preview the production build locally:
   ```bash
   npm run preview
   ```

> The Vite dev server and preview server both default to [http://localhost:5173](http://localhost:5173). Pass `--host` or `--port` flags if you need to bind to a different interface.

## How to play / test
1. Launch the dev server (`npm run dev`) and open the app in your browser.
2. You should see a full-height page with the "Opinionated People" title, a "Prototype build" subtitle, and a single **Start Game** button centered on the screen.
3. Click **Start Game**:
   - The browser console should immediately log `Start game clicked` (this is currently the primary success signal for QA).
   - No navigation or UI state changes occur yet; the button remains available so you can click multiple times to confirm repeated logs.
4. Inputs available in this milestone:
   - Mouse / touch interaction with the **Start Game** button.
   - Keyboard navigation (tab to the button and press `Enter` or `Space`).
5. Outcomes to verify until the full gameplay UI ships:
   - Ensure the page renders without runtime errors in the console before interaction.
   - Confirm the log message appears exactly once per click or key activation.
   - Validate the layout remains centered at common desktop widths (768–1440px) and that the button remains accessible via keyboard focus.

Document any deviations (missing log, unexpected errors, misaligned layout) so future gameplay work can reproduce the state reliably.

## Troubleshooting
- **Dev server not reachable**: Confirm `npm run dev` reports `Local: http://localhost:5173/`. If another process already uses that port, append `--port 5174` (or similar) to the script: `npm run dev -- --port 5174`.
- **Blank page or runtime errors**: Open the browser devtools console (⌘+Option+J on macOS, Ctrl+Shift+J on Windows/Linux) and capture any stack traces. The `handleStart` logic currently only logs to the console, so any additional errors likely stem from build or dependency issues.
- **Build failures**: Run `npm run build -- --debug` to see verbose Vite output, or `npx tsc --noEmit` to isolate TypeScript diagnostics.
- **Stale dependencies**: Delete `node_modules` and `package-lock.json`, reinstall with `npm install`, and retry the command.
- **Inspecting server logs**: All dev server logs appear directly in the terminal running `npm run dev`. Leave that session open while testing so you can capture warnings (e.g., ESLint hints) alongside browser console logs.

By following these steps, contributors and QA can consistently install, run, and verify the current Opinionated People prototype while we continue iterating on gameplay features.
