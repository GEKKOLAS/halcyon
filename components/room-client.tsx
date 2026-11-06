"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Copy,
  Keyboard,
  Loader2,
  PhoneOff,
  RotateCcw,
  WifiOff,
  X,
} from "lucide-react";
import { useWebRTC, type EndReason, type RtcErrorCode } from "@/hooks/use-webrtc";
import { AuroraBackground } from "@/components/aurora-background";
import { Logo, PresenceOrb } from "@/components/logo";
import { VideoTile } from "@/components/video-tile";
import { SignalPanel } from "@/components/signal-panel";
import { LinkPanel } from "@/components/link-panel";
import { httpSignaling } from "@/lib/signaling";
import { ControlBar, REACTIONS } from "@/components/control-bar";
import { ChatPanel } from "@/components/chat-panel";
import { NetworkBadge } from "@/components/network-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MEDIA_ERRORS: RtcErrorCode[] = [
  "permission-denied",
  "no-device",
  "device-busy",
  "media-failed",
];

const END_COPY: Record<EndReason, { title: string; body: string }> = {
  peer: {
    title: "The other person left",
    body: "The call has ended. Nothing was recorded.",
  },
  network: {
    title: "Connection lost",
    body: "The direct connection dropped and couldn't recover.",
  },
  local: { title: "Call ended", body: "Nothing was recorded." },
};

const ease = [0.16, 1, 0.3, 1] as const;

function CallEnded({ reason, duration }: { reason: EndReason; duration: string | null }) {
  const { title, body } = END_COPY[reason];
  const Icon = reason === "network" ? WifiOff : PhoneOff;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease }}
      className="w-full max-w-sm rounded-[2rem] glass-strong p-8 text-center shadow-2xl"
      role="status"
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-5 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {body}
        {duration && <> You talked for {duration}.</>}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={() => window.location.reload()}>
          <RotateCcw className="h-4 w-4" />
          Start over in this room
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </motion.div>
  );
}

function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Elapsed call time; freezes when the call stops running. */
function useCallTimer(since: number | null, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since || !running) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since, running]);
  return since ? formatDuration(now - since) : null;
}

export function RoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const isHost = params.get("host") === "1";
  const remoteLabel = isHost ? "Guest" : "Host";

  const rtc = useWebRTC();
  const [offerCode, setOfferCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [mode, setMode] = useState<"link" | "manual">("link");
  const [roomUrl, setRoomUrl] = useState(`/room/${roomId}`);
  const [busy, setBusy] = useState(false);
  const [answerApplied, setAnswerApplied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const lastMsgCount = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const { connState, endReason, error } = rtc;
  const connected = connState === "connected";
  const reconnecting = connState === "reconnecting";
  const inCall = connected || reconnecting;
  // In manual mode ICE checks can start before the host pastes the reply, so
  // only treat the call as "connecting" once the host has applied the answer.
  const negotiating =
    mode === "link"
      ? connState === "connecting"
      : isHost && answerApplied && !inCall && connState !== "failed";
  const ended = endReason === "peer" || endReason === "network";
  const timer = useCallTimer(rtc.connectedAt, inCall);

  const startLink = () => rtc.connectVia(httpSignaling(roomId));

  // Start the camera and join the room's handshake channel right away.
  useEffect(() => {
    setRoomUrl(`${window.location.origin}/room/${roomId}`);
    startLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useManual = () => {
    rtc.disconnectSignaling();
    rtc.clearError();
    setMode("manual");
    rtc.initMedia();
  };
  const useLink = () => {
    setOfferCode("");
    setAnswerCode("");
    setAnswerApplied(false);
    setMode("link");
    startLink();
  };

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  }, []);

  // Track unread chat
  useEffect(() => {
    if (rtc.messages.length > lastMsgCount.current) {
      const newest = rtc.messages[rtc.messages.length - 1];
      if (newest && !newest.mine && !chatOpen) setUnread((u) => u + 1);
    }
    lastMsgCount.current = rtc.messages.length;
  }, [rtc.messages, chatOpen]);

  // Close chat when the call ends
  useEffect(() => {
    if (ended) setChatOpen(false);
  }, [ended]);

  // Auto-hide chrome while in a call and the pointer is still
  useEffect(() => {
    if (!connected || chatOpen) {
      setIdle(false);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 3500);
    };
    wake();
    const events = ["pointermove", "pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, wake));
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [connected, chatOpen]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const openChat = useCallback(() => {
    setChatOpen((o) => !o);
    setUnread(0);
  }, []);

  const { toggleMic, toggleCam, sendReaction } = rtc;

  // Keyboard shortcuts
  useEffect(() => {
    if (ended) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      const k = e.key.toLowerCase();
      const actions: Record<string, () => void> = {
        m: toggleMic,
        v: toggleCam,
        c: openChat,
        f: toggleFullscreen,
      };
      const action =
        actions[k] ??
        (connected && /^[1-6]$/.test(k)
          ? () => sendReaction(REACTIONS[Number(k) - 1])
          : null);
      if (!action) return;
      // Keep the key from landing in an input that this action focuses.
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMic, toggleCam, openChat, toggleFullscreen, sendReaction, connected, ended]);

  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateOffer = () =>
    run(async () => {
      const code = await rtc.createOffer();
      if (code) setOfferCode(code);
    });
  const handleAcceptOffer = (code: string) =>
    run(async () => {
      const ans = await rtc.acceptOffer(code);
      if (ans) setAnswerCode(ans);
    });
  const handleAcceptAnswer = (code: string) =>
    run(async () => {
      if (await rtc.acceptAnswer(code)) setAnswerApplied(true);
    });

  // What "try again" means depends on what failed.
  let onRetry: (() => void) | undefined;
  let retryLabel: string | undefined;
  if (error && MEDIA_ERRORS.includes(error.code)) {
    onRetry = () => run<unknown>(() => (mode === "link" ? startLink() : rtc.initMedia()));
    retryLabel = "Try camera again";
  } else if (error?.code === "signaling-failed") {
    onRetry = () => run(startLink);
  } else if (error?.code === "ice-failed") {
    onRetry = () => window.location.reload();
    retryLabel = "Start over";
  }

  const leave = () => {
    rtc.hangUp();
    router.push("/");
  };

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      flash("Room link copied");
    } catch {
      // Clipboard unavailable; nothing to do.
    }
  };

  const status = ended
    ? "Call ended"
    : connected
    ? "Connected"
    : reconnecting
    ? "Reconnecting…"
    : negotiating
    ? "Connecting…"
    : connState === "failed"
    ? "Couldn't connect"
    : mode === "link"
    ? "Waiting for someone"
    : isHost && offerCode
    ? "Waiting for reply"
    : !isHost && answerCode
    ? "Waiting for host"
    : "Not connected";

  const mediaBlocked = !!error && MEDIA_ERRORS.includes(error.code);
  const chromeHidden = idle && !reconnecting;

  const localTile = (
    <VideoTile
      stream={rtc.screenStream ?? rtc.localStream}
      label={rtc.sharing ? "You · screen" : "You"}
      muted
      mirror={rtc.localMirror}
      audioOff={!rtc.micOn}
      videoOff={!rtc.sharing && !rtc.camOn}
      fit={rtc.sharing ? "contain" : "cover"}
      compact={inCall && !swapped}
      className="h-full w-full"
    />
  );
  const remoteTile = (
    <VideoTile
      stream={rtc.remoteStream}
      label={remoteLabel}
      audioOff={!rtc.remoteMicOn}
      videoOff={!rtc.remoteCamOn && !rtc.remoteSharing}
      fit={rtc.remoteSharing ? "contain" : "cover"}
      compact={swapped}
      className="h-full w-full"
    />
  );

  return (
    <div
      className={cn(
        "relative flex h-[100dvh] flex-col overflow-hidden",
        chromeHidden && "cursor-none"
      )}
    >
      <AuroraBackground interactive={!inCall} />

      {/* Top bar */}
      <motion.header
        animate={{ y: chromeHidden ? -80 : 0, opacity: chromeHidden ? 0 : 1 }}
        transition={{ duration: 0.35, ease }}
        className="z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <Link href="/" aria-label="Halcyon home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs tabular-nums",
              (ended || connState === "failed") && "text-destructive"
            )}
            aria-live="polite"
          >
            {connected ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-aurora-rose" />
            ) : (
              <PresenceOrb className={cn(!negotiating && !reconnecting && "opacity-40")} />
            )}
            <span className={cn(inCall && "hidden sm:inline")}>{status}</span>
            {inCall && timer && <span>{timer}</span>}
          </span>
          <button
            onClick={copyRoom}
            aria-label={`Copy room link (${roomId})`}
            className="group flex items-center gap-2 rounded-full glass glass-hover px-3 py-1.5 font-mono text-xs"
          >
            <Copy className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            <span className="hidden sm:inline">{roomId}</span>
          </button>
        </div>
      </motion.header>

      {/* Main stage */}
      <div className="relative z-10 flex flex-1 gap-4 overflow-hidden px-4 pb-4 sm:px-6">
        <div ref={stageRef} className="relative flex flex-1 items-center justify-center">
          {/* No "wait" mode: the next view mounts at once and fades in over the old one. */}
          <AnimatePresence initial={false}>
            {ended ? (
              <motion.div
                key="ended"
                className="absolute inset-0 flex items-center justify-center"
                exit={{ opacity: 0 }}
              >
                <CallEnded reason={endReason!} duration={timer} />
              </motion.div>
            ) : inCall ? (
              <motion.div
                key="call"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease }}
                className="absolute inset-0"
              >
                {swapped ? localTile : remoteTile}

                {/* Stage overlays (stay put when the tiles are swapped) */}
                <motion.div
                  animate={{ opacity: chromeHidden ? 0 : 1 }}
                  className="pointer-events-none absolute left-3 top-3 z-10"
                >
                  <NetworkBadge stats={rtc.netStats} />
                </motion.div>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      role="alert"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-7rem)] -translate-x-1/2 items-center gap-2 rounded-full glass-strong px-4 py-2 text-sm"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      <span className="truncate">{error.message}</span>
                      <button
                        onClick={rtc.clearError}
                        aria-label="Dismiss"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-white/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {reconnecting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 grid place-items-center rounded-3xl bg-background/60 backdrop-blur-sm"
                      role="status"
                    >
                      <div className="flex items-center gap-2 rounded-full glass-strong px-4 py-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Reconnecting…
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Draggable picture-in-picture — double-click to swap */}
                <motion.div
                  drag
                  dragConstraints={stageRef}
                  dragElastic={0.15}
                  dragMomentum={false}
                  whileDrag={{ scale: 1.04 }}
                  onDoubleClick={() => setSwapped((s) => !s)}
                  title="Drag to move · double-click to swap"
                  className="absolute bottom-4 right-4 z-10 aspect-[3/4] w-28 cursor-grab touch-none active:cursor-grabbing sm:w-40 md:w-48"
                >
                  <div className="h-full w-full overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/15">
                    {swapped ? remoteTile : localTile}
                  </div>
                </motion.div>

                {/* Floating reactions */}
                <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-3xl">
                  <AnimatePresence>
                    {rtc.reactions.map((r) => {
                      const jitter = r.id.charCodeAt(0) % 30;
                      const left = r.mine ? 55 + jitter : 10 + jitter;
                      return (
                        <motion.div
                          key={r.id}
                          initial={{ y: 0, opacity: 0, scale: 0.4 }}
                          animate={{
                            y: -420,
                            opacity: [0, 1, 1, 0],
                            scale: [0.4, 1.4, 1.1, 1],
                            x: [0, 18, -14, 8],
                          }}
                          transition={{ duration: 2.4, ease: "easeOut" }}
                          className="absolute bottom-10 text-5xl drop-shadow-lg"
                          style={{ left: `${left}%` }}
                          aria-hidden
                        >
                          {r.emoji}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="lobby"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.25 } }}
                transition={{ duration: 0.5, ease }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-6 overflow-y-auto py-2 lg:flex-row lg:gap-10"
              >
                <div className="w-full max-w-md lg:max-w-lg">
                  <div className="aspect-video w-full sm:aspect-[4/3]">{localTile}</div>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    {mediaBlocked
                      ? "Camera or mic unavailable. See the message alongside."
                      : rtc.localStream
                      ? "Looking good. Check your camera and mic before you connect."
                      : "Starting your camera…"}
                  </p>
                </div>
                {mode === "link" ? (
                  <LinkPanel
                    roomUrl={roomUrl}
                    isHost={isHost}
                    connecting={negotiating}
                    error={error}
                    onRetry={onRetry}
                    retryLabel={retryLabel}
                    footer={
                      <button
                        onClick={useManual}
                        className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Having trouble? Connect manually with codes
                      </button>
                    }
                  />
                ) : (
                  <SignalPanel
                    role={isHost ? "host" : "guest"}
                    offerCode={offerCode}
                    answerCode={answerCode}
                    onGenerateOffer={handleGenerateOffer}
                    onAcceptOffer={handleAcceptOffer}
                    onAcceptAnswer={handleAcceptAnswer}
                    busy={busy}
                    connecting={negotiating}
                    error={error}
                    onRetry={onRetry}
                    retryLabel={retryLabel}
                    onClearError={rtc.clearError}
                    footer={
                      <button
                        onClick={useLink}
                        className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Use the room link instead
                      </button>
                    }
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat — side panel on desktop */}
        <AnimatePresence initial={false}>
          {chatOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="hidden shrink-0 overflow-hidden md:block"
            >
              <div className="h-full w-[340px]">
                <ChatPanel
                  messages={rtc.messages}
                  onSend={rtc.sendMessage}
                  onClose={() => setChatOpen(false)}
                  disabled={!connected}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      {!ended && (
        <motion.div
          animate={{ y: chromeHidden ? 120 : 0, opacity: chromeHidden ? 0 : 1 }}
          transition={{ duration: 0.35, ease }}
          className="z-20 flex flex-col items-center gap-2 pb-5 sm:pb-7"
        >
          <ControlBar
            micOn={rtc.micOn}
            camOn={rtc.camOn}
            chatOpen={chatOpen}
            fullscreen={fullscreen}
            canReact={connected}
            onToggleMic={rtc.toggleMic}
            onToggleCam={rtc.toggleCam}
            onHangUp={leave}
            onToggleChat={openChat}
            onToggleFullscreen={toggleFullscreen}
            onReact={rtc.sendReaction}
            unread={unread}
            onSwitchCamera={rtc.canSwitchCamera ? rtc.switchCamera : undefined}
            onToggleScreen={rtc.canShareScreen && connected ? rtc.toggleScreenShare : undefined}
            sharing={rtc.sharing}
          />
          <p className="hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex">
            <Keyboard className="h-3 w-3" /> M mute · V camera · C chat · F full screen
            {connected && " · 1–6 react"}
          </p>
        </motion.div>
      )}

      {/* Chat — bottom sheet on mobile */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-x-0 bottom-0 z-40 h-[80dvh] p-2 md:hidden"
            >
              <ChatPanel
                messages={rtc.messages}
                onSend={rtc.sendMessage}
                onClose={() => setChatOpen(false)}
                disabled={!connected}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            className="absolute left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full glass-strong px-4 py-2 text-sm shadow-xl"
            role="status"
          >
            <Check className="h-4 w-4 text-primary" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
