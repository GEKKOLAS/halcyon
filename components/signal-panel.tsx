"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ArrowRight, ClipboardPaste, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the textarea is still selectable.
    }
  };
  const share = () => navigator.share?.({ text: value }).catch(() => {});

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          readOnly
          value={value}
          aria-label={label}
          onClick={(e) => e.currentTarget.select()}
          className="no-scrollbar h-20 w-full resize-none rounded-2xl border border-input bg-black/20 p-3 font-mono text-[11px] leading-snug text-muted-foreground focus-visible:outline-none"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-[hsl(230_30%_9%)] to-transparent" />
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={copy}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "y" : "n"}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              className="flex items-center gap-2"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy code"}
            </motion.span>
          </AnimatePresence>
        </Button>
        {canShare && (
          <Button variant="secondary" size="icon" onClick={share} aria-label="Share code">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function PasteField({
  placeholder,
  onSubmit,
  cta,
  busy,
}: {
  placeholder: string;
  onSubmit: (v: string) => Promise<void> | void;
  cta: string;
  busy?: boolean;
}) {
  const [val, setVal] = useState("");
  const [error, setError] = useState("");

  const submit = async (v = val) => {
    setError("");
    try {
      await onSubmit(v);
    } catch {
      setError("That code doesn't look right. Check you copied all of it.");
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setVal(t);
    } catch {}
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setError("");
          }}
          placeholder={placeholder}
          className={cn(
            "no-scrollbar h-20 w-full resize-none rounded-2xl border bg-black/20 p-3 pr-20 font-mono text-[11px] leading-snug transition-colors placeholder:font-sans placeholder:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error ? "border-destructive/60" : "border-input"
          )}
        />
        <button
          onClick={paste}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-primary transition-colors hover:bg-primary/15"
        >
          <ClipboardPaste className="h-3 w-3" /> Paste
        </button>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <Button className="group w-full" disabled={!val.trim() || busy} onClick={() => submit()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {cta}
        {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
      </Button>
    </div>
  );
}

export function ErrorNotice({
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

export function Waiting({ children }: { children: React.ReactNode }) {
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
  onGenerateOffer: () => Promise<void> | void;
  onAcceptOffer: (code: string) => Promise<void> | void;
  onAcceptAnswer: (code: string) => Promise<void> | void;
  connecting: boolean;
  error: RtcError | null;
  onRetry?: () => void;
  retryLabel?: string;
  onClearError: () => void;
  footer?: React.ReactNode;
}

function Stepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <div key={l} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ scale: on ? 1.08 : 1 }}
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  on && "bg-primary/20 text-primary ring-1 ring-primary",
                  !done && !on && "bg-secondary text-muted-foreground"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </motion.span>
              <span
                className={cn(
                  "hidden text-xs sm:inline",
                  on ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {l}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className="relative h-px flex-1 overflow-hidden bg-border">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary"
                  initial={false}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
};

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
  footer,
}: SignalPanelProps) {
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(false);
  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const hostStep = !offerCode ? 0 : answered ? 2 : 1;
  const guestStep = !answerCode ? 0 : 1;

  return (
    <div className="w-full max-w-md rounded-[2rem] glass-strong p-6 shadow-2xl">
      {role === "host" ? (
        <div className="space-y-5">
          <div>
            <h3 className="font-display text-xl font-semibold">Invite someone</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Send your invite code, then paste back the reply they give you.
            </p>
          </div>
          <Stepper labels={["Create", "Share", "Connect"]} current={hostStep} />

          <AnimatePresence mode="wait">
            {!offerCode ? (
              <motion.div key="gen" {...slide}>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => run(onGenerateOffer)}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Gathering network routes…
                    </>
                  ) : (
                    "Generate invite code"
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div key="exchange" {...slide} className="space-y-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    1 · Send this invite code
                  </p>
                  <CopyField value={offerCode} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    2 · Paste their reply code
                  </p>
                  <PasteField
                    placeholder="Paste the reply code from your guest…"
                    cta={answered ? "Connecting…" : "Connect"}
                    busy={busy || answered}
                    onSubmit={(v) =>
                      run(async () => {
                        await onAcceptAnswer(v);
                        setAnswered(true);
                      })
                    }
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="font-display text-xl font-semibold">Join the call</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste the invite code you received, then send back your reply.
            </p>
          </div>
          <Stepper labels={["Paste invite", "Send reply"]} current={guestStep} />

          <AnimatePresence mode="wait">
            {!answerCode ? (
              <motion.div key="paste" {...slide}>
                <PasteField
                  placeholder="Paste the invite code from the host…"
                  cta={busy ? "Generating reply…" : "Generate reply"}
                  busy={busy}
                  onSubmit={(v) => run(() => onAcceptOffer(v))}
                />
              </motion.div>
            ) : (
              <motion.div key="reply" {...slide} className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Send this reply code back to the host
                </p>
                <CopyField value={answerCode} />
                <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Waiting for the host to connect…
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {footer}
    </div>
  );
}
