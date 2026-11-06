"use client";

import { Signal, SignalLow, SignalMedium, SignalZero } from "lucide-react";
import type { NetStats } from "@/hooks/use-webrtc";
import { cn } from "@/lib/utils";

const LOOK = {
  good: { Icon: Signal, label: "Good connection", tone: "text-primary" },
  fair: { Icon: SignalMedium, label: "Fair connection", tone: "text-amber-300" },
  poor: { Icon: SignalLow, label: "Poor connection", tone: "text-destructive" },
  unknown: { Icon: SignalZero, label: "Measuring connection", tone: "text-muted-foreground" },
} as const;

/** Small pill showing live connection quality for the remote tile. */
export function NetworkBadge({ stats, className }: { stats: NetStats | null; className?: string }) {
  const { Icon, label, tone } = LOOK[stats?.level ?? "unknown"];
  const detail =
    stats && stats.rttMs !== null
      ? `${stats.rttMs < 1 ? "<1" : stats.rttMs} ms · ${(stats.loss * 100).toFixed(1)}% loss`
      : undefined;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full glass-strong px-2.5 py-1 text-xs font-medium",
        className
      )}
      role="status"
      aria-label={detail ? `${label}, ${detail}` : label}
      title={detail}
    >
      <Icon className={cn("h-3.5 w-3.5", tone)} aria-hidden />
      <span className="hidden sm:inline">{detail ?? label}</span>
    </div>
  );
}
