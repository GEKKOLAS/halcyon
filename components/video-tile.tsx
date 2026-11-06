"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MicOff, VideoOff } from "lucide-react";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirror?: boolean;
  audioOff?: boolean;
  videoOff?: boolean;
  compact?: boolean;
  className?: string;
}

export function VideoTile({
  stream,
  label,
  muted,
  mirror,
  audioOff,
  videoOff,
  compact,
  className,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const level = useAudioLevel(stream, !audioOff);
  const speaking = level > 0.08;

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream, videoOff]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl glass-strong transition-shadow duration-300",
        speaking && "shadow-[0_0_0_2px_hsl(168_76%_50%/0.8),0_0_40px_-8px_hsl(168_76%_50%/0.6)]",
        className
      )}
    >
      {stream && !videoOff ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={cn("h-full w-full object-cover", mirror && "-scale-x-100")}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#121a2e] to-[#1b1534]">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="relative">
              <motion.span
                className="absolute inset-0 rounded-full bg-primary/30"
                animate={{ scale: 1 + level * 1.4, opacity: speaking ? 0.6 : 0 }}
                transition={{ duration: 0.15 }}
              />
              <div
                className={cn(
                  "relative grid place-items-center rounded-full bg-gradient-to-br from-aurora-teal/50 to-aurora-violet/50 font-display font-semibold text-foreground",
                  compact ? "h-12 w-12 text-base" : "h-20 w-20 text-2xl"
                )}
              >
                {label.charAt(0).toUpperCase()}
              </div>
            </div>
            {videoOff && !compact && (
              <span className="flex items-center gap-1.5 text-xs">
                <VideoOff className="h-3.5 w-3.5" /> Camera off
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          "absolute flex items-center gap-2 rounded-full glass font-medium",
          compact ? "bottom-2 left-2 px-2 py-0.5 text-[10px]" : "bottom-3 left-3 px-3 py-1 text-xs"
        )}
      >
        {audioOff ? (
          <MicOff className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <span className="flex h-3 items-end gap-[2px]">
            {[0.6, 1, 0.75].map((m, i) => (
              <span
                key={i}
                className="w-[2px] rounded-full bg-primary transition-[height] duration-100"
                style={{ height: `${Math.max(20, Math.min(100, level * 100 * m * 2))}%` }}
              />
            ))}
          </span>
        )}
        {label}
      </div>
    </div>
  );
}
