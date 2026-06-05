# 지수 하락세 경고 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매수 전, 선택 종목이 속한 시장의 종합지수가 연속 하락(sticky 추세)이면 매수 체크리스트에 경고 항목을 띄운다.

**Architecture:** `shared/`에 ka20003 종합지수 조회 레이어를 추가하고, `client/` SSR 프로세스 메모리에 시장별 추세 상태를 유지한다. 클라이언트 react-query가 60초마다 `/api/index`를 폴링하며 매 요청이 1틱이 되어 연속 하락/반등을 센다(히스테리시스). 결과를 `TradeConfirmModal`의 3번째 체크 항목으로 노출한다.

**Tech Stack:** TypeScript(strict), React Router 7, @tanstack/react-query, axios(kiwoom), tsx(테스트 러너), node:assert.

**테스트 방침:** 테스트 러너 미설정. 순수 로직(`recordTick`, `pickCompositeIndex`, `getMarketType`)은 `node:assert` 스크립트를 `npx tsx`로 실행해 검증한다. React/route/hook 결선은 `npm run typecheck -w @brain-lock/client`로 검증한다.

**설계 문서:** `docs/superpowers/specs/2026-06-06-index-downtrend-warning-design.md`

---

## File Structure

| 파일 | 책임 | 신규/수정 |
| --- | --- | --- |
| `shared/types.ts` | `SectorMarketType`, `IndustryIndexItem/Response`, `IndustryTheme` 타입 | 수정 |
| `shared/sector.ts` | ka20003 호출 + 종합지수 추출(순수 `pickCompositeIndex`, `toIndustryTheme`) | 신규 |
| `shared/sector.test.ts` | `pickCompositeIndex`/`toIndustryTheme` 단위 테스트 | 신규 |
| `shared/index.ts` | 배럴 익스포트 | 수정 |
| `shared/stocks.ts` | 종목 마스터에 `market` 스탬프 | 수정 |
| `client/app/lib/indexTrend.server.ts` | 시장별 sticky 추세 상태(순수 `createTrendTracker` + 싱글톤) | 신규 |
| `client/app/lib/indexTrend.server.test.ts` | `recordTick` 단위 테스트 | 신규 |
| `client/app/routes/api/index.ts` | `/api/index?market=` loader | 신규 |
| `client/app/routes.ts` | 라우트 등록 | 수정 |
| `client/app/shared/utils.ts` | `getMarketType` 헬퍼 | 수정 |
| `client/app/shared/utils.test.ts` | `getMarketType` 테스트 | 신규 |
| `client/app/routes/trade/hooks/queries/useIndexTrend.ts` | react-query 폴링 훅 + `IndexTrend` 타입 | 신규 |
| `client/app/routes/trade.tsx` | 훅 결선 + 모달 prop 전달 | 수정 |
| `client/app/routes/trade/components/TradeConfirmModal.tsx` | 3번째 체크 항목 | 수정 |

---

## Task 1: shared 타입 + sector 데이터 레이어

**Files:**
- Modify: `shared/types.ts` (파일 끝에 추가)
- Create: `shared/sector.ts`
- Create: `shared/sector.test.ts`
- Modify: `shared/index.ts`

- [ ] **Step 1: 타입 추가 (`shared/types.ts` 파일 맨 끝에 append)**

```ts

export type SectorMarketType = "0" | "1";
// 0: 코스피, 1: 코스닥 (ka20003 mrkt_tp)

export interface IndustryIndexItem {
  upjong_cd: string;
  upjong_nm: string;
  cur_idx: string;
  pred_pre: string;
  pred_pre_sig: string;
  flu_rt: string;
  trde_qty: string;
  trde_prica: string;
  up_cnt: string;
  down_cnt: string;
  flat_cnt: string;
}

export interface IndustryIndexResponse {
  upjong_index: IndustryIndexItem[];
  return_code: number;
  return_msg: string;
}

export interface IndustryTheme {
  code: string;
  name: string;
  index: number;
  change: number;
  changeRate: number;
  tradingVolume: number;
  tradingAmount: number;
  upCount: number;
  downCount: number;
  flatCount: number;
}
```

- [ ] **Step 2: `shared/sector.ts` 생성**

```ts
import { kiwoomClient } from "./client.js";
import type {
  IndustryIndexItem,
  IndustryIndexResponse,
  IndustryTheme,
  SectorMarketType,
} from "./types.js";

// 코스피 종합지수 upjong_cd "001", 코스닥 종합지수 "101"
const COMPOSITE_CODE: Record<SectorMarketType, string> = {
  "0": "001",
  "1": "101",
};

export function toIndustryTheme(item: IndustryIndexItem): IndustryTheme {
  return {
    code: item.upjong_cd,
    name: item.upjong_nm,
    index: Number(item.cur_idx),
    change: Number(item.pred_pre),
    changeRate: Number(item.flu_rt),
    tradingVolume: Number(item.trde_qty),
    tradingAmount: Number(item.trde_prica),
    upCount: Number(item.up_cnt),
    downCount: Number(item.down_cnt),
    flatCount: Number(item.flat_cnt),
  };
}

// 종합지수 코드로 찾고, 없으면 목록 첫 항목으로 폴백 (실제 코드값 미확정 대비)
export function pickCompositeIndex(
  themes: IndustryTheme[],
  market: SectorMarketType
): IndustryTheme | undefined {
  const code = COMPOSITE_CODE[market];
  return themes.find((t) => t.code === code) ?? themes[0];
}

export async function getIndustryIndices(
  market: SectorMarketType
): Promise<IndustryTheme[]> {
  const { data } = await kiwoomClient.post<IndustryIndexResponse>(
    "/api/dostk/sector",
    { mrkt_tp: market },
    { headers: { "api-id": "ka20003" } }
  );
  return (data.upjong_index ?? []).map(toIndustryTheme);
}

export async function getCompositeIndex(
  market: SectorMarketType
): Promise<IndustryTheme> {
  const themes = await getIndustryIndices(market);
  const composite = pickCompositeIndex(themes, market);
  if (!composite) throw new Error("composite index not found");
  return composite;
}
```

- [ ] **Step 3: 실패 테스트 작성 (`shared/sector.test.ts`)**

```ts
import assert from "node:assert/strict";
import { pickCompositeIndex, toIndustryTheme } from "./sector.js";
import type { IndustryIndexItem, IndustryTheme } from "./types.js";

function theme(code: string, index: number): IndustryTheme {
  return {
    code,
    name: code,
    index,
    change: 0,
    changeRate: 0,
    tradingVolume: 0,
    tradingAmount: 0,
    upCount: 0,
    downCount: 0,
    flatCount: 0,
  };
}

// 코스피 종합 "001" 추출
assert.equal(
  pickCompositeIndex([theme("002", 1), theme("001", 100)], "0")?.code,
  "001"
);

// 코스닥 종합 "101" 추출
assert.equal(
  pickCompositeIndex([theme("105", 1), theme("101", 200)], "1")?.code,
  "101"
);

// 종합 코드 없으면 첫 항목 폴백
assert.equal(
  pickCompositeIndex([theme("999", 1), theme("888", 2)], "0")?.code,
  "999"
);

// 빈 목록이면 undefined
assert.equal(pickCompositeIndex([], "0"), undefined);

// 매퍼: 문자열 → 숫자 변환
const item: IndustryIndexItem = {
  upjong_cd: "001",
  upjong_nm: "종합(KOSPI)",
  cur_idx: "2500.12",
  pred_pre: "-3.4",
  pred_pre_sig: "5",
  flu_rt: "-0.14",
  trde_qty: "1000",
  trde_prica: "2000",
  up_cnt: "100",
  down_cnt: "800",
  flat_cnt: "50",
};
const mapped = toIndustryTheme(item);
assert.equal(mapped.code, "001");
assert.equal(mapped.index, 2500.12);
assert.equal(mapped.changeRate, -0.14);
assert.equal(mapped.downCount, 800);

console.log("sector.test.ts OK");
```

- [ ] **Step 4: 테스트 실행해 실패 확인**

Run (repo root): `npx tsx shared/sector.test.ts`
Expected: FAIL — `sector.ts`가 없거나 함수 미정의로 import 에러. (Step 2를 먼저 만들었다면 PASS; 그 경우 Step 2 코드를 잠시 비워 실패를 확인할 필요는 없음 — 바로 Step 6로 진행)

- [ ] **Step 5: 배럴 익스포트 추가 (`shared/index.ts`, 12번째 줄 뒤에 추가)**

```ts
export { getIndustryIndices, getCompositeIndex, pickCompositeIndex, toIndustryTheme } from "./sector.js";
```

(타입 `SectorMarketType`, `IndustryTheme` 등은 기존 `export * from "./types.js"`로 이미 노출됨)

- [ ] **Step 6: 테스트 실행해 통과 확인**

Run (repo root): `npx tsx shared/sector.test.ts`
Expected: PASS — 출력 `sector.test.ts OK`

- [ ] **Step 7: 커밋**

```bash
git add shared/types.ts shared/sector.ts shared/sector.test.ts shared/index.ts
git commit -m "feat(shared): ka20003 종합지수 조회 레이어 추가"
```

---

## Task 2: 종목 마스터 시장 스탬프 + getMarketType

**Files:**
- Modify: `shared/stocks.ts`
- Modify: `client/app/shared/utils.ts`
- Create: `client/app/shared/utils.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (`client/app/shared/utils.test.ts`)**

```ts
import assert from "node:assert/strict";
import { getMarketType } from "./utils";
import type { KiwoomStockMasterItem } from "@brain-lock/kiwoom";

function stock(market?: "0" | "1"): KiwoomStockMasterItem {
  return { code: "005930", name: "삼성전자", market, raw: {} };
}

assert.equal(getMarketType(stock("0")), "0");
assert.equal(getMarketType(stock("1")), "1");
assert.equal(getMarketType(stock(undefined)), null);
assert.equal(getMarketType(null), null);

console.log("utils.test.ts OK");
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run (repo root): `npx tsx client/app/shared/utils.test.ts`
Expected: FAIL — `getMarketType`가 `./utils`에 없음 / `market` 필드가 `KiwoomStockMasterItem`에 없어 타입 에러

- [ ] **Step 3: `shared/stocks.ts`에 `market` 필드 추가**

`shared/stocks.ts` 상단 import에 타입 추가 (1번째 줄 아래):

```ts
import { kiwoomClient } from "./client.js";
import type { SectorMarketType } from "./types.js";
```

`KiwoomStockMasterItem` 타입에 `market` 추가:

```ts
export type KiwoomStockMasterItem = {
  code: string;
  name: string;
  market?: SectorMarketType;
  marketCode?: string;
  marketName?: string;
  lastPrice?: string;
  state?: string;
  raw: Record<string, unknown>;
};
```

`fetchStockMasterByMarket`의 `.map(...)` 반환 객체에 `market` 스탬프 추가 (`code: item.code!,` 바로 위 또는 아래):

```ts
    .map((item: KiwoomStockMasterRawItem) => ({
      code: item.code!,
      name: item.name!,
      market: (marketType === "0" ? "0" : "1") as SectorMarketType,
      marketCode: item.marketCode,
      marketName: item.marketName,
      lastPrice: item.lastPrice,
      state: item.state,
      raw: item as Record<string, unknown>,
    }));
```

(이 함수의 인자 `marketType`은 `"0"`=코스피 / `"10"`=코스닥. 즉 코스피→`"0"`, 그 외→`"1"`)

- [ ] **Step 4: `client/app/shared/utils.ts`에 `getMarketType` 추가**

파일 상단에 타입 import 추가, 파일 끝에 함수 추가:

```ts
import type { KiwoomStockMasterItem } from "@brain-lock/kiwoom";
```

```ts
export function getMarketType(
  stock: KiwoomStockMasterItem | null | undefined
): "0" | "1" | null {
  return stock?.market ?? null;
}
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run (repo root): `npx tsx client/app/shared/utils.test.ts`
Expected: PASS — 출력 `utils.test.ts OK`

- [ ] **Step 6: 커밋**

```bash
git add shared/stocks.ts client/app/shared/utils.ts client/app/shared/utils.test.ts
git commit -m "feat(shared): 종목 마스터에 시장 구분 스탬프 + getMarketType"
```

---

## Task 3: 시장별 sticky 추세 상태

**Files:**
- Create: `client/app/lib/indexTrend.server.ts`
- Create: `client/app/lib/indexTrend.server.test.ts`

- [ ] **Step 1: `client/app/lib/indexTrend.server.ts` 생성**

```ts
import type { SectorMarketType } from "@brain-lock/kiwoom";

export const DOWN_TICK_THRESHOLD = 3; // 연속 3틱 하락 → 하락세 진입
export const REBOUND_TICK_THRESHOLD = 3; // 연속 3틱 반등 → 하락세 해제

export type TrendResult = {
  isDowntrend: boolean;
  downStreak: number;
  upStreak: number;
};

type TrendState = {
  prev: number | null;
  downStreak: number;
  upStreak: number;
  isDowntrend: boolean;
};

export function createTrendTracker(
  downThreshold: number = DOWN_TICK_THRESHOLD,
  reboundThreshold: number = REBOUND_TICK_THRESHOLD
) {
  const states = new Map<SectorMarketType, TrendState>();

  function recordTick(market: SectorMarketType, index: number): TrendResult {
    const s = states.get(market) ?? {
      prev: null,
      downStreak: 0,
      upStreak: 0,
      isDowntrend: false,
    };

    if (s.prev !== null) {
      if (index < s.prev) {
        s.downStreak++;
        s.upStreak = 0;
      } else if (index > s.prev) {
        s.upStreak++;
        s.downStreak = 0;
      } else {
        s.downStreak = 0;
        s.upStreak = 0;
      }
    }
    s.prev = index;

    if (!s.isDowntrend && s.downStreak >= downThreshold) {
      s.isDowntrend = true;
    } else if (s.isDowntrend && s.upStreak >= reboundThreshold) {
      s.isDowntrend = false;
    }

    states.set(market, s);
    return {
      isDowntrend: s.isDowntrend,
      downStreak: s.downStreak,
      upStreak: s.upStreak,
    };
  }

  return { recordTick };
}

let singleton: ReturnType<typeof createTrendTracker> | null = null;

export function getTrendTracker() {
  if (!singleton) singleton = createTrendTracker();
  return singleton;
}
```

- [ ] **Step 2: 실패 테스트 작성 (`client/app/lib/indexTrend.server.test.ts`)**

```ts
import assert from "node:assert/strict";
import { createTrendTracker } from "./indexTrend.server";

// 첫 틱은 비교 없음(prev 설정만), 연속 3틱 하락에 진입
{
  const { recordTick } = createTrendTracker(3, 3);
  assert.equal(recordTick("0", 100).isDowntrend, false); // prev=100
  assert.equal(recordTick("0", 99).isDowntrend, false); // down1
  assert.equal(recordTick("0", 98).isDowntrend, false); // down2
  const r = recordTick("0", 97); // down3
  assert.equal(r.isDowntrend, true);
  assert.equal(r.downStreak, 3);
}

// 반등 1틱으론 해제 안 됨 (sticky)
{
  const { recordTick } = createTrendTracker(3, 3);
  [100, 99, 98, 97].forEach((v) => recordTick("0", v)); // isDowntrend=true
  const r = recordTick("0", 98); // up1
  assert.equal(r.isDowntrend, true);
  assert.equal(r.upStreak, 1);
  assert.equal(r.downStreak, 0);
}

// 연속 3틱 반등해야 해제
{
  const { recordTick } = createTrendTracker(3, 3);
  [100, 99, 98, 97].forEach((v) => recordTick("0", v)); // true
  recordTick("0", 98); // up1
  recordTick("0", 99); // up2
  const r = recordTick("0", 100); // up3
  assert.equal(r.isDowntrend, false);
}

// 보합은 양쪽 스트릭 리셋 → 하락세 진입 지연
{
  const { recordTick } = createTrendTracker(3, 3);
  recordTick("0", 100);
  recordTick("0", 99); // down1
  recordTick("0", 99); // 보합 → reset
  recordTick("0", 98); // down1
  assert.equal(recordTick("0", 97).isDowntrend, false); // down2 only
}

// 시장별 상태 독립
{
  const { recordTick } = createTrendTracker(3, 3);
  [100, 99, 98, 97].forEach((v) => recordTick("0", v));
  assert.equal(recordTick("1", 500).isDowntrend, false);
  assert.equal(recordTick("1", 501).isDowntrend, false);
}

console.log("indexTrend.server.test.ts OK");
```

- [ ] **Step 3: 테스트 실행해 통과 확인**

Run (repo root): `npx tsx client/app/lib/indexTrend.server.test.ts`
Expected: PASS — 출력 `indexTrend.server.test.ts OK`
(Step 1을 먼저 작성했으므로 바로 통과. 실패를 보려면 `downThreshold` 비교를 `>`로 잠시 바꿔 확인 가능 — 선택)

- [ ] **Step 4: 커밋**

```bash
git add client/app/lib/indexTrend.server.ts client/app/lib/indexTrend.server.test.ts
git commit -m "feat(client): 시장별 sticky 지수 추세 추적기"
```

---

## Task 4: /api/index 라우트

**Files:**
- Create: `client/app/routes/api/index.ts`
- Modify: `client/app/routes.ts`

- [ ] **Step 1: `client/app/routes/api/index.ts` 생성**

```ts
import type { LoaderFunctionArgs } from "react-router";
import { getCompositeIndex } from "@brain-lock/kiwoom";
import { getTrendTracker } from "~/lib/indexTrend.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const market = new URL(request.url).searchParams.get("market");
  if (market !== "0" && market !== "1") {
    return Response.json({ error: "invalid market" }, { status: 400 });
  }

  try {
    const composite = await getCompositeIndex(market);
    const trend = getTrendTracker().recordTick(market, composite.index);
    return Response.json({
      name: composite.name,
      index: composite.index,
      changeRate: composite.changeRate,
      isDowntrend: trend.isDowntrend,
      downStreak: trend.downStreak,
      upStreak: trend.upStreak,
    });
  } catch {
    // 폴백: 매수 차단하지 않도록 중립 상태 반환
    return Response.json({
      name: market === "0" ? "코스피" : "코스닥",
      index: null,
      changeRate: null,
      isDowntrend: false,
      downStreak: 0,
      upStreak: 0,
    });
  }
}
```

- [ ] **Step 2: `client/app/routes.ts`에 라우트 등록**

`route("api/stocks", "routes/api/stocks.ts"),` 줄 아래에 추가:

```ts
  route("api/index", "routes/api/index.ts"),
```

- [ ] **Step 3: 타입체크로 검증**

Run (repo root): `npm run typecheck -w @brain-lock/client`
Expected: PASS — 에러 없음 (route 타입 생성 포함)

- [ ] **Step 4: 커밋**

```bash
git add client/app/routes/api/index.ts client/app/routes.ts
git commit -m "feat(client): /api/index 지수 추세 엔드포인트"
```

---

## Task 5: useIndexTrend 훅

**Files:**
- Create: `client/app/routes/trade/hooks/queries/useIndexTrend.ts`

- [ ] **Step 1: `client/app/routes/trade/hooks/queries/useIndexTrend.ts` 생성**

```ts
import { useQuery } from "@tanstack/react-query";
import { isMarketHours } from "~/shared/utils";

export type IndexTrend = {
  name: string;
  index: number | null;
  changeRate: number | null;
  isDowntrend: boolean;
  downStreak: number;
  upStreak: number;
};

async function fetchIndexTrend(market: "0" | "1"): Promise<IndexTrend> {
  const res = await fetch(`/api/index?market=${market}`);
  if (!res.ok) throw new Error("지수 데이터를 불러오지 못했습니다.");
  return res.json();
}

export function useIndexTrend(market: "0" | "1" | null) {
  return useQuery({
    queryKey: ["indexTrend", market],
    queryFn: () => fetchIndexTrend(market as "0" | "1"),
    enabled: market != null,
    refetchInterval: isMarketHours() ? 60_000 : false,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: 타입체크로 검증**

Run (repo root): `npm run typecheck -w @brain-lock/client`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add client/app/routes/trade/hooks/queries/useIndexTrend.ts
git commit -m "feat(client): useIndexTrend 폴링 훅"
```

---

## Task 6: TradeConfirmModal 체크 항목 추가

**Files:**
- Modify: `client/app/routes/trade/components/TradeConfirmModal.tsx`

- [ ] **Step 1: import + props에 `indexTrend` 추가**

상단 import에 타입 추가 (`useStockThemeStatus` import 아래):

```ts
import type { IndexTrend } from "~/routes/trade/hooks/queries/useIndexTrend";
```

`TradeConfirmModalProps`에 필드 추가 (`changeRate: number | null;` 아래):

```ts
  indexTrend: IndexTrend | undefined;
```

구조분해 인자에 추가 (`changeRate,` 아래):

```ts
  indexTrend,
```

- [ ] **Step 2: indexLabel 계산 + checks/checked 3개로 확장**

`const checks = [chaseLabel, themeLabel];` 를 아래로 교체:

```ts
  const indexLabel =
    indexTrend == null
      ? "지수 상태 확인 중..."
      : indexTrend.isDowntrend
      ? `⚠️ ${indexTrend.name} ${indexTrend.downStreak}틱 연속 하락 중 — 지금 매수 맞나?`
      : `✅ ${indexTrend.name} 하락세 아님`;

  const checks = [chaseLabel, themeLabel, indexLabel];
```

`const [checked, setChecked] = useState<boolean[]>([false, false]);` 를 교체:

```ts
  const [checked, setChecked] = useState<boolean[]>([false, false, false]);
```

`function reset() { setChecked([false, false]); }` 의 본문 교체:

```ts
  function reset() {
    setChecked([false, false, false]);
  }
```

- [ ] **Step 3: 타입체크로 검증**

Run (repo root): `npm run typecheck -w @brain-lock/client`
Expected: FAIL — `trade.tsx`에서 `<TradeConfirmModal>`에 `indexTrend` prop 미전달로 타입 에러 (Task 7에서 해결). 모달 파일 자체의 에러는 없어야 함.

- [ ] **Step 4: 커밋**

```bash
git add client/app/routes/trade/components/TradeConfirmModal.tsx
git commit -m "feat(client): 매수 체크리스트에 지수 하락세 항목 추가"
```

---

## Task 7: trade.tsx 결선

**Files:**
- Modify: `client/app/routes/trade.tsx`

- [ ] **Step 1: import 추가**

기존 hook import들 근처(`useRealtimePrice` import 아래)에 추가:

```ts
import { useIndexTrend } from "./trade/hooks/queries/useIndexTrend";
```

`getMarketType`를 utils import에 추가 — 기존 줄:

```ts
import { parsePrice, getTickSize } from "../shared/utils";
```

를 교체:

```ts
import { parsePrice, getTickSize, getMarketType } from "../shared/utils";
```

- [ ] **Step 2: 훅 호출 추가**

`useRealtimePrice` 호출부 아래 (`const currentPrice = ...` 줄 아래)에 추가:

```ts
  const market = getMarketType(selected);
  const { data: indexTrend } = useIndexTrend(market);
```

- [ ] **Step 3: 모달에 prop 전달**

`<TradeConfirmModal>` JSX에 `changeRate={realtimeChangeRate}` 아래로 prop 추가:

```tsx
        changeRate={realtimeChangeRate}
        indexTrend={indexTrend}
```

- [ ] **Step 4: 타입체크로 검증**

Run (repo root): `npm run typecheck -w @brain-lock/client`
Expected: PASS — Task 6에서 발생한 prop 에러 해소, 전체 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add client/app/routes/trade.tsx
git commit -m "feat(client): trade 페이지에 지수 추세 폴링 결선"
```

---

## Task 8: 전체 검증

- [ ] **Step 1: 모든 순수 로직 테스트 재실행**

Run (repo root):
```bash
npx tsx shared/sector.test.ts
npx tsx client/app/shared/utils.test.ts
npx tsx client/app/lib/indexTrend.server.test.ts
```
Expected: 세 줄 모두 `... OK` 출력, 비정상 종료 없음

- [ ] **Step 2: 클라이언트 타입체크**

Run (repo root): `npm run typecheck -w @brain-lock/client`
Expected: PASS

- [ ] **Step 3: 수동 확인 (`npm run dev` 구동 중, 모의 환경)**

1. trade 페이지에서 코스피 종목(예: 삼성전자) 선택 → 수량 입력 → 매수 클릭
2. 체크리스트 모달에 **3번째 "지수 상태" 항목**이 보이는지 확인
3. 네트워크 탭에서 `/api/index?market=0` 60초 폴링 확인
4. 코스닥 종목 선택 시 `market=1`로 요청되는지 확인

Expected: 모달에 지수 항목 노출, 폴백 시 "지수 상태 확인 중..." 표시, 체크해야 매수 버튼 활성화

> **하락세 라벨 실제 확인**은 종합지수가 장중 연속 하락하는 동안(또는 임계값을 임시로 1로 낮춰) 검증. 종합지수 `upjong_cd`(코스피 `001`/코스닥 `101`)가 모의 응답과 일치하는지 이 단계에서 확인 — 불일치 시 `shared/sector.ts`의 `COMPOSITE_CODE` 수정.

---

## Self-Review 결과

- **Spec coverage:** 데이터 레이어(Task1) / 추세 상태(Task3) / API(Task4) / 훅(Task5) / 시장 판별(Task2) / 모달(Task6) / 결선(Task7) — 스펙 7개 섹션 모두 태스크 매핑됨. 에러 처리(폴백)·테스트(순수 로직 3종) 반영.
- **Placeholder scan:** 없음. 모든 코드 스텝에 완전한 코드 포함.
- **Type consistency:** `SectorMarketType="0"|"1"`, `IndexTrend`, `TrendResult`, `recordTick`, `getMarketType`, `getCompositeIndex`, `pickCompositeIndex` 시그니처가 태스크 간 일치.
- **설계와의 차이:** 시장 판별을 `marketName/marketCode` 파싱 대신 종목 마스터 fetch 시점에 `market` 스탬프(결정적). 스펙의 "실제 값은 구현 중 확정" 의도에 부합하며 더 견고함.
