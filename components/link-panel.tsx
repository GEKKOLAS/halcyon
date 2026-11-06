"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import type { RtcError } from "@/hooks/use-webrtc";
import { Button } from "@/components/ui/button";
import { ErrorNotice, Waiting } from "@/components/signal-panel";

interface LinkPanelProps {
  roomUrl: string;
  isHost: boolean;
  connecting: boolean;
  error: RtcError | null;
  onRetry?: () => void;
  retryLabel?: string;
  footer?: React.ReactNode;
}

/** Default join flow: share the room link, the call starts when they open it. */
export function LinkPanel({
  roomUrl,
  isHost,
  connecting,
  error,
  onRetry,
  retryLabel,
  footer,
}: LinkPanelProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const share = () =>
    navigator.share({ title: "Join my Halcyon call", url: roomUrl }).catch(() => {});

  return (
    <div className="glass-strong w-full max-w-md rounded-3xl p-6">
      <div className="space-y-5">
        <div>
          <h3 className="font-display text-lg font-semibold">
            {isHost ? "Invite someone" : "Join the call"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isHost
              ? "Send them this link. The call starts as soon as they open it."
              : "You'll be connected as soon as the other person is in the room."}
          </p>
        </div>

        {error && <ErrorNotice error={error} onRetry={onRetry} retryLabel={retryLabel} />}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Room link
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={roomUrl}
              aria-label="Room link"
              onClick={(e) => e.currentTarget.select()}
              className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-secondary/40 px-4 font-mono text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={copy}
              aria-label={copied ? "Copied" : "Copy link"}
            >
              {copied ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5" />}
            </Button>
            {canShare && (
              <Button
                variant="secondary"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={share}
                aria-label="Share link"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {!error && (
          <Waiting>{connecting ? "Connecting…" : "Waiting for someone to join…"}</Waiting>
        )}
      </div>
      {footer}
    </div>
  );
}
