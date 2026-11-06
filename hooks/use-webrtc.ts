"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SignalingError,
  type SignalMessage,
  type SignalingChannel,
} from "@/lib/signaling";
import { ICE_SERVERS } from "@/lib/ice";

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
  | "screen-failed"
  | "unknown";

export interface RtcError {
  code: RtcErrorCode;
  message: string;
}

/** Why a call that was connected has ended. */
export type EndReason = "local" | "peer" | "network";

export type NetLevel = "good" | "fair" | "poor" | "unknown";

export interface NetStats {
  level: NetLevel;
  /** Round-trip time of the active candidate pair, in ms. */
  rttMs: number | null;
  /** Fraction of incoming packets lost over the last sample (0–1). */
  loss: number;
}

const STATS_INTERVAL_MS = 2000;

function netLevel(rttMs: number | null, loss: number): NetLevel {
  if (rttMs === null) return "unknown";
  if (rttMs < 150 && loss < 0.02) return "good";
  if (rttMs < 400 && loss < 0.08) return "fair";
  return "poor";
}

export interface ChatMessage {
  id: string;
  text: string;
  mine: boolean;
  ts: number;
}

/** Messages exchanged over the data channel. */
type WireMessage =
  | { type: "chat"; text: string }
  | { type: "state"; mic: boolean; cam: boolean; screen?: boolean }
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
  "screen-failed": "Couldn't start screen sharing.",
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
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connState, setConnState] = useState<ConnState>("idle");
  const [error, setError] = useState<RtcError | null>(null);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteMicOn, setRemoteMicOn] = useState(true);
  const [remoteCamOn, setRemoteCamOn] = useState(true);
  const [remoteSharing, setRemoteSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [cameraCount, setCameraCount] = useState(0);
  const [netStats, setNetStats] = useState<NetStats | null>(null);
  // Detected after mount so server and client render the same markup.
  const [canShareScreen, setCanShareScreen] = useState(false);
  useEffect(() => {
    setCanShareScreen(typeof navigator.mediaDevices?.getDisplayMedia === "function");
  }, []);
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

  const sendState = useCallback(
    () =>
      sendWire({
        type: "state",
        mic: micRef.current,
        cam: camRef.current,
        screen: !!screenTrackRef.current,
      }),
    [sendWire]
  );

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
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    setScreenStream(null);
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
          setRemoteSharing(!!msg.screen);
        } else if (msg.type === "bye") teardown("peer");
      };
      // The channel closes when the other tab goes away without a "bye".
      dc.onclose = () => {
        if (wasConnected.current && pcRef.current) teardown("peer");
      };
    },
    [pushMessage, sendState, teardown]
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
    const settings = stream.getVideoTracks()[0]?.getSettings();
    setFacing(settings?.facingMode === "environment" ? "environment" : "user");
    navigator.mediaDevices
      .enumerateDevices()
      .then((d) => setCameraCount(d.filter((x) => x.kind === "videoinput").length))
      .catch(() => {});
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
    sendState();
  }, [sendState]);

  const toggleCam = useCallback(() => {
    camRef.current = !camRef.current;
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = camRef.current));
    setCamOn(camRef.current);
    sendState();
  }, [sendState]);

  const videoSender = () =>
    pcRef.current?.getSenders().find((s) => s.track?.kind === "video") ?? null;

  /** Cycle to the next camera (front ↔ back on phones). */
  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const old = stream.getVideoTracks()[0];
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === "videoinput"
    );
    setCameraCount(cams.length);
    if (cams.length < 2) return;
    const currentId = old?.getSettings().deviceId;
    const next = cams[(cams.findIndex((c) => c.deviceId === currentId) + 1) % cams.length];

    const open = (deviceId: string) =>
      navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    // Many phones can't open two cameras at once, so release the current one first.
    old?.stop();
    let track: MediaStreamTrack;
    try {
      track = (await open(next.deviceId)).getVideoTracks()[0];
    } catch (err) {
      setError(mediaError(err));
      if (!currentId) return;
      try {
        track = (await open(currentId)).getVideoTracks()[0];
      } catch {
        return;
      }
    }
    track.enabled = camRef.current;
    const fresh = new MediaStream([
      ...stream.getAudioTracks(),
      track,
    ]);
    localStreamRef.current = fresh;
    setLocalStream(fresh);
    const mode = track.getSettings().facingMode;
    setFacing(mode === "environment" ? "environment" : "user");
    if (!screenTrackRef.current) await videoSender()?.replaceTrack(track);
  }, []);

  const stopScreenShare = useCallback(() => {
    const t = screenTrackRef.current;
    if (!t) return;
    screenTrackRef.current = null;
    t.onended = null;
    t.stop();
    const cam = localStreamRef.current?.getVideoTracks()[0] ?? null;
    videoSender()?.replaceTrack(cam).catch(() => {});
    setScreenStream(null);
    sendState();
  }, [sendState]);

  /** Share a screen/window/tab in place of the camera. */
  const toggleScreenShare = useCallback(async () => {
    if (screenTrackRef.current) return stopScreenShare();
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (err) {
      // Closing the picker is not an error worth showing.
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) {
        setError(rtcError("screen-failed"));
      }
      return;
    }
    const track = display.getVideoTracks()[0];
    if (!track) return;
    track.contentHint = "detail";
    track.onended = stopScreenShare; // the browser's own "Stop sharing" button
    screenTrackRef.current = track;
    try {
      await videoSender()?.replaceTrack(track);
    } catch {
      stopScreenShare();
      setError(rtcError("screen-failed"));
      return;
    }
    setScreenStream(new MediaStream([track]));
    sendState();
  }, [sendState, stopScreenShare]);

  // Sample connection quality while connected.
  useEffect(() => {
    if (connState !== "connected") {
      setNetStats(null);
      return;
    }
    let prevLost = 0;
    let prevRecv = 0;
    const timer = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      const report = await pc.getStats().catch(() => null);
      if (!report) return;
      let pairId: string | undefined;
      let rtt: number | null = null;
      let lost = 0;
      let recv = 0;
      report.forEach((st) => {
        if (st.type === "transport" && st.selectedCandidatePairId) pairId = st.selectedCandidatePairId;
        if (st.type === "inbound-rtp") {
          lost += Math.max(0, st.packetsLost ?? 0);
          recv += st.packetsReceived ?? 0;
        }
      });
      report.forEach((st) => {
        if (st.type !== "candidate-pair" || typeof st.currentRoundTripTime !== "number") return;
        if (pairId ? st.id === pairId : st.nominated && st.state === "succeeded") {
          rtt = Math.round(st.currentRoundTripTime * 1000);
        }
      });
      const dLost = lost - prevLost;
      const dRecv = recv - prevRecv;
      prevLost = lost;
      prevRecv = recv;
      const loss = dLost + dRecv > 0 ? Math.max(0, dLost) / (dLost + dRecv) : 0;
      setNetStats({ level: netLevel(rtt, loss), rttMs: rtt, loss });
    }, STATS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [connState]);

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
    remoteSharing,
    screenStream,
    sharing: !!screenStream,
    localMirror: !screenStream && facing === "user",
    canSwitchCamera: cameraCount > 1,
    canShareScreen,
    netStats,
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
    switchCamera,
    toggleScreenShare,
    clearError,
    hangUp,
  };
}
