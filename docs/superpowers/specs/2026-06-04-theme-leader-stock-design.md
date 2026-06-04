# 주도 테마 & 주도주 선별 기능 설계

## 개요

거래대금 상위 종목을 기반으로 테마를 수동 매핑하고, 테마별 주도주를 자동/수동으로 선별하는 기능.
주도 테마·주도주 여부는 전역 상태로 공유되어 트레이드 확인 체크리스트에서 활용된다.

---

## 1. 데이터 모델 (Prisma — `client/`)

```prisma
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
  theme        Theme    @relation(fields: [themeId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())

  @@id([themeId, stockCode])
}
```

- 종목은 여러 테마에 동시에 속할 수 있다 (n:n).
- `manualLeader`: 사용자가 수동으로 주도주를 지정한 경우 `true`.
- `order`: 테마 수동 정렬 순서 저장용.

---

## 2. 주도주 판별 로직

### 자동 판별 (기본)

랭킹 데이터(`TopTradingValueItem`)의 `trde_prica`(거래대금)와 `flu_rt`(등락률)를 활용.

```
stock_score = 거래대금_정규화 * 0.6 + 등락률_정규화 * 0.4
```

- 랭킹에 등장하지 않는 종목은 점수 0으로 처리.
- 테마 내 가장 높은 `stock_score`를 가진 종목 → `isLeader = true`.

### 수동 지정 우선

`manualLeader = true`인 종목이 있으면 점수 계산 없이 해당 종목을 주도주로 반환.

### 주도 테마 판별

```
테마_점수 = 랭킹에 등장한 종목 수 × 해당 종목들의 평균 stock_score
```

가장 높은 점수의 테마 = 주도 테마 (⭐ 뱃지, 항상 목록 맨 위).

---

## 3. API 레이어 (`client/app/routes/api/`)

| 메서드 | 경로 | 역할 |
|--------|------|------|
| GET | `/api/themes` | 테마 목록 + 종목 + 주도주 계산 결과 (랭킹 포함) |
| POST | `/api/themes` | 테마 생성 |
| DELETE | `/api/themes/:id` | 테마 삭제 |
| POST | `/api/themes/:id/stocks` | 테마에 종목 추가 |
| DELETE | `/api/themes/:id/stocks/:code` | 테마에서 종목 제거 |
| PATCH | `/api/themes/:id/stocks/:code` | 수동 주도주 지정/해제 |
| PATCH | `/api/themes/reorder` | 테마 순서 일괄 업데이트 |

### `GET /api/themes` 응답 타입 (`shared/themes.ts`)

```ts
type ThemeWithLeader = {
  id: number
  name: string
  order: number
  themeScore: number
  isLeadingTheme: boolean
  stocks: {
    stockCode: string
    stockName: string
    manualLeader: boolean
    isLeader: boolean
    rankingData?: {
      tradingValue: string
      changeRate: string
    }
  }[]
  leadingStock: { stockCode: string; stockName: string } | null
}
```

응답은 `themeScore` 내림차순으로 정렬되어 반환된다.

---

## 4. 분석 페이지 (`/themes`)

**레이아웃:** 2열 구성

- **왼쪽**: 거래대금 상위 종목 목록 (드래그 소스)
- **오른쪽**: 테마 패널 목록 (드롭 타겟 + 드래그로 순서 변경)

**드래그앤드롭 (`@dnd-kit/core`):**
- 종목 추가: 왼쪽 랭킹 종목 → 오른쪽 테마 패널에 드롭
- 테마 순서: 테마 패널을 드래그해서 재정렬 → `PATCH /api/themes/reorder` 호출
- 수동 재정렬 후 다음 새로고침 시 주도 테마는 다시 맨 위로 이동

**폴링:**
- React Query `refetchInterval`: 장 시간(09:00~15:30) 5분 간격 자동 갱신
- `[새로고침]` 버튼으로 수동 즉시 갱신

**주도주 UI:**
- `★` 아이콘: 주도주 표시
- 종목 클릭 → 수동 주도주 토글
- `⭐ 주도 테마` 뱃지: 1위 테마에 표시

---

## 5. 전역 상태 & 트레이드 연동

### 훅

```ts
// 전체 테마 데이터
useThemes(): ThemeWithLeader[]

// 상위 2개 테마의 주도주 코드 집합
useLeaderStocks(): Set<string>
// → data.slice(0, 2)에서 isLeader인 종목 코드만 추출
```

### `TradeConfirmModal` 체크리스트 항목 추가

```
□ 선택 종목이 1~2위 테마의 주도주인가?
  ✅ 1위 반도체 테마 주도주   (isLeader, top2 테마 소속)
  🟡 반도체 테마 소속 (주도주 아님)
  ⚠️ 상위 2개 테마 미등록
```

주문 자체는 막지 않고 인식을 유도하는 체크리스트 항목으로 동작한다.

---

## 6. 파일 구조 (신규/변경)

```
shared/
  themes.ts              # ThemeWithLeader 타입 정의

client/
  prisma/
    schema.prisma        # Theme, ThemeStock 모델 추가
  app/
    routes.ts            # /themes, /api/themes/* 라우트 추가
    routes/
      themes.tsx         # 분석 페이지
      api/
        themes.ts        # GET, POST
        themes.$id.ts    # DELETE
        themes.$id.stocks.ts       # POST
        themes.$id.stocks.$code.ts # DELETE, PATCH
        themes.reorder.ts          # PATCH
      themes/
        hooks/
          useThemes.ts
          useLeaderStocks.ts
        components/
          RankingList.tsx    # 드래그 소스
          ThemePanel.tsx     # 드롭 타겟 + 드래그 소스(순서)
          ThemeStock.tsx     # 종목 아이템
```
