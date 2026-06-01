import { useEffect, useState } from "react";

type RealtimeTick = {
  code?: string;
  type?: string;
  values?: Record<string, string>;
  error?: string;
};

// 키움 실시간 주식체결(0B) 현재가 필드
const CURRENT_PRICE_FIELD = "10";

export function useRealtimePrice(code: string | undefined): number | null {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    setPrice(null);

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

      const raw = tick.values[CURRENT_PRICE_FIELD];
      if (raw == null) return;

      const parsed = Math.abs(Number(raw.replace(/[^0-9.-]/g, "")));
      if (!Number.isNaN(parsed) && parsed > 0) setPrice(parsed);
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

  return price;
}
