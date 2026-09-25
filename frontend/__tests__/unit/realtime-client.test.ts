import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api", () => ({ apiSend: vi.fn().mockResolvedValue({ ticket: "t" }) }));

/** A WebSocket that always fails before opening (e.g. a host that can't proxy upgrades). */
class FailingSocket {
  static instances = 0;
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  constructor(public url: string) {
    FailingSocket.instances += 1;
    setTimeout(() => {
      this.onerror?.();
      this.onclose?.({ code: 1006 });
    }, 0);
  }
  close() {}
  send() {}
}

describe("realtime client circuit breaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FailingSocket.instances = 0;
    vi.stubGlobal("WebSocket", FailingSocket as unknown as typeof WebSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("stops reconnecting after repeated failures instead of flooding the console", async () => {
    const { realtime } = await import("@/lib/realtime");
    realtime.start();
    await vi.advanceTimersByTimeAsync(10 * 60_000); // far longer than every backoff step
    expect(FailingSocket.instances).toBe(5);
    expect(realtime.getStatus()).toBe("closed"); // → UI keeps its polling fallback
    realtime.stop();
  });

  it("uses the build-time realtime URL when configured (Vercel → direct to API host)", async () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_URL", "wss://api.example.com/api/v1/realtime/ws");
    let seen = "";
    vi.stubGlobal(
      "WebSocket",
      class extends FailingSocket {
        constructor(url: string) {
          super(url);
          seen = url;
        }
      } as unknown as typeof WebSocket,
    );
    const { realtime } = await import("@/lib/realtime");
    realtime.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(seen.startsWith("wss://api.example.com/api/v1/realtime/ws?ticket=")).toBe(true);
    realtime.stop();
    vi.unstubAllEnvs();
  });
});
