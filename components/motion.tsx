"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/** Fades + lifts children into view once they scroll on screen. */
export function Reveal({
  delay = 0,
  className,
  children,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Writes the pointer position into --mx/--my so `.spotlight` can follow it. */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
  return { ref, onPointerMove };
}

export function SpotlightCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const spot = useSpotlight<HTMLDivElement>();
  return (
    <div
      ref={spot.ref}
      onPointerMove={spot.onPointerMove}
      className={cn("spotlight glass rounded-3xl", className)}
    >
      {children}
    </div>
  );
}
