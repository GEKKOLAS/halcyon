"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Lock, Mic, MessageSquare, PhoneOff, Video } from "lucide-react";

const EMOJIS = ["👋", "😂", "❤️", "🎉", "👍"];
const LINES = ["hey! can you hear me?", "loud and clear ✨", "no servers, huh?"];

function Waveform() {
  return (
    <div className="flex h-4 items-end gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-primary"
          animate={{ height: ["30%", "100%", "45%", "80%", "30%"] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/** A decorative, tilt-on-hover mock of a live call. */
export function HeroPreview() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), {
    stiffness: 150,
    damping: 18,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), {
    stiffness: 150,
    damping: 18,
  });

  const [bursts, setBursts] = useState<{ id: number; e: string; x: number }[]>([]);
  const [line, setLine] = useState(0);
  const [seconds, setSeconds] = useState(127);

  useEffect(() => {
    const t1 = setInterval(() => setSeconds((s) => s + 1), 1000);
    const t2 = setInterval(() => setLine((l) => (l + 1) % LINES.length), 2800);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const burst = (e: string) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, e, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1800);
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;

  return (
    <div
      className="relative [perspective:1200px]"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] glass-strong p-2 shadow-[0_40px_120px_-30px_rgba(45,212,191,0.35)]"
      >
        {/* Remote "video" */}
        <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#12213a] via-[#1a1640] to-[#0f2a2c]">
          <div className="absolute inset-0 opacity-70">
            <div className="absolute left-1/2 top-[38%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-aurora-teal/70 to-aurora-violet/70 blur-[2px] sm:h-36 sm:w-36" />
            <div className="absolute bottom-[-18%] left-1/2 h-48 w-72 -translate-x-1/2 rounded-[50%] bg-gradient-to-t from-aurora-violet/40 to-aurora-teal/30 sm:h-56 sm:w-96" />
          </div>

          {/* Top status */}
          <div className="absolute inset-x-3 top-3 flex items-center justify-between">
            <span className="flex items-center gap-2 rounded-full glass px-3 py-1 text-[11px] font-medium">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-aurora-rose" />
              {mmss}
            </span>
            <span className="flex items-center gap-1.5 rounded-full glass px-3 py-1 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3 text-primary" /> Direct · encrypted
            </span>
          </div>

          {/* Remote label */}
          <div className="absolute bottom-16 left-3 flex items-center gap-2 rounded-full glass px-3 py-1 text-[11px] font-medium sm:bottom-3">
            <Waveform /> Maya
          </div>

          {/* Chat bubble */}
          <div className="absolute left-3 top-14 hidden sm:block">
            <AnimatePresence mode="wait">
              <motion.div
                key={line}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.35 }}
                className="rounded-2xl rounded-tl-sm glass px-3 py-2 text-xs"
              >
                {LINES[line]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Self PiP */}
          <motion.div
            style={{ translateZ: 40 }}
            className="absolute bottom-16 right-3 aspect-[3/4] w-20 overflow-hidden rounded-2xl ring-2 ring-primary/40 sm:bottom-3 sm:w-28"
          >
            <div className="h-full w-full bg-gradient-to-br from-[#1c2a3f] to-[#2a1f3d]">
              <div className="absolute left-1/2 top-[40%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-aurora-cyan/70 to-aurora-teal/60 sm:h-12 sm:w-12" />
            </div>
          </motion.div>

          {/* Reactions */}
          <AnimatePresence>
            {bursts.map((b) => (
              <motion.span
                key={b.id}
                initial={{ y: 0, opacity: 0, scale: 0.6 }}
                animate={{ y: -180, opacity: [0, 1, 1, 0], scale: [0.6, 1.3, 1, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, ease: "easeOut" }}
                className="pointer-events-none absolute bottom-20 text-3xl"
                style={{ left: `${b.x}%` }}
              >
                {b.e}
              </motion.span>
            ))}
          </AnimatePresence>

          {/* Mini controls */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full glass-strong p-1.5 sm:hidden">
            {[Mic, Video, MessageSquare].map((I, i) => (
              <span key={i} className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
                <I className="h-3.5 w-3.5" />
              </span>
            ))}
            <span className="grid h-8 w-8 place-items-center rounded-full bg-destructive">
              <PhoneOff className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </motion.div>

      {/* Reaction tray (interactive) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="absolute -bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full glass-strong p-1.5 shadow-xl"
      >
        {EMOJIS.map((e) => (
          <motion.button
            key={e}
            whileHover={{ scale: 1.25, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => burst(e)}
            className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-white/5"
            aria-label={`Send ${e}`}
          >
            {e}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
