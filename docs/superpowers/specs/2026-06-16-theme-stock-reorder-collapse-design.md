# 종목 순서 변경 + 테마 접힘 상태 영속화 — 설계

날짜: 2026-06-16
대상: `client/app/routes/themes.tsx` 및 관련 테마 레이어

## 목표

1. 테마 패널 안의 종목을 드래그로 순서 변경할 수 있게 한다 (같은 테마 안에서만).
2. 테마 패널의 접힘(collapsed) 상태를 DB에 저장해 새로고침/서버 재시작 후에도 유지한다.

## 범위

- **포함**: 같은 테마 내 종목 순서 변경, 테마별 접힘 상태 영속화.
- **제외**: 테마 간 종목 이동(드래그로 다른 테마로 옮기기)은 요청에 없으므로 구현하지 않는다.

## 현재 구조 요약

- `Theme` 모델: `id, name, order, createdAt, stocks`. 테마 순서 변경은 이미 구현됨(`/api/themes/reorder`).
- `ThemeStock` 모델: 복합 PK `(themeId, stockCode)`, **order 필드 없음** — 종목은 DB 반환 순서대로 렌더링됨.
- `ThemePanel`: 로컬 `useState(false)`로 접힘 상태 관리 — 영속화되지 않음.
- DnD: `themes.tsx`의 `DndContext`가 ranking→theme(종목 추가)와 theme→theme(테마 순서 변경)을 처리.

## 변경 사항

### 1. DB 스키마 (`client/prisma/schema.prisma`)

```prisma
model Theme {
  ...
  collapsed Boolean @default(false)   // 추가
}

model ThemeStock {
  ...
  order Int @default(0)               // 추가
}
```

Prisma 마이그레이션 1회 실행. 기존 종목은 모두 `order=0`이며, 첫 순서 변경 시 정규화된다.

### 2. 타입 + 응답 빌더

- `shared/themes.ts`
  - `ThemeWithLeader`에 `collapsed: boolean` 추가.
  - `ThemeStockWithLeader`에 `order: number` 추가.
- `client/app/lib/themeScoring.server.ts`
  - `RawTheme`에 `collapsed`, `RawThemeStock`에 `order` 추가.
  - 빌더가 `collapsed`, `order`를 그대로 전달.
- `client/app/routes/api/themes.ts` loader
  - `include: { stocks: { orderBy: { order: 'asc' } } }`로 종목을 order순 정렬해 반환.

### 3. API 엔드포인트

- **신규** `client/app/routes/api/themes.$id.stocks.reorder.ts` (PATCH)
  - body `{ stockCodes: string[] }`. 배열 index를 각 종목의 `order`로 저장.
  - `themes.reorder.ts`와 동일한 `Promise.all + update` 패턴.
- **`client/app/routes/api/themes.$id.ts`에 PATCH 추가**
  - body `{ collapsed: boolean }` → 해당 테마의 `collapsed` 저장. 기존 DELETE 핸들러 유지.
- **`client/app/routes/api/themes.$id.stocks.ts` (addStock)**
  - 신규 종목 생성 시 `order = (해당 테마 max order) + 1` 부여.

### 4. 클라이언트

- `client/app/routes/themes/hooks/useThemeMutations.ts`
  - `reorderStocks` 뮤테이션 추가 (낙관적 업데이트): `{ themeId, stockCodes }`.
  - `setCollapsed` 뮤테이션 추가 (낙관적 업데이트): `{ themeId, collapsed }`.
  - 두 뮤테이션 모두 `reorderThemes`와 동일한 optimistic 패턴 — 접기/순서변경은 즉시 반응해야 하고 60초 refetch에 깜빡이면 안 된다.
- `client/app/routes/themes/components/ThemePanel.tsx`
  - 로컬 `useState` 제거 → `theme.collapsed`를 표시값으로 사용.
  - 토글 시 `onToggleCollapse(theme.id, !theme.collapsed)` 호출.
- `client/app/routes/themes/components/ThemeStockItem.tsx`
  - dnd-kit `useSortable`로 감싸 드래그 핸들 추가.
- `client/app/routes/themes.tsx`
  - 각 테마 패널 안에 종목용 `SortableContext` 중첩 (vertical strategy).
  - 종목 sortable id 형식: `stock-${themeId}-${stockCode}`.
  - `handleDragEnd`에 `stock-` prefix 분기 추가. active와 over의 themeId가 같을 때만 reorder (테마 간 이동 무시).
  - `onToggleCollapse`를 `SortableThemePanel` → `ThemePanel`로 전달.

## 검증

- `npm run typecheck -w @brain-lock/client` 통과.
- 수동 검증:
  - 종목을 드래그해 순서 변경 → 새로고침 후 순서 유지.
  - 테마 패널을 접고 서버 재시작 → 접힘 상태 유지.
