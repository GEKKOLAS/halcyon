"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  SmilePlus,
  Maximize,
  Minimize,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const REACTIONS = ["👋", "👍", "😂", "❤️", "🎉", "🔥"];

interface ControlBarProps {
  micOn: boolean;
  camOn: boolean;
  chatOpen: boolean;
  fullscreen: boolean;
  canReact: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onHangUp: () => void;
  onToggleChat: () => void;
  onToggleFullscreen: () => void;
  onReact: (emoji: string) => void;
  unread: number;
}

function CtrlButton({
  tone = "neutral",
  onClick,
  label,
  shortcut,
  children,
  className,
}: {
  tone?: "neutral" | "off" | "danger" | "active";
  onClick: () => void;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClick}
          aria-label={label}
          className={cn(
            "relative grid h-12 w-12 place-items-center rounded-2xl transition-colors sm:h-14 sm:w-14",
            tone === "danger" &&
              "w-16 bg-destructive text-destructive-foreground hover:brightness-110 sm:w-20",
            tone === "off" && "bg-destructive/15 text-destructive ring-1 ring-destructive/40 hover:bg-destructive/25",
            tone === "active" && "bg-primary text-primary-foreground",
            tone === "neutral" && "bg-white/[0.06] text-foreground hover:bg-white/[0.12]",
            className
          )}
        >
          {children}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        {shortcut && (
          <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function ControlBar({
  micOn,
  camOn,
  chatOpen,
  fullscreen,
  canReact,
  onToggleMic,
  onToggleCam,
  onHangUp,
  onToggleChat,
  onToggleFullscreen,
  onReact,
  unread,
}: ControlBarProps) {
  const [trayOpen, setTrayOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative">
        <AnimatePresence>
          {trayOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 gap-1 rounded-full glass-strong p-1.5 shadow-2xl"
            >
              {REACTIONS.map((e, i) => (
                <motion.button
                  key={e}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                  whileHover={{ scale: 1.3, y: -4 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => onReact(e)}
                  className="grid h-10 w-10 place-items-center rounded-full text-xl hover:bg-white/5"
                  aria-label={`React ${e}`}
                >
                  {e}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 rounded-[1.75rem] glass-strong p-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] sm:gap-2.5">
          <CtrlButton
            tone={micOn ? "neutral" : "off"}
            onClick={onToggleMic}
            label={micOn ? "Mute" : "Unmute"}
            shortcut="M"
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </CtrlButton>
          <CtrlButton
            tone={camOn ? "neutral" : "off"}
            onClick={onToggleCam}
            label={camOn ? "Turn camera off" : "Turn camera on"}
            shortcut="V"
          >
            {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </CtrlButton>

          {canReact && (
            <CtrlButton
              tone={trayOpen ? "active" : "neutral"}
              onClick={() => setTrayOpen((o) => !o)}
              label="Reactions"
              shortcut="1–6"
            >
              <SmilePlus className="h-5 w-5" />
            </CtrlButton>
          )}

          <div className="relative">
            <CtrlButton
              tone={chatOpen ? "active" : "neutral"}
              onClick={onToggleChat}
              label="Chat"
              shortcut="C"
            >
              <MessageSquare className="h-5 w-5" />
            </CtrlButton>
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="pointer-events-none absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-aurora-rose px-1 text-[10px] font-bold text-white"
                >
                  {unread}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <CtrlButton
            onClick={onToggleFullscreen}
            label={fullscreen ? "Exit full screen" : "Full screen"}
            shortcut="F"
            className="hidden sm:grid"
          >
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </CtrlButton>

          <div className="mx-0.5 h-8 w-px bg-white/10" />

          <CtrlButton tone="danger" onClick={onHangUp} label="Leave call">
            <PhoneOff className="h-5 w-5" />
          </CtrlButton>
        </div>
      </div>
    </TooltipProvider>
  );
}
