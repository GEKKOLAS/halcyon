/**
 * In-memory mailbox for the signaling relay.
 *
 * It only ever holds the WebRTC handshake (offer, answer, ICE candidates) for
 * a couple of minutes — never media or chat. State lives in the Node process,
 * so this works for `next start`, Docker, Fly, Railway, Render… For serverless
 * hosts with many short-lived instances (e.g. Vercel) swap this module for a
 * shared store such as Redis; the API route only uses the functions below.
 */

export const SIGNAL_TYPES = ["hello", "offer", "answer", "candidate", "bye"] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export interface StoredSignal {
  seq: number;
  from: string;
  type: SignalType;
  data?: unknown;
  ts: number;
}

interface Room {
  seq: number;
  messages: StoredSignal[];
  /** peer id → last time we heard from it */
  peers: Map<string, number>;
  waiters: Set<() => void>;
}

export const MAX_PEERS = 2;
const MESSAGE_TTL_MS = 2 * 60_000;
/** A peer that hasn't polled for this long is considered gone. */
const PEER_TTL_MS = 35_000;
const MAX_MESSAGES_PER_ROOM = 200;

const g = globalThis as unknown as { __halcyonRooms?: Map<string, Room> };
const rooms: Map<string, Room> = (g.__halcyonRooms ??= new Map());

function getRoom(id: string): Room {
  let room = rooms.get(id);
  if (!room) {
    room = { seq: 0, messages: [], peers: new Map(), waiters: new Set() };
    rooms.set(id, room);
  }
  return room;
}

function prune(room: Room, now = Date.now()) {
  room.messages = room.messages.filter((m) => now - m.ts < MESSAGE_TTL_MS);
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
  }
  room.peers.forEach((seen, id) => {
    if (now - seen > PEER_TTL_MS) room.peers.delete(id);
  });
}

// Drop idle rooms periodically so memory can't grow without bound.
const sweeper = setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, id) => {
    prune(room, now);
    if (room.peers.size === 0 && room.waiters.size === 0) rooms.delete(id);
  });
}, 60_000);
(sweeper as { unref?: () => void }).unref?.();

/** Register a peer. Returns false if the room already has two other people. */
export function touchPeer(roomId: string, peer: string): boolean {
  const room = getRoom(roomId);
  prune(room);
  if (!room.peers.has(peer) && room.peers.size >= MAX_PEERS) return false;
  room.peers.set(peer, Date.now());
  return true;
}

export function removePeer(roomId: string, peer: string) {
  rooms.get(roomId)?.peers.delete(peer);
}

export function publish(roomId: string, from: string, type: SignalType, data?: unknown) {
  const room = getRoom(roomId);
  room.messages.push({ seq: ++room.seq, from, type, data, ts: Date.now() });
  prune(room);
  room.waiters.forEach((wake) => wake());
}

export function cursor(roomId: string) {
  return getRoom(roomId).seq;
}

function pending(room: Room, peer: string, since: number) {
  return room.messages.filter((m) => m.seq > since && m.from !== peer);
}

/** Wait (up to `timeoutMs`) for messages from other peers newer than `since`. */
export async function poll(
  roomId: string,
  peer: string,
  since: number,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ messages: StoredSignal[]; cursor: number }> {
  const room = getRoom(roomId);
  let msgs = pending(room, peer, since);
  if (msgs.length === 0 && !signal?.aborted) {
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        room.waiters.delete(done);
        signal?.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      room.waiters.add(done);
      signal?.addEventListener("abort", done);
    });
    msgs = pending(room, peer, since);
  }
  // Refresh, but don't resurrect a peer that left while this poll was open.
  if (room.peers.has(peer)) room.peers.set(peer, Date.now());
  return { messages: msgs, cursor: room.seq };
}
