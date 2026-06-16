# Balance Guard — 외부 주문 자동 시장가 매도 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BrainLock을 통해 주문하지 않은 계좌 보유 포지션을 서버가 지속 감시하다 즉시 시장가로 매도한다.

**Architecture:** 모든 구성요소(장부 DB, 주문 훅, 감시 워처)를 `client/`의 long-lived React Router Node 서버 한 프로세스 안에 둔다. 실제 앱 DB(SQLite)가 client에 있고, 주문도 이미 client의 `trade.tsx` action에서 나가며, 잔고 조회/주문 API도 `@brain-lock/kiwoom`에 있기 때문이다. 워처는 부팅 시 `entry.server.tsx`에서 1회 시작되는 `setInterval`이다.

**Tech Stack:** React Router 7 (SSR, Node), Prisma + SQLite, `@brain-lock/kiwoom`, TypeScript. 머니 로직(외부 수량 계산)은 순수 함수로 분리해 `node:test`(+`tsx`)로 단위 테스트한다.

**설계 문서:** `docs/superpowers/specs/2026-06-16-balance-guard-auto-sell-design.md`

**주의 — 실제 매도:** `trde_tp: '3'`(시장가) 매도가 실제 계좌에 나간다. 구현·검증은 `KIWOOM_ENVIRONMENT=mock`에서 수행한다. `GuardSetting.enabled` 기본값 OFF.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `client/prisma/schema.prisma` (modify) | `LedgerPosition`, `PendingSell`, `GuardSetting` 모델 추가 |
| `client/app/guard/computeForeign.ts` (create) | 순수 함수: 보유/승인/대기 수량 → 매도할 외부 수량 계산 |
| `client/app/guard/computeForeign.test.ts` (create) | `computeForeign` 단위 테스트 (`node:test`) |
| `client/app/guard/ledger.server.ts` (create) | Prisma 데이터 레이어: 장부 적립/차감, 설정 조회/토글, pending sell CRUD |
| `client/app/guard/watcher.server.ts` (create) | 폴링 루프: 잔고 조회 → 외부 수량 계산 → 시장가 매도 → pending 기록 |
| `client/app/entry.server.tsx` (create) | RR7 표준 SSR 엔트리 + 부팅 시 `startWatcher()` 1회 호출 |
| `client/app/routes/trade.tsx` (modify) | 주문 성공 시 장부 적립(매수)/차감(매도) 훅 + 폼에 `stk_nm` 추가 |
| `client/app/routes/guard.tsx` (create) | 활성화(종목별 keep/sell) UI + kill-switch 토글, loader/action |
| `client/app/routes.ts` (modify) | `/guard` 라우트 등록 |

> 참고: 현재 client에는 매수 취소 UI/플로우가 없다. 설계의 "취소 훅"은 취소 기능이 생길 때 추가하며, 이 플랜 범위 밖이다. 미체결 지정가 잔여 크레딧 한계(설계 §6)는 그대로 유효.

---

## Task 1: Prisma 모델 추가 + 마이그레이션

**Files:**
- Modify: `client/prisma/schema.prisma`

- [ ] **Step 1: 모델 3개 추가**

`client/prisma/schema.prisma` 파일 끝에 추가:

```prisma
model LedgerPosition {
  stockCode   String   @id
  stockName   String
  approvedQty Int      @default(0)
  updatedAt   DateTime @updatedAt
}

model PendingSell {
  id        Int      @id @default(autoincrement())
  stockCode String
  qty       Int
  orderNo   String?
  createdAt DateTime @default(now())
}

model GuardSetting {
  id        Int      @id @default(1)
  enabled   Boolean  @default(false)
  activated Boolean  @default(false)
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: 마이그레이션 생성 + 클라이언트 생성**

Run (repo root):
```bash
npm run db:migrate -w @brain-lock/client -- --name add_balance_guard
npm run db:generate -w @brain-lock/client
```
Expected: `migrations/<timestamp>_add_balance_guard/` 생성, Prisma Client 재생성 성공.

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: 통과 (새 모델이 생성된 client에 반영됨).

- [ ] **Step 4: Commit**

```bash
git add client/prisma/schema.prisma client/prisma/migrations
git commit -m "feat(guard): balance guard용 Prisma 모델 추가"
```

---

## Task 2: 외부 수량 계산 순수 함수 (TDD)

머니 로직의 핵심. DB/IO 없이 순수 계산만 한다.

**Files:**
- Create: `client/app/guard/computeForeign.ts`
- Test: `client/app/guard/computeForeign.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`client/app/guard/computeForeign.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeForeignSells, type Holding } from "./computeForeign";

const h = (
  stockCode: string,
  quantity: number,
  orderableQuantity: number,
  stockName = stockCode
): Holding => ({ stockCode, stockName, quantity, orderableQuantity });

test("승인량이 보유량 이상이면 매도 없음", () => {
  const out = computeForeignSells([h("005930", 10, 10)], new Map([["005930", 10]]), new Map());
  assert.deepEqual(out, []);
});

test("승인량 0이면 보유 전량이 외부", () => {
  const out = computeForeignSells([h("005930", 7, 7)], new Map(), new Map());
  assert.deepEqual(out, [{ stockCode: "005930", stockName: "005930", qty: 7 }]);
});

test("초과분만 매도", () => {
  const out = computeForeignSells([h("005930", 15, 15)], new Map([["005930", 10]]), new Map());
  assert.deepEqual(out, [{ stockCode: "005930", stockName: "005930", qty: 5 }]);
});

test("pending 수량은 차감되어 중복 매도 안 함", () => {
  const out = computeForeignSells(
    [h("005930", 15, 15)],
    new Map([["005930", 10]]),
    new Map([["005930", 5]])
  );
  assert.deepEqual(out, []);
});

test("매도 가능 수량(orderableQuantity)으로 상한", () => {
  const out = computeForeignSells([h("005930", 15, 3)], new Map(), new Map());
  assert.deepEqual(out, [{ stockCode: "005930", stockName: "005930", qty: 3 }]);
});

test("여러 종목 동시 처리, 음수/0은 스킵", () => {
  const out = computeForeignSells(
    [h("005930", 5, 5, "삼성전자"), h("000660", 10, 10, "SK하이닉스")],
    new Map([["005930", 5]]),
    new Map()
  );
  assert.deepEqual(out, [{ stockCode: "000660", stockName: "SK하이닉스", qty: 10 }]);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run (repo root): `node --import tsx --test client/app/guard/computeForeign.test.ts`
Expected: FAIL — `computeForeign.ts` 모듈/`computeForeignSells` 없음.

- [ ] **Step 3: 최소 구현**

`client/app/guard/computeForeign.ts`:

```ts
export type Holding = {
  stockCode: string;
  stockName: string;
  quantity: number;
  orderableQuantity: number;
};

export type ForeignSell = {
  stockCode: string;
  stockName: string;
  qty: number;
};

/**
 * 종목별로 "외부에서 유입되어 매도해야 할 수량"을 계산한다.
 * foreign = min(보유 - 승인 - 대기, 매도가능 - 대기), 0 이하는 스킵.
 */
export function computeForeignSells(
  holdings: Holding[],
  approvedQtyByCode: Map<string, number>,
  pendingQtyByCode: Map<string, number>
): ForeignSell[] {
  const result: ForeignSell[] = [];
  for (const h of holdings) {
    const approved = approvedQtyByCode.get(h.stockCode) ?? 0;
    const pending = pendingQtyByCode.get(h.stockCode) ?? 0;
    const foreign = Math.min(
      h.quantity - approved - pending,
      h.orderableQuantity - pending
    );
    if (foreign > 0) {
      result.push({ stockCode: h.stockCode, stockName: h.stockName, qty: foreign });
    }
  }
  return result;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run (repo root): `node --import tsx --test client/app/guard/computeForeign.test.ts`
Expected: PASS — 6개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add client/app/guard/computeForeign.ts client/app/guard/computeForeign.test.ts
git commit -m "feat(guard): 외부 수량 계산 순수 함수 + 테스트"
```

---

## Task 3: 장부 데이터 레이어 (`ledger.server.ts`)

**Files:**
- Create: `client/app/guard/ledger.server.ts`

- [ ] **Step 1: 데이터 레이어 작성**

`client/app/guard/ledger.server.ts`:

```ts
import { prisma } from "~/db.server";

const SINGLETON_ID = 1;

export async function getGuardSetting() {
  return prisma.guardSetting.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
}

export async function setGuardEnabled(enabled: boolean) {
  return prisma.guardSetting.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, enabled },
    update: { enabled },
  });
}

/** 활성화 완료 표시 + 가드 ON */
export async function markActivated() {
  return prisma.guardSetting.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, activated: true, enabled: true },
    update: { activated: true, enabled: true },
  });
}

/** 매수 시 승인 수량 누적 */
export async function creditLedger(stockCode: string, stockName: string, qty: number) {
  return prisma.ledgerPosition.upsert({
    where: { stockCode },
    create: { stockCode, stockName, approvedQty: qty },
    update: { approvedQty: { increment: qty }, stockName },
  });
}

/** 내 매도 시 승인 수량 차감(0 하한) */
export async function debitLedger(stockCode: string, qty: number) {
  const pos = await prisma.ledgerPosition.findUnique({ where: { stockCode } });
  if (!pos) return;
  const next = Math.max(0, pos.approvedQty - qty);
  await prisma.ledgerPosition.update({ where: { stockCode }, data: { approvedQty: next } });
}

/** 활성화 reconciliation: 보유분을 그대로 승인량으로 세팅 */
export async function seedApproved(stockCode: string, stockName: string, qty: number) {
  return prisma.ledgerPosition.upsert({
    where: { stockCode },
    create: { stockCode, stockName, approvedQty: qty },
    update: { approvedQty: qty, stockName },
  });
}

export async function getApprovedMap(): Promise<Map<string, number>> {
  const rows = await prisma.ledgerPosition.findMany();
  return new Map(rows.map((r) => [r.stockCode, r.approvedQty]));
}

export async function clearExpiredPendingSells(ttlMs: number) {
  const cutoff = new Date(Date.now() - ttlMs);
  await prisma.pendingSell.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

export async function getPendingMap(): Promise<Map<string, number>> {
  const rows = await prisma.pendingSell.findMany();
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.stockCode, (m.get(r.stockCode) ?? 0) + r.qty);
  return m;
}

export async function insertPendingSell(stockCode: string, qty: number, orderNo?: string) {
  await prisma.pendingSell.create({ data: { stockCode, qty, orderNo: orderNo ?? null } });
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add client/app/guard/ledger.server.ts
git commit -m "feat(guard): 장부 데이터 레이어"
```

---

## Task 4: 감시 워처 (`watcher.server.ts`)

**Files:**
- Create: `client/app/guard/watcher.server.ts`

- [ ] **Step 1: 워처 작성**

`client/app/guard/watcher.server.ts`:

```ts
import { fetchAccountEvaluation, sellStock } from "@brain-lock/kiwoom";
import { computeForeignSells } from "./computeForeign";
import {
  getGuardSetting,
  getApprovedMap,
  getPendingMap,
  clearExpiredPendingSells,
  insertPendingSell,
} from "./ledger.server";

const POLL_MS = 3000;
const PENDING_TTL_MS = 60_000;

async function tick() {
  const setting = await getGuardSetting();
  if (!setting.enabled) return;

  await clearExpiredPendingSells(PENDING_TTL_MS);

  const [acct, approved, pending] = await Promise.all([
    fetchAccountEvaluation(),
    getApprovedMap(),
    getPendingMap(),
  ]);

  const sells = computeForeignSells(acct.holdings, approved, pending);

  for (const s of sells) {
    try {
      const res = await sellStock({
        stk_cd: s.stockCode,
        ord_qty: String(s.qty),
        ord_uv: "",
        trde_tp: "3", // 시장가
      });
      await insertPendingSell(s.stockCode, s.qty, res.ord_no);
      console.log(
        `[guard] 외부 포지션 시장가 매도: ${s.stockName}(${s.stockCode}) x${s.qty} ord_no=${res.ord_no ?? "?"}`
      );
    } catch (e) {
      console.error(`[guard] 매도 실패 ${s.stockCode}`, e);
    }
  }
}

/** 서버 부팅 시 1회 호출. globalThis 가드로 중복 시작 방지(dev HMR 포함). */
export function startWatcher() {
  const g = globalThis as unknown as { __guardWatcher?: ReturnType<typeof setInterval> };
  if (g.__guardWatcher) return;
  g.__guardWatcher = setInterval(() => {
    tick().catch((e) => console.error("[guard] tick error", e));
  }, POLL_MS);
  console.log("[guard] balance watcher 시작");
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add client/app/guard/watcher.server.ts
git commit -m "feat(guard): 잔고 감시 워처(시장가 매도 루프)"
```

---

## Task 5: SSR 엔트리에서 워처 부팅 (`entry.server.tsx`)

RR7 표준 Node 엔트리를 만들고 모듈 로드 시 `startWatcher()`를 호출한다. 이 파일은 서버에서만, 부팅 시 1회 로드된다.

**Files:**
- Create: `client/app/entry.server.tsx`

- [ ] **Step 1: 엔트리 작성**

`client/app/entry.server.tsx`:

```tsx
import { PassThrough } from "node:stream";
import type { EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { startWatcher } from "./guard/watcher.server";

export const streamTimeout = 5_000;

// 서버 부팅 시 1회 — balance guard 워처 시작
startWatcher();

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");

    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, streamTimeout + 1000);
  });
}
```

- [ ] **Step 2: 타입체크 + 부팅 로그 확인**

Run: `npm run typecheck -w @brain-lock/client`
Expected: 통과.

Run: `npm run dev -w @brain-lock/client` (몇 초 후 종료)
Expected: 콘솔에 `[guard] balance watcher 시작` 출력. (`enabled`가 OFF이므로 매도는 발생하지 않음.)

- [ ] **Step 3: Commit**

```bash
git add client/app/entry.server.tsx
git commit -m "feat(guard): SSR 엔트리에서 워처 부팅"
```

---

## Task 6: 주문 성공 시 장부 훅 (`trade.tsx`)

매수 성공 → 적립, 매도 성공 → 차감. 종목명을 위해 폼에 `stk_nm` 추가.

**Files:**
- Modify: `client/app/routes/trade.tsx`

- [ ] **Step 1: action에 장부 훅 추가**

`client/app/routes/trade.tsx`의 `action`(현재 25–37행)을 아래로 교체:

```ts
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const stk_cd = String(formData.get("stk_cd") ?? "");
  const stk_nm = String(formData.get("stk_nm") ?? "");
  const ord_qty = String(formData.get("ord_qty") ?? "");
  const ord_uv = String(formData.get("ord_uv") ?? "");
  const trde_tp = String(formData.get("trde_tp") ?? "0") as KiwoomOrderType;
  const side = String(formData.get("side") ?? "buy");

  const { buyStock, sellStock } = await import("@brain-lock/kiwoom");
  const fn = side === "sell" ? sellStock : buyStock;
  const result = await fn({ stk_cd, ord_qty, ord_uv, trde_tp });

  if (Number(result.return_code) === 0) {
    const { creditLedger, debitLedger } = await import("~/guard/ledger.server");
    const qty = Number(ord_qty);
    if (qty > 0) {
      if (side === "sell") {
        await debitLedger(stk_cd, qty);
      } else {
        await creditLedger(stk_cd, stk_nm || stk_cd, qty);
      }
    }
  }

  return { result };
}
```

- [ ] **Step 2: 폼 제출에 `stk_nm` 추가**

`client/app/routes/trade.tsx`의 `handleConfirm`(현재 130–139행) `fetcher.submit` 첫 인자 객체에 `stk_nm` 추가:

```ts
    fetcher.submit(
      {
        stk_cd: selected.code,
        stk_nm: selected.name,
        ord_qty: String(parsedQty),
        ord_uv: orderType === "market" ? "" : String(parsedPrice),
        trde_tp: orderType === "market" ? "3" : "0",
        side,
      },
      { method: "post" }
    );
```

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: 통과.

- [ ] **Step 4: Commit**

```bash
git add client/app/routes/trade.tsx
git commit -m "feat(guard): 주문 성공 시 장부 적립/차감 훅"
```

---

## Task 7: 활성화 + kill-switch 라우트 (`/guard`)

보유 종목을 종목별 keep/sell로 정리하고 가드를 켠다. 켜진 뒤에는 ON/OFF 토글.

**Files:**
- Create: `client/app/routes/guard.tsx`
- Modify: `client/app/routes.ts`

- [ ] **Step 1: 라우트 등록**

`client/app/routes.ts`의 배열에 한 줄 추가(`themes` 라우트 아래):

```ts
  route("guard", "routes/guard.tsx"),
```

- [ ] **Step 2: 라우트 파일 작성**

`client/app/routes/guard.tsx`:

```tsx
import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/guard";
import { fetchAccountEvaluation } from "@brain-lock/kiwoom";
import {
  getGuardSetting,
  setGuardEnabled,
  markActivated,
  seedApproved,
} from "~/guard/ledger.server";

export async function loader() {
  const [setting, acct] = await Promise.all([
    getGuardSetting(),
    fetchAccountEvaluation(),
  ]);
  return {
    setting,
    holdings: acct.holdings.map((h) => ({
      stockCode: h.stockCode,
      stockName: h.stockName,
      quantity: h.quantity,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "toggle") {
    await setGuardEnabled(String(form.get("enabled")) === "true");
    return { ok: true };
  }

  if (intent === "activate") {
    const acct = await fetchAccountEvaluation();
    // 체크된 종목 = keep. 보유분을 승인량으로 시드.
    for (const h of acct.holdings) {
      if (form.get(`keep:${h.stockCode}`) === "on") {
        await seedApproved(h.stockCode, h.stockName, h.quantity);
      }
    }
    // keep 안 한 종목은 승인량 0 → 워처가 다음 틱에 시장가 청산.
    await markActivated();
    return { ok: true };
  }

  return { ok: false };
}

export default function Guard() {
  const { setting, holdings } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-10 gap-6">
      <h1 className="text-lg font-semibold">Balance Guard</h1>

      <div className="text-sm text-gray-400">
        상태: {setting.enabled ? "🟢 ON" : "⚪ OFF"}
        {setting.activated ? "" : " (미활성화)"}
      </div>

      {!setting.activated ? (
        <Form method="post" className="w-full max-w-sm space-y-3">
          <input type="hidden" name="intent" value="activate" />
          <p className="text-xs text-gray-500">
            유지할 종목만 체크하세요. 체크 안 한 종목은 활성화 후 시장가로 매도됩니다.
          </p>
          {holdings.length === 0 && (
            <p className="text-sm text-gray-400">현재 보유 종목 없음.</p>
          )}
          {holdings.map((h) => (
            <label
              key={h.stockCode}
              className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
            >
              <span className="text-sm">
                {h.stockName}
                <span className="text-gray-500"> ({h.stockCode})</span> · {h.quantity}주
              </span>
              <input type="checkbox" name={`keep:${h.stockCode}`} defaultChecked />
            </label>
          ))}
          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-500 rounded-lg py-2.5 text-sm font-semibold"
          >
            활성화 (이후 외부 포지션 자동 시장가 매도)
          </button>
        </Form>
      ) : (
        <Form method="post" className="w-full max-w-sm">
          <input type="hidden" name="intent" value="toggle" />
          <input type="hidden" name="enabled" value={(!setting.enabled).toString()} />
          <button
            type="submit"
            className={`w-full rounded-lg py-2.5 text-sm font-semibold ${
              setting.enabled ? "bg-gray-700 hover:bg-gray-600" : "bg-green-600 hover:bg-green-500"
            }`}
          >
            {setting.enabled ? "가드 끄기 (OFF)" : "가드 켜기 (ON)"}
          </button>
        </Form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck -w @brain-lock/client`
Expected: 통과 (`react-router typegen`이 `./+types/guard` 생성).

- [ ] **Step 4: Commit**

```bash
git add client/app/routes.ts client/app/routes/guard.tsx
git commit -m "feat(guard): 활성화 + kill-switch 라우트(/guard)"
```

---

## Task 8: Mock 환경 수동 E2E 검증

실제 매도가 나가므로 반드시 `KIWOOM_ENVIRONMENT=mock`에서.

**Files:** 없음 (검증 전용)

- [ ] **Step 1: mock으로 dev 기동**

Run (repo root): `npm run dev`
Expected: client 콘솔에 `[guard] balance watcher 시작`. `.env.development`의 `KIWOOM_ENVIRONMENT=mock` 확인.

- [ ] **Step 2: 활성화 — keep 검증**

`/guard` 접속 → 보유 종목 전부 keep 체크 → 활성화.
Expected: 상태 `🟢 ON`. 워처가 돌아도(3초마다) 어떤 매도도 발생하지 않음(콘솔에 `시장가 매도` 로그 없음). DB `LedgerPosition.approvedQty == 보유수량` (`npm run db:studio -w @brain-lock/client`로 확인).

- [ ] **Step 3: 정상 매수 경로 검증**

`/`(trade)에서 임의 종목 1주 매수 성공.
Expected: 다음 틱에 그 종목이 매도되지 않음. `LedgerPosition`에 해당 종목 `approvedQty`가 매수 수량만큼 증가.

- [ ] **Step 4: 외부 포지션 매도 검증**

가드 ON 상태에서, **앱을 거치지 않고**(예: 키움 영웅문/별도 스크립트로) mock 계좌에 한 종목을 매수해 외부 유입 상황을 만든다.
Expected: 3초 이내 콘솔에 `[guard] 외부 포지션 시장가 매도: ...` 로그, 해당 수량이 시장가 매도됨. `PendingSell` 행 생성으로 같은 틱/다음 틱 중복 매도 없음.

- [ ] **Step 5: kill-switch 검증**

`/guard`에서 OFF 토글 → 다시 외부 포지션을 만들어도 매도 안 됨. ON으로 되돌리면 다시 매도.
Expected: `GuardSetting.enabled` 토글에 따라 매도 동작 on/off.

- [ ] **Step 6: 검증 결과 기록 커밋(선택)**

검증만 통과하면 별도 커밋 불필요. 문제 발견 시 해당 Task로 돌아가 수정.

---

## 완료 기준

- [ ] `computeForeign` 단위 테스트 통과
- [ ] `npm run typecheck -w @brain-lock/client` 통과
- [ ] mock에서: keep한 종목/정상 매수분은 보존, 외부 유입분만 시장가 매도
- [ ] kill-switch OFF 시 매도 중단, ON 시 재개
- [ ] 중복 매도 없음(PendingSell 가드 동작)
