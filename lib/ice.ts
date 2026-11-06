/**
 * ICE servers for NAT traversal. STUN is enough for most home networks; a
 * TURN relay is needed behind symmetric NATs (many mobile carriers, offices).
 *
 * Configure TURN at build time:
 *   NEXT_PUBLIC_TURN_URLS="turn:turn.example.com:3478,turns:turn.example.com:5349"
 *   NEXT_PUBLIC_TURN_USERNAME=...
 *   NEXT_PUBLIC_TURN_CREDENTIAL=...
 * These values ship to the browser, so use credentials scoped to TURN only
 * (or short-lived ones from your provider).
 */
const STUN: RTCIceServer = {
  urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
};

function turnFromEnv(): RTCIceServer | null {
  const urls = (process.env.NEXT_PUBLIC_TURN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length === 0) return null;
  return {
    urls,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
  };
}

export const ICE_SERVERS: RTCIceServer[] = [STUN, ...[turnFromEnv()].filter((s): s is RTCIceServer => !!s)];
