"use client";

/**
 * Transport for the WebRTC handshake. The default implementation talks to the
 * built-in relay at /api/signal/:room; any other channel (WebSocket, Supabase
 * Realtime, …) can implement the same interface.
 */
export type SignalKind = "hello" | "offer" | "answer" | "candidate" | "bye";

export interface SignalMessage {
  from: string;
  type: SignalKind;
  data?: unknown;
}

export interface SignalingChannel {
  /** This tab's peer id. */
  readonly id: string;
  /** Resolves once joined; rejects with "room-full" or "unreachable". */
  connect(): Promise<void>;
  send(type: SignalKind, data?: unknown): Promise<void>;
  onMessage(handler: (msg: SignalMessage) => void): void;
  close(): void;
}

export class SignalingError extends Error {
  constructor(public reason: "room-full" | "unreachable") {
    super(reason);
  }
}

/** A fresh id per page load, so a late "leave" from a previous load can't evict us. */
function newPeerId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function httpSignaling(roomId: string): SignalingChannel {
  const id = newPeerId();
  const base = `/api/signal/${encodeURIComponent(roomId)}`;
  let handler: (msg: SignalMessage) => void = () => {};
  let since = 0;
  let closed = false;
  let abort: AbortController | null = null;
  // Sends go out strictly in order (offer before its candidates).
  let queue: Promise<void> = Promise.resolve();

  const onPageHide = () => {
    navigator.sendBeacon?.(
      base,
      new Blob([JSON.stringify({ peer: id, type: "leave" })], { type: "application/json" })
    );
  };

  async function loop() {
    let failures = 0;
    while (!closed) {
      abort = new AbortController();
      try {
        const res = await fetch(`${base}?peer=${id}&since=${since}`, {
          signal: abort.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { messages: SignalMessage[]; cursor: number };
        since = body.cursor;
        failures = 0;
        for (const m of body.messages) if (!closed) handler(m);
      } catch {
        if (closed) return;
        failures++;
        await sleep(Math.min(1000 * failures, 5000));
      }
    }
  }

  return {
    id,
    async connect() {
      let res: Response;
      try {
        res = await fetch(`${base}?peer=${id}`, { cache: "no-store" });
      } catch {
        throw new SignalingError("unreachable");
      }
      if (res.status === 409) throw new SignalingError("room-full");
      if (!res.ok) throw new SignalingError("unreachable");
      since = ((await res.json()) as { cursor: number }).cursor;
      window.addEventListener("pagehide", onPageHide);
      loop();
    },
    send(type, data) {
      queue = queue.then(async () => {
        if (closed) return;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(base, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ peer: id, type, data }),
            });
            if (res.ok || res.status < 500) return;
          } catch {}
          await sleep(500 * (attempt + 1));
        }
      });
      return queue;
    },
    onMessage(h) {
      handler = h;
    },
    close() {
      if (closed) return;
      closed = true;
      abort?.abort();
      window.removeEventListener("pagehide", onPageHide);
      onPageHide();
    },
  };
}
