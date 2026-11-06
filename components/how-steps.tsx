"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Link2, MicOff, PhoneOff, Users, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Link2,
    title: "Open a room",
    body: "Hit create and you get a private room with a shareable link.",
  },
  {
    icon: Users,
    title: "Share the link",
    body: "Send it to whoever you want. The call starts the moment they open it.",
  },
  {
    icon: MicOff,
    title: "Talk freely",
    body: "Mute, react, chat on the side. Hang up and leave no trace.",
  },
];

const DURATION = 5000;

function StepVisual({ i }: { i: number }) {
  if (i === 0)
    return (
      <div className="w-full max-w-xs space-y-3">
        <div className="rounded-2xl glass p-4">
          <p className="text-xs text-muted-foreground">Room created</p>
          <p className="mt-1 font-mono text-xl tracking-[0.2em]">k3x9qa2m</p>
        </div>
        <motion.div
          initial={{ width: "30%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground"
        >
          <Link2 className="h-4 w-4" /> Link ready
        </motion.div>
      </div>
    );
  if (i === 1)
    return (
      <div className="relative flex w-full max-w-xs items-center justify-between">
        {["You", "Them"].map((n, k) => (
          <div key={n} className="z-10 flex flex-col items-center gap-2">
            <div
              className={cn(
                "grid h-14 w-14 place-items-center rounded-2xl font-display font-semibold",
                k === 0
                  ? "bg-gradient-to-br from-aurora-teal to-aurora-cyan text-background"
                  : "bg-gradient-to-br from-aurora-violet to-aurora-rose text-background"
              )}
            >
              {n[0]}
            </div>
            <span className="text-xs text-muted-foreground">{n}</span>
          </div>
        ))}
        <div className="absolute inset-x-14 top-7 h-px bg-gradient-to-r from-aurora-teal via-white/20 to-aurora-violet" />
        <motion.span
          className="absolute top-[18px] grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
          animate={{ left: ["22%", "72%", "22%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Link2 className="h-3 w-3" />
        </motion.span>
      </div>
    );
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      <div className="grid w-full grid-cols-2 gap-2">
        {[0, 1].map((k) => (
          <div
            key={k}
            className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#14233b] to-[#21183f]"
          >
            <motion.div
              className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-aurora-teal/70 to-aurora-violet/70"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: k * 0.7 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
          <Video className="h-4 w-4" />
        </span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-destructive">
          <PhoneOff className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export function HowSteps() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % steps.length), DURATION);
    return () => clearTimeout(t);
  }, [active, paused]);

  return (
    <div
      className="mt-14 grid gap-6 lg:grid-cols-[1fr_1.1fr]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => {
          const on = i === active;
          const done = i < active;
          return (
            <button
              key={s.title}
              onClick={() => setActive(i)}
              className={cn(
                "relative overflow-hidden rounded-3xl p-6 text-left transition-all",
                on ? "glass-strong" : "glass glass-hover opacity-70 hover:opacity-100"
              )}
            >
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-2xl font-display text-sm font-bold transition-colors",
                    on
                      ? "bg-primary text-primary-foreground"
                      : done
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : `0${i + 1}`}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="block pt-1">{s.body}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              {on && (
                <motion.span
                  key={`bar-${active}-${paused}`}
                  className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-aurora-teal to-aurora-violet"
                  initial={{ width: "0%" }}
                  animate={{ width: paused ? "0%" : "100%" }}
                  transition={{ duration: paused ? 0 : DURATION / 1000, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-3xl glass-strong p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-aurora-violet/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-aurora-teal/15 blur-3xl" />
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex w-full justify-center"
          >
            <StepVisual i={active} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
