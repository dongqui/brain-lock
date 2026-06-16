import type { RealtimeMessage } from "./types.js";

export type OrderExecutionSide = "BUY" | "SELL";

export type OrderExecution = {
  accountNo: string;
  orderNo: string;
  stockCode: string;
  stockName: string;
  orderStatus: string;
  side: OrderExecutionSide;
  orderQuantity: number;
  unfilledQuantity: number;
  executedQuantity: number;
  executedPrice: number;
  executionTime: string;
  raw: unknown;
};

/**
 * 키움 `00`(주문체결) 실시간 메시지를 도메인 타입으로 변환.
 * 종목코드(9001)는 account.ts와 동일하게 접두어(A/J/Q 등) 제거.
 * 매도수구분(907): "2"=매수, 그 외=매도 (docs/kiwoom_realtime_order.md 기준).
 */
export function parseOrderExecution(message: RealtimeMessage): OrderExecution[] {
  if (message.trnm !== "REAL" || !message.data) return [];
  return message.data
    .filter((d) => d.type === "00")
    .map((d) => {
      const v = d.values ?? {};
      return {
        accountNo: v["9201"] ?? "",
        orderNo: v["9203"] ?? "",
        stockCode: (v["9001"] ?? "").replace(/^[A-Z]/, ""),
        stockName: v["302"] ?? "",
        orderStatus: v["913"] ?? "",
        side: v["907"] === "2" ? "BUY" : "SELL",
        orderQuantity: Number(v["900"] ?? 0),
        unfilledQuantity: Number(v["902"] ?? 0),
        executedQuantity: Number(v["911"] ?? 0),
        executedPrice: Number(v["910"] ?? 0),
        executionTime: v["908"] ?? "",
        raw: d,
      };
    });
}
