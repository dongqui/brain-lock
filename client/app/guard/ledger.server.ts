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
    if (e.delta > 0) {
      // 매수 체결: 원자적 증가(레이스 안전). 신규면 delta로 생성.
      await tx.ledgerPosition.upsert({
        where: { stockCode: e.stockCode },
        create: { stockCode: e.stockCode, stockName: e.stockName, approvedQty: e.delta },
        update: { approvedQty: { increment: e.delta }, stockName: e.stockName },
      });
    } else if (e.delta < 0) {
      // 매도 체결: 기존 포지션에서만 차감(0 하한). 포지션이 없으면 음수 생성 금지 → 경고 후 생략.
      const pos = await tx.ledgerPosition.findUnique({ where: { stockCode: e.stockCode } });
      if (!pos) {
        console.warn(
          `[guard] 매도 체결이나 LedgerPosition 없음 — 차감 생략 ${e.stockCode} delta=${e.delta}`
        );
      } else {
        await tx.ledgerPosition.update({
          where: { stockCode: e.stockCode },
          data: { approvedQty: Math.max(0, pos.approvedQty + e.delta), stockName: e.stockName },
        });
      }
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
