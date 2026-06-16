"use client";

import { useState } from "react";
import { Check, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
          onClick={(e) => e.currentTarget.select()}
          className="h-20 flex-1 resize-none rounded-2xl border border-input bg-secondary/40 p-3 font-mono text-[11px] leading-snug text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          variant="secondary"
          size="icon"
          className="h-auto w-12 shrink-0"
          onClick={copy}
          aria-label="Copy"
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
}: {
  label: string;
  placeholder: string;
  onSubmit: (v: string) => void;
  cta: string;
}) {
  const [val, setVal] = useState("");
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        className="h-20 w-full resize-none rounded-2xl border border-input bg-secondary/40 p-3 font-mono text-[11px] leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50"
      />
      <Button
        className="mt-2 w-full"
        disabled={!val.trim()}
        onClick={() => onSubmit(val)}
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface SignalPanelProps {
  role: "host" | "guest";
  offerCode: string;
  answerCode: string;
  onGenerateOffer: () => void;
  onAcceptOffer: (code: string) => void;
  onAcceptAnswer: (code: string) => void;
  connecting: boolean;
}

export function SignalPanel({
  role,
  offerCode,
  answerCode,
  onGenerateOffer,
  onAcceptOffer,
  onAcceptAnswer,
  connecting,
}: SignalPanelProps) {
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

          {!offerCode ? (
            <Button className="w-full" onClick={onGenerateOffer} disabled={connecting}>
              {connecting ? "Setting up camera…" : "Generate invite code"}
            </Button>
          ) : (
            <>
              <CopyField label="1 · Send this invite code" value={offerCode} />
              <PasteField
                label="2 · Paste their reply code"
                placeholder="Paste the reply code from your guest…"
                cta="Connect"
                onSubmit={onAcceptAnswer}
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

          {!answerCode ? (
            <PasteField
              label="1 · Paste the invite code"
              placeholder="Paste the invite code from the host…"
              cta="Generate reply"
              onSubmit={onAcceptOffer}
            />
          ) : (
            <CopyField
              label="2 · Send this reply code back to the host"
              value={answerCode}
            />
          )}
        </div>
      )}
    </div>
  );
}
