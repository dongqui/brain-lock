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
