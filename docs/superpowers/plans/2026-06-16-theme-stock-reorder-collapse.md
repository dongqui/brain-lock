# 종목 순서 변경 + 테마 접힘 영속화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 테마 패널 안의 종목을 같은 테마 안에서 드래그로 순서 변경할 수 있게 하고, 테마 접힘 상태를 DB에 영속화한다.

**Architecture:** Prisma 스키마에 `ThemeStock.order`와 `Theme.collapsed`를 추가하고, 응답 빌더/타입이 이를 전달한다. 신규/수정 API 엔드포인트가 순서·접힘 변경을 저장하고, 클라이언트는 dnd-kit 중첩 SortableContext와 낙관적 업데이트 뮤테이션으로 즉각 반응한다.

**Tech Stack:** Prisma (SQLite), React Router 7, dnd-kit, @tanstack/react-query, TypeScript.

> **테스트 주의:** 이 저장소에는 테스트 러너가 없다(CLAUDE.md). 각 태스크 검증은 `npm run typecheck -w @brain-lock/client`와 명시된 수동 확인으로 한다.

---

## File Structure

- `client/prisma/schema.prisma` — `ThemeStock.order`, `Theme.collapsed` 필드 추가 (마이그레이션)
- `shared/themes.ts` — `ThemeWithLeader.collapsed`, `ThemeStockWithLeader.order` 타입 추가
- `client/app/lib/themeScoring.server.ts` — Raw 타입에 필드 추가, 빌더가 전달
- `client/app/routes/api/themes.ts` — loader가 종목을 order순 정렬
- `client/app/routes/api/themes.$id.stocks.ts` — addStock이 `order = max+1` 부여
- `client/app/routes/api/themes.$id.ts` — PATCH(collapsed) 핸들러 추가
- `client/app/routes/api/themes.$id.stocks.reorder.ts` — **신규** 종목 순서 저장 PATCH
- `client/app/routes/themes/hooks/useThemeMutations.ts` — `reorderStocks`, `setCollapsed` 뮤테이션 추가
- `client/app/routes/themes/components/ThemePanel.tsx` — 접힘 상태를 prop 기반으로 전환
- `client/app/routes/themes/components/ThemeStockItem.tsx` — `useSortable` 적용
- `client/app/routes/themes.tsx` — 종목 중첩 SortableContext, drag end 분기, collapse 콜백 배선

---

### Task 1: DB 스키마에 order/collapsed 추가

**Files:**
- Modify: `client/prisma/schema.prisma`

- [ ] **Step 1: 스키마 수정**

`Theme` 모델의 `stocks ThemeStock[]` 줄 위에 `collapsed` 추가:

```prisma
model Theme {
  id        Int          @id @default(autoincrement())
  name      String       @unique
  order     Int          @default(0)
  collapsed Boolean      @default(false)
  createdAt DateTime     @default(now())
  stocks    ThemeStock[]
}
```

`ThemeStock` 모델에 `order` 추가:

```prisma
model ThemeStock {
  themeId      Int
  stockCode    String
  stockName    String
  manualLeader Boolean  @default(false)
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  theme        Theme    @relation(fields: [themeId], references: [id], onDelete: Cascade)

  @@id([themeId, stockCode])
}
```

- [ ] **Step 2: 마이그레이션 실행 + Prisma Client 재생성**

Run:
```bash
cd client && npx prisma migrate dev --name add_stock_order_theme_collapsed
```
Expected: 마이그레이션 생성·적용 성공, `app/generated/prisma` 재생성.

- [ ] **Step 3: 커밋**

```bash
git add client/prisma
git commit -m "feat(db): ThemeStock.order, Theme.collapsed 컬럼 추가"
```

---

### Task 2: 공유 타입 확장

**Files:**
- Modify: `shared/themes.ts`

- [ ] **Step 1: 타입에 필드 추가**

`ThemeStockWithLeader`에 `order` 추가:

```typescript
export type ThemeStockWithLeader = {
  stockCode: string
  stockName: string
  manualLeader: boolean
  isLeader: boolean
  order: number
  rankingData?: {
    tradingValue: string
    changeRate: string
  }
}
```

`ThemeWithLeader`에 `collapsed` 추가:

```typescript
export type ThemeWithLeader = {
  id: number
  name: string
  order: number
  collapsed: boolean
  themeScore: number
  isLeadingTheme: boolean
  stocks: ThemeStockWithLeader[]
  leadingStock: { stockCode: string; stockName: string } | null
}
```

- [ ] **Step 2: 타입체크 (실패 확인)**

Run: `npm run typecheck -w @brain-lock/client`
Expected: `themeScoring.server.ts`에서 `collapsed`/`order` 누락으로 FAIL. (다음 태스크에서 해소)

---

### Task 3: 응답 빌더가 order/collapsed 전달

**Files:**
- Modify: `client/app/lib/themeScoring.server.ts`

- [ ] **Step 1: Raw 타입에 필드 추가**

```typescript
type RawThemeStock = {
  stockCode: string
  stockName: string
  manualLeader: boolean
  order: number
}

type RawTheme = {
  id: number
  name: string
  order: number
  collapsed: boolean
  stocks: RawThemeStock[]
}
```

- [ ] **Step 2: stocks 매핑에 order 전달**

`const stocks: ThemeStockWithLeader[] = theme.stocks.map(s => {` 블록의 반환 객체에 `order` 추가:

```typescript
    const stocks: ThemeStockWithLeader[] = theme.stocks.map(s => {
      const rankItem = rankingMap.get(s.stockCode)
      return {
        stockCode: s.stockCode,
        stockName: s.stockName,
        manualLeader: s.manualLeader,
        isLeader: s.stockCode === leaderCode,
        order: s.order,
        rankingData: rankItem
          ? { tradingValue: rankItem.trde_prica, changeRate: rankItem.flu_rt }
          : undefined,
      }
    })
```

- [ ] **Step 3: 테마 반환 객체에 collapsed 전달**

`return {` (id, name, order ... 블록)에 `collapsed` 추가:

```typescript
    return {
      id: theme.id,
      name: theme.name,
      order: theme.order,
      collapsed: theme.collapsed,
      themeScore,
      isLeadingTheme: false,
      stocks,
      leadingStock: leadingStock
        ? { stockCode: leadingStock.stockCode, stockName: leadingStock.stockName }
        : null,
    }
```

- [ ] **Step 4: 타입체크 (통과 확인)**

Run: `npm run typecheck -w @brain-lock/client`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add shared/themes.ts client/app/lib/themeScoring.server.ts
git commit -m "feat(themes): 응답에 stock order, theme collapsed 포함"
```

---

### Task 4: loader가 종목을 order순 정렬

**Files:**
- Modify: `client/app/routes/api/themes.ts:8-11`

- [ ] **Step 1: include에 orderBy 추가**

`prisma.theme.findMany`의 `include`를 수정:

```typescript
    prisma.theme.findMany({
      include: { stocks: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    }),
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add client/app/routes/api/themes.ts
git commit -m "feat(themes): loader가 종목을 order순 반환"
```

---

### Task 5: addStock이 order 부여

**Files:**
- Modify: `client/app/routes/api/themes.$id.stocks.ts:13-18`

- [ ] **Step 1: upsert 전에 max order 조회 후 create에 order 부여**

`const stock = await prisma.themeStock.upsert(...)` 부분을 다음으로 교체:

```typescript
  const maxOrder = await prisma.themeStock.aggregate({
    where: { themeId },
    _max: { order: true },
  })
  const stock = await prisma.themeStock.upsert({
    where: { themeId_stockCode: { themeId, stockCode: body.stockCode } },
    create: {
      themeId,
      stockCode: body.stockCode,
      stockName: body.stockName,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    update: {},
  })
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add client/app/routes/api/themes.$id.stocks.ts
git commit -m "feat(themes): 신규 종목에 order 부여"
```

---

### Task 6: 테마 PATCH(collapsed) 핸들러

**Files:**
- Modify: `client/app/routes/api/themes.$id.ts`

- [ ] **Step 1: PATCH 분기 추가**

action 함수를 다음으로 교체:

```typescript
import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  const id = Number(params.id)

  if (request.method === 'DELETE') {
    await prisma.theme.delete({ where: { id } })
    return new Response(null, { status: 204 })
  }

  if (request.method === 'PATCH') {
    const body = await request.json() as { collapsed?: boolean }
    if (typeof body.collapsed !== 'boolean') {
      return Response.json({ error: 'collapsed boolean required' }, { status: 400 })
    }
    await prisma.theme.update({ where: { id }, data: { collapsed: body.collapsed } })
    return new Response(null, { status: 204 })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add client/app/routes/api/themes.$id.ts
git commit -m "feat(themes): 테마 collapsed PATCH 엔드포인트"
```

---

### Task 7: 종목 순서 저장 엔드포인트

**Files:**
- Create: `client/app/routes/api/themes.$id.stocks.reorder.ts`

> `client/app/routes.ts`는 명시적 배열 방식이다. 신규 라우트를 직접 등록해야 하며, 정적 세그먼트 `reorder`가 동적 `:code`보다 먼저 매칭되도록 `:code` 라우트 **앞에** 등록한다.

- [ ] **Step 1: 엔드포인트 작성**

```typescript
import type { ActionFunctionArgs } from 'react-router'
import { prisma } from '~/db.server'

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  const themeId = Number(params.id)
  const body = await request.json() as { stockCodes?: string[] }
  if (!Array.isArray(body.stockCodes)) {
    return Response.json({ error: 'stockCodes array required' }, { status: 400 })
  }
  await Promise.all(
    body.stockCodes.map((stockCode, index) =>
      prisma.themeStock.update({
        where: { themeId_stockCode: { themeId, stockCode } },
        data: { order: index },
      })
    )
  )
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 2: routes.ts 등록**

`client/app/routes.ts`의 `api/themes/:id/stocks/:code` 줄 **바로 위**에 신규 라우트를 추가한다:

```typescript
  route("api/themes/:id/stocks/reorder", "routes/api/themes.$id.stocks.reorder.ts"),
  route("api/themes/:id/stocks/:code", "routes/api/themes.$id.stocks.$code.ts"),
```

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add client/app/routes/api/themes.$id.stocks.reorder.ts client/app/routes.ts
git commit -m "feat(themes): 종목 순서 저장 엔드포인트"
```

---

### Task 8: reorderStocks / setCollapsed 뮤테이션

**Files:**
- Modify: `client/app/routes/themes/hooks/useThemeMutations.ts`

- [ ] **Step 1: reorderStocks 뮤테이션 추가**

`reorderThemes` 뮤테이션 정의 뒤, `return` 문 앞에 추가:

```typescript
  const reorderStocks = useMutation({
    mutationFn: async ({ themeId, stockCodes }: { themeId: number; stockCodes: string[] }) => {
      const res = await fetch(`/api/themes/${themeId}/stocks/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockCodes }),
      })
      if (!res.ok) throw new Error('종목 순서 저장에 실패했습니다.')
    },
    onMutate: async ({ themeId, stockCodes }: { themeId: number; stockCodes: string[] }) => {
      await queryClient.cancelQueries({ queryKey: themesQueryKey })
      const previous = queryClient.getQueryData<ThemesApiResponse>(themesQueryKey)
      if (previous) {
        queryClient.setQueryData<ThemesApiResponse>(themesQueryKey, {
          ...previous,
          themes: previous.themes.map(theme => {
            if (theme.id !== themeId) return theme
            const byCode = new Map(theme.stocks.map(s => [s.stockCode, s]))
            const reordered = stockCodes
              .map((code, index) => {
                const stock = byCode.get(code)
                return stock ? { ...stock, order: index } : undefined
              })
              .filter((s): s is NonNullable<typeof s> => s != null)
            return { ...theme, stocks: reordered }
          }),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(themesQueryKey, context.previous)
      }
      invalidate()
    },
  })
```

- [ ] **Step 2: setCollapsed 뮤테이션 추가**

이어서 추가:

```typescript
  const setCollapsed = useMutation({
    mutationFn: async ({ themeId, collapsed }: { themeId: number; collapsed: boolean }) => {
      const res = await fetch(`/api/themes/${themeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collapsed }),
      })
      if (!res.ok) throw new Error('접힘 상태 저장에 실패했습니다.')
    },
    onMutate: async ({ themeId, collapsed }: { themeId: number; collapsed: boolean }) => {
      await queryClient.cancelQueries({ queryKey: themesQueryKey })
      const previous = queryClient.getQueryData<ThemesApiResponse>(themesQueryKey)
      if (previous) {
        queryClient.setQueryData<ThemesApiResponse>(themesQueryKey, {
          ...previous,
          themes: previous.themes.map(theme =>
            theme.id === themeId ? { ...theme, collapsed } : theme
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(themesQueryKey, context.previous)
      }
      invalidate()
    },
  })
```

- [ ] **Step 3: return에 노출**

```typescript
  return { createTheme, deleteTheme, addStock, removeStock, toggleLeader, reorderThemes, reorderStocks, setCollapsed }
```

- [ ] **Step 4: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add client/app/routes/themes/hooks/useThemeMutations.ts
git commit -m "feat(themes): reorderStocks, setCollapsed 낙관적 뮤테이션"
```

---

### Task 9: ThemePanel 접힘 상태 prop 기반 전환

**Files:**
- Modify: `client/app/routes/themes/components/ThemePanel.tsx`

- [ ] **Step 1: prop 추가 및 useState 제거**

`useState` import 제거하고, `ThemePanelProps`에 `onToggleCollapse` 추가:

```typescript
import type { ThemeWithLeader } from "@brain-lock/kiwoom";
import { ThemeStockItem } from "./ThemeStockItem";

interface ThemePanelProps {
  theme: ThemeWithLeader;
  onDelete: (id: number) => void;
  onRemoveStock: (themeId: number, stockCode: string) => void;
  onToggleLeader: (
    themeId: number,
    stockCode: string,
    current: boolean
  ) => void;
  onToggleCollapse: (themeId: number, collapsed: boolean) => void;
  isDropTarget?: boolean;
  dragHandleProps?: Record<string, unknown>;
}
```

- [ ] **Step 2: 함수 시그니처/본문 수정**

`export function ThemePanel({ ... })`에서 `onToggleCollapse`를 구조분해에 추가하고, `const [collapsed, setCollapsed] = useState(false);` 줄을 제거한 뒤 `collapsed`를 `theme.collapsed`로 사용:

```typescript
export function ThemePanel({
  theme,
  onDelete,
  onRemoveStock,
  onToggleLeader,
  onToggleCollapse,
  isDropTarget = false,
  dragHandleProps,
}: ThemePanelProps) {
  const collapsed = theme.collapsed;
  return (
```

토글 버튼의 onClick 수정:

```typescript
        <button
          type="button"
          onClick={() => onToggleCollapse(theme.id, !collapsed)}
          className="text-gray-500 hover:text-white text-xs w-4 shrink-0"
          title={collapsed ? "펼치기" : "접기"}
        >
          {collapsed ? "▶" : "▼"}
        </button>
```

- [ ] **Step 3: 타입체크 (실패 확인)**

Run: `npm run typecheck -w @brain-lock/client`
Expected: `themes.tsx`가 아직 `onToggleCollapse`를 넘기지 않아 FAIL. (Task 11에서 해소)

---

### Task 10: ThemeStockItem을 sortable로 전환

**Files:**
- Modify: `client/app/routes/themes/components/ThemeStockItem.tsx`

- [ ] **Step 1: useSortable 적용**

파일 전체를 다음으로 교체:

```typescript
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ThemeStockWithLeader } from "@brain-lock/kiwoom";

interface ThemeStockItemProps {
  stock: ThemeStockWithLeader;
  themeId: number;
  onRemove: (themeId: number, stockCode: string) => void;
  onToggleLeader: (
    themeId: number,
    stockCode: string,
    current: boolean
  ) => void;
}

export function ThemeStockItem({
  stock,
  themeId,
  onRemove,
  onToggleLeader,
}: ThemeStockItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `stock-${themeId}-${stock.stockCode}`,
      data: { type: "stock", themeId, stockCode: stock.stockCode },
    });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded group"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-gray-600 cursor-grab active:cursor-grabbing select-none shrink-0"
        title="드래그해서 순서 변경"
      >
        ≡
      </span>
      <button
        type="button"
        onClick={() =>
          onToggleLeader(themeId, stock.stockCode, stock.manualLeader)
        }
        title={stock.manualLeader ? "수동 주도주 해제" : "수동 주도주 지정"}
        className="text-sm shrink-0"
      >
        {stock.isLeader ? "⭐" : "☆"}
      </button>
      <span className="flex-1 text-sm text-white truncate">
        {stock.stockName}
      </span>
      <span className="text-xs text-gray-500 font-mono">{stock.stockCode}</span>
      {stock.rankingData && (
        <span
          className={`text-xs font-mono ${Number(stock.rankingData.changeRate) >= 0 ? "text-red-400" : "text-blue-400"}`}
        >
          {stock.rankingData.changeRate}%
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
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: Task 9의 `themes.tsx` 에러만 남고 이 파일 관련 에러는 없음.

---

### Task 11: themes.tsx — 종목 SortableContext 중첩 + drag 분기 + collapse 배선

**Files:**
- Modify: `client/app/routes/themes.tsx`

- [ ] **Step 1: ThemePanel 안 종목을 SortableContext로 감싸기**

`ThemePanel`은 stocks 렌더링을 내부에서 하므로, 종목 SortableContext를 ThemePanel 내부에 넣어야 한다. `ThemePanel.tsx`의 stocks 렌더 블록을 SortableContext로 감싼다.

`ThemePanel.tsx` 상단에 import 추가:

```typescript
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
```

stocks 렌더 부분(`theme.stocks.map(...)`)을 감싼다:

```typescript
      {!collapsed && (
        <div className="py-1 min-h-[40px]">
          {theme.stocks.length === 0 ? (
            <p className="text-xs text-gray-600 px-3 py-2">
              종목을 드래그해서 추가하세요
            </p>
          ) : (
            <SortableContext
              items={theme.stocks.map(
                (s) => `stock-${theme.id}-${s.stockCode}`
              )}
              strategy={verticalListSortingStrategy}
            >
              {theme.stocks.map((stock) => (
                <ThemeStockItem
                  key={stock.stockCode}
                  stock={stock}
                  themeId={theme.id}
                  onRemove={onRemoveStock}
                  onToggleLeader={onToggleLeader}
                />
              ))}
            </SortableContext>
          )}
        </div>
      )}
```

- [ ] **Step 2: SortableThemePanel에 onToggleCollapse 전달**

`themes.tsx`의 `SortableThemePanel` 컴포넌트 props 타입에 `onToggleCollapse` 추가하고 `ThemePanel`에 전달:

```typescript
function SortableThemePanel({
  theme,
  onDelete,
  onRemoveStock,
  onToggleLeader,
  onToggleCollapse,
}: {
  theme: ThemeWithLeader;
  onDelete: (id: number) => void;
  onRemoveStock: (themeId: number, stockCode: string) => void;
  onToggleLeader: (
    themeId: number,
    stockCode: string,
    current: boolean
  ) => void;
  onToggleCollapse: (themeId: number, collapsed: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isOver } =
    useSortable({
      id: `theme-${theme.id}`,
      data: { type: "theme", themeId: theme.id },
    });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <ThemePanel
        theme={theme}
        onDelete={onDelete}
        onRemoveStock={onRemoveStock}
        onToggleLeader={onToggleLeader}
        onToggleCollapse={onToggleCollapse}
        isDropTarget={isOver}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
```

- [ ] **Step 3: 렌더에서 onToggleCollapse 콜백 전달**

`themes.map((theme) => (<SortableThemePanel ... />))` 부분에 prop 추가:

```typescript
                {themes.map((theme) => (
                  <SortableThemePanel
                    key={theme.id}
                    theme={theme}
                    onDelete={(id) => mutations.deleteTheme.mutate(id)}
                    onRemoveStock={(themeId, stockCode) =>
                      mutations.removeStock.mutate({ themeId, stockCode })
                    }
                    onToggleLeader={(themeId, stockCode, current) =>
                      mutations.toggleLeader.mutate({
                        themeId,
                        stockCode,
                        manualLeader: !current,
                      })
                    }
                    onToggleCollapse={(themeId, collapsed) =>
                      mutations.setCollapsed.mutate({ themeId, collapsed })
                    }
                  />
                ))}
```

- [ ] **Step 4: handleDragEnd에 stock 분기 추가**

`handleDragEnd` 함수에서, ranking→theme 분기 다음에 stock reorder 분기를 추가한다. 종목 id는 `stock-${themeId}-${stockCode}` 형식이므로 themeId를 `data.current`에서 읽어 같은 테마일 때만 reorder한다:

```typescript
    if (activeId.startsWith("stock-") && overId.startsWith("stock-")) {
      const activeThemeId = active.data.current?.themeId as number | undefined;
      const overThemeId = over.data.current?.themeId as number | undefined;
      if (
        activeThemeId == null ||
        activeThemeId !== overThemeId ||
        activeId === overId
      ) {
        return;
      }
      const theme = themes.find((t) => t.id === activeThemeId);
      if (!theme) return;
      const codes = theme.stocks.map((s) => s.stockCode);
      const activeCode = active.data.current?.stockCode as string;
      const overCode = over.data.current?.stockCode as string;
      const oldIndex = codes.indexOf(activeCode);
      const newIndex = codes.indexOf(overCode);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(codes, oldIndex, newIndex);
      mutations.reorderStocks.mutate({
        themeId: activeThemeId,
        stockCodes: reordered,
      });
      return;
    }
```

이 분기는 기존 ranking→theme 분기(`activeId.startsWith("ranking-")`) 뒤, theme→theme 분기 앞에 둔다.

- [ ] **Step 5: 타입체크 (통과 확인)**

Run: `npm run typecheck -w @brain-lock/client`
Expected: PASS (Task 9·10 포함 모든 에러 해소).

- [ ] **Step 6: 커밋**

```bash
git add client/app/routes/themes.tsx client/app/routes/themes/components/ThemePanel.tsx client/app/routes/themes/components/ThemeStockItem.tsx
git commit -m "feat(themes): 종목 드래그 순서변경 + 접힘 상태 영속화 UI"
```

---

### Task 12: 수동 통합 검증

**Files:** 없음 (수동)

- [ ] **Step 1: 개발 서버 기동**

Run: `npm run dev`

- [ ] **Step 2: 종목 순서 변경 검증**

`/themes`에서 한 테마에 종목 2개 이상 추가 → ≡ 핸들로 순서 변경 → 브라우저 새로고침 → 순서가 유지되는지 확인.

- [ ] **Step 3: 접힘 영속화 검증**

테마 패널을 ▼ 버튼으로 접기 → 서버 재시작(dev 종료 후 재기동) → `/themes` 재진입 → 접힘 상태가 유지되는지 확인.

- [ ] **Step 4: 회귀 확인**

테마 순서 변경, 종목 추가/삭제, 주도주 토글이 여전히 정상 동작하는지 확인.

---

## Self-Review 결과

- **Spec coverage:** 종목 순서 변경(Task 1,4,5,7,8,10,11), 접힘 영속화(Task 1,6,8,9,11) 모두 태스크로 매핑됨. 테마 간 이동 제외는 Task 11 Step 4의 themeId 비교로 보장.
- **Placeholder scan:** 코드 스텝마다 실제 코드 포함. routes.ts는 명시적 배열 방식으로 확인됨 — Task 7 Step 2에 정확한 등록 위치/코드 명시.
- **Type consistency:** `reorderStocks({ themeId, stockCodes })`, `setCollapsed({ themeId, collapsed })`, `onToggleCollapse(themeId, collapsed)`, sortable id `stock-${themeId}-${stockCode}`, data `{ themeId, stockCode }` — 태스크 전반에서 일치.
