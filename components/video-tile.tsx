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
}

export function VideoTile({
  stream,
  label,
  muted,
  mirror,
  audioOff,
  videoOff,
  className,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl glass-strong",
        className
      )}
    >
      {stream && !videoOff ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={cn(
            "h-full w-full object-cover",
            mirror && "-scale-x-100"
          )}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-secondary/30">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-aurora-teal/40 to-aurora-violet/40 text-xl font-display font-semibold text-foreground">
              {label.charAt(0).toUpperCase()}
            </div>
            {videoOff && <VideoOff className="h-5 w-5" />}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-medium">
        {audioOff && <MicOff className="h-3.5 w-3.5 text-destructive" />}
        {label}
      </div>
    </div>
  );
}
