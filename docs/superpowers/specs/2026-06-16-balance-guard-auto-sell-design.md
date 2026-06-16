# Balance Guard — 외부 주문 자동 시장가 매도

작성일: 2026-06-16

## 목적

BrainLock을 통해서만 매매하도록 강제한다. 계좌 잔고를 지속적으로 감시하다가,
이 서비스를 통해 주문하지 않은 포지션(외부 주문/수동 주문 등)이 발견되면 즉시
시장가로 매도한다.

뇌동매매 방지라는 제품 철학상 "자동 시장가 매도"는 그 자체로 되돌릴 수 없는
공격적 행위다. 따라서 **무엇이 '우리 것'인가**를 판별하는 정확도가 핵심이며,
설계 전반이 그 판별을 안전하게(=내 정상 보유분을 잘못 팔지 않는 방향으로) 기울도록
구성한다.

## 확정된 결정 사항

| 항목 | 결정 |
| --- | --- |
| 외부 포지션 발견 시 행동 | **즉시 시장가 매도** (확인 없음) |
| '우리 것' 판별 방식 | **수량 기준** — 종목별 net 승인 수량을 장부에 기록, 보유량이 승인량 초과 시 초과분만 매도 |
| 최초 활성화 시 기존 보유분 | **종목별 수동 정리(reconciliation)** — keep/sell 선택 |
| 감시 위치/주기 | **서버 사이드 연속 폴링** (client의 long-lived Node 서버, ~3초) |
| 환경/안전장치 | 환경 제한 없음(`KIWOOM_ENVIRONMENT` 따름) + enable 플래그(기본 OFF) 런타임 토글 |

## 아키텍처 — 단일 프로세스(client)

핵심 사실:

- 실제 애플리케이션 DB는 **`client/`** 에 있다 (SQLite `client/prisma/prisma/dev.db`).
  `server/` 는 별도의 scratch SQLite를 가지며 이 기능과 무관하다.
- `client` 는 `react-router-serve` 로 구동되는 **long-lived Node(Express) 서버**
  (Dockerfile `CMD ["npm","run","start"]`). serverless 아님 → 모듈 레벨
  `setInterval` 백그라운드 워처가 컨테이너 수명 동안 유지된다.
- 주문은 이미 `client` 의 `trade.tsx` `action` 에서 `@brain-lock/kiwoom` 의
  `buyStock`/`sellStock` 를 직접 호출한다.
- 잔고 조회 `fetchAccountEvaluation()` 도 `@brain-lock/kiwoom`(`shared/account.ts`)에 존재.

따라서 **장부 + 주문 훅 + 워처를 모두 `client` 프로세스 안**에 둔다. 크로스 프로세스
동기화/HTTP 알림 채널이 필요 없다. `server/` 는 실시간 시세 허브로 그대로 둔다.

### 멀티 인스턴스 주의

현재는 단일 인스턴스다. 단, 향후 replica가 2개 이상으로 늘면 각 인스턴스가
워처를 돌려 중복 매도가 발생할 수 있다. 이를 대비해 **pending-sell 가드를
in-memory가 아니라 DB**에 둔다(아래 4번).

## 1. DB 모델 (`client/prisma/schema.prisma` 에 추가)

```prisma
model LedgerPosition {
  stockCode   String   @id
  stockName   String
  approvedQty Int      @default(0)   // '우리 것'으로 인정하는 net 수량
  updatedAt   DateTime @updatedAt
}

model PendingSell {
  id        Int      @id @default(autoincrement())
  stockCode String
  qty       Int
  orderNo   String?
  createdAt DateTime @default(now())  // TTL 만료로 중복 매도 방지 / 미체결 시 재시도
}

model GuardSetting {
  id        Int      @id @default(1)   // 싱글톤 행
  enabled   Boolean  @default(false)   // kill-switch, 기본 OFF
  activated Boolean  @default(false)   // 최초 reconciliation 완료 여부
  updatedAt DateTime @updatedAt
}
```

## 2. 주문 훅 (`trade.tsx` action 내부)

주문 성공(`return_code === 0`) 직후 같은 프로세스/DB에서 장부 갱신:

- **매수(buy)** → `approvedQty += ord_qty`
- **매도(sell, 서비스 통한 내 매도)** → `approvedQty -= ord_qty`, 0 하한
- **취소(cancel)** → 해당 미체결 매수분 `approvedQty -= 취소수량` (아래 한계 완화)

장부 갱신은 시장가/지정가 무관하게 주문 수량(`ord_qty`) 기준.

## 3. 활성화 (종목별 reconciliation)

신규 라우트 `/guard`. 최초 활성화 시:

1. `fetchAccountEvaluation()` 로 현재 보유 종목 조회.
2. 각 보유 종목을 **keep / sell** 토글과 함께 표시.
3. **keep** → `LedgerPosition.approvedQty = 현재 보유수량` 기록.
4. **sell** → 0으로 둠. 워처가 다음 틱에 시장가 청산.
5. `GuardSetting { activated: true, enabled: true }` 설정.

이후 보유량이 종목별 `approvedQty` 를 초과하면 그 초과분이 외부(foreign) 포지션.

## 4. 워처 루프 + 매도 로직 (client 내 server-only 모듈)

서버 부팅 시 1회 시작하는 `setInterval`(~3초). dev HMR / 중복 시작 방지를 위해
`db.server.ts` 의 `globalForPrisma` 와 동일한 `globalThis` 가드 패턴 사용.

```
if (!setting.enabled) return
TTL(~60s) 지난 PendingSell 행 삭제           // 미체결 매도 재시도
acct = fetchAccountEvaluation()
for each holding h:
  approved = LedgerPosition[h.stockCode]?.approvedQty ?? 0
  pending  = active PendingSell 합계(h.stockCode)
  foreign  = min(h.quantity - approved - pending, h.orderableQuantity - pending)
  if foreign > 0:
     sellStock({ stk_cd, ord_qty: foreign, ord_uv: "", trde_tp: "3" })  // 시장가
     insert PendingSell(stockCode, foreign, orderNo)
```

- **DB 기반 pending 가드**: 체결 반영 전 다음 폴링에서 같은 물량을 또 파는 것을 방지.
- `orderableQuantity`(`ord_psbl_qty`)로 실제 매도 가능 수량 상한.
- 장 시간 외에는 시장가 주문이 거부/대기될 수 있음. PendingSell TTL 재시도로
  장 개시 후 자동 처리. (MVP 범위에서 별도 스케줄링 안 함.)

## 5. Kill-switch

`GuardSetting.enabled` 을 `/guard` 페이지 및 API 라우트에서 토글. 기본 OFF.
activated 전에는 enable 불가.

## 6. 알려진 한계 (정직한 명시)

장부는 **실체결이 아니라 주문 시점**의 `ord_qty` 로 적립한다. 따라서
**체결되지 않은(또는 취소된) 지정가 매수**가 잔여 크레딧을 남기면, 그 종목의
진짜 외부 보유분이 무시될 수 있다. 이 오차는 **내 보유분을 잘못 매도하지 않는
안전한 방향**으로 기운다. 취소 훅으로 가장 흔한 경우를 완화한다.

근본 해결책은 키움 실시간 **체결 피드(`00` 주문체결)** 구독이며, **섹션 7**에서
이를 설계한다. 섹션 7 적용 후 이 한계는 해소된다.

또한 이 "주문 시점 적립" 모델은 별도의 운영 버그를 낳는다: `PendingSell`을 실체결이
아니라 고정 TTL(60초)로만 지우기 때문에, **같은 종목을 자동매도 직후 다시 외부 매수**하면
이전 매도의 PendingSell 행이 남아(`foreign = 보유 − 승인 − 대기 ≤ 0`) 그 신규 외부
포지션이 TTL 만료(최대 60초)까지 매도되지 않는다. ("첫 외부 주문은 ~3초에 매도되나
두 번째부터 한참 뒤에 매도" 증상.) 섹션 7의 체결 기반 PendingSell 정리가 이 버그도 해소한다.

## 7. 체결 피드(`00`) 기반 장부 정밀화

섹션 6의 한계와 위 버그는 **같은 뿌리** — 장부/대기 상태가 *주문 시점 `ord_qty`* 와
*고정 타이머* 로만 구동되고 **실체결**을 반영하지 않는다. 키움 `00` 주문체결 실시간
피드를 구독해 장부 변경의 진실원천을 **실체결 이벤트** 로 옮긴다.

`00`은 계좌 단위 피드라 서비스 주문·외부(키움 앱 등) 주문의 체결이 **모두** 내려온다.
따라서 **주문번호(`9203`)** 로 자체/외부를 식별한다.

- **USER 주문**(서비스로 낸 매수/매도) → 신규 `OwnedOrder` 테이블에 `orderNo`로 기록.
  체결 이벤트가 `approved` 를 갱신.
- **GUARD 자동매도** → 기존 `PendingSell`(이미 `orderNo` 보유)이 그 기록. 체결 이벤트가
  PendingSell을 실시간 정리 → 60초 blind TTL 대체(버그 해결).
- **외부 주문**(어느 테이블에도 없는 orderNo) → 외부 포지션. 폴링이 탐지·매도(기존 경로 유지).

### 7.1 데이터 모델 (신규)

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

`PendingSell`은 유지하되 TTL을 **백업 안전망(예: 10분)** 으로 늘린다. 정상 경로는 체결
이벤트가 정리하고, TTL은 WS 끊김으로 이벤트를 놓친 경우만 대비한다.

### 7.2 구성요소 & 데이터 흐름

신규 server-only 모듈 `client/app/guard/orderFeed.server.ts` — 워처와 동일하게 부팅 시
1회 시작(`globalThis` 가드, dev HMR/중복 방지).

```
client 부팅
 ├─ startWatcher()     (기존, 3초 폴링 — 외부 탐지 백스톱)
 └─ startOrderFeed()   (신규)
       createKiwoomSocket().connect("00") → LOGIN → register("00", [""])
       onMessage → parseOrderExecution → 이벤트별 장부 트랜잭션
       onClose → 재연결 + 재등록
```

`shared/socket.ts`는 이미 `register("00", [""])`로 계좌 이벤트 등록 가능 → **소켓 레이어
변경 없음**. `shared/`에 `parseOrderExecution` 매퍼만 추가(`kiwoom_realtime_order.md` 그대로).

### 7.3 체결 이벤트 처리

각 이벤트에서 누적 체결량을 **`체결누계 = orderQty − 미체결수량(902)`** 로 구해 저장된
`filledQty` 와의 **델타**만 적용한다(필드 `911` 의 cumulative/incremental 모호성 회피,
부분체결 안전).

| orderNo 매칭 | side | 처리 |
| --- | --- | --- |
| `PendingSell`에 있음 | (SELL) | `PendingSell.qty −= delta`, 0 도달 시 삭제 → **버그 해결** |
| `OwnedOrder`에 있음 | BUY | `approved += delta` |
| `OwnedOrder`에 있음 | SELL | `approved −= delta` (0 하한) |
| 어디에도 없음 | BUY | 외부 → 무시(폴링이 매도) |
| 어디에도 없음 | SELL | 무시 |

취소/거부 상태(`913`) → 해당 `OwnedOrder.closed = true`(크레딧 없이 예약분 해제).

### 7.4 레이스 가드 (정상 매수 오인 매도 방지)

크레딧이 체결 시점으로 옮겨지면서 **체결 직후 이벤트 처리 전에 폴링이 먼저 보유분을 보면
내 정상 매수를 외부로 오인**할 위험이 생긴다. 막는 법:

미체결 자체 매수 예약분 `outstandingBuy = Σ(OwnedOrder.orderQty − filledQty)`
(side=BUY, not closed) 를 폴링 계산에서 차감한다:

```
foreign = min(보유 − 승인 − 대기 − outstandingBuy, 매도가능 − 대기)
```

- 체결 전: `outstandingBuy` 가 커버 → 오인 매도 없음.
- 체결 후: 이벤트가 `filledQty↑`, `approved↑` → outstanding 소멸, approved가 인계.
- 미체결로 남은 지정가 매수 → outstanding이 그 종목 외부 탐지를 보수적으로 가림
  (= 내 보유분을 잘못 팔지 않는 **안전한 방향**, 섹션 6 철학과 일치). 취소/체결로 자동 정상화.

이로써 섹션 6 한계(미체결/취소 지정가 매수의 유령 크레딧)가 닫히고, 별도 취소 훅이
불필요해진다.

### 7.5 기존 파일 변경

- **`trade.tsx`**: `creditLedger`/`debitLedger` 즉시 호출 제거 → 주문 성공 시
  `OwnedOrder` insert(`res.ord_no`, side, orderQty). 크레딧/차감은 체결 이벤트가 수행.
- **`watcher.server.ts`**: `outstandingBuy` 맵을 조회해 `computeForeignSells` 에 전달.
  `PENDING_TTL_MS` 를 장기 백업값으로.
- **`computeForeign.ts`**: 파라미터에 `outstandingBuyByCode` 추가, 위 공식 반영.
  기존 테스트 유지 + 신규 케이스(레이스 가드, 부분체결).

### 7.6 구현 전 실측 검증 항목 (모의투자 로그)

스펙 추정값이라 구현 시 실제 `00` 수신 로그로 확인한다:

- `9001` 종목코드 접두어 형식(`account.ts` 처럼 `^[A-Z]` strip 필요 여부)
- `907` 매도수구분 매핑(문서 기준 2=매수)
- `913` 주문상태 값(체결/접수/취소/거부 구분 문자열)
- 부분체결 시 `902`(미체결수량) 동작 — 누계 도출 가정 검증
- 모의투자가 `00` 이벤트를 실제로 내려주는지
- 키움 동시 소켓 연결 한도(`server/` 가 이미 `0B` 1개 보유 → `client/` 가 `00` 1개 추가)

## 범위 밖 (Out of scope)

- 외부 체결 **즉시 매도 트리거**(접근 C) — 폴링이 청산 담당, 이번 범위 제외
- `04` 잔고 실시간 피드 — 이번 설계는 `00` 만으로 충분
- 장 시간 스케줄링/휴장일 캘린더
- 다중 계좌 지원
- `server/` 패키지 변경 (이 기능은 건드리지 않음)
