import type { OrderExecutionSide } from "@brain-lock/kiwoom";

export type ExecutionInput = {
  orderNo: string;
  stockCode: string;
  stockName: string;
  side: OrderExecutionSide;
  orderQuantity: number;
  unfilledQuantity: number;
  orderStatus: string;
};

export type OwnedOrderState = {
  side: OrderExecutionSide;
  filledQty: number;
};

export type OrderEffect =
  | {
      type: "approved";
      stockCode: string;
      stockName: string;
      delta: number; // 매수 +, 매도 -
      newFilled: number; // 갱신할 누적 체결 수량
      close: boolean;
    }
  | { type: "pending"; remaining: number; remove: boolean }
  | { type: "none" };

const TERMINAL_STATUS = /취소|거부/;

/** 주문상태(913)가 취소/거부면 종결로 본다. (스펙 7.6 실측 검증 대상) */
export function isCanceledOrRejected(orderStatus: string): boolean {
  return TERMINAL_STATUS.test(orderStatus);
}

/**
 * 체결 이벤트 1건의 장부 효과를 결정한다.
 * - isPendingSell: 이 orderNo가 자동매도(PendingSell) 행과 매칭됨
 * - owned: 이 orderNo가 USER OwnedOrder와 매칭됨(아니면 null)
 * - 둘 다 아니면 외부 주문 → 효과 없음(폴링이 매도)
 * 누적 체결 = 주문수량 - 미체결수량. 저장된 filledQty와의 차이만 approved에 반영.
 */
export function computeOrderEffect(
  e: ExecutionInput,
  owned: OwnedOrderState | null,
  isPendingSell: boolean
): OrderEffect {
  const canceled = isCanceledOrRejected(e.orderStatus);

  if (isPendingSell) {
    const remaining = Math.max(0, e.unfilledQuantity);
    return { type: "pending", remaining, remove: remaining <= 0 || canceled };
  }

  if (owned) {
    const cumulativeFilled = Math.max(0, e.orderQuantity - e.unfilledQuantity);
    const delta = cumulativeFilled - owned.filledQty;
    const signed = owned.side === "BUY" ? delta : -delta;
    return {
      type: "approved",
      stockCode: e.stockCode,
      stockName: e.stockName,
      delta: signed,
      newFilled: cumulativeFilled,
      close: e.unfilledQuantity <= 0 || canceled,
    };
  }

  return { type: "none" };
}
