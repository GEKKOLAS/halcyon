"use client";

import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirror?: boolean;
  audioOff?: boolean;
  videoOff?: boolean;
  className?: string;
  /** "contain" for screen shares, so nothing gets cropped. */
  fit?: "cover" | "contain";
  children?: React.ReactNode;
}

export function VideoTile({
  stream,
  label,
  muted,
  mirror,
  audioOff,
  videoOff,
  className,
  fit = "cover",
  children,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  // The <video> element stays mounted for the tile's lifetime, so the stream
  // only needs to be attached when it changes (not when the camera toggles).
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const showVideo = !!stream && !videoOff;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl glass-strong",
        className
      )}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        aria-hidden={!showVideo}
        className={cn(
          "h-full w-full",
          fit === "contain" ? "object-contain" : "object-cover",
          mirror && "-scale-x-100",
          !showVideo && "invisible"
        )}
      />

      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center bg-secondary/30">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-aurora-teal/40 to-aurora-violet/40 text-xl font-display font-semibold text-foreground">
              {label.charAt(0).toUpperCase()}
            </div>
            {videoOff && <VideoOff className="h-5 w-5" role="img" aria-label="Camera off" />}
          </div>
        </div>
      )}

      {children}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-medium">
        {audioOff && (
          <MicOff className="h-3.5 w-3.5 text-destructive" role="img" aria-label="Muted" />
        )}
        {label}
      </div>
    </div>
  );
}
