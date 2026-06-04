# 주도 테마 & 주도주 선별 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/themes` analysis page where trading-value top stocks are drag-mapped to themes, leading stocks are auto/manually selected, and the trade confirm modal shows whether the selected stock is a top-2 theme leader.

**Architecture:** Prisma SQLite lives in `client/` and is accessed from React Router 7 SSR API routes (loader/action). React Query caches `/api/themes` globally with market-hours polling. `@dnd-kit` handles drag-from-ranking-to-theme and theme reordering. The `server/prisma/` directory (currently untracked) will be retired — its purpose is replaced by this setup.

**Tech Stack:** Prisma 6 (SQLite), `@dnd-kit/core` + `@dnd-kit/sortable`, React Query 5, React Router 7 SSR

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `client/prisma/schema.prisma` | Theme + ThemeStock DB models |
| Create | `client/prisma.config.ts` | Prisma CLI config |
| Modify | `client/package.json` | Add prisma, @prisma/client, @dnd-kit/* |
| Create | `client/app/db.server.ts` | Prisma singleton (SSR-only) |
| Create | `client/app/lib/themeScoring.server.ts` | Leader scoring + theme sort logic |
| Create | `shared/themes.ts` | Shared types: ThemeWithLeader, RankingItem |
| Modify | `shared/index.ts` | Re-export themes types |
| Create | `client/app/routes/api/themes.ts` | GET list + POST create |
| Create | `client/app/routes/api/themes.$id.ts` | DELETE theme |
| Create | `client/app/routes/api/themes.$id.stocks.ts` | POST add stock |
| Create | `client/app/routes/api/themes.$id.stocks.$code.ts` | DELETE remove + PATCH manual leader |
| Create | `client/app/routes/api/themes.reorder.ts` | PATCH reorder |
| Modify | `client/app/routes.ts` | Register all theme routes |
| Create | `client/app/routes/themes/hooks/useThemes.ts` | React Query fetch + polling |
| Create | `client/app/routes/themes/hooks/useThemeMutations.ts` | All write mutations |
| Create | `client/app/routes/themes/hooks/useLeaderStocks.ts` | Set of top-2 leader codes |
| Create | `client/app/routes/themes/hooks/useStockThemeStatus.ts` | Per-stock theme/leader info |
| Create | `client/app/routes/themes/components/ThemePanel.tsx` | Right panel (droppable + sortable) |
| Create | `client/app/routes/themes/components/ThemeStockItem.tsx` | Stock row inside theme |
| Create | `client/app/routes/themes.tsx` | Analysis page |
| Modify | `client/app/shared/utils.ts` | Add isMarketHours() |
| Modify | `client/app/routes/trade/components/TradeConfirmModal.tsx` | Data-driven first check item |
| Modify | `client/app/routes/trade.tsx` | Pass stockCode to modal |

---

## Task 1: Prisma Setup in client/

**Files:**
- Create: `client/prisma/schema.prisma`
- Create: `client/prisma.config.ts`
- Modify: `client/package.json`
- Modify: `.env` (root)

- [ ] **Step 1: Add Prisma dependencies to `client/package.json`**

```json
{
  "scripts": {
    "dev": "react-router dev",
    "dev:prod": "react-router dev --mode production",
    "build": "react-router build",
    "build:mock": "react-router build --mode development",
    "start": "react-router-serve ./build/server/index.js",
    "typecheck": "react-router typegen && tsc",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@brain-lock/kiwoom": "*",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "@prisma/client": "^6.19.3",
    "@react-router/node": "7.15.1",
    "@react-router/serve": "7.15.1",
    "@tanstack/react-query": "^5.100.14",
    "isbot": "^5.1.36",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router": "7.15.1"
  },
  "devDependencies": {
    "@react-router/dev": "7.15.1",
    "@tailwindcss/vite": "^4.2.2",
    "@types/node": "^22",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "prisma": "^6.19.3",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.9.3",
    "vite": "^8.0.3"
  }
}
```

- [ ] **Step 2: Create `client/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Theme {
  id        Int          @id @default(autoincrement())
  name      String       @unique
  order     Int          @default(0)
  createdAt DateTime     @default(now())
  stocks    ThemeStock[]
}

model ThemeStock {
  themeId      Int
  stockCode    String
  stockName    String
  manualLeader Boolean  @default(false)
  createdAt    DateTime @default(now())
  theme        Theme    @relation(fields: [themeId], references: [id], onDelete: Cascade)

  @@id([themeId, stockCode])
}
```

- [ ] **Step 3: Create `client/prisma.config.ts`**

```ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  engine: 'classic',
  datasource: { url: env('DATABASE_URL') },
})
```

- [ ] **Step 4: Add `DATABASE_URL` to root `.env`**

Append this line (file is gitignored):
```
DATABASE_URL="file:./prisma/dev.db"
```

(Prisma resolves this path relative to `client/prisma/schema.prisma`, placing the DB at `client/prisma/dev.db`.)

- [ ] **Step 5: Install dependencies and run migration**

```bash
npm install
npm run db:migrate -w @brain-lock/client -- --name init
```

Expected: `client/prisma/dev.db` created, migration files in `client/prisma/migrations/`.

- [ ] **Step 6: Verify generated client exists**

Check that `client/app/generated/prisma/` directory was created.

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/prisma/ client/prisma.config.ts package-lock.json
git commit -m "feat: Prisma SQLite setup in client/ for theme persistence"
```

---

## Task 2: Shared Type Definitions

**Files:**
- Create: `shared/themes.ts`
- Modify: `shared/index.ts`

- [ ] **Step 1: Create `shared/themes.ts`**

```ts
export type RankingItem = {
  stockCode: string
  stockName: string
  tradingValue: string
  changeRate: string
  rank: number
}

export type ThemeStockWithLeader = {
  stockCode: string
  stockName: string
  manualLeader: boolean
  isLeader: boolean
  rankingData?: {
    tradingValue: string
    changeRate: string
  }
}

export type ThemeWithLeader = {
  id: number
  name: string
  order: number
  themeScore: number
  isLeadingTheme: boolean
  stocks: ThemeStockWithLeader[]
  leadingStock: { stockCode: string; stockName: string } | null
}

export type ThemesApiResponse = {
  themes: ThemeWithLeader[]
  rankingItems: RankingItem[]
}
```

- [ ] **Step 2: Add export to `shared/index.ts`**

Append to the end of `shared/index.ts`:
```ts
export type { RankingItem, ThemeStockWithLeader, ThemeWithLeader, ThemesApiResponse } from './themes.js'
```

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run typecheck -w @brain-lock/client
```

Expected: no errors related to the new types.

- [ ] **Step 4: Commit**

```bash
git add shared/themes.ts shared/index.ts
git commit -m "feat: shared theme types (ThemeWithLeader, RankingItem)"
```

---

## Task 3: DB Singleton + Leader Scoring Logic

**Files:**
- Create: `client/app/db.server.ts`
- Create: `client/app/lib/themeScoring.server.ts`

- [ ] **Step 1: Create `client/app/db.server.ts`**

The `.server.ts` suffix prevents this file from being bundled for the browser.

```ts
import { PrismaClient } from './generated/prisma/client.js'

const globalForPrisma = globalThis as unknown as { __prisma: PrismaClient }

export const prisma = globalForPrisma.__prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma
}
```

- [ ] **Step 2: Create `client/app/lib/themeScoring.server.ts`**

```ts
import type { TopTradingValueItem } from '@brain-lock/kiwoom'
import type { ThemeWithLeader, ThemeStockWithLeader, RankingItem, ThemesApiResponse } from '@brain-lock/kiwoom'

type RawThemeStock = {
  stockCode: string
  stockName: string
  manualLeader: boolean
}

type RawTheme = {
  id: number
  name: string
  order: number
  stocks: RawThemeStock[]
}

function stockScore(item: TopTradingValueItem, maxTV: number, maxCR: number): number {
  const tv = maxTV > 0 ? (Number(item.trde_prica) || 0) / maxTV : 0
  const cr = maxCR > 0 ? Math.abs(Number(item.flu_rt) || 0) / maxCR : 0
  return tv * 0.6 + cr * 0.4
}

export function buildThemesResponse(
  themes: RawTheme[],
  rankingItems: TopTradingValueItem[]
): ThemesApiResponse {
  const rankingMap = new Map(rankingItems.map(r => [r.stk_cd, r]))

  const allTV = rankingItems.map(r => Number(r.trde_prica) || 0)
  const allCR = rankingItems.map(r => Math.abs(Number(r.flu_rt)) || 0)
  const maxTV = allTV.length > 0 ? Math.max(...allTV) : 1
  const maxCR = allCR.length > 0 ? Math.max(...allCR) : 1

  const scored = themes.map((theme): ThemeWithLeader => {
    const manualLeader = theme.stocks.find(s => s.manualLeader)

    let leaderCode: string | null = null

    if (manualLeader) {
      leaderCode = manualLeader.stockCode
    } else {
      let best = -1
      for (const s of theme.stocks) {
        const rankItem = rankingMap.get(s.stockCode)
        if (!rankItem) continue
        const score = stockScore(rankItem, maxTV, maxCR)
        if (score > best) {
          best = score
          leaderCode = s.stockCode
        }
      }
    }

    const stocks: ThemeStockWithLeader[] = theme.stocks.map(s => {
      const rankItem = rankingMap.get(s.stockCode)
      return {
        stockCode: s.stockCode,
        stockName: s.stockName,
        manualLeader: s.manualLeader,
        isLeader: s.stockCode === leaderCode,
        rankingData: rankItem
          ? { tradingValue: rankItem.trde_prica, changeRate: rankItem.flu_rt }
          : undefined,
      }
    })

    const inRanking = theme.stocks
      .map(s => rankingMap.get(s.stockCode))
      .filter((r): r is TopTradingValueItem => r !== undefined)

    const themeScore =
      inRanking.length === 0
        ? 0
        : inRanking.length *
          (inRanking.reduce((sum, r) => sum + stockScore(r, maxTV, maxCR), 0) / inRanking.length)

    const leadingStock = leaderCode
      ? (theme.stocks.find(s => s.stockCode === leaderCode) ?? null)
      : null

    return {
      id: theme.id,
      name: theme.name,
      order: theme.order,
      themeScore,
      isLeadingTheme: false,
      stocks,
      leadingStock: leadingStock
        ? { stockCode: leadingStock.stockCode, stockName: leadingStock.stockName }
        : null,
    }
  })

  scored.sort((a, b) => b.themeScore - a.themeScore)
  if (scored.length > 0) scored[0].isLeadingTheme = true

  const normalizedRanking: RankingItem[] = rankingItems.map((r, i) => ({
    stockCode: r.stk_cd,
    stockName: r.stk_nm,
    tradingValue: r.trde_prica,
    changeRate: r.flu_rt,
    rank: i + 1,
  }))

  return { themes: scored, rankingItems: normalizedRanking }
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck -w @brain-lock/client
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/app/db.server.ts client/app/lib/themeScoring.server.ts
git commit -m "feat: Prisma singleton and theme scoring logic"
```

---

## Task 4: API Routes — GET /api/themes + POST /api/themes

**Files:**
- Create: `client/app/routes/api/themes.ts`

- [ ] **Step 1: Create `client/app/routes/api/themes.ts`**

```ts
import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'
import { getTopTradingValue } from '@brain-lock/kiwoom'
import { buildThemesResponse } from '~/lib/themeScoring.server'

export async function loader() {
  const [themes, rankingResult] = await Promise.all([
    prisma.theme.findMany({
      include: { stocks: true },
      orderBy: { order: 'asc' },
    }),
    getTopTradingValue().catch(() => ({ trde_prica_upper: [] as never[] })),
  ])

  const rankingItems = rankingResult.trde_prica_upper ?? []
  return Response.json(buildThemesResponse(themes, rankingItems))
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const body = await request.json() as { name?: string }
  if (!body.name?.trim()) {
    return Response.json({ error: 'name required' }, { status: 400 })
  }
  const maxOrder = await prisma.theme.aggregate({ _max: { order: true } })
  const theme = await prisma.theme.create({
    data: { name: body.name.trim(), order: (maxOrder._max.order ?? 0) + 1 },
  })
  return Response.json(theme, { status: 201 })
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w @brain-lock/client
```

- [ ] **Step 3: Commit**

```bash
git add client/app/routes/api/themes.ts
git commit -m "feat: GET /api/themes and POST /api/themes routes"
```

---

## Task 5: API Routes — Theme & Stock CRUD + Reorder

**Files:**
- Create: `client/app/routes/api/themes.$id.ts`
- Create: `client/app/routes/api/themes.$id.stocks.ts`
- Create: `client/app/routes/api/themes.$id.stocks.$code.ts`
- Create: `client/app/routes/api/themes.reorder.ts`

- [ ] **Step 1: Create `client/app/routes/api/themes.$id.ts`** (DELETE theme)

```ts
import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const id = Number(params.id)
  await prisma.theme.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 2: Create `client/app/routes/api/themes.$id.stocks.ts`** (POST add stock)

```ts
import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const themeId = Number(params.id)
  const body = await request.json() as { stockCode?: string; stockName?: string }
  if (!body.stockCode || !body.stockName) {
    return Response.json({ error: 'stockCode and stockName required' }, { status: 400 })
  }
  const stock = await prisma.themeStock.upsert({
    where: { themeId_stockCode: { themeId, stockCode: body.stockCode } },
    create: { themeId, stockCode: body.stockCode, stockName: body.stockName },
    update: {},
  })
  return Response.json(stock, { status: 201 })
}
```

- [ ] **Step 3: Create `client/app/routes/api/themes.$id.stocks.$code.ts`** (DELETE + PATCH)

```ts
import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  const themeId = Number(params.id)
  const stockCode = params.code as string

  if (request.method === 'DELETE') {
    await prisma.themeStock.delete({
      where: { themeId_stockCode: { themeId, stockCode } },
    })
    return new Response(null, { status: 204 })
  }

  if (request.method === 'PATCH') {
    const body = await request.json() as { manualLeader?: boolean }
    const updated = await prisma.themeStock.update({
      where: { themeId_stockCode: { themeId, stockCode } },
      data: { manualLeader: body.manualLeader ?? false },
    })
    return Response.json(updated)
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
```

- [ ] **Step 4: Create `client/app/routes/api/themes.reorder.ts`** (PATCH reorder)

```ts
import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const body = await request.json() as { ids?: number[] }
  if (!Array.isArray(body.ids)) {
    return Response.json({ error: 'ids array required' }, { status: 400 })
  }
  await Promise.all(
    body.ids.map((id, index) =>
      prisma.theme.update({ where: { id }, data: { order: index } })
    )
  )
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck -w @brain-lock/client
```

- [ ] **Step 6: Commit**

```bash
git add client/app/routes/api/themes.$id.ts client/app/routes/api/themes.$id.stocks.ts client/app/routes/api/themes.$id.stocks.$code.ts client/app/routes/api/themes.reorder.ts
git commit -m "feat: theme and stock CRUD API routes"
```

---

## Task 6: Register Routes

**Files:**
- Modify: `client/app/routes.ts`

- [ ] **Step 1: Update `client/app/routes.ts`**

`reorder` must be registered before `$id` to prevent route conflict.

```ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/trade.tsx"),
  route("themes", "routes/themes.tsx"),
  route("api/stocks", "routes/api/stocks.ts"),
  route("api/account", "routes/api/account.ts"),
  route("api/themes", "routes/api/themes.ts"),
  route("api/themes/reorder", "routes/api/themes.reorder.ts"),
  route("api/themes/:id", "routes/api/themes.$id.ts"),
  route("api/themes/:id/stocks", "routes/api/themes.$id.stocks.ts"),
  route("api/themes/:id/stocks/:code", "routes/api/themes.$id.stocks.$code.ts"),
  route(".well-known/appspecific/com.chrome.devtools.json", "routes/api/devtools.ts"),
] satisfies RouteConfig;
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w @brain-lock/client
```

- [ ] **Step 3: Commit**

```bash
git add client/app/routes.ts
git commit -m "feat: register theme API routes"
```

---

## Task 7: Client Hooks

**Files:**
- Modify: `client/app/shared/utils.ts`
- Create: `client/app/routes/themes/hooks/useThemes.ts`
- Create: `client/app/routes/themes/hooks/useThemeMutations.ts`
- Create: `client/app/routes/themes/hooks/useLeaderStocks.ts`
- Create: `client/app/routes/themes/hooks/useStockThemeStatus.ts`

- [ ] **Step 1: Add `isMarketHours` to `client/app/shared/utils.ts`**

Append to the end of the existing file:

```ts
export function isMarketHours(): boolean {
  const now = new Date()
  const kstOffset = 9 * 60
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const kstMinutes = (utcMinutes + kstOffset) % (24 * 60)
  return kstMinutes >= 9 * 60 && kstMinutes <= 15 * 60 + 30
}
```

- [ ] **Step 2: Create `client/app/routes/themes/hooks/useThemes.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import type { ThemesApiResponse } from '@brain-lock/kiwoom'
import { isMarketHours } from '~/shared/utils'

async function fetchThemes(): Promise<ThemesApiResponse> {
  const res = await fetch('/api/themes')
  if (!res.ok) throw new Error('테마 데이터를 불러오지 못했습니다.')
  return res.json()
}

export const themesQueryKey = ['themes'] as const

export function useThemes() {
  return useQuery({
    queryKey: themesQueryKey,
    queryFn: fetchThemes,
    refetchInterval: isMarketHours() ? 5 * 60 * 1000 : false,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 3: Create `client/app/routes/themes/hooks/useThemeMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { themesQueryKey } from './useThemes'

export function useThemeMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: themesQueryKey })

  const createTheme = useMutation({
    mutationFn: (name: string) =>
      fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(r => r.json()),
    onSuccess: invalidate,
  })

  const deleteTheme = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/themes/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const addStock = useMutation({
    mutationFn: ({ themeId, stockCode, stockName }: { themeId: number; stockCode: string; stockName: string }) =>
      fetch(`/api/themes/${themeId}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockCode, stockName }),
      }),
    onSuccess: invalidate,
  })

  const removeStock = useMutation({
    mutationFn: ({ themeId, stockCode }: { themeId: number; stockCode: string }) =>
      fetch(`/api/themes/${themeId}/stocks/${stockCode}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const toggleLeader = useMutation({
    mutationFn: ({ themeId, stockCode, manualLeader }: { themeId: number; stockCode: string; manualLeader: boolean }) =>
      fetch(`/api/themes/${themeId}/stocks/${stockCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualLeader }),
      }),
    onSuccess: invalidate,
  })

  const reorderThemes = useMutation({
    mutationFn: (ids: number[]) =>
      fetch('/api/themes/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }),
    onSuccess: invalidate,
  })

  return { createTheme, deleteTheme, addStock, removeStock, toggleLeader, reorderThemes }
}
```

- [ ] **Step 4: Create `client/app/routes/themes/hooks/useLeaderStocks.ts`**

```ts
import { useMemo } from 'react'
import { useThemes } from './useThemes'

export function useLeaderStocks(): Set<string> {
  const { data } = useThemes()
  return useMemo(() => {
    const top2 = data?.themes.slice(0, 2) ?? []
    const codes = top2.flatMap(t => t.stocks.filter(s => s.isLeader).map(s => s.stockCode))
    return new Set(codes)
  }, [data])
}
```

- [ ] **Step 5: Create `client/app/routes/themes/hooks/useStockThemeStatus.ts`**

```ts
import { useMemo } from 'react'
import { useThemes } from './useThemes'

export type StockThemeStatus = {
  isLeader: boolean
  isInTop2: boolean
  themeName: string | null
  rank: 1 | 2 | null
}

export function useStockThemeStatus(stockCode: string | null): StockThemeStatus {
  const { data } = useThemes()
  return useMemo(() => {
    if (!stockCode || !data) {
      return { isLeader: false, isInTop2: false, themeName: null, rank: null }
    }
    const top2 = data.themes.slice(0, 2)
    for (let i = 0; i < top2.length; i++) {
      const theme = top2[i]
      const stock = theme.stocks.find(s => s.stockCode === stockCode)
      if (stock) {
        return {
          isLeader: stock.isLeader,
          isInTop2: true,
          themeName: theme.name,
          rank: (i + 1) as 1 | 2,
        }
      }
    }
    return { isLeader: false, isInTop2: false, themeName: null, rank: null }
  }, [stockCode, data])
}
```

- [ ] **Step 6: Verify typecheck**

```bash
npm run typecheck -w @brain-lock/client
```

- [ ] **Step 7: Commit**

```bash
git add client/app/shared/utils.ts client/app/routes/themes/hooks/
git commit -m "feat: useThemes, useThemeMutations, useLeaderStocks, useStockThemeStatus hooks"
```

---

## Task 8: Update TradeConfirmModal

**Files:**
- Modify: `client/app/routes/trade/components/TradeConfirmModal.tsx`
- Modify: `client/app/routes/trade.tsx`

- [ ] **Step 1: Update `client/app/routes/trade/components/TradeConfirmModal.tsx`**

Replace entire file:

```tsx
import { useState } from "react";
import { Modal } from "~/shared/components/Modal";
import { useStockThemeStatus } from "~/routes/themes/hooks/useStockThemeStatus";

const STATIC_CHECKS = [
  "장 초반 혹은 급등 후 추격 매수는 아닌가?",
  "상위 차트가 괜찮은가?",
  "돌파, 상다, 눌림목 - 내가 아는 패턴인가?",
] as const;

interface TradeConfirmModalProps {
  open: boolean;
  side: "buy" | "sell";
  stockCode: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TradeConfirmModal({
  open,
  side,
  stockCode,
  onCancel,
  onConfirm,
}: TradeConfirmModalProps) {
  const themeStatus = useStockThemeStatus(stockCode);
  const [checked, setChecked] = useState<boolean[]>(() =>
    Array(STATIC_CHECKS.length + 1).fill(false)
  );

  const firstCheckLabel = themeStatus.isLeader
    ? `주도 테마 주도주: ✅ ${themeStatus.themeName} (${themeStatus.rank}위)`
    : themeStatus.isInTop2
    ? `주도 테마 종목 (주도주 아님): 🟡 ${themeStatus.themeName}`
    : `⚠️ 상위 2개 테마 미등록`;

  const allChecks = [firstCheckLabel, ...STATIC_CHECKS];

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function handleConfirm() {
    setChecked(Array(allChecks.length).fill(false));
    onConfirm();
  }

  function handleCancel() {
    setChecked(Array(allChecks.length).fill(false));
    onCancel();
  }

  const allChecked = side === "sell" || checked.every(Boolean);

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={side === "buy" ? "매수 전 체크리스트" : "매도 확인"}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-2.5 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allChecked}
            className={`flex-1 py-2.5 rounded-lg disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold transition-colors ${
              side === "buy"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {side === "buy" ? "매수 주문" : "매도 주문"}
          </button>
        </div>
      }
    >
      {side === "buy" ? (
        <>
          <p className="text-sm text-red-700">* 당장 버는 것이 중요하지 않아. </p>
          <p className="text-sm text-red-700">* 원칙을 지켜야해.</p>
          <ul className="space-y-3 mt-4">
            {allChecks.map((label, i) => (
              <li key={i}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    onChange={() => toggle(i)}
                    className="mt-0.5 accent-red-500 w-4 h-4 shrink-0"
                  />
                  <span className="text-sm text-gray-200">{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-gray-300">매도 주문을 접수하시겠습니까?</p>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Update `client/app/routes/trade.tsx` — pass stockCode to modal**

Find the `<TradeConfirmModal` usage (around line 384) and add the `stockCode` prop:

```tsx
<TradeConfirmModal
  open={modalOpen}
  side={side}
  stockCode={selected?.code ?? null}
  onCancel={() => setModalOpen(false)}
  onConfirm={handleConfirm}
/>
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck -w @brain-lock/client
```

- [ ] **Step 4: Commit**

```bash
git add client/app/routes/trade/components/TradeConfirmModal.tsx client/app/routes/trade.tsx
git commit -m "feat: trade confirm modal shows dynamic theme/leader status"
```

---

## Task 9: Analysis Page Components

**Files:**
- Create: `client/app/routes/themes/components/ThemeStockItem.tsx`
- Create: `client/app/routes/themes/components/ThemePanel.tsx`

- [ ] **Step 1: Create `client/app/routes/themes/components/ThemeStockItem.tsx`**

```tsx
import type { ThemeStockWithLeader } from '@brain-lock/kiwoom'

interface ThemeStockItemProps {
  stock: ThemeStockWithLeader
  themeId: number
  onRemove: (themeId: number, stockCode: string) => void
  onToggleLeader: (themeId: number, stockCode: string, current: boolean) => void
}

export function ThemeStockItem({ stock, themeId, onRemove, onToggleLeader }: ThemeStockItemProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded group">
      <button
        type="button"
        onClick={() => onToggleLeader(themeId, stock.stockCode, stock.manualLeader)}
        title={stock.manualLeader ? '수동 주도주 해제' : '수동 주도주 지정'}
        className="text-sm shrink-0"
      >
        {stock.isLeader ? '★' : '☆'}
      </button>
      <span className="flex-1 text-sm text-white truncate">{stock.stockName}</span>
      <span className="text-xs text-gray-500 font-mono">{stock.stockCode}</span>
      {stock.rankingData && (
        <span className={`text-xs font-mono ${Number(stock.rankingData.changeRate) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
          {Number(stock.rankingData.changeRate) >= 0 ? '+' : ''}{stock.rankingData.changeRate}%
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(themeId, stock.stockCode)}
        className="text-gray-600 hover:text-white text-xs opacity-0 group-hover:opacity-100 shrink-0"
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `client/app/routes/themes/components/ThemePanel.tsx`**

```tsx
import type { ThemeWithLeader } from '@brain-lock/kiwoom'
import { ThemeStockItem } from './ThemeStockItem'

interface ThemePanelProps {
  theme: ThemeWithLeader
  onDelete: (id: number) => void
  onRemoveStock: (themeId: number, stockCode: string) => void
  onToggleLeader: (themeId: number, stockCode: string, current: boolean) => void
  isDropTarget?: boolean
  dragHandleProps?: Record<string, unknown>
}

export function ThemePanel({
  theme,
  onDelete,
  onRemoveStock,
  onToggleLeader,
  isDropTarget = false,
  dragHandleProps,
}: ThemePanelProps) {
  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
      isDropTarget ? 'border-blue-500 bg-gray-800' : 'border-gray-700'
    }`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <div
          {...dragHandleProps}
          className="text-gray-500 cursor-grab active:cursor-grabbing select-none px-1"
          title="드래그해서 순서 변경"
        >
          ≡
        </div>
        <span className="flex-1 text-sm font-semibold text-white">{theme.name}</span>
        {theme.isLeadingTheme && (
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
            ⭐ 주도 테마
          </span>
        )}
        <button
          type="button"
          onClick={() => onDelete(theme.id)}
          className="text-gray-600 hover:text-red-400 text-xs"
        >
          삭제
        </button>
      </div>
      <div className="py-1 min-h-[40px]">
        {theme.stocks.length === 0 ? (
          <p className="text-xs text-gray-600 px-3 py-2">종목을 드래그해서 추가하세요</p>
        ) : (
          theme.stocks.map(stock => (
            <ThemeStockItem
              key={stock.stockCode}
              stock={stock}
              themeId={theme.id}
              onRemove={onRemoveStock}
              onToggleLeader={onToggleLeader}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck -w @brain-lock/client
```

- [ ] **Step 4: Commit**

```bash
git add client/app/routes/themes/components/
git commit -m "feat: ThemeStockItem and ThemePanel components"
```

---

## Task 10: Analysis Page + DnD Integration

**Files:**
- Create: `client/app/routes/themes.tsx`

- [ ] **Step 1: Create `client/app/routes/themes.tsx`**

Ranking items use `useDraggable` (drag sources only). Theme panels use `useSortable` (both drag + drop targets for reordering). Drop zones inside each theme panel come from `useSortable`'s `isOver`.

```tsx
import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import type { ThemeWithLeader, RankingItem } from '@brain-lock/kiwoom'
import { useThemes, themesQueryKey } from './themes/hooks/useThemes'
import { useThemeMutations } from './themes/hooks/useThemeMutations'
import { ThemePanel } from './themes/components/ThemePanel'

function DraggableRankingItem({ item }: { item: RankingItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ranking-${item.stockCode}`,
    data: { type: 'ranking', item },
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-grab active:cursor-grabbing rounded transition-opacity ${isDragging ? 'opacity-30' : ''}`}
    >
      <span className="text-xs text-gray-500 w-5 text-right shrink-0">{item.rank}</span>
      <span className="flex-1 text-sm text-white truncate">{item.stockName}</span>
      <span className={`text-xs font-mono shrink-0 ${Number(item.changeRate) >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
        {Number(item.changeRate) >= 0 ? '+' : ''}{item.changeRate}%
      </span>
    </div>
  )
}

function SortableThemePanel({
  theme,
  onDelete,
  onRemoveStock,
  onToggleLeader,
}: {
  theme: ThemeWithLeader
  onDelete: (id: number) => void
  onRemoveStock: (themeId: number, stockCode: string) => void
  onToggleLeader: (themeId: number, stockCode: string, current: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isOver } = useSortable({
    id: `theme-${theme.id}`,
    data: { type: 'theme', themeId: theme.id },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <ThemePanel
        theme={theme}
        onDelete={onDelete}
        onRemoveStock={onRemoveStock}
        onToggleLeader={onToggleLeader}
        isDropTarget={isOver}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

export default function Themes() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useThemes()
  const mutations = useThemeMutations()
  const [newThemeName, setNewThemeName] = useState('')
  const [activeRankingItem, setActiveRankingItem] = useState<RankingItem | null>(null)

  const themes = data?.themes ?? []
  const rankingItems = data?.rankingItems ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const item = event.active.data.current?.item as RankingItem | undefined
    if (item) setActiveRankingItem(item)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRankingItem(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith('ranking-') && overId.startsWith('theme-')) {
      const item = active.data.current?.item as RankingItem | undefined
      const themeId = Number(overId.replace('theme-', ''))
      if (item) {
        mutations.addStock.mutate({ themeId, stockCode: item.stockCode, stockName: item.stockName })
      }
      return
    }

    if (activeId.startsWith('theme-') && overId.startsWith('theme-') && activeId !== overId) {
      const oldIndex = themes.findIndex(t => `theme-${t.id}` === activeId)
      const newIndex = themes.findIndex(t => `theme-${t.id}` === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(themes, oldIndex, newIndex)
        mutations.reorderThemes.mutate(reordered.map(t => t.id))
      }
    }
  }

  function handleCreateTheme(e: React.FormEvent) {
    e.preventDefault()
    if (!newThemeName.trim()) return
    mutations.createTheme.mutate(newThemeName.trim(), {
      onSuccess: () => setNewThemeName(''),
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">주도 테마 분석</h1>
          <a href="/" className="text-sm text-gray-400 hover:text-white">← 주문</a>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-[280px_1fr] gap-6">
            {/* Left: Ranking */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
                <span className="text-sm font-semibold text-white">거래대금 상위</span>
                <button
                  type="button"
                  onClick={() => queryClient.invalidateQueries({ queryKey: themesQueryKey })}
                  disabled={isLoading}
                  className="text-xs text-gray-400 hover:text-white disabled:opacity-40"
                >
                  {isLoading ? '로딩...' : '새로고침'}
                </button>
              </div>
              <div className="overflow-y-auto max-h-[600px]">
                {rankingItems.map(item => (
                  <DraggableRankingItem key={item.stockCode} item={item} />
                ))}
                {rankingItems.length === 0 && !isLoading && (
                  <p className="text-xs text-gray-600 px-3 py-4 text-center">데이터 없음</p>
                )}
              </div>
            </div>

            {/* Right: Themes */}
            <div className="space-y-3">
              <form onSubmit={handleCreateTheme} className="flex gap-2">
                <input
                  type="text"
                  value={newThemeName}
                  onChange={e => setNewThemeName(e.target.value)}
                  placeholder="새 테마 이름"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newThemeName.trim() || mutations.createTheme.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg"
                >
                  + 테마 추가
                </button>
              </form>

              <SortableContext
                items={themes.map(t => `theme-${t.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {themes.map(theme => (
                  <SortableThemePanel
                    key={theme.id}
                    theme={theme}
                    onDelete={id => mutations.deleteTheme.mutate(id)}
                    onRemoveStock={(themeId, stockCode) =>
                      mutations.removeStock.mutate({ themeId, stockCode })
                    }
                    onToggleLeader={(themeId, stockCode, current) =>
                      mutations.toggleLeader.mutate({ themeId, stockCode, manualLeader: !current })
                    }
                  />
                ))}
              </SortableContext>

              {themes.length === 0 && !isLoading && (
                <p className="text-sm text-gray-500 text-center py-8">
                  테마를 추가하고 거래대금 상위 종목을 드래그해서 매핑하세요.
                </p>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeRankingItem && (
              <div className="bg-gray-800 border border-blue-500 rounded-lg px-3 py-2 text-sm text-white shadow-xl">
                {activeRankingItem.stockName}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add nav link to trade page**

In `client/app/routes/trade.tsx`, change the outer div to flex-col and add a link above the form:

```tsx
<div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center">
  <div className="w-full max-w-xs mb-2 flex justify-end">
    <a href="/themes" className="text-xs text-gray-500 hover:text-white">테마 분석 →</a>
  </div>
  <form className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-xs p-4 space-y-3">
    {/* rest of form unchanged */}
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck -w @brain-lock/client
```

- [ ] **Step 4: Start dev server and manual smoke test**

```bash
npm run dev
```

Open `http://localhost:5173/themes`:
- [ ] Page loads without error
- [ ] "테마 추가" form works — creates a new theme in DB
- [ ] Ranking list shows (may be empty in mock env)
- [ ] Theme delete button works
- [ ] Drag ranking item onto theme panel → stock appears in theme
- [ ] Click ★/☆ on a stock → toggles manual leader
- [ ] Drag theme panels → reorders correctly

Open `http://localhost:5173` (trade page):
- [ ] "테마 분석 →" link appears
- [ ] Click a stock, click 매수 → modal shows first check item with theme status

- [ ] **Step 5: Commit**

```bash
git add client/app/routes/themes.tsx client/app/routes/themes/ client/app/routes/trade.tsx
git commit -m "feat: /themes analysis page with DnD stock mapping and theme reordering"
```

---

## Task 11: Cleanup

- [ ] **Step 1: Add `client/app/generated/` to `client/.gitignore`**

The generated Prisma client should not be committed.

```
# Add to client/.gitignore (or root .gitignore)
client/app/generated/
client/prisma/dev.db
client/prisma/migrations/
```

Actually, migrations SHOULD be committed (they're the source of truth for the schema). Only exclude the dev.db and the generated client:

```gitignore
# Prisma
client/app/generated/
client/prisma/dev.db
```

- [ ] **Step 2: Update root `.gitignore`**

Add these lines to the root `.gitignore`:

```
# Prisma generated client
client/app/generated/

# SQLite dev database
client/prisma/dev.db
```

- [ ] **Step 3: Note on server/prisma cleanup**

The `server/prisma/` directory and `server/prisma.config.ts` are currently untracked and not needed. They can be deleted:

```bash
rm -rf server/prisma server/prisma.config.ts
```

Only do this if the server package will NOT use its own DB in the future. If the server will eventually use Prisma separately, leave the files.

- [ ] **Step 4: Commit gitignore**

```bash
git add .gitignore
git commit -m "chore: gitignore Prisma generated client and dev.db"
```

---

## Self-Review

| Spec requirement | Task |
|-----------------|------|
| 거래대금 상위 종목 조회 | Task 4 (`GET /api/themes` calls `getTopTradingValue`) |
| 수동 테마 매핑 (드래그앤드롭) | Task 10 (`useDraggable` → `addStock` mutation) |
| 테마 → 종목 n:n 관계 | Task 1 (Prisma schema `@@id([themeId, stockCode])`) |
| 한 번 매핑된 테마 재사용/삭제 | Task 5 (DELETE route) + Task 10 (delete button) |
| 주도주 자동 판별 (거래대금×0.6 + 등락률×0.4) | Task 3 (`buildThemesResponse`) |
| 수동 주도주 지정 우선 | Task 3 (`manualLeader` check in scoring) |
| 테마 점수 = 종목 수 × 평균 stock_score | Task 3 |
| 주도 테마 맨 위 + 뱃지 | Task 3 (sort by themeScore) + Task 9 (⭐ badge) |
| 드래그앤드롭 테마 순서 변경 | Task 10 (`useSortable` + `arrayMove` + reorder mutation) |
| 상위 2개 테마 주도주만 체크 | Task 7 (`useLeaderStocks` slices top 2) |
| TradeConfirmModal 동적 체크 | Task 8 |
| 장 시간 5분 폴링 | Task 7 (`refetchInterval: isMarketHours() ? 5min : false`) |
