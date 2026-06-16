# Balance Guard 체결 피드(`00`) 기반 장부 정밀화 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키움 `00` 주문체결 실시간 피드를 구독해, 장부(`approved`)와 자동매도 대기(`PendingSell`)를 *주문 시점 추정*이 아니라 *실체결 이벤트* 로 갱신한다. 이로써 미체결/취소 지정가 매수의 유령 크레딧(섹션 6 한계)과 "같은 종목 재진입이 60초 blind TTL에 막혀 늦게 매도되는" 버그를 동시에 해소한다.

**Architecture:** `client/` long-lived Node 프로세스 안에 신규 server-only 모듈 `orderFeed.server.ts` 를 두고, 부팅 시 `createKiwoomSocket().connect("00")` → `register("00", [""])` 로 계좌 단위 체결 피드를 구독한다. 자체/외부 주문은 **주문번호(`9203`)** 로 구분한다: 우리가 낸 주문은 `OwnedOrder`(USER) / `PendingSell`(GUARD 자동매도)에 기록되어 있고, 어디에도 없으면 외부. 의사결정 로직은 순수 함수 `computeOrderEffect` 로 분리해 단위 테스트한다. 폴링 워처는 외부 탐지 백스톱으로 유지하되, 레이스 가드용 `outstandingBuy`(미체결 자체 매수 예약분)를 차감한다.

**Tech Stack:** React Router 7 (SSR, Node), Prisma + SQLite, `@brain-lock/kiwoom`(WebSocket/REST), `node:test` + `tsx` 테스트 러너.

**설계 문서:** `docs/superpowers/specs/2026-06-16-balance-guard-auto-sell-design.md` 섹션 7.

**선행 참고:**
- 순수 함수 테스트 실행: `client/` 에서 `npx tsx --test app/guard/<파일>.test.ts`
- 타입체크: `client/` 에서 `npm run typecheck`
- 키움 `00` 필드 정의: `docs/kiwoom_realtime_order.md`
- ⚠️ 스펙 7.6의 실측 검증 항목(`9001` 접두어, `907` 매도수구분, `913` 상태 문자열, `902` 동작, 모의투자 `00` 수신 여부, 동시 소켓 한도)은 구현 후 모의투자 로그로 확인한다. 본 플랜의 매핑은 문서 기준 추정값이다.

---

## File Structure

생성:
- `shared/orderExecution.ts` — `00` 실시간 메시지 → `OrderExecution` 도메인 타입 + `parseOrderExecution` 매퍼
- `client/app/guard/computeOrderEffect.ts` — 순수 의사결정 함수(이벤트 → 장부 효과)
- `client/app/guard/computeOrderEffect.test.ts` — 위 함수의 단위 테스트
- `client/app/guard/orderFeed.server.ts` — `00` 피드 구독 + 효과 적용 + 재연결

수정:
- `client/prisma/schema.prisma` — `OwnedOrder` 모델 추가
- `shared/index.ts` — `orderExecution` 익스포트
- `client/app/guard/computeForeign.ts` — `outstandingBuyByCode` 파라미터 추가
- `client/app/guard/computeForeign.test.ts` — 기존 호출 시그니처 호환 + 레이스 가드 케이스
- `client/app/guard/ledger.server.ts` — OwnedOrder/효과 적용 헬퍼 추가, `creditLedger`/`debitLedger` 제거
- `client/app/routes/trade.tsx` — 주문 성공 시 `creditLedger`/`debitLedger` → `insertOwnedOrder`
- `client/app/guard/watcher.server.ts` — `outstandingBuy` 차감, TTL 백업값, stale OwnedOrder 정리
- `client/app/entry.server.tsx` — `startOrderFeed()` 부팅 훅

---

## Task 1: Prisma — `OwnedOrder` 모델 + 마이그레이션

**Files:**
- Modify: `client/prisma/schema.prisma`

- [ ] **Step 1: `OwnedOrder` 모델 추가**

`client/prisma/schema.prisma` 끝의 `GuardSetting` 모델 아래에 추가:

```prisma
model OwnedOrder {
  orderNo   String   @id           // 키움 ord_no
  stockCode String
  stockName String
  side      String                 // "BUY" | "SELL"
  orderQty  Int
  filledQty Int      @default(0)   // 누적 체결 (델타 · 예약분 계산)
  closed    Boolean  @default(false) // 완전체결/취소/거부 시 true
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

`PendingSell` / `LedgerPosition` / `GuardSetting` 은 변경하지 않는다.

- [ ] **Step 2: 마이그레이션 생성 + 클라이언트 재생성**

Run (repo 루트에서):
```bash
cd client && npx prisma migrate dev --name add_owned_order
```
Expected: 새 마이그레이션 폴더 `client/prisma/migrations/<timestamp>_add_owned_order/` 생성, "✔ Generated Prisma Client" 출력. (DATABASE_URL은 기존 마이그레이션과 동일하게 로드됨.)

- [ ] **Step 3: 타입 재생성 확인**

Run:
```bash
cd client && npm run typecheck
```
Expected: 통과 (이 시점엔 `OwnedOrder` 사용처가 없어 에러 없음).

- [ ] **Step 4: 커밋**

```bash
git add client/prisma/schema.prisma client/prisma/migrations
git commit -m "feat(guard): OwnedOrder 모델 추가 — 자체 주문 체결 추적"
```

---

## Task 2: shared — `OrderExecution` 도메인 타입 + `parseOrderExecution` 매퍼

**Files:**
- Create: `shared/orderExecution.ts`
- Modify: `shared/index.ts`

- [ ] **Step 1: 매퍼 모듈 작성**

`shared/orderExecution.ts` 생성:

```ts
import type { RealtimeMessage } from "./types.js";

export type OrderExecutionSide = "BUY" | "SELL";

export type OrderExecution = {
  accountNo: string;
  orderNo: string;
  stockCode: string;
  stockName: string;
  orderStatus: string;
  side: OrderExecutionSide;
  orderQuantity: number;
  unfilledQuantity: number;
  executedQuantity: number;
  executedPrice: number;
  executionTime: string;
  raw: unknown;
};

/**
 * 키움 `00`(주문체결) 실시간 메시지를 도메인 타입으로 변환.
 * 종목코드(9001)는 account.ts와 동일하게 접두어(A/J/Q 등) 제거.
 * 매도수구분(907): "2"=매수, 그 외=매도 (docs/kiwoom_realtime_order.md 기준).
 */
export function parseOrderExecution(message: RealtimeMessage): OrderExecution[] {
  if (message.trnm !== "REAL" || !message.data) return [];
  return message.data
    .filter((d) => d.type === "00")
    .map((d) => {
      const v = d.values ?? {};
      return {
        accountNo: v["9201"] ?? "",
        orderNo: v["9203"] ?? "",
        stockCode: (v["9001"] ?? "").replace(/^[A-Z]/, ""),
        stockName: v["302"] ?? "",
        orderStatus: v["913"] ?? "",
        side: v["907"] === "2" ? "BUY" : "SELL",
        orderQuantity: Number(v["900"] ?? 0),
        unfilledQuantity: Number(v["902"] ?? 0),
        executedQuantity: Number(v["911"] ?? 0),
        executedPrice: Number(v["910"] ?? 0),
        executionTime: v["908"] ?? "",
        raw: d,
      };
    });
}
```

- [ ] **Step 2: 배럴 익스포트 추가**

`shared/index.ts` 의 `export { fetchAccountEvaluation } from "./account.js";` 줄 아래에 추가:

```ts
export { parseOrderExecution } from "./orderExecution.js";
export type { OrderExecution, OrderExecutionSide } from "./orderExecution.js";
```

- [ ] **Step 3: 타입체크**

Run:
```bash
cd client && npm run typecheck
```
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add shared/orderExecution.ts shared/index.ts
git commit -m "feat(kiwoom): 00 주문체결 파서 parseOrderExecution 추가"
```

---

## Task 3: 순수 의사결정 함수 `computeOrderEffect` (TDD)

이벤트 1건 + 매칭 정보(OwnedOrder / PendingSell 여부)를 받아 "어떤 장부 변경을 해야 하는가"를 순수하게 결정한다. DB/소켓과 분리해 단위 테스트한다.

**Files:**
- Create: `client/app/guard/computeOrderEffect.ts`
- Test: `client/app/guard/computeOrderEffect.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`client/app/guard/computeOrderEffect.test.ts` 생성:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOrderEffect, type ExecutionInput, type OwnedOrderState } from "./computeOrderEffect";

const exec = (over: Partial<ExecutionInput> = {}): ExecutionInput => ({
  orderNo: "A1",
  stockCode: "005930",
  stockName: "삼성전자",
  side: "BUY",
  orderQuantity: 10,
  unfilledQuantity: 0,
  orderStatus: "체결",
  ...over,
});

test("외부 주문(매칭 없음)은 효과 없음", () => {
  assert.deepEqual(computeOrderEffect(exec(), null, false), { type: "none" });
});

test("내 매수 전량 체결 → approved 전량 적립 + close", () => {
  const owned: OwnedOrderState = { side: "BUY", filledQty: 0 };
  assert.deepEqual(computeOrderEffect(exec({ unfilledQuantity: 0 }), owned, false), {
    type: "approved", stockCode: "005930", stockName: "삼성전자", delta: 10, newFilled: 10, close: true,
  });
});

test("내 매수 부분 체결 → 델타만 적립, close 아님", () => {
  const owned: OwnedOrderState = { side: "BUY", filledQty: 4 };
  // 누계 = 10 - 4(미체결) = 6, 이전 filled 4 → 델타 2
  assert.deepEqual(computeOrderEffect(exec({ unfilledQuantity: 4 }), owned, false), {
    type: "approved", stockCode: "005930", stockName: "삼성전자", delta: 2, newFilled: 6, close: false,
  });
});

test("내 매도 체결 → approved 차감(음수 델타)", () => {
  const owned: OwnedOrderState = { side: "SELL", filledQty: 0 };
  assert.deepEqual(computeOrderEffect(exec({ side: "SELL", unfilledQuantity: 0 }), owned, false), {
    type: "approved", stockCode: "005930", stockName: "삼성전자", delta: -10, newFilled: 10, close: true,
  });
});

test("자동매도(PendingSell 매칭) 부분 체결 → 잔여 갱신, 제거 아님", () => {
  assert.deepEqual(computeOrderEffect(exec({ side: "SELL", unfilledQuantity: 3 }), null, true), {
    type: "pending", remaining: 3, remove: false,
  });
});

test("자동매도 전량 체결 → 잔여 0, 제거", () => {
  assert.deepEqual(computeOrderEffect(exec({ side: "SELL", unfilledQuantity: 0 }), null, true), {
    type: "pending", remaining: 0, remove: true,
  });
});

test("내 매수 취소(부분 체결 후) → 체결분만 적립 + close", () => {
  const owned: OwnedOrderState = { side: "BUY", filledQty: 6 };
  // 취소 시점 미체결 4 → 누계 6, 이전 6 → 델타 0, close true
  assert.deepEqual(computeOrderEffect(exec({ unfilledQuantity: 4, orderStatus: "취소확인" }), owned, false), {
    type: "approved", stockCode: "005930", stockName: "삼성전자", delta: 0, newFilled: 6, close: true,
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd client && npx tsx --test app/guard/computeOrderEffect.test.ts
```
Expected: FAIL — `Cannot find module './computeOrderEffect'`.

- [ ] **Step 3: 구현 작성**

`client/app/guard/computeOrderEffect.ts` 생성:

```ts
import type { OrderExecutionSide } from "@brain-lock/kiwoom";

export type ExecutionInput = {
  orderNo: string;
  stockCode: string;
  stockName: string;
  side: OrderExecutionSide;
  orderQuantity: number;
  unfilledQuantity: number;
  orderStatus: string;
};

export type OwnedOrderState = {
  side: OrderExecutionSide;
  filledQty: number;
};

export type OrderEffect =
  | {
      type: "approved";
      stockCode: string;
      stockName: string;
      delta: number; // 매수 +, 매도 -
      newFilled: number; // 갱신할 누적 체결 수량
      close: boolean;
    }
  | { type: "pending"; remaining: number; remove: boolean }
  | { type: "none" };

const TERMINAL_STATUS = /취소|거부/;

/** 주문상태(913)가 취소/거부면 종결로 본다. (스펙 7.6 실측 검증 대상) */
export function isCanceledOrRejected(orderStatus: string): boolean {
  return TERMINAL_STATUS.test(orderStatus);
}

/**
 * 체결 이벤트 1건의 장부 효과를 결정한다.
 * - isPendingSell: 이 orderNo가 자동매도(PendingSell) 행과 매칭됨
 * - owned: 이 orderNo가 USER OwnedOrder와 매칭됨(아니면 null)
 * - 둘 다 아니면 외부 주문 → 효과 없음(폴링이 매도)
 * 누적 체결 = 주문수량 - 미체결수량. 저장된 filledQty와의 차이만 approved에 반영.
 */
export function computeOrderEffect(
  e: ExecutionInput,
  owned: OwnedOrderState | null,
  isPendingSell: boolean
): OrderEffect {
  const canceled = isCanceledOrRejected(e.orderStatus);

  if (isPendingSell) {
    const remaining = Math.max(0, e.unfilledQuantity);
    return { type: "pending", remaining, remove: remaining <= 0 || canceled };
  }

  if (owned) {
    const cumulativeFilled = Math.max(0, e.orderQuantity - e.unfilledQuantity);
    const delta = cumulativeFilled - owned.filledQty;
    const signed = owned.side === "BUY" ? delta : -delta;
    return {
      type: "approved",
      stockCode: e.stockCode,
      stockName: e.stockName,
      delta: signed,
      newFilled: cumulativeFilled,
      close: e.unfilledQuantity <= 0 || canceled,
    };
  }

  return { type: "none" };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd client && npx tsx --test app/guard/computeOrderEffect.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add client/app/guard/computeOrderEffect.ts client/app/guard/computeOrderEffect.test.ts
git commit -m "feat(guard): 체결 효과 결정 순수함수 computeOrderEffect"
```

---

## Task 4: `computeForeign` — 레이스 가드 `outstandingBuy` (TDD)

**Files:**
- Modify: `client/app/guard/computeForeign.ts`
- Test: `client/app/guard/computeForeign.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`client/app/guard/computeForeign.test.ts` 의 마지막 `test(...)` 아래에 추가:

```ts
test("미체결 자체 매수 예약분(outstandingBuy)은 외부로 오인하지 않음", () => {
  // 보유 10, 승인 0, 대기 0, 미체결 자체매수 예약 10 → foreign 0
  const out = computeForeignSells(
    [h("005930", 10, 10)],
    new Map(),
    new Map(),
    new Map([["005930", 10]])
  );
  assert.deepEqual(out, []);
});

test("예약분을 초과한 보유분만 외부로 매도", () => {
  // 보유 15, 승인 0, 대기 0, 예약 10 → foreign 5
  const out = computeForeignSells(
    [h("005930", 15, 15)],
    new Map(),
    new Map(),
    new Map([["005930", 10]])
  );
  assert.deepEqual(out, [{ stockCode: "005930", stockName: "005930", qty: 5 }]);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd client && npx tsx --test app/guard/computeForeign.test.ts
```
Expected: FAIL — `computeForeignSells` 가 4번째 인자를 받지 않아 새 케이스의 결과가 기대와 다름(예: foreign 10 반환).

- [ ] **Step 3: 구현 수정**

`client/app/guard/computeForeign.ts` 의 `computeForeignSells` 를 다음으로 교체:

```ts
/**
 * 종목별로 "외부에서 유입되어 매도해야 할 수량"을 계산한다.
 * foreign = min(보유 - 승인 - 대기 - 미체결자체매수, 매도가능 - 대기), 0 이하는 스킵.
 * outstandingBuyByCode: 체결 전 자체 매수 예약분(레이스 가드). 기본값 빈 맵.
 */
export function computeForeignSells(
  holdings: Holding[],
  approvedQtyByCode: Map<string, number>,
  pendingQtyByCode: Map<string, number>,
  outstandingBuyByCode: Map<string, number> = new Map()
): ForeignSell[] {
  const result: ForeignSell[] = [];
  for (const h of holdings) {
    const approved = approvedQtyByCode.get(h.stockCode) ?? 0;
    const pending = pendingQtyByCode.get(h.stockCode) ?? 0;
    const outstandingBuy = outstandingBuyByCode.get(h.stockCode) ?? 0;
    const foreign = Math.min(
      h.quantity - approved - pending - outstandingBuy,
      h.orderableQuantity - pending
    );
    if (foreign > 0) {
      result.push({ stockCode: h.stockCode, stockName: h.stockName, qty: foreign });
    }
  }
  return result;
}
```

(기본값 파라미터라 기존 3-인자 호출은 그대로 컴파일/통과한다.)

- [ ] **Step 4: 전체 테스트 통과 확인**

Run:
```bash
cd client && npx tsx --test app/guard/computeForeign.test.ts
```
Expected: PASS (기존 6 + 신규 2 = 8 tests).

- [ ] **Step 5: 커밋**

```bash
git add client/app/guard/computeForeign.ts client/app/guard/computeForeign.test.ts
git commit -m "feat(guard): computeForeignSells에 outstandingBuy 레이스 가드 추가"
```

---

## Task 5: `ledger.server` — OwnedOrder/효과 적용 영속화 헬퍼

DB 글루라 단위 테스트 없이 타입체크로 검증한다. (동작 검증은 Task 9 + 스펙 7.6 모의투자 로그)

**Files:**
- Modify: `client/app/guard/ledger.server.ts`

- [ ] **Step 1: 신규 헬퍼 추가**

`client/app/guard/ledger.server.ts` 끝(`insertPendingSell` 아래)에 추가:

```ts
export async function insertOwnedOrder(params: {
  orderNo: string;
  stockCode: string;
  stockName: string;
  side: "BUY" | "SELL";
  orderQty: number;
}) {
  await prisma.ownedOrder.upsert({
    where: { orderNo: params.orderNo },
    create: params,
    update: {},
  });
}

export async function getOwnedOrder(orderNo: string) {
  return prisma.ownedOrder.findUnique({ where: { orderNo } });
}

/** 레이스 가드: 미체결 자체 매수 예약분 합계(종목별) */
export async function getOutstandingBuyMap(): Promise<Map<string, number>> {
  const rows = await prisma.ownedOrder.findMany({
    where: { side: "BUY", closed: false },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    const outstanding = Math.max(0, r.orderQty - r.filledQty);
    if (outstanding > 0) m.set(r.stockCode, (m.get(r.stockCode) ?? 0) + outstanding);
  }
  return m;
}

/** 체결 이벤트의 approved 효과 적용 + OwnedOrder.filledQty/closed 갱신(트랜잭션) */
export async function applyApprovedEffect(e: {
  orderNo: string;
  stockCode: string;
  stockName: string;
  delta: number;
  newFilled: number;
  close: boolean;
}) {
  await prisma.$transaction(async (tx) => {
    if (e.delta !== 0) {
      const pos = await tx.ledgerPosition.findUnique({ where: { stockCode: e.stockCode } });
      const next = Math.max(0, (pos?.approvedQty ?? 0) + e.delta);
      await tx.ledgerPosition.upsert({
        where: { stockCode: e.stockCode },
        create: { stockCode: e.stockCode, stockName: e.stockName, approvedQty: Math.max(0, e.delta) },
        update: { approvedQty: next, stockName: e.stockName },
      });
    }
    await tx.ownedOrder.update({
      where: { orderNo: e.orderNo },
      data: { filledQty: e.newFilled, closed: e.close },
    });
  });
}

export async function getPendingByOrderNo(orderNo: string) {
  return prisma.pendingSell.findFirst({ where: { orderNo } });
}

/** 자동매도 체결 효과 적용: 잔여 갱신 또는 제거 */
export async function applyPendingEffect(orderNo: string, remaining: number, remove: boolean) {
  if (remove) {
    await prisma.pendingSell.deleteMany({ where: { orderNo } });
  } else {
    await prisma.pendingSell.updateMany({ where: { orderNo }, data: { qty: remaining } });
  }
}

/** 백업 안전망: 체결 이벤트를 놓쳐 오래 열린 채 남은 OwnedOrder 종결 */
export async function closeStaleOwnedOrders(ttlMs: number) {
  const cutoff = new Date(Date.now() - ttlMs);
  await prisma.ownedOrder.updateMany({
    where: { closed: false, createdAt: { lt: cutoff } },
    data: { closed: true },
  });
}
```

- [ ] **Step 2: 사용처 없어진 `creditLedger` / `debitLedger` 제거**

`client/app/guard/ledger.server.ts` 에서 다음 두 함수를 삭제한다(Task 7에서 `trade.tsx` 가 더 이상 호출하지 않게 됨):

```ts
/** 매수 시 승인 수량 누적 */
export async function creditLedger(stockCode: string, stockName: string, qty: number) { ... }

/** 내 매도 시 승인 수량 차감(0 하한) */
export async function debitLedger(stockCode: string, qty: number) { ... }
```

`seedApproved`, `getApprovedMap`, `getGuardSetting`, `setGuardEnabled`, `markActivated`, pending 관련 함수는 그대로 둔다.

- [ ] **Step 3: 다른 참조 없는지 확인**

Run:
```bash
cd "C:/Users/kimwi/OneDrive/Desktop/dev/brain-lock" && grep -rn "creditLedger\|debitLedger" client/app shared server/src
```
Expected: `trade.tsx` 외 결과 없음. (`trade.tsx` 는 Task 7에서 정리.) 만약 다른 참조가 나오면 그 호출처도 함께 마이그레이션할 것.

- [ ] **Step 4: 타입체크**

Run:
```bash
cd client && npm run typecheck
```
Expected: `trade.tsx` 의 `creditLedger`/`debitLedger` import 에러만 발생(Task 7에서 해소). 그 외 신규 헬퍼는 통과.

> 참고: 이 단계 직후 typecheck는 `trade.tsx` 때문에 실패한다. Task 7과 묶어 커밋하므로 여기서는 별도 커밋하지 않고 바로 Task 7로 진행한다.

---

## Task 6: `orderFeed.server` — `00` 피드 구독 모듈

**Files:**
- Create: `client/app/guard/orderFeed.server.ts`

- [ ] **Step 1: 구독 모듈 작성**

`client/app/guard/orderFeed.server.ts` 생성:

```ts
import { createKiwoomSocket, parseOrderExecution } from "@brain-lock/kiwoom";
import type { RealtimeMessage } from "@brain-lock/kiwoom";
import { computeOrderEffect } from "./computeOrderEffect";
import {
  getOwnedOrder,
  getPendingByOrderNo,
  applyApprovedEffect,
  applyPendingEffect,
} from "./ledger.server";

const RECONNECT_MS = 5000;

async function handleRealtime(msg: RealtimeMessage) {
  const execs = parseOrderExecution(msg);
  for (const e of execs) {
    if (!e.orderNo) continue;

    const [owned, pending] = await Promise.all([
      getOwnedOrder(e.orderNo),
      getPendingByOrderNo(e.orderNo),
    ]);

    const effect = computeOrderEffect(
      {
        orderNo: e.orderNo,
        stockCode: e.stockCode,
        stockName: e.stockName,
        side: e.side,
        orderQuantity: e.orderQuantity,
        unfilledQuantity: e.unfilledQuantity,
        orderStatus: e.orderStatus,
      },
      owned ? { side: owned.side as "BUY" | "SELL", filledQty: owned.filledQty } : null,
      pending != null
    );

    if (effect.type === "approved") {
      await applyApprovedEffect({ ...effect, orderNo: e.orderNo });
      console.log(
        `[guard] 체결 반영 ${e.stockName}(${e.stockCode}) approved ${effect.delta >= 0 ? "+" : ""}${effect.delta}${effect.close ? " (종결)" : ""}`
      );
    } else if (effect.type === "pending") {
      await applyPendingEffect(e.orderNo, effect.remaining, effect.remove);
      console.log(
        `[guard] 자동매도 체결 ${e.stockName}(${e.stockCode}) 잔여=${effect.remaining}${effect.remove ? " (정리)" : ""}`
      );
    }
  }
}

function connectFeed() {
  const socket = createKiwoomSocket();
  socket
    .connect("00")
    .then(() => {
      socket.register("00", [""]);
      socket.onMessage((msg) => {
        if (msg.trnm !== "REAL") return;
        handleRealtime(msg).catch((err) => console.error("[guard] 체결 처리 오류", err));
      });
      socket.onClose(() => {
        console.warn("[guard] 체결 피드 연결 종료 — 재연결 예약");
        setTimeout(connectFeed, RECONNECT_MS);
      });
      console.log("[guard] 체결 피드(00) 구독 시작");
    })
    .catch((err) => {
      console.error("[guard] 체결 피드 연결 실패 — 재시도 예약", err);
      setTimeout(connectFeed, RECONNECT_MS);
    });
}

/** 서버 부팅 시 1회 호출. globalThis 가드로 중복 시작 방지(dev HMR 포함). */
export function startOrderFeed() {
  const g = globalThis as unknown as { __guardOrderFeed?: boolean };
  if (g.__guardOrderFeed) return;
  g.__guardOrderFeed = true;
  connectFeed();
}
```

- [ ] **Step 2: 타입체크**

Run:
```bash
cd client && npm run typecheck
```
Expected: (Task 5 후속이라) `trade.tsx` import 에러를 제외하면 이 파일 자체는 통과. `RealtimeMessage` / `createKiwoomSocket` / `parseOrderExecution` 가 `@brain-lock/kiwoom` 에서 정상 해석되어야 함.

> 커밋은 Task 7과 함께(아래) 진행 — entry 훅 연결까지 묶어야 부팅 경로가 완성된다.

---

## Task 7: `trade.tsx` — 주문 성공 시 OwnedOrder 기록으로 전환

**Files:**
- Modify: `client/app/routes/trade.tsx` (action, 현재 38–48행)

- [ ] **Step 1: 크레딧/차감 블록 교체**

`client/app/routes/trade.tsx` 의 다음 블록:

```ts
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
```

을 다음으로 교체:

```ts
  // 주문 시점 추정 적립이 아니라, 주문번호만 기록해 두고 실체결 이벤트(00 피드)가 장부를 갱신한다.
  if (Number(result.return_code) === 0 && result.ord_no) {
    const { insertOwnedOrder } = await import("~/guard/ledger.server");
    const qty = Number(ord_qty);
    if (qty > 0) {
      await insertOwnedOrder({
        orderNo: result.ord_no,
        stockCode: stk_cd,
        stockName: stk_nm || stk_cd,
        side: side === "sell" ? "SELL" : "BUY",
        orderQty: qty,
      });
    }
  }
```

- [ ] **Step 2: entry 부팅 훅 연결**

`client/app/entry.server.tsx` 의 import 블록에 추가:

```ts
import { startOrderFeed } from "./guard/orderFeed.server";
```

그리고 `startWatcher();` 호출 바로 아래에 추가:

```ts
startOrderFeed();
```

- [ ] **Step 3: 타입체크 (이제 깨끗해야 함)**

Run:
```bash
cd client && npm run typecheck
```
Expected: PASS — `creditLedger`/`debitLedger` 참조가 사라지고 `result.ord_no`(`StockOrderResponse.ord_no?: string`) 분기로 해소됨.

- [ ] **Step 4: 커밋 (Task 5·6·7 묶음)**

```bash
git add client/app/guard/ledger.server.ts client/app/guard/orderFeed.server.ts client/app/routes/trade.tsx client/app/entry.server.tsx
git commit -m "feat(guard): 00 체결 피드 구독 + 주문 기록을 OwnedOrder로 전환"
```

---

## Task 8: `watcher.server` — outstandingBuy 차감 + TTL 백업화 + stale 정리

**Files:**
- Modify: `client/app/guard/watcher.server.ts`

- [ ] **Step 1: import 보강**

`client/app/guard/watcher.server.ts` 의 ledger import 에 `getOutstandingBuyMap`, `closeStaleOwnedOrders` 추가:

```ts
import {
  getGuardSetting,
  getApprovedMap,
  getPendingMap,
  getOutstandingBuyMap,
  clearExpiredPendingSells,
  closeStaleOwnedOrders,
  insertPendingSell,
} from "./ledger.server";
```

- [ ] **Step 2: TTL 상수 백업값으로, stale 상수 추가**

상단 상수 교체:

```ts
const POLL_MS = 3000;
// 체결 이벤트(00 피드)가 정상 경로. TTL/stale 정리는 이벤트 누락(WS 끊김) 대비 백업 안전망.
const PENDING_TTL_MS = 600_000;
const OWNED_STALE_MS = 600_000;
```

- [ ] **Step 3: tick 본문에서 outstandingBuy 반영 + stale 정리**

`tick()` 내부의 다음 부분:

```ts
  await clearExpiredPendingSells(PENDING_TTL_MS);

  const [acct, approved, pending] = await Promise.all([
    fetchAccountEvaluation(),
    getApprovedMap(),
    getPendingMap(),
  ]);
  const sells = computeForeignSells(acct.holdings, approved, pending);
```

을 다음으로 교체:

```ts
  await clearExpiredPendingSells(PENDING_TTL_MS);
  await closeStaleOwnedOrders(OWNED_STALE_MS);

  const [acct, approved, pending, outstandingBuy] = await Promise.all([
    fetchAccountEvaluation(),
    getApprovedMap(),
    getPendingMap(),
    getOutstandingBuyMap(),
  ]);
  const sells = computeForeignSells(acct.holdings, approved, pending, outstandingBuy);
```

`sellStock` 호출과 `insertPendingSell` 기록 로직은 그대로 둔다(자동매도는 계속 `PendingSell` 에 기록되어 `00` 피드가 매칭·정리한다).

- [ ] **Step 4: 타입체크**

Run:
```bash
cd client && npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add client/app/guard/watcher.server.ts
git commit -m "feat(guard): 워처에 outstandingBuy 차감 + 체결피드 백업 TTL/stale 정리"
```

---

## Task 9: 최종 검증 + 정리

**Files:** 없음(검증 단계)

- [ ] **Step 1: 전체 가드 테스트 실행**

Run:
```bash
cd client && npx tsx --test app/guard/computeForeign.test.ts app/guard/computeOrderEffect.test.ts
```
Expected: PASS — computeForeign 8 + computeOrderEffect 7 = 15 tests, fail 0.

- [ ] **Step 2: 전체 타입체크**

Run:
```bash
cd client && npm run typecheck
```
Expected: PASS.

- [ ] **Step 3: 빌드 스모크(선택)**

Run:
```bash
cd client && npm run build
```
Expected: 빌드 성공(서버 번들에 `orderFeed.server`/`watcher.server` 포함). 실패 시 import 경로/타입 확인.

- [ ] **Step 4: 스펙 7.6 실측 검증 메모를 이슈/TODO로 남기기**

구현은 끝났지만 다음은 **모의투자 실거래 로그로만** 확정 가능하다. 코드 주석/PR 설명에 명시:
- `9001` 종목코드 접두어가 실제로 `^[A-Z]` 형태인지 (아니면 `parseOrderExecution` 정규식 조정)
- `907` "2"=매수 매핑이 맞는지
- `913` 주문상태에 "취소"/"거부" 문자열이 실제로 포함되는지 (`isCanceledOrRejected` 정규식 조정 가능성)
- 부분체결 시 `902` 미체결수량이 누계 기준으로 감소하는지
- 모의투자 환경에서 `00` 이벤트가 실제로 수신되는지
- `server/`(0B) + `client/`(00) 동시 소켓 연결이 키움 한도 내인지

---

## Self-Review (작성자 점검 결과)

**1. 스펙 커버리지 (섹션 7):**
- 7.1 데이터 모델(OwnedOrder + PendingSell TTL 백업) → Task 1, Task 8
- 7.2 orderFeed.server 구독 모듈(소켓 변경 없음, 매퍼만 추가) → Task 2, Task 6
- 7.3 이벤트 처리(orderNo 매칭, 델타=주문수량−미체결, PendingSell 정리/approved 갱신/외부 무시) → Task 3(결정) + Task 5(적용) + Task 6(배선)
- 7.4 레이스 가드 outstandingBuy → Task 4, Task 5, Task 8
- 7.5 기존 파일 변경(trade.tsx / watcher / computeForeign) → Task 7, Task 8, Task 4
- 7.6 실측 검증 항목 → Task 9 Step 4
- 취소 훅 불필요화 → Task 7(주문 시점 적립 제거)로 자연 해소
- 버그(60초 blind TTL) 해소 → Task 3의 pending-remove 테스트 + Task 8의 TTL 백업화로 커버

**2. Placeholder 스캔:** 모든 코드 스텝에 실제 코드/명령/기대출력 포함. TBD/TODO 없음.

**3. 타입 일관성:** `computeOrderEffect`(Task 3)의 `ExecutionInput`/`OwnedOrderState`/`OrderEffect` 가 Task 6 호출과 일치. `OrderExecutionSide`(Task 2)를 Task 3에서 import. `applyApprovedEffect` 의 효과 객체 형태(`{stockCode,stockName,delta,newFilled,close}`)가 `OrderEffect`의 `approved` 변형 + `orderNo` 와 일치(Task 6에서 `{...effect, orderNo}`). `insertOwnedOrder` 시그니처(Task 5)가 Task 7 호출과 일치. `computeForeignSells` 4-인자(Task 4)가 Task 8 호출과 일치.
