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

근본 해결책은 키움 실시간 **체결 피드** 구독(현재 보류한 옵션)이며 이를 향후
정밀도 업그레이드 경로로 둔다.

## 범위 밖 (Out of scope)

- 실시간 체결 피드 기반 장부 정합 (업그레이드 경로로만 명시)
- 장 시간 스케줄링/휴장일 캘린더
- 다중 계좌 지원
- `server/` 패키지 변경 (이 기능은 건드리지 않음)
