"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type ConnState = "idle" | "connecting" | "connected" | "failed" | "closed";

export interface Reaction {
  id: string;
  emoji: string;
  mine: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  mine: boolean;
  ts: number;
}

/**
 * Serverless WebRTC: peers exchange a single "signal code" (offer or answer)
 * out of band (paste link / code). ICE candidates are bundled into the SDP
 * via a short gathering wait, so no live signaling server is required.
 */
export function useWebRTC() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connState, setConnState] = useState<ConnState>("idle");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);

  const pushReaction = useCallback((emoji: string, mine: boolean) => {
    const id = Math.random().toString(36).slice(2);
    setReactions((prev) => [...prev, { id, emoji, mine }]);
    setTimeout(
      () => setReactions((prev) => prev.filter((r) => r.id !== id)),
      2600
    );
  }, []);

  const pushMessage = useCallback((text: string, mine: boolean) => {
    setMessages((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), text, mine, ts: Date.now() },
    ]);
  }, []);

  const wireDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dcRef.current = dc;
      dc.onmessage = (e) => {
        // Structured payloads; fall back to plain text for older peers.
        try {
          const msg = JSON.parse(e.data);
          if (msg?.type === "reaction") return pushReaction(msg.emoji, false);
          if (msg?.type === "chat") return pushMessage(msg.text, false);
        } catch {}
        pushMessage(String(e.data), false);
      };
    },
    [pushMessage, pushReaction]
  );

  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pc.ondatachannel = (e) => wireDataChannel(e.channel);
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        setConnState("connected");
        setConnectedAt((t) => t ?? Date.now());
      }
      else if (s === "failed") setConnState("failed");
      else if (s === "disconnected" || s === "closed") setConnState("closed");
    };
    pcRef.current = pc;
    return pc;
  }, []);

  const initMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

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

  const encode = (d: RTCSessionDescriptionInit) =>
    btoa(encodeURIComponent(JSON.stringify(d)));
  const decode = (s: string): RTCSessionDescriptionInit =>
    JSON.parse(decodeURIComponent(atob(s.trim())));

  // Host: create an offer code
  const createOffer = useCallback(async () => {
    setConnState("connecting");
    const stream = await initMedia();
    const pc = createPeer();
    wireDataChannel(pc.createDataChannel("chat"));
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIce(pc);
    return encode(pc.localDescription!);
  }, [createPeer, initMedia, wireDataChannel]);

  // Guest: consume offer, produce an answer code
  const acceptOffer = useCallback(
    async (offerCode: string) => {
      setConnState("connecting");
      const stream = await initMedia();
      const pc = createPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(decode(offerCode));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIce(pc);
      return encode(pc.localDescription!);
    },
    [createPeer, initMedia, wireDataChannel]
  );

  const sendMessage = useCallback(
    (text: string) => {
      const dc = dcRef.current;
      if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify({ type: "chat", text }));
        pushMessage(text, true);
      }
    },
    [pushMessage]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      const dc = dcRef.current;
      if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify({ type: "reaction", emoji }));
      }
      pushReaction(emoji, true);
    },
    [pushReaction]
  );
  const acceptAnswer = useCallback(async (answerCode: string) => {
    const pc = pcRef.current;
    if (!pc) throw new Error("No active connection");
    await pc.setRemoteDescription(decode(answerCode));
  }, []);

  const toggleMic = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((p) => !p);
  }, []);

  const toggleCam = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((p) => !p);
  }, []);

  const hangUp = useCallback(() => {
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setConnState("closed");
  }, []);

  useEffect(() => () => hangUp(), [hangUp]);

  return {
    localStream,
    remoteStream,
    connState,
    micOn,
    camOn,
    messages,
    reactions,
    connectedAt,
    initMedia,
    createOffer,
    acceptOffer,
    acceptAnswer,
    sendMessage,
    sendReaction,
    toggleMic,
    toggleCam,
    hangUp,
  };
}
