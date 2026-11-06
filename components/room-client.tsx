"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, AlertTriangle, RefreshCw, Keyboard } from "lucide-react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { AuroraBackground } from "@/components/aurora-background";
import { Logo, PresenceOrb } from "@/components/logo";
import { VideoTile } from "@/components/video-tile";
import { SignalPanel } from "@/components/signal-panel";
import { ControlBar, REACTIONS } from "@/components/control-bar";
import { ChatPanel } from "@/components/chat-panel";
import { NetworkBadge } from "@/components/network-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function useCallTimer(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
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
  const [mediaError, setMediaError] = useState(false);
  const lastMsgCount = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const connected = rtc.connState === "connected";
  const connecting = rtc.connState === "connecting";
  const dropped = rtc.connState === "failed" || (rtc.connState === "closed" && !!rtc.connectedAt);
  const timer = useCallTimer(connected ? rtc.connectedAt : null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  }, []);

  // Start the camera and join the room's handshake channel right away.
  useEffect(() => {
    rtc.initMedia().catch(() => setMediaError(true));
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

  // Track unread chat
  useEffect(() => {
    if (rtc.messages.length > lastMsgCount.current) {
      const newest = rtc.messages[rtc.messages.length - 1];
      if (newest && !newest.mine && !chatOpen) setUnread((u) => u + 1);
    }
    lastMsgCount.current = rtc.messages.length;
  }, [rtc.messages, chatOpen]);

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
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
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

  const toggleMic = rtc.toggleMic;
  const toggleCam = rtc.toggleCam;
  const sendReaction = rtc.sendReaction;

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const actions: Record<string, () => void> = {
        m: toggleMic,
        v: toggleCam,
        c: openChat,
        f: toggleFullscreen,
      };
      const run =
        actions[k] ??
        (connected && /^[1-6]$/.test(k)
          ? () => sendReaction(REACTIONS[Number(k) - 1])
          : null);
      if (!run) return;
      // Keep the key from landing in an input that this action focuses.
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMic, toggleCam, openChat, toggleFullscreen, sendReaction, connected]);

  const handleGenerateOffer = async () => {
    const code = await rtc.createOffer();
    setOfferCode(code);
  };
  const handleAcceptOffer = async (code: string) => {
    const ans = await rtc.acceptOffer(code);
    setAnswerCode(ans);
  };
  const handleAcceptAnswer = async (code: string) => {
    await rtc.acceptAnswer(code);
  };

  const leave = () => {
    rtc.hangUp();
    router.push("/");
  };

  const copyRoom = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    flash("Room link copied");
  };

  const status = connected ? timer ?? "Live" : connecting ? "Connecting…" : dropped ? "Disconnected" : "Waiting";

  const local = (
    <VideoTile
      stream={rtc.localStream}
      label="You"
      muted
      mirror
      audioOff={!rtc.micOn}
      videoOff={!rtc.camOn}
      compact={!swapped && connected}
      className="h-full w-full"
    />
  );
  const remote = (
    <VideoTile
      stream={rtc.remoteStream}
      label="Guest"
      compact={swapped}
      className="h-full w-full"
    />
  );

  return (
    <div className={cn("relative flex h-[100dvh] flex-col overflow-hidden", idle && "cursor-none")}>
      <AuroraBackground interactive={!connected} />

      {/* Top bar */}
      <motion.header
        animate={{ y: idle ? -80 : 0, opacity: idle ? 0 : 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <Link href="/" aria-label="Halcyon home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs tabular-nums",
              dropped && "text-destructive"
            )}
          >
            {connected ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-aurora-rose" />
            ) : (
              <PresenceOrb className={cn(!connecting && "opacity-40")} />
            )}
            {status}
          </span>
          <button
            onClick={copyRoom}
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
          <AnimatePresence mode="wait">
            {connected ? (
              <motion.div
                key="call"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                {swapped ? local : remote}

                {/* Draggable PiP — double-click / double-tap to swap */}
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
                    {swapped ? remote : local}
                  </div>
                </motion.div>

                {/* Floating reactions */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                  <AnimatePresence>
                    {rtc.reactions.map((r) => {
                      const left = r.mine ? 55 + (r.id.charCodeAt(0) % 30) : 10 + (r.id.charCodeAt(0) % 30);
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
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto py-2 lg:flex-row lg:gap-10"
              >
                <div className="w-full max-w-md lg:max-w-lg">
                  <div className="aspect-video w-full sm:aspect-[4/3]">{local}</div>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    {mediaError
                      ? "Camera or mic blocked — allow access in your browser settings."
                      : "Looking good. Check your camera and mic before you connect."}
                  </p>
                </div>
                {dropped ? (
                  <div className="w-full max-w-md rounded-[2rem] glass-strong p-6 text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
                    <h3 className="mt-3 font-display text-xl font-semibold">Call ended</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The connection dropped. Reload to start a fresh handshake.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mx-auto mt-5 flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
                    >
                      <RefreshCw className="h-4 w-4" /> Reconnect
                    </button>
                  </div>
                ) : (
                  <SignalPanel
                    role={isHost ? "host" : "guest"}
                    offerCode={offerCode}
                    answerCode={answerCode}
                    onGenerateOffer={handleGenerateOffer}
                    onAcceptOffer={handleAcceptOffer}
                    onAcceptAnswer={handleAcceptAnswer}
                    connecting={connecting}
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
      <motion.div
        animate={{ y: idle ? 120 : 0, opacity: idle ? 0 : 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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
        />
        <p className="hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex">
          <Keyboard className="h-3 w-3" /> M mute · V camera · C chat · F full screen
          {connected && " · 1–6 react"}
        </p>
      </motion.div>

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
          >
            <Check className="h-4 w-4 text-primary" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
