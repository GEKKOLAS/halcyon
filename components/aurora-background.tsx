"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function AuroraBackground({ interactive = true }: { interactive?: boolean }) {
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (!interactive) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [interactive, x, y]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="absolute inset-0 grid-fade" />
      <div className="absolute -top-1/3 left-1/4 h-[60vmax] w-[60vmax] animate-aurora rounded-full bg-aurora-teal/20 blur-[120px]" />
      <div
        className="absolute top-1/4 -right-1/4 h-[55vmax] w-[55vmax] animate-aurora rounded-full bg-aurora-violet/20 blur-[120px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute -bottom-1/3 left-1/3 h-[50vmax] w-[50vmax] animate-aurora rounded-full bg-aurora-cyan/15 blur-[120px]"
        style={{ animationDelay: "-12s" }}
      />
      {interactive && (
        <motion.div
          className="absolute h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-aurora-teal/10 blur-[100px]"
          style={{ left: sx, top: sy }}
        />
      )}
      <div className="absolute inset-0 noise" />
    </div>
  );
}
