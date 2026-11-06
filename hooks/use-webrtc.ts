"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SignalingError,
  type SignalMessage,
  type SignalingChannel,
} from "@/lib/signaling";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/** How long a dropped connection may try to recover before the call ends. */
const RECONNECT_GRACE_MS = 15_000;

export type ConnState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  | "closed";

export type RtcErrorCode =
  | "insecure-context"
  | "permission-denied"
  | "no-device"
  | "device-busy"
  | "media-failed"
  | "invalid-code"
  | "expected-answer"
  | "expected-offer"
  | "ice-failed"
  | "room-full"
  | "signaling-failed"
  | "unknown";

export interface RtcError {
  code: RtcErrorCode;
  message: string;
}

/** Why a call that was connected has ended. */
export type EndReason = "local" | "peer" | "network";

export interface ChatMessage {
  id: string;
  text: string;
  mine: boolean;
  ts: number;
}

/** Messages exchanged over the data channel. */
type WireMessage =
  | { type: "chat"; text: string }
  | { type: "state"; mic: boolean; cam: boolean }
  | { type: "bye" };

const ERROR_MESSAGES: Record<RtcErrorCode, string> = {
  "insecure-context":
    "Camera access needs a secure connection. Open Halcyon over HTTPS (or localhost).",
  "permission-denied":
    "Camera and microphone access was blocked. Allow it in your browser's site settings, then try again.",
  "no-device": "No camera or microphone was found on this device.",
  "device-busy":
    "Your camera or microphone is being used by another app. Close it and try again.",
  "media-failed": "Couldn't start your camera or microphone.",
  "invalid-code":
    "That code doesn't look right. Make sure you copied the whole thing.",
  "expected-answer":
    "That's an invite code. Paste the reply code your guest sent back instead.",
  "expected-offer":
    "That's a reply code. Paste the invite code the host sent you instead.",
  "ice-failed":
    "Couldn't open a direct connection. One of the networks may be blocking peer-to-peer traffic.",
  "room-full": "This room already has two people in it. Start a new room instead.",
  "signaling-failed":
    "Couldn't reach the connection service. Check your internet, or connect manually with codes.",
  unknown: "Something went wrong. Please try again.",
};

export const rtcError = (code: RtcErrorCode): RtcError => ({
  code,
  message: ERROR_MESSAGES[code],
});

function mediaError(err: unknown): RtcError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return rtcError("permission-denied");
    case "NotFoundError":
    case "OverconstrainedError":
      return rtcError("no-device");
    case "NotReadableError":
    case "AbortError":
      return rtcError("device-busy");
    default:
      return rtcError("media-failed");
  }
}

const encode = (d: RTCSessionDescriptionInit) =>
  btoa(encodeURIComponent(JSON.stringify(d)));

/** Decode a pasted signal code, verifying it is the kind we expect. */
function decode(code: string, expected: "offer" | "answer"): RTCSessionDescriptionInit {
  let desc: RTCSessionDescriptionInit;
  try {
    desc = JSON.parse(decodeURIComponent(atob(code.replace(/\s+/g, ""))));
  } catch {
    throw rtcError("invalid-code");
  }
  if (!desc || typeof desc.sdp !== "string" || !desc.type) {
    throw rtcError("invalid-code");
  }
  if (desc.type !== expected) {
    throw rtcError(expected === "answer" ? "expected-answer" : "expected-offer");
  }
  return desc;
}

const isRtcError = (e: unknown): e is RtcError =>
  typeof e === "object" && e !== null && "code" in e && "message" in e;

/**
 * Serverless WebRTC: peers exchange a single "signal code" (offer or answer)
 * out of band (paste link / code). ICE candidates are bundled into the SDP
 * via a short gathering wait, so no live signaling server is required.
 */
export function useWebRTC() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const sigRef = useRef<SignalingChannel | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasConnected = useRef(false);
  const micRef = useRef(true);
  const camRef = useRef(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connState, setConnState] = useState<ConnState>("idle");
  const [error, setError] = useState<RtcError | null>(null);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteMicOn, setRemoteMicOn] = useState(true);
  const [remoteCamOn, setRemoteCamOn] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const pushMessage = useCallback((text: string, mine: boolean) => {
    setMessages((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), text, mine, ts: Date.now() },
    ]);
  }, []);

  const sendWire = useCallback((msg: WireMessage) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const clearReconnectTimer = () => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
  };

  /** Close the peer connection and stop local media. */
  const teardown = useCallback((reason: EndReason | null) => {
    clearReconnectTimer();
    const pc = pcRef.current;
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
      pc.ondatachannel = null;
      pc.close();
    }
    if (dcRef.current) dcRef.current.onclose = null;
    sigRef.current?.close();
    sigRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current = null;
    dcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setConnState("closed");
    if (reason && wasConnected.current) setEndReason(reason);
  }, []);

  const wireDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dcRef.current = dc;
      const sendState = () =>
        sendWire({ type: "state", mic: micRef.current, cam: camRef.current });
      // The answerer's channel usually arrives already open.
      if (dc.readyState === "open") sendState();
      else dc.onopen = sendState;
      dc.onmessage = (e) => {
        let msg: WireMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          // Plain-text message from an older client.
          pushMessage(String(e.data), false);
          return;
        }
        if (msg.type === "chat") pushMessage(msg.text, false);
        else if (msg.type === "state") {
          setRemoteMicOn(msg.mic);
          setRemoteCamOn(msg.cam);
        } else if (msg.type === "bye") teardown("peer");
      };
      // The channel closes when the other tab goes away without a "bye".
      dc.onclose = () => {
        if (wasConnected.current && pcRef.current) teardown("peer");
      };
    },
    [pushMessage, sendWire, teardown]
  );

  const createPeer = useCallback(() => {
    // Replace any previous attempt.
    if (pcRef.current) {
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
    pc.ondatachannel = (e) => wireDataChannel(e.channel);
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          clearReconnectTimer();
          wasConnected.current = true;
          setError(null);
          setConnState("connected");
          break;
        case "disconnected":
          // Often transient (network switch, brief loss). Give it a chance.
          setConnState("reconnecting");
          clearReconnectTimer();
          reconnectTimer.current = setTimeout(
            () => teardown("network"),
            RECONNECT_GRACE_MS
          );
          break;
        case "failed":
          if (wasConnected.current) teardown("network");
          else {
            setConnState("failed");
            setError(rtcError("ice-failed"));
          }
          break;
        case "closed":
          teardown(null);
          break;
      }
    };
    pcRef.current = pc;
    return pc;
  }, [teardown, wireDataChannel]);

  /** Acquire camera + mic. Throws an RtcError on failure. */
  const getMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw rtcError("insecure-context");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      throw mediaError(err);
    }
    stream.getAudioTracks().forEach((t) => (t.enabled = micRef.current));
    stream.getVideoTracks().forEach((t) => (t.enabled = camRef.current));
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  /** Run an async step, turning failures into the `error` state. */
  const guard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      setError(null);
      try {
        return await fn();
      } catch (err) {
        setError(isRtcError(err) ? err : rtcError("unknown"));
        return null;
      }
    },
    []
  );

  const initMedia = useCallback(() => guard(getMedia), [guard, getMedia]);

  const waitForIce = (pc: RTCPeerConnection) =>
    new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const timer = setTimeout(resolve, 2500);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timer);
          resolve();
        }
      };
    });

  /** Host: create an invite (offer) code. */
  const createOffer = useCallback(
    () =>
      guard(async () => {
        const stream = await getMedia();
        const pc = createPeer();
        wireDataChannel(pc.createDataChannel("chat"));
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        await pc.setLocalDescription(await pc.createOffer());
        await waitForIce(pc);
        return encode(pc.localDescription!);
      }),
    [guard, getMedia, createPeer, wireDataChannel]
  );

  /** Guest: consume an invite code, produce a reply (answer) code. */
  const acceptOffer = useCallback(
    (offerCode: string) =>
      guard(async () => {
        const offer = decode(offerCode, "offer");
        const stream = await getMedia();
        const pc = createPeer();
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        try {
          await pc.setRemoteDescription(offer);
        } catch {
          throw rtcError("invalid-code");
        }
        await pc.setLocalDescription(await pc.createAnswer());
        await waitForIce(pc);
        return encode(pc.localDescription!);
      }),
    [guard, getMedia, createPeer]
  );

  /** Host: consume the guest's reply code to complete the connection. */
  const acceptAnswer = useCallback(
    (answerCode: string) =>
      guard(async () => {
        const answer = decode(answerCode, "answer");
        const pc = pcRef.current;
        if (!pc || pc.signalingState !== "have-local-offer") {
          throw rtcError("unknown");
        }
        try {
          await pc.setRemoteDescription(answer);
        } catch {
          throw rtcError("invalid-code");
        }
        setConnState("connecting");
        return true;
      }),
    [guard]
  );

  /**
   * Link mode: run the whole handshake over a signaling channel, trickling
   * ICE candidates as they are found. Whichever peer has the lower id makes
   * the offer, so both sides can join in any order (or at the same time).
   */
  const connectVia = useCallback(
    (sig: SignalingChannel) =>
      guard(async () => {
        const stream = await getMedia();
        sigRef.current?.close();
        sigRef.current = sig;

        // The peer we're negotiating with; messages from anyone else (e.g. a
        // late "bye" from a tab that already reloaded) are ignored.
        let remote: string | null = null;
        let saidHelloBack = false;
        let queued: RTCIceCandidateInit[] = [];

        const newPeer = () => {
          const pc = createPeer();
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));
          pc.onicecandidate = (e) => {
            if (e.candidate) sig.send("candidate", e.candidate.toJSON());
          };
          queued = [];
          return pc;
        };
        const flush = async (pc: RTCPeerConnection) => {
          const list = queued;
          queued = [];
          for (const c of list) await pc.addIceCandidate(c).catch(() => {});
        };
        const alive = (pc: RTCPeerConnection | null) =>
          !!pc && !["failed", "closed"].includes(pc.connectionState);

        const handle = async (m: SignalMessage) => {
          if (sigRef.current !== sig) return;
          const pc = pcRef.current;
          if (m.type !== "hello" && m.type !== "offer" && m.from !== remote) return;
          switch (m.type) {
            case "hello": {
              if (remote && alive(pc)) {
                if (m.from === remote || wasConnected.current) return;
              }
              if (sig.id < m.from) {
                remote = m.from;
                setConnState("connecting");
                const next = newPeer();
                wireDataChannel(next.createDataChannel("chat"));
                await next.setLocalDescription(await next.createOffer());
                await sig.send("offer", next.localDescription!.toJSON());
              } else if (!saidHelloBack) {
                // The other peer joined after us; let it know we're here.
                saidHelloBack = true;
                await sig.send("hello");
              }
              break;
            }
            case "offer": {
              if (wasConnected.current) return;
              remote = m.from;
              setConnState("connecting");
              const next = newPeer();
              await next.setRemoteDescription(m.data as RTCSessionDescriptionInit);
              await flush(next);
              await next.setLocalDescription(await next.createAnswer());
              await sig.send("answer", next.localDescription!.toJSON());
              break;
            }
            case "answer":
              if (pc && pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
                await flush(pc);
              }
              break;
            case "candidate":
              if (pc?.remoteDescription) {
                await pc.addIceCandidate(m.data as RTCIceCandidateInit).catch(() => {});
              } else queued.push(m.data as RTCIceCandidateInit);
              break;
            case "bye":
              if (wasConnected.current) teardown("peer");
              else {
                // They left before we connected: wait for the next person.
                remote = null;
                saidHelloBack = false;
                setConnState("idle");
              }
              break;
          }
        };

        // Process messages one at a time, in order.
        let chain = Promise.resolve();
        sig.onMessage((m) => {
          chain = chain
            .then(() => handle(m))
            .catch(() => setError(rtcError("unknown")));
        });

        try {
          await sig.connect();
        } catch (err) {
          sigRef.current = null;
          throw rtcError(
            err instanceof SignalingError && err.reason === "room-full"
              ? "room-full"
              : "signaling-failed"
          );
        }
        await sig.send("hello");
        return true;
      }),
    [guard, getMedia, createPeer, wireDataChannel, teardown]
  );

  /** Stop link mode (e.g. to switch to manual codes). */
  const disconnectSignaling = useCallback(() => {
    sigRef.current?.close();
    sigRef.current = null;
    if (!wasConnected.current && pcRef.current) {
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    setConnState("idle");
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      if (sendWire({ type: "chat", text })) pushMessage(text, true);
    },
    [pushMessage, sendWire]
  );

  const toggleMic = useCallback(() => {
    micRef.current = !micRef.current;
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = micRef.current));
    setMicOn(micRef.current);
    sendWire({ type: "state", mic: micRef.current, cam: camRef.current });
  }, [sendWire]);

  const toggleCam = useCallback(() => {
    camRef.current = !camRef.current;
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = camRef.current));
    setCamOn(camRef.current);
    sendWire({ type: "state", mic: micRef.current, cam: camRef.current });
  }, [sendWire]);

  const clearError = useCallback(() => setError(null), []);

  /** End the call and tell the other side. */
  const hangUp = useCallback(() => {
    sendWire({ type: "bye" });
    teardown("local");
  }, [sendWire, teardown]);

  // Tell the peer when the tab is closed or navigated away.
  useEffect(() => {
    const onPageHide = () => sendWire({ type: "bye" });
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [sendWire]);

  useEffect(() => () => hangUp(), [hangUp]);

  return {
    localStream,
    remoteStream,
    connState,
    error,
    endReason,
    micOn,
    camOn,
    remoteMicOn,
    remoteCamOn,
    messages,
    initMedia,
    createOffer,
    acceptOffer,
    acceptAnswer,
    connectVia,
    disconnectSignaling,
    sendMessage,
    toggleMic,
    toggleCam,
    clearError,
    hangUp,
  };
}
