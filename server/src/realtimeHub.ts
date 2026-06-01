import { createKiwoomSocket } from "@brain-lock/kiwoom";
import type { RealtimeMessage, RealtimeType } from "@brain-lock/kiwoom";

export type RealtimeData = NonNullable<RealtimeMessage["data"]>[number];
export type RealtimeListener = (data: RealtimeData) => void;

const REALTIME_TYPE: RealtimeType = "0B";

let socket: ReturnType<typeof createKiwoomSocket> | null = null;
let connecting: Promise<void> | null = null;

const subscribers = new Map<string, Set<RealtimeListener>>();

function dispatch(message: RealtimeMessage): void {
  for (const entry of message.data ?? []) {
    const code = entry.item;
    if (!code) continue;
    const listeners = subscribers.get(code);
    if (!listeners) continue;
    for (const listener of listeners) listener(entry);
  }
}

async function ensureConnected(): Promise<void> {
  if (socket) return;
  if (!connecting) {
    const next = createKiwoomSocket();
    connecting = next.connect().then(() => {
      socket = next;
      next.onMessage(dispatch);
      next.onClose(() => {
        socket = null;
        connecting = null;
        subscribers.clear();
      });
    });
  }
  await connecting;
}

export async function subscribe(
  code: string,
  listener: RealtimeListener
): Promise<void> {
  await ensureConnected();
  let listeners = subscribers.get(code);
  if (!listeners) {
    listeners = new Set();
    subscribers.set(code, listeners);
    socket!.register(REALTIME_TYPE, [code]);
  }
  listeners.add(listener);
}

export function unsubscribe(code: string, listener: RealtimeListener): void {
  const listeners = subscribers.get(code);
  if (!listeners) return;
  listeners.delete(listener);
  if (listeners.size === 0) {
    subscribers.delete(code);
    socket?.remove(REALTIME_TYPE, [code]);
  }
}
