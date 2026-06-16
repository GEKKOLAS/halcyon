"use client";

import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare } from "lucide-react";
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
}

function CtrlButton({
  active,
  onClick,
  label,
  children,
  danger,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            aria-label={label}
            className={cn(
              "grid h-14 w-14 place-items-center rounded-full transition-all active:scale-95",
              danger
                ? "bg-destructive text-destructive-foreground hover:brightness-110"
                : active
                ? "bg-secondary text-foreground hover:bg-secondary/70"
                : "bg-destructive/90 text-destructive-foreground hover:brightness-110"
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
}: ControlBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-full glass-strong px-3 py-3">
      <CtrlButton active={micOn} onClick={onToggleMic} label={micOn ? "Mute" : "Unmute"}>
        {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </CtrlButton>
      <CtrlButton
        active={camOn}
        onClick={onToggleCam}
        label={camOn ? "Turn camera off" : "Turn camera on"}
      >
        {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </CtrlButton>

      <div className="relative">
        <CtrlButton active onClick={onToggleChat} label="Chat">
          <MessageSquare className="h-5 w-5" />
        </CtrlButton>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread}
          </span>
        )}
      </div>

      <div className="mx-1 h-8 w-px bg-border" />

      <CtrlButton danger onClick={onHangUp} label="Leave call">
        <PhoneOff className="h-5 w-5" />
      </CtrlButton>
    </div>
  );
}
