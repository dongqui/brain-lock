import { useEffect, useState } from "react";

type RealtimeTick = {
  code?: string;
  type?: string;
  values?: Record<string, string>;
  error?: string;
};

// 키움 실시간 주식체결(0B) 필드
const CURRENT_PRICE_FIELD = "10";
const CHANGE_RATE_FIELD = "12";

export function useRealtimePrice(code: string | undefined): {
  price: number | null;
  changeRate: number | null;
} {
  const [price, setPrice] = useState<number | null>(null);
  const [changeRate, setChangeRate] = useState<number | null>(null);

  useEffect(() => {
    setPrice(null);
    setChangeRate(null);

    const url = import.meta.env.VITE_REALTIME_WS_URL;
    if (!code || !url) return;

    const ws = new WebSocket(url);

    const handleOpen = () => {
      ws.send(JSON.stringify({ action: "subscribe", code }));
    };

    const handleMessage = (event: MessageEvent<string>) => {
      let tick: RealtimeTick;
      try {
        tick = JSON.parse(event.data) as RealtimeTick;
      } catch {
        return;
      }
      if (tick.code !== code || !tick.values) return;

      const rawPrice = tick.values[CURRENT_PRICE_FIELD];
      if (rawPrice != null) {
        const parsed = Math.abs(Number(rawPrice.replace(/[^0-9.-]/g, "")));
        if (!Number.isNaN(parsed) && parsed > 0) setPrice(parsed);
      }

      const rawRate = tick.values[CHANGE_RATE_FIELD];
      if (rawRate != null) {
        const cleaned = rawRate.trim();
        const isNeg = cleaned.startsWith("-");
        const num = Number(cleaned.replace(/[^0-9.]/g, ""));
        if (!Number.isNaN(num)) setChangeRate(isNeg ? -num : num);
      }
    };

    ws.addEventListener("open", handleOpen);
    ws.addEventListener("message", handleMessage);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "unsubscribe", code }));
      }
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("message", handleMessage);
      ws.close();
    };
  }, [code]);

  return { price, changeRate };
}
