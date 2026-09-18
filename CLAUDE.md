# CLAUDE.md — cosmic-breaker-web

AI working instructions for this repository. Read before editing.

## What this is

Static **Astro 5 + React 19 + Tailwind 4** frontend for a 1v1 trading-card-game
simulator. It compiles to plain HTML/JS (no server adapter) and talks to a Go
backend (`sockets-api-tcg` / tcg-realtime) over **REST + WebSocket**. Auth and
realtime identity come from **Supabase**.

## Commands

```bash
npm run dev        # astro dev — local dev server
npm run build      # astro build — static output to dist/
npm run preview    # serve the built output
npm run check      # astro check — TS + Astro diagnostics (this is the "lint")
npm run test       # vitest run — run tests once
npm run test:watch # vitest — watch mode
```

There is **no ESLint/Prettier/Biome**. `npm run check` is the type/diagnostic
gate. Run `npm run check` and `npm run test` before considering a change done.

## Architecture

Layered, one direction of dependency: `pages → components → hooks → lib`.

```
src/
  pages/           Astro file-based routes (index, lobby, room/, dev/)
  layouts/         Base.astro — master layout, imports global.css
  components/
    ui/            Design-system primitives (Panel, Meter, StatusDot, Wordmark)
    auth/          SignIn, TurnstileField
    lobby/         Lobby
    game/          Game UI (React, mounted client:only); dnd.ts = native DnD payloads
  hooks/
    useSession.ts     Supabase auth + identity
    useGameRoom.ts     REST + WebSocket + game-state engine wiring
    usePrivateDeck.ts  local deck/hand (localStorage)
  lib/
    config.ts        PUBLIC_* env access with fallbacks
    api.ts           REST client for the Go backend
    session.ts       Supabase auth helpers
    navigation.ts    safe routing (anti open-redirect)
    realtime/        client.ts (WS client) + protocol.ts (wire types)
    game/            PURE game engine — types, cards, events, state (reducers)
  styles/global.css  HUD/design-system CSS
```

### Non-negotiable boundaries

- **`lib/game/` is pure.** No React, no I/O, no randomness. State is derived
  deterministically from the event log via `applyEvent` / `reduceAll`. Keep it
  that way — it's what makes the game reproducible and testable.
- **No optimistic updates.** State changes flow from the server event stream.
  Don't mutate game state locally ahead of the server.
- **Private state stays in the browser.** Deck/hand live in `localStorage`
  (`usePrivateDeck`) and must never be sent to the server.
- **Secrets never live here.** Only `PUBLIC_*` env vars belong in this repo. JWT
  secrets, service-role keys and `DATABASE_URL` belong to the Go backend.

## Conventions

- **Imports use the `@/*` alias** (→ `src/*`). Example:
  `import { GameEventType } from '@/lib/game/events'`. Don't use long relative
  paths.
- Components: `PascalCase.tsx`. Hooks: `useXxx.ts`. Event types:
  `SCREAMING_SNAKE_CASE`. Types/interfaces: `PascalCase`. Utils: `camelCase`.
- React game components are mounted from Astro with `client:only="react"`.
- TypeScript is **strict** (`astro/tsconfigs/strict`, `verbatimModuleSyntax`).
  Use `import type` for type-only imports.
- Feature-folder organization; tests colocated as `*.test.ts` next to source.

## Testing

- Vitest, **node environment** (no DOM). Tests target pure functions in
  `lib/game/` and `lib/`.
- Pattern: `describe('context', () => it('behavior', ...))`, `expect` assertions,
  small factory helpers for fixtures (see `lib/game/state.test.ts`).
- When you touch the game engine, add/extend a reducer test. Behavior first.

## Environment

`.env.example` declares the only vars this app reads (all browser-exposed):

```
PUBLIC_REALTIME_URL           # Go backend base URL (http://localhost:8080)
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
PUBLIC_TURNSTILE_SITE_KEY
```

## When making changes

1. Match existing patterns in the target folder before inventing new ones.
2. Keep the layer direction intact (`pages → components → hooks → lib`); never
   import upward.
3. Keep `lib/game/` pure; put side effects in hooks.
4. Run `npm run check` and `npm run test`; fix what they report.
