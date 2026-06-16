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
