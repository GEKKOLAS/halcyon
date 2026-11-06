"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  SwitchCamera,
  ScreenShare,
  ScreenShareOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ControlBarProps {
  micOn: boolean;
  camOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onHangUp: () => void;
  onToggleChat: () => void;
  unread: number;
  /** Shown only when the device has more than one camera. */
  onSwitchCamera?: () => void;
  /** Shown only when the browser supports screen capture and a call is live. */
  onToggleScreen?: () => void;
  sharing?: boolean;
}

type Tone = "neutral" | "off" | "on" | "danger";

function CtrlButton({
  tone,
  onClick,
  label,
  pressed,
  children,
  className,
}: {
  tone: Tone;
  onClick: () => void;
  label: string;
  pressed?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full transition-all active:scale-95 sm:h-14 sm:w-14",
            tone === "neutral" && "bg-secondary text-foreground hover:bg-secondary/70",
            tone === "off" && "bg-destructive/90 text-destructive-foreground hover:brightness-110",
            tone === "on" && "bg-primary text-primary-foreground hover:brightness-110",
            tone === "danger" && "bg-destructive text-destructive-foreground hover:brightness-110",
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ControlBar({
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  onHangUp,
  onToggleChat,
  unread,
  onSwitchCamera,
  onToggleScreen,
  sharing,
}: ControlBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="toolbar"
        aria-label="Call controls"
        className="flex items-center gap-2 rounded-full glass-strong px-2.5 py-2.5 sm:gap-3 sm:px-3 sm:py-3"
      >
        <CtrlButton tone={micOn ? "neutral" : "off"} onClick={onToggleMic} label={micOn ? "Mute" : "Unmute"}>
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </CtrlButton>
        <CtrlButton
          tone={camOn ? "neutral" : "off"}
          onClick={onToggleCam}
          label={camOn ? "Turn camera off" : "Turn camera on"}
        >
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </CtrlButton>
        {onSwitchCamera && (
          <CtrlButton tone="neutral" onClick={onSwitchCamera} label="Switch camera">
            <SwitchCamera className="h-5 w-5" />
          </CtrlButton>
        )}
        {onToggleScreen && (
          <CtrlButton
            tone={sharing ? "on" : "neutral"}
            onClick={onToggleScreen}
            label={sharing ? "Stop sharing screen" : "Share screen"}
            pressed={sharing}
            className="hidden md:grid"
          >
            {sharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
          </CtrlButton>
        )}

        <div className="relative">
          <CtrlButton tone="neutral" onClick={onToggleChat} label="Chat">
            <MessageSquare className="h-5 w-5" />
          </CtrlButton>
          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
              aria-label={`${unread} unread`}
            >
              {unread}
            </span>
          )}
        </div>

        <div className="mx-0.5 h-8 w-px bg-border sm:mx-1" />

        <CtrlButton tone="danger" onClick={onHangUp} label="Leave call">
          <PhoneOff className="h-5 w-5" />
        </CtrlButton>
      </div>
    </TooltipProvider>
  );
}
