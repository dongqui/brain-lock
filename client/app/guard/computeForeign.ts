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
