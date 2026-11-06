import { NextResponse, type NextRequest } from "next/server";
import {
  SIGNAL_TYPES,
  cursor,
  poll,
  publish,
  removePeer,
  touchPeer,
  type SignalType,
} from "@/lib/signal-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_RE = /^[a-z0-9_-]{1,64}$/i;
const MAX_BODY_BYTES = 64 * 1024;
const POLL_TIMEOUT_MS = 20_000;

const bad = (msg: string, status = 400) =>
  NextResponse.json({ error: msg }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Long-poll for handshake messages.
 * GET /api/signal/:room?peer=<id>           → join; returns the current cursor
 * GET /api/signal/:room?peer=<id>&since=<n> → messages from others after n
 */
export async function GET(req: NextRequest, { params }: { params: { room: string } }) {
  const room = params.room;
  const peer = req.nextUrl.searchParams.get("peer") ?? "";
  const sinceRaw = req.nextUrl.searchParams.get("since");
  if (!ID_RE.test(room) || !ID_RE.test(peer)) return bad("invalid room or peer");
  if (!touchPeer(room, peer)) return bad("room full", 409);

  if (sinceRaw === null) {
    return NextResponse.json(
      { messages: [], cursor: cursor(room) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  const since = Number(sinceRaw);
  if (!Number.isInteger(since) || since < 0) return bad("invalid cursor");

  const result = await poll(room, peer, since, POLL_TIMEOUT_MS, req.signal);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/signal/:room  { peer, type, data? } */
export async function POST(req: NextRequest, { params }: { params: { room: string } }) {
  const room = params.room;
  if (!ID_RE.test(room)) return bad("invalid room");

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return bad("message too large", 413);

  let body: { peer?: unknown; type?: unknown; data?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return bad("invalid json");
  }
  const { peer, type, data } = body;
  if (typeof peer !== "string" || !ID_RE.test(peer)) return bad("invalid peer");

  // Sent by sendBeacon when a tab closes: free the slot and tell the other side.
  if (type === "leave") {
    publish(room, peer, "bye");
    removePeer(room, peer);
    return new NextResponse(null, { status: 204 });
  }

  if (typeof type !== "string" || !SIGNAL_TYPES.includes(type as SignalType)) {
    return bad("invalid type");
  }
  if (!touchPeer(room, peer)) return bad("room full", 409);

  publish(room, peer, type as SignalType, data);
  return new NextResponse(null, { status: 204 });
}
