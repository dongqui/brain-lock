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
# 루트에서 실행 (client + server 동시 기동)
npm run dev        # concurrently: client(5173) + server(8080)
npm run build      # client 프로덕션 빌드
npm run start      # concurrently: client serve + server

# 워크스페이스 직접 실행
npm run dev -w @brain-lock/client      # React Router dev server only
npm run dev -w @brain-lock/server      # Realtime WebSocket server only
npm run typecheck -w @brain-lock/client  # react-router typegen + tsc
```

No test runner is configured yet.

## TypeScript

- Never use `any` type. Use `unknown`, proper generics, or explicit interfaces instead.
- Always use strict mode (`"strict": true` is already set in each workspace's `tsconfig.json`).

## Architecture

**BrainLock** is a trading gatekeeper (뇌동매매 방지) — not an automated trading bot. It validates market conditions before allowing a stock order to execute, enforcing rule-based discipline to prevent impulsive trades.

### Stack

- **npm workspaces monorepo** — `shared/`, `client/`, `server/` 3개 패키지
- **React Router 7** (SSR enabled) — `client/` 패키지, routes는 `client/app/routes.ts`
- **React 19** + **TypeScript** + **TailwindCSS v4**
- **Vite** (`client/vite.config.ts`) — `@tailwindcss/vite` 플러그인, env는 repo root(`/`) 기준
- Path alias `~/*` → `./app/*` (`client/` 내부)

### Monorepo Structure

```
/
├── shared/          # @brain-lock/kiwoom — 키움 API 레이어 (서버 전용)
├── client/          # @brain-lock/client — React Router 7 SSR 앱
├── server/          # @brain-lock/server — 실시간 WebSocket 허브
├── .env             # 공통 시크릿 (KIWOOM_APP_KEY, KIWOOM_SECRET_KEY)
├── .env.development # KIWOOM_ENVIRONMENT=mock, VITE_ 설정
└── .env.production  # KIWOOM_ENVIRONMENT=production, VITE_ 설정
```

### `shared/` — `@brain-lock/kiwoom`

키움증권 API 레이어. `client/`와 `server/` 모두 이 패키지에 의존.

| File         | Purpose                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| `auth.ts`    | OAuth2 토큰 발급/갱신, 60초 버퍼 자동 리프레시, 중복 발급 방지                    |
| `client.ts`  | axios 기반 REST 래퍼, HTTP 상태 + 키움 return_code 검증                           |
| `env.ts`     | `process.env` 기반 환경변수 헬퍼 (`getKiwoomCredentials`, `getKiwoomEnvironment`) |
| `orders.ts`  | 매수/매도/정정/취소 주문                                                          |
| `ranking.ts` | 거래대금 상위 종목 조회                                                           |
| `socket.ts`  | Kiwoom WebSocket 클라이언트 — `createKiwoomSocket(environment?)` 팩토리           |
| `stocks.ts`  | 종목 마스터 조회 (코스피 + 코스닥)                                                |
| `types.ts`   | 모든 TypeScript 타입 정의                                                         |
| `index.ts`   | 배럴 익스포트                                                                     |

- Production REST: `https://api.kiwoom.com`
- Mock REST: `https://mockapi.kiwoom.com`
- WebSocket: `wss://api.kiwoom.com:10000/api/dostk/websocket`

### `server/` — `@brain-lock/server`

실시간 가격 스트리밍 전용 독립 서버. `tsx watch`로 구동.

| File                 | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `src/index.ts`       | HTTP + WebSocket 서버 (`/realtime` 엔드포인트, `/health` 헬스체크), Origin 검증 |
| `src/realtimeHub.ts` | Kiwoom 소켓 단일 인스턴스 관리, 종목별 subscriber 멀티플렉싱, 자동 REG/REMOVE   |
| `src/loadEnv.ts`     | repo root의 `.env.{mode}` + `.env` 로드 (dotenv)                                |

**데이터 흐름**: 브라우저 WS → `server/` → Kiwoom WS (단일 공유 연결)  
브라우저가 구독/구독취소 메시지(`{ action, code }`)를 보내면 허브가 Kiwoom에 REG/REMOVE.

### `client/` — `@brain-lock/client`

| Path                                                | Purpose                                         |
| --------------------------------------------------- | ----------------------------------------------- |
| `app/root.tsx`                                      | HTML 셸, QueryClientProvider, 에러 바운더리     |
| `app/routes.ts`                                     | 라우트 설정                                     |
| `app/routes/trade.tsx`                              | 주문 폼 (종목 검색, 유형, 가격, 수량)           |
| `app/routes/api/stocks.ts`                          | `/api/stocks` — 종목 마스터 REST 엔드포인트     |
| `app/routes/trade/hooks/useRealtimePrice.ts`        | 브라우저 WebSocket으로 `server/`에 구독, 현재가 |
| `app/routes/trade/hooks/useRecentStocks.ts`         | localStorage 기반 최근 검색 종목 (최대 8개)     |
| `app/routes/trade/hooks/queries/useStockSearch.ts`  | react-query 기반 종목 이름/코드 검색            |
| `app/routes/trade/components/TradeConfirmModal.tsx` | 매수 전 체크리스트 모달                         |
| `app/shared/components/Modal.tsx`                   | 공통 모달 프리미티브                            |
| `app/shared/utils.ts`                               | 공통 유틸 (`parsePrice` 등)                     |

### Environment Variables

```bash
# .env (repo root) — 절대 커밋 금지
KIWOOM_APP_KEY=...
KIWOOM_SECRET_KEY=...

# .env.development / .env.production (repo root)
KIWOOM_ENVIRONMENT=production         # 서버 전용 (process.env)
VITE_REALTIME_WS_URL=ws://localhost:8080/realtime  # 클라이언트 브라우저 WS URL
REALTIME_PORT=8080                         # server/ 리슨 포트 (기본값 8080)
REALTIME_ALLOWED_ORIGINS=http://localhost:5173,...  # server/ CORS
```

`client/vite.config.ts`는 `envDir`를 repo root로 설정하므로 `VITE_*` 변수가 모두 브라우저에 노출됨.  
`server/src/loadEnv.ts`는 dotenv로 repo root의 `.env.*`를 직접 로드.

### Planned (Not Yet Implemented)

- PostgreSQL + Prisma ORM
- Rule Engine: 테마 관리, 주도주 감지, 돌파 패턴 검증, PASS/BLOCK 로직
- Backtesting module

The Rule Engine is the core product differentiator — orders are blocked/delayed when market conditions fail validation rules defined by the user.
