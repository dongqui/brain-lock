# 지수 하락세 경고 설계

## 목적

매수 전에 **시장 종합지수가 하락세인지** 판단해 경고한다. 뇌동매매 방지(BrainLock)의 게이트키퍼 역할 — 정상 거래를 막는 게 아니라, 지수가 연속 하락 중일 때 매수 전 한 번 더 확인하게 만든다.

기존 매수 체크리스트(등락률·테마)와 동일한 패턴으로 `TradeConfirmModal`에 항목 하나를 더한다.

## 핵심 결정사항

| 항목 | 결정 |
| --- | --- |
| 판정 방식 | 서버가 지수를 폴링하며 장중 시세 누적 → **연속 K틱 하락**이면 하락세 |
| 대상 지수 | 매수 종목 시장의 **종합지수** (코스피 종목 → 코스피 종합, 코스닥 → 코스닥 종합) |
| 추세 상태 | **sticky (히스테리시스)** — 연속 3틱 하락에 진입, 연속 3틱 반등해야 해제 |
| 노출 | `TradeConfirmModal`에 체크리스트 항목 추가 (체크해야 매수 가능) |
| 폴링 주기 | 클라이언트 react-query가 주도, 장중 60초 (기존 themes와 동일) |
| 상태 저장 | 서버 프로세스 **메모리** (DB 불필요, 재시작 시 초기화 허용) |

## 사용 API

`ka20003` 전업종지수요청 (`POST /api/dostk/sector`) — 한 시장의 전 업종지수 목록을 반환. 여기서 **종합지수 1건**만 추출한다.

- 요청: `{ mrkt_tp: "0" }` (코스피) / `"1"` (코스닥)
- 응답: `upjong_index: IndustryIndexItem[]` — 각 항목에 `cur_idx`(현재지수), `flu_rt`(등락률), `pred_pre_sig`(전일대비기호) 등
- 종합지수 추출: 코스피 종합 `upjong_cd "001"`, 코스닥 종합 `"101"`. 해당 코드가 없으면 목록 첫 항목으로 폴백. **실제 코드값은 구현 중 모의 API 응답으로 확정한다.**

자세한 스펙: `docs/kiwoom_index_api.md`

---

## 아키텍처

```
trade.tsx (선택 종목 → 시장 판별)
  └ useIndexTrend(market)  ── react-query 60s 폴링 ──┐
                                                     ▼
                              GET /api/index?market=0|1   (loader)
                                     │
                                     ├ getCompositeIndex(market)  ── ka20003 ──> Kiwoom
                                     └ recordTick(market, index)  ── 메모리 상태
                                                     │
                              { name, index, changeRate, isDowntrend, downStreak, upStreak }
                                                     │
  indexTrend ───────────────────────────────────────┘
  └ <TradeConfirmModal indexTrend={...}>  → 체크리스트 항목
```

### 1. 데이터 레이어 (`shared/`)

`shared/sector.ts` (신규):

```ts
// ka20003 호출, upjong_index를 IndustryTheme[]로 매핑 (docs의 toIndustryTheme 사용)
export async function getIndustryIndices(market: "0" | "1"): Promise<IndustryTheme[]>

// 종합지수 1건 추출. 코스피 "001" / 코스닥 "101", 없으면 첫 항목 폴백
export async function getCompositeIndex(market: "0" | "1"): Promise<IndustryTheme>
```

- `types.ts`에 `IndustryIndexResponse`, `IndustryIndexItem`, `IndustryTheme` 타입 추가
- `index.ts` 배럴에 익스포트

### 2. 추세 상태 (`client/app/lib/indexTrend.server.ts`, 신규)

모듈 싱글톤. 시장별 상태를 메모리에 유지하고, 매 틱마다 sticky 하락세 여부를 갱신.

```ts
// 시장별 상태: { prev: number | null, downStreak, upStreak, isDowntrend }
recordTick(market: "0" | "1", index: number):
    { isDowntrend, downStreak, upStreak }

// 로직
if index < prev  → downStreak++,  upStreak = 0
if index > prev  → upStreak++,    downStreak = 0
if index == prev → downStreak = 0, upStreak = 0   // 보합은 양쪽 스트릭 끊음

// 상태 전이 (히스테리시스)
if !isDowntrend && downStreak >= DOWN_TICK_THRESHOLD   → isDowntrend = true
if  isDowntrend && upStreak   >= REBOUND_TICK_THRESHOLD → isDowntrend = false
```

- `DOWN_TICK_THRESHOLD = 3` — 연속 3틱 하락에 하락세 진입
- `REBOUND_TICK_THRESHOLD = 3` — 연속 3틱 반등해야 하락세 해제 (반등 1틱으론 안 풀림)
- 두 상수는 분리 (필요 시 따로 조정)
- 연속 틱은 **클라이언트가 폴링하는 동안만** 쌓이므로, trade 페이지가 선택 종목 시장 지수를 모달과 무관하게 **상시 폴링**해야 한다.

### 3. API 라우트 (`client/app/routes/api/index.ts`, 신규)

```ts
// loader: ?market=0|1
//   getCompositeIndex(market) → recordTick(market, index) → 응답
//   { name, index, changeRate, isDowntrend, downStreak, upStreak }
//   실패 시 themes 라우트처럼 안전 폴백 (중립 상태 반환)
```

`routes.ts`에 `/api/index` 등록.

### 4. 클라이언트 훅 (`client/app/routes/trade/hooks/queries/useIndexTrend.ts`, 신규)

```ts
useIndexTrend(market: "0" | "1" | null)
//  queryKey ["indexTrend", market]
//  refetchInterval: isMarketHours() ? 60_000 : false
//  enabled: market != null
//  → { name, changeRate, isDowntrend, downStreak, upStreak } | undefined
```

### 5. 시장 판별 (`~/shared/utils`)

```ts
// 선택 종목(KiwoomStockMasterItem)의 marketName/marketCode → "0"|"1"|null
getMarketType(stock: KiwoomStockMasterItem | null): "0" | "1" | null
```

실제 `marketCode`/`marketName` 값은 종목 마스터 응답으로 확정.

### 6. trade.tsx 연결

```ts
const market = getMarketType(selected);
const indexTrend = useIndexTrend(market);   // 모달 무관 상시 폴링 → 틱 누적
// ...
<TradeConfirmModal indexTrend={indexTrend} ... />
```

### 7. 모달 체크리스트 (`TradeConfirmModal`)

기존 등락률·테마와 동일 패턴으로 **3번째 항목** 추가:

```ts
const indexLabel =
  indexTrend == null
    ? "지수 상태 확인 중..."
    : indexTrend.isDowntrend
    ? `⚠️ ${indexTrend.name} ${indexTrend.downStreak}틱 연속 하락 중 — 지금 매수 맞나?`
    : `✅ ${indexTrend.name} 하락세 아님`;

const checks = [chaseLabel, themeLabel, indexLabel];   // [false,false] → [false,false,false]
```

- `checked` 초기값 3개로, `reset()`도 3개로 수정
- `allChecked`(every Boolean)·매도 분기는 그대로

---

## 에러 처리

- API 실패 / 시장 미상(`market = null`) → "지수 상태 확인 중..." 표시, **매수 차단 안 함**. 임펄스 방지가 목적이지 정상 거래를 막는 게 아님.
- 장 마감 시간엔 폴링 중단(틱 안 쌓임) → 마지막 상태 또는 중립 표시.
- 상태는 메모리 → 서버 재시작 시 틱 히스토리 초기화 (허용).

## 테스트

테스트 러너 미설정. 순수 로직을 분리해 검증 용이하게 한다.

- `recordTick`: 연속 하락 → 카운트 증가 / 진입, 반등 1틱 → 해제 안 됨(sticky), 연속 3틱 반등 → 해제, 보합 → 스트릭 리셋
- `getMarketType`: 코스피/코스닥/미상 매핑
- `getCompositeIndex`: 종합지수 추출 및 폴백

## 비목표 (YAGNI)

- 과거 N일 이동평균 등 시계열 기반 추세 (별도 API 필요 — 범위 외)
- DB 영속화
- 지수 상태 상시 배너 (모달 항목으로 한정)
- 코스피·코스닥 동시 경고 (선택 종목 시장 하나만)
