"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Plus, LogIn, Sparkles, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpotlight } from "@/components/motion";
import { cn } from "@/lib/utils";

const CODE_LEN = 8;

/** Accepts a bare code or a full room URL and returns the room id. */
function extractId(raw: string) {
  const t = raw.trim();
  const m = t.match(/\/room\/([^/?#\s]+)/);
  return (m ? m[1] : t).toLowerCase();
}

function CodeInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => inputRef.current?.focus(), []);
  const chars = value.padEnd(CODE_LEN, " ").slice(0, CODE_LEN).split("");

  return (
    <div
      className="relative cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(extractId(e.target.value).slice(0, CODE_LEN))}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 opacity-0"
        aria-label="Room code"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
        {chars.map((c, i) => {
          const isCaret = focused && i === Math.min(value.length, CODE_LEN - 1);
          const filled = c.trim() !== "";
          return (
            <div
              key={i}
              className={cn(
                "relative grid aspect-[3/4] place-items-center rounded-xl border bg-secondary/40 font-mono text-lg uppercase transition-all",
                isCaret
                  ? "border-primary/70 ring-2 ring-primary/30"
                  : filled
                  ? "border-white/15"
                  : "border-input"
              )}
            >
              <AnimatePresence mode="popLayout">
                {filled && (
                  <motion.span
                    key={c + i}
                    initial={{ y: 8, opacity: 0, scale: 0.7 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  >
                    {c}
                  </motion.span>
                )}
              </AnimatePresence>
              {isCaret && !filled && (
                <span className="h-5 w-[2px] animate-pulse rounded bg-primary" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StartRoom() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [code, setCode] = useState("");
  // Generated on the client only, so server and client markup match.
  const [preview, setPreview] = useState("");
  useEffect(() => setPreview(nanoid(CODE_LEN).toLowerCase()), []);
  const [launching, setLaunching] = useState(false);
  const spot = useSpotlight<HTMLDivElement>();

  const createRoom = () => {
    setLaunching(true);
    router.push(`/room/${preview}?host=1`);
  };

  const joinRoom = () => {
    const id = extractId(code);
    if (id) router.push(`/room/${id}`);
  };

  const pasteCode = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setCode(extractId(t).slice(0, CODE_LEN));
    } catch {}
  };

  return (
    <div
      id="start"
      ref={spot.ref}
      onPointerMove={spot.onPointerMove}
      className="spotlight scroll-mt-28 rounded-[2rem] glass-strong p-2 shadow-2xl"
    >
      <div className="rounded-[1.6rem] bg-card/40 p-5 sm:p-7">
        {/* Tabs */}
        <div className="relative mb-6 grid grid-cols-2 rounded-full bg-secondary/60 p-1 text-sm font-medium">
          {(["create", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative z-10 flex items-center justify-center gap-2 rounded-full py-2.5 transition-colors",
                tab === t ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === t && (
                <motion.span
                  layoutId="start-tab"
                  className="absolute inset-0 -z-10 rounded-full bg-primary shadow-[0_0_24px_-6px_hsl(168_76%_50%/0.7)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {t === "create" ? <Plus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {t === "create" ? "New room" : "Join"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {tab === "create" ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22 }}
              className="space-y-4"
            >
              <div className="rounded-2xl border border-dashed border-white/10 p-4">
                <p className="text-xs text-muted-foreground">Your room code</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-2xl tracking-[0.2em] text-foreground">
                    {preview || "········"}
                  </span>
                  <Sparkles className="h-5 w-5 text-aurora-violet" />
                </div>
              </div>
              <Button
                size="lg"
                className="group w-full"
                onClick={createRoom}
                disabled={launching || !preview}
              >
                {launching ? "Opening room…" : "Create room"}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Enter code or paste a link</p>
                <button
                  onClick={pasteCode}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                </button>
              </div>
              <CodeInput value={code} onChange={setCode} onSubmit={joinRoom} />
              <Button
                size="lg"
                className="group w-full"
                onClick={joinRoom}
                disabled={!code.trim()}
              >
                Join room
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Free · No account · Calls stay between you and your peer
        </p>
      </div>
    </div>
  );
}
