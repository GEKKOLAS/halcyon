"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Copy, ArrowLeft } from "lucide-react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { AuroraBackground } from "@/components/aurora-background";
import { Logo, PresenceOrb } from "@/components/logo";
import { VideoTile } from "@/components/video-tile";
import { SignalPanel } from "@/components/signal-panel";
import { ControlBar } from "@/components/control-bar";
import { ChatPanel } from "@/components/chat-panel";
import { cn } from "@/lib/utils";

export function RoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const isHost = params.get("host") === "1";

  const rtc = useWebRTC();
  const [offerCode, setOfferCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const lastMsgCount = useRef(0);

  const connected = rtc.connState === "connected";
  const connecting = rtc.connState === "connecting";

  // Pre-warm camera so the local preview shows immediately
  useEffect(() => {
    rtc.initMedia().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track unread chat
  useEffect(() => {
    if (rtc.messages.length > lastMsgCount.current) {
      const newest = rtc.messages[rtc.messages.length - 1];
      if (newest && !newest.mine && !chatOpen) setUnread((u) => u + 1);
    }
    lastMsgCount.current = rtc.messages.length;
  }, [rtc.messages, chatOpen]);

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

  const openChat = () => {
    setChatOpen((o) => !o);
    setUnread(0);
  };

  const leave = () => {
    rtc.hangUp();
    router.push("/");
  };

  const copyRoom = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/room/${roomId}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      <AuroraBackground />

      {/* Top bar */}
      <header className="z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full glass px-3 py-1.5 text-xs sm:flex">
            <PresenceOrb className={cn(!connected && "opacity-40")} />
            {connected ? "Connected" : connecting ? "Connecting…" : "Waiting"}
          </span>
          <button
            onClick={copyRoom}
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
          {connected ? (
            <>
              {/* Remote fills the stage */}
              <VideoTile
                stream={rtc.remoteStream}
                label="Guest"
                className="h-full w-full"
              />
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
              <SignalPanel
                role={isHost ? "host" : "guest"}
                offerCode={offerCode}
                answerCode={answerCode}
                onGenerateOffer={handleGenerateOffer}
                onAcceptOffer={handleAcceptOffer}
                onAcceptAnswer={handleAcceptAnswer}
                connecting={connecting}
              />
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
