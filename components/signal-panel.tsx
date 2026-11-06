"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, Check, Copy, Loader2, RotateCcw } from "lucide-react";
import type { RtcError } from "@/hooks/use-webrtc";
import { Button } from "@/components/ui/button";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the textarea is still selectable.
    }
  };
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex gap-2">
        <textarea
          readOnly
          value={value}
          aria-label={label}
          onClick={(e) => e.currentTarget.select()}
          className="h-20 flex-1 resize-none rounded-2xl border border-input bg-secondary/40 p-3 font-mono text-[11px] leading-snug text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          variant="secondary"
          size="icon"
          className="h-auto w-12 shrink-0"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <Check className="h-5 w-5 text-primary" />
          ) : (
            <Copy className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function PasteField({
  label,
  placeholder,
  onSubmit,
  cta,
  busy,
  busyLabel,
  onChange,
}: {
  label: string;
  placeholder: string;
  onSubmit: (v: string) => void;
  cta: string;
  busy: boolean;
  busyLabel: string;
  onChange?: () => void;
}) {
  const [val, setVal] = useState("");
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <textarea
        value={val}
        aria-label={label}
        onChange={(e) => {
          setVal(e.target.value);
          onChange?.();
        }}
        placeholder={placeholder}
        disabled={busy}
        className="h-20 w-full resize-none rounded-2xl border border-input bg-secondary/40 p-3 font-mono text-[11px] leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50 disabled:opacity-60"
      />
      <Button
        className="mt-2 w-full"
        disabled={!val.trim() || busy}
        onClick={() => onSubmit(val)}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {busyLabel}
          </>
        ) : (
          <>
            {cta}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}

function ErrorNotice({
  error,
  onRetry,
  retryLabel,
}: {
  error: RtcError;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <p>{error.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {retryLabel ?? "Try again"}
          </button>
        )}
      </div>
    </div>
  );
}

function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {children}
    </p>
  );
}

interface SignalPanelProps {
  role: "host" | "guest";
  offerCode: string;
  answerCode: string;
  onGenerateOffer: () => void;
  onAcceptOffer: (code: string) => void;
  onAcceptAnswer: (code: string) => void;
  /** An async step (camera, code generation) is in progress. */
  busy: boolean;
  /** The answer has been applied and ICE/DTLS is negotiating. */
  connecting: boolean;
  error: RtcError | null;
  onRetry?: () => void;
  retryLabel?: string;
  onClearError: () => void;
}

export function SignalPanel({
  role,
  offerCode,
  answerCode,
  onGenerateOffer,
  onAcceptOffer,
  onAcceptAnswer,
  busy,
  connecting,
  error,
  onRetry,
  retryLabel,
  onClearError,
}: SignalPanelProps) {
  const errorNotice = error && (
    <ErrorNotice error={error} onRetry={onRetry} retryLabel={retryLabel} />
  );

  return (
    <div className="glass-strong w-full max-w-md rounded-3xl p-6">
      {role === "host" ? (
        <div className="space-y-5">
          <div>
            <h3 className="font-display text-lg font-semibold">
              Invite someone
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Send your invite code, then paste back the reply they give you.
            </p>
          </div>

          {errorNotice}

          {!offerCode ? (
            <Button className="w-full" onClick={onGenerateOffer} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing invite…
                </>
              ) : (
                "Generate invite code"
              )}
            </Button>
          ) : (
            <>
              <CopyField label="1 · Send this invite code" value={offerCode} />
              <PasteField
                label="2 · Paste their reply code"
                placeholder="Paste the reply code from your guest…"
                cta="Connect"
                busy={busy || connecting}
                busyLabel="Connecting…"
                onSubmit={onAcceptAnswer}
                onChange={onClearError}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="font-display text-lg font-semibold">Join the call</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste the invite code you received, then send back your reply.
            </p>
          </div>

          {errorNotice}

          {!answerCode ? (
            <PasteField
              label="1 · Paste the invite code"
              placeholder="Paste the invite code from the host…"
              cta="Generate reply"
              busy={busy}
              busyLabel="Preparing reply…"
              onSubmit={onAcceptOffer}
              onChange={onClearError}
            />
          ) : (
            <>
              <CopyField
                label="2 · Send this reply code back to the host"
                value={answerCode}
              />
              {!error && <Waiting>Waiting for the host to connect…</Waiting>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
