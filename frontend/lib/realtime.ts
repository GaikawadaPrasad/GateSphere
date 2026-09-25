/**
 * Realtime client (AGENTS.md §5.7) — ONE WebSocket per browser tab, multiplexed.
 *
 * - Auth: a single-use 30 s ticket from `POST /api/v1/realtime/ticket` (session cookie +
 *   CSRF), passed once in the socket URL. The ticket is never stored.
 * - The socket only carries *hints* (`{type:"invalidate", module, ...}`); listeners react by
 *   invalidating queries / reloading via the REST API. Payloads never enter the cache.
 * - Realtime is an optimisation, never a dependency: failures log at debug level, the UI
 *   falls back to polling (`useLivePollInterval`) while `status !== "open"`.
 */

import { apiSend } from "@/lib/api";

export type RealtimeStatus = "idle" | "connecting" | "open" | "closed";

export interface RealtimeHint {
  type: "invalidate" | "resync";
  scope?: "community" | "user";
  module?: string;
  entity?: string | null;
  action?: string | null;
}

type HintListener = (hint: RealtimeHint) => void;
type StatusListener = (status: RealtimeStatus) => void;

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;
/** Close codes that mean "don't hammer the server": wait long before retrying. */
const SLOW_RETRY_CODES = new Set([4403, 4429]);
/**
 * Circuit breaker: after this many consecutive attempts that never reached `open`
 * (host can't carry WebSockets, misconfigured URL, blocked by a proxy), stop for this page
 * session — polling already keeps the UI fresh, and endless retries only flood the console.
 */
const MAX_FAILED_ATTEMPTS = 5;

function debug(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.debug("[realtime]", ...args);
}

function socketUrl(ticket: string): string {
  const explicit = process.env.NEXT_PUBLIC_REALTIME_URL;
  const base = explicit
    ? explicit.replace(/\/+$/, "")
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/v1/realtime/ws`;
  return `${base}?ticket=${encodeURIComponent(ticket)}`;
}

class RealtimeClient {
  private ws: WebSocket | null = null;
  private status: RealtimeStatus = "idle";
  private wanted = false;
  private community: string | null = null;
  private attempt = 0;
  private failedWithoutOpen = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private hintListeners = new Set<HintListener>();
  private statusListeners = new Set<StatusListener>();

  getStatus(): RealtimeStatus {
    return this.status;
  }

  onHint(fn: HintListener): () => void {
    this.hintListeners.add(fn);
    return () => this.hintListeners.delete(fn);
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  /** Idempotent: safe to call on every render of the provider. */
  start(): void {
    if (this.wanted) return;
    this.wanted = true;
    void this.connect();
  }

  stop(): void {
    this.wanted = false;
    this.clearTimers();
    this.attempt = 0;
    this.failedWithoutOpen = 0;
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000);
    this.setStatus("idle");
  }

  /** Follow `communityId` (the header's active community). Checked server-side. */
  subscribe(communityId: string | null): void {
    this.community = communityId;
    this.sendSubscribe();
  }

  private sendSubscribe() {
    if (this.community && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "subscribe", community_id: this.community }));
    }
  }

  private setStatus(s: RealtimeStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach((fn) => fn(s));
  }

  private clearTimers() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.retryTimer = null;
    this.heartbeat = null;
  }

  private async connect(): Promise<void> {
    if (!this.wanted || typeof window === "undefined") return;
    this.setStatus("connecting");
    let ticket: string;
    try {
      const res = await apiSend<{ ticket: string }>("POST", "/realtime/ticket");
      ticket = res.ticket;
    } catch (err: any) {
      debug("ticket failed", err?.status);
      if (err?.status === 401) {
        this.stop(); // signed out — the global 401 handler takes over
        return;
      }
      this.failedWithoutOpen += 1;
      this.scheduleRetry();
      return;
    }
    if (!this.wanted) return;

    const ws = new WebSocket(socketUrl(ticket));
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.attempt = 0;
      this.failedWithoutOpen = 0;
      this.setStatus("open");
      this.heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}');
      }, HEARTBEAT_MS);
    };
    ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg?.type === "hello") {
        if (this.community && msg.community_id !== this.community) this.sendSubscribe();
      } else if (msg?.type === "invalidate" || msg?.type === "resync") {
        this.hintListeners.forEach((fn) => fn(msg as RealtimeHint));
      } else if (msg?.type === "error") {
        debug("server error", msg.code);
      }
      // pong / subscribed / unknown types: nothing to do (forward compatible)
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return; // superseded by stop()/reconnect
      this.ws = null;
      this.clearTimers();
      this.setStatus("closed");
      debug("closed", ev.code);
      if (!opened) this.failedWithoutOpen += 1;
      this.scheduleRetry(SLOW_RETRY_CODES.has(ev.code) ? 60_000 : undefined);
    };
    ws.onerror = () => debug("socket error");
  }

  private scheduleRetry(fixedMs?: number) {
    if (!this.wanted) return;
    this.setStatus("closed");
    if (this.failedWithoutOpen >= MAX_FAILED_ATTEMPTS) {
      // Give up for this page session; `useLivePollInterval` keeps polling meanwhile.
      debug(`giving up after ${this.failedWithoutOpen} failed attempts; polling only`);
      return;
    }
    const exp = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** this.attempt);
    const delay = fixedMs ?? exp / 2 + Math.random() * (exp / 2); // jitter
    this.attempt += 1;
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }
}

export const realtime = new RealtimeClient();
