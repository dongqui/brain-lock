import { createKiwoomSocket, parseOrderExecution } from "@brain-lock/kiwoom";
import type { RealtimeMessage } from "@brain-lock/kiwoom";
import { computeOrderEffect } from "./computeOrderEffect";
import {
  getOwnedOrder,
  getPendingByOrderNo,
  applyApprovedEffect,
  applyPendingEffect,
} from "./ledger.server";

const RECONNECT_MS = 5000;

async function handleRealtime(msg: RealtimeMessage) {
  const execs = parseOrderExecution(msg);
  for (const e of execs) {
    if (!e.orderNo) continue;

    const [owned, pending] = await Promise.all([
      getOwnedOrder(e.orderNo),
      getPendingByOrderNo(e.orderNo),
    ]);

    const effect = computeOrderEffect(
      {
        orderNo: e.orderNo,
        stockCode: e.stockCode,
        stockName: e.stockName,
        side: e.side,
        orderQuantity: e.orderQuantity,
        unfilledQuantity: e.unfilledQuantity,
        orderStatus: e.orderStatus,
      },
      owned ? { side: owned.side as "BUY" | "SELL", filledQty: owned.filledQty } : null,
      pending != null
    );

    if (effect.type === "approved") {
      await applyApprovedEffect({ ...effect, orderNo: e.orderNo });
      console.log(
        `[guard] 체결 반영 ${e.stockName}(${e.stockCode}) approved ${effect.delta >= 0 ? "+" : ""}${effect.delta}${effect.close ? " (종결)" : ""}`
      );
    } else if (effect.type === "pending") {
      await applyPendingEffect(e.orderNo, effect.remaining, effect.remove);
      console.log(
        `[guard] 자동매도 체결 ${e.stockName}(${e.stockCode}) 잔여=${effect.remaining}${effect.remove ? " (정리)" : ""}`
      );
    }
  }
}

function connectFeed() {
  const socket = createKiwoomSocket();
  socket
    .connect("00")
    .then(() => {
      socket.register("00", [""]);
      socket.onMessage((msg) => {
        if (msg.trnm !== "REAL") return;
        handleRealtime(msg).catch((err) => console.error("[guard] 체결 처리 오류", err));
      });
      socket.onClose(() => {
        console.warn("[guard] 체결 피드 연결 종료 — 재연결 예약");
        setTimeout(connectFeed, RECONNECT_MS);
      });
      console.log("[guard] 체결 피드(00) 구독 시작");
    })
    .catch((err) => {
      console.error("[guard] 체결 피드 연결 실패 — 재시도 예약", err);
      setTimeout(connectFeed, RECONNECT_MS);
    });
}

/** 서버 부팅 시 1회 호출. globalThis 가드로 중복 시작 방지(dev HMR 포함). */
export function startOrderFeed() {
  const g = globalThis as unknown as { __guardOrderFeed?: boolean };
  if (g.__guardOrderFeed) return;
  g.__guardOrderFeed = true;
  connectFeed();
}
