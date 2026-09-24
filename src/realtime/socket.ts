import { getAccessToken } from "@/session/tokenStore";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const WS_URL = BASE_URL.replace(/^http/, "ws");

type Handler = (payload: unknown) => void;

/**
 * Thin client for the backend's realtime hub (see backend src/realtime/hub.ts —
 * a Durable Object pushing `message.new` / `typing` / `notification.new`
 * events). Receive-only: nothing here needs to send over the socket itself,
 * since actions (sending a message, signaling typing) already go through
 * normal REST calls that trigger the push server-side.
 */
class RealtimeSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async connect() {
    this.shouldReconnect = true;
    const token = await getAccessToken();
    if (!token || this.ws) return;

    const ws = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    // Local pseudo-event so screens can resync state (e.g. presence) after a reconnect.
    ws.onopen = () => this.handlers.get("socket.open")?.forEach((h) => h(null));
    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        this.handlers.get(type)?.forEach((h) => h(payload));
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };
    ws.onerror = () => ws.close();
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  on(type: string, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }
}

export const realtimeSocket = new RealtimeSocket();
