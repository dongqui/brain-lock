# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask. 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
   Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run build      # Production build
npm run start      # Run production server
npm run typecheck  # Generate React Router types + TypeScript check
```

No test runner is configured yet.

## TypeScript

- Never use `any` type. Use `unknown`, proper generics, or explicit interfaces instead.
- Always use strict mode (`"strict": true` is already set in `tsconfig.json`).

## Architecture

**BrainLock** is a trading gatekeeper (뇌동매매 방지) — not an automated trading bot. It validates market conditions before allowing a stock order to execute, enforcing rule-based discipline to prevent impulsive trades.

### Stack

- **React Router 7** (SSR enabled) — full-stack framework; routes are defined in `app/routes.ts`
- **React 19** + **TypeScript** + **TailwindCSS v4**
- **Vite** as the bundler with `@tailwindcss/vite` plugin
- Path alias `~/*` → `./app/*`

### Key Layers

**`apis/`** — Kiwoom Securities API layer (server-side only)

| File        | Purpose                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| `auth.ts`   | `KiwoomAuthService` — OAuth2 token lifecycle, auto-refresh with 60s buffer, prevents concurrent issuance |
| `client.ts` | `KiwoomRestClient` — generic `post<T>()` wrapper; validates HTTP status + Kiwoom return codes            |
| `orders.ts` | `KiwoomOrderService` — buy/sell/modify/cancel stock orders                                               |
| `socket.ts` | `KiwoomSocketClient` — WebSocket for real-time market data (executions, bid-ask, account events)         |
| `types.ts`  | All TypeScript types for the Kiwoom API                                                                  |

- Production base URL: `https://api.kiwoom.com`
- Mock base URL: `https://mockapi.kiwoom.com`
- WebSocket: `wss://api.kiwoom.com:10000/api/dostk/websocket`

**`app/`** — React Router application

- `root.tsx` — HTML shell, Google Fonts (Inter), error boundary
- `routes.ts` — Route config (currently only index → `routes/home.tsx`)
- `routes/home.tsx` — Stock order form UI (ticker, order type, price, qty, total)

### Environment Variables

```
KIWOOM_APP_KEY=...
KIWOOM_SECRET_KEY=...
```

Loaded from `.env` — never commit real credentials.

### Planned (Not Yet Implemented)

- PostgreSQL + Prisma ORM
- Rule Engine: theme management, market-leading theme detection, breakout pattern validation, PASS/BLOCK logic
- Backtesting module

The Rule Engine is the core product differentiator — orders are blocked/delayed when market conditions fail validation rules defined by the user.
