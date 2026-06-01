import "./loadEnv.js";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  subscribe,
  unsubscribe,
  type RealtimeListener,
} from "./realtimeHub.js";

const PORT = Number(process.env.REALTIME_PORT ?? 8080);
const ALLOWED_ORIGINS = (
  process.env.REALTIME_ALLOWED_ORIGINS ??
  "http://localhost:5173,http://localhost:3000"
).split(",");

type ClientMessage = { action?: "subscribe" | "unsubscribe"; code?: string };

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
    return;
  }
  res.writeHead(426, { "Content-Type": "text/plain" }).end("Upgrade Required");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const origin = req.headers.origin;
  const originAllowed = !origin || ALLOWED_ORIGINS.includes(origin);

  if (pathname !== "/realtime" || !originAllowed) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws: WebSocket) => {
  const active = new Map<string, RealtimeListener>();

  ws.on("message", async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }

    const code = msg.code;
    if (!code) return;

    if (msg.action === "subscribe") {
      if (active.has(code)) return;
      const listener: RealtimeListener = (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              code: data.item,
              type: data.type,
              values: data.values,
            })
          );
        }
      };
      active.set(code, listener);
      try {
        await subscribe(code, listener);
      } catch (error) {
        active.delete(code);
        console.error(`[realtime] subscribe failed for ${code}:`, error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ code, error: "subscribe_failed" }));
        }
      }
    } else if (msg.action === "unsubscribe") {
      const listener = active.get(code);
      if (listener) {
        unsubscribe(code, listener);
        active.delete(code);
      }
    }
  });

  ws.on("close", () => {
    for (const [code, listener] of active) {
      unsubscribe(code, listener);
    }
    active.clear();
  });
});

server.listen(PORT, () => {
  console.log(`[realtime] websocket server listening on :${PORT}/realtime`);
});
