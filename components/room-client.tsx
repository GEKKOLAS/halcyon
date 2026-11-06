"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Copy, Loader2, PhoneOff, RotateCcw, WifiOff } from "lucide-react";
import { useWebRTC, type EndReason, type RtcErrorCode } from "@/hooks/use-webrtc";
import { AuroraBackground } from "@/components/aurora-background";
import { Logo, PresenceOrb } from "@/components/logo";
import { VideoTile } from "@/components/video-tile";
import { SignalPanel } from "@/components/signal-panel";
import { LinkPanel } from "@/components/link-panel";
import { httpSignaling } from "@/lib/signaling";
import { ControlBar } from "@/components/control-bar";
import { ChatPanel } from "@/components/chat-panel";
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

function CallEnded({ reason }: { reason: EndReason }) {
  const { title, body } = END_COPY[reason];
  const Icon = reason === "network" ? WifiOff : PhoneOff;
  return (
    <div className="glass-strong w-full max-w-sm rounded-3xl p-8 text-center" role="status">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-5 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={() => window.location.reload()}>
          <RotateCcw className="h-4 w-4" />
          Start over in this room
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
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
  const [copied, setCopied] = useState(false);
  const lastMsgCount = useRef(0);

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

  const openChat = () => {
    setChatOpen((o) => !o);
    setUnread(0);
  };

  const leave = () => {
    rtc.hangUp();
    router.push("/");
  };

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
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

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      <AuroraBackground />

      {/* Top bar */}
      <header className="z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <span
            className="hidden items-center gap-2 rounded-full glass px-3 py-1.5 text-xs sm:flex"
            aria-live="polite"
          >
            <PresenceOrb className={cn(!connected && "opacity-40")} />
            {status}
          </span>
          <button
            onClick={copyRoom}
            aria-label={`Copy room link (${roomId})`}
            className="flex items-center gap-2 rounded-full glass px-3 py-1.5 font-mono text-xs transition-colors hover:bg-secondary"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {roomId}
          </button>
        </div>
      </header>

      {/* Main stage */}
      <div className="relative z-10 flex flex-1 gap-4 overflow-hidden px-4 pb-4 sm:px-6">
        <div className="relative flex flex-1 items-center justify-center">
          {ended ? (
            <CallEnded reason={endReason!} />
          ) : inCall ? (
            <>
              {/* Remote fills the stage */}
              <VideoTile
                stream={rtc.remoteStream}
                label={remoteLabel}
                audioOff={!rtc.remoteMicOn}
                videoOff={!rtc.remoteCamOn}
                className="h-full w-full"
              >
                {reconnecting && (
                  <div
                    className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm"
                    role="status"
                  >
                    <div className="flex items-center gap-2 rounded-full glass-strong px-4 py-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Reconnecting…
                    </div>
                  </div>
                )}
              </VideoTile>
              {/* Local PiP */}
              <div className="absolute bottom-4 right-4 aspect-[3/4] w-28 sm:w-44 md:w-52">
                <VideoTile
                  stream={rtc.localStream}
                  label="You"
                  muted
                  mirror
                  audioOff={!rtc.micOn}
                  videoOff={!rtc.camOn}
                  className="h-full w-full ring-2 ring-primary/40"
                />
              </div>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-6 lg:flex-row lg:gap-8">
              {/* Local preview while waiting */}
              <div className="aspect-[4/3] w-full max-w-md lg:max-w-sm">
                <VideoTile
                  stream={rtc.localStream}
                  label="You"
                  muted
                  mirror
                  audioOff={!rtc.micOn}
                  videoOff={!rtc.camOn}
                  className="h-full w-full"
                />
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
                      className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
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
                      className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                    >
                      Use the room link instead
                    </button>
                  }
                />
              )}
            </div>
          )}
        </div>

        {/* Chat — side panel on desktop */}
        {chatOpen && (
          <div className="hidden w-80 shrink-0 md:block">
            <ChatPanel
              messages={rtc.messages}
              onSend={rtc.sendMessage}
              onClose={() => setChatOpen(false)}
              disabled={!connected}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      {!ended && (
        <div className="z-20 flex justify-center pb-5 sm:pb-7">
          <ControlBar
            micOn={rtc.micOn}
            camOn={rtc.camOn}
            onToggleMic={rtc.toggleMic}
            onToggleCam={rtc.toggleCam}
            onHangUp={leave}
            onToggleChat={openChat}
            unread={unread}
          />
        </div>
      )}

      {/* Chat — full-screen sheet on mobile */}
      {chatOpen && (
        <div className="absolute inset-0 z-30 p-4 md:hidden">
          <ChatPanel
            messages={rtc.messages}
            onSend={rtc.sendMessage}
            onClose={() => setChatOpen(false)}
            disabled={!connected}
          />
        </div>
      )}
    </div>
  );
}
