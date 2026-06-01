import WebSocket from "ws";
import { REST_BASE_URL, getAccessToken } from "./auth.js";
import { getKiwoomEnvironment } from "./env.js";
import type {
  KiwoomEnvironment,
  RealtimeMessage,
  RealtimeRegisterRequest,
  RealtimeType,
} from "./types.js";

const SOCKET_BASE_URL: Record<KiwoomEnvironment, string> = {
  production: "wss://api.kiwoom.com:10000/api/dostk/websocket",
  mock: "wss://mockapi.kiwoom.com:10000/api/dostk/websocket",
};

export function createKiwoomSocket(
  environment: KiwoomEnvironment = getKiwoomEnvironment()
) {
  const url = SOCKET_BASE_URL[environment];
  const restBaseUrl = REST_BASE_URL[environment];
  let socket: WebSocket | null = null;

  function send(payload: RealtimeRegisterRequest): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Kiwoom socket is not connected. Call connect() first.");
    }
    socket.send(JSON.stringify(payload));
  }

  async function connect(apiId: RealtimeType = "0B"): Promise<void> {
    if (socket?.readyState === WebSocket.OPEN) return;

    const token = await getAccessToken(restBaseUrl);
    socket = new WebSocket(url, {
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "api-id": apiId,
        authorization: `Bearer ${token}`,
      },
    });

    return new Promise((resolve, reject) => {
      const ws = socket!;
      ws.once("open", () => {
        ws.send(JSON.stringify({ trnm: "LOGIN", token }));
      });
      // LOGIN 응답으로 connect 완료를 판정하고, PING은 연결 유지를 위해 원문 그대로 echo
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as RealtimeMessage;
        if (msg.trnm === "PING") {
          ws.send(raw.toString());
          return;
        }
        if (msg.trnm === "LOGIN") {
          if (Number(msg.return_code) === 0) resolve();
          else reject(new Error(`Kiwoom LOGIN failed: ${msg.return_msg ?? ""}`));
        }
      });
      ws.once("error", reject);
    });
  }

  function onMessage(handler: (message: RealtimeMessage) => void): void {
    socket?.on("message", (raw) => {
      handler(JSON.parse(raw.toString()) as RealtimeMessage);
    });
  }

  function onClose(handler: (code: number, reason: Buffer) => void): void {
    socket?.on("close", handler);
  }

  function register(
    type: RealtimeType,
    items: string[],
    groupNo = "1",
    refresh: "0" | "1" = "1"
  ): void {
    send({ trnm: "REG", grp_no: groupNo, refresh, data: [{ item: items, type: [type] }] });
  }

  function remove(type: RealtimeType, items: string[], groupNo = "1"): void {
    send({ trnm: "REMOVE", grp_no: groupNo, data: [{ item: items, type: [type] }] });
  }

  /** 주문체결(00), 잔고(04)는 종목코드와 상관없이 계좌 이벤트가 내려오므로 item은 빈 문자열로 등록 */
  function registerAccountEvents(groupNo = "1"): void {
    send({
      trnm: "REG",
      grp_no: groupNo,
      refresh: "1",
      data: [
        { item: [""], type: ["00"] },
        { item: [""], type: ["04"] },
      ],
    });
  }

  function close(): void {
    socket?.close();
    socket = null;
  }

  return { connect, onMessage, onClose, register, remove, registerAccountEvents, close };
}
