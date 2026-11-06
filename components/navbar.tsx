"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "privacy", label: "Privacy" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.isIntersecting && setActive(e.target.id));
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    links.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) io.observe(el);
    });
    const hero = document.getElementById("top");
    if (hero) io.observe(hero);

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  const highlight = hovered ?? active;

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "flex w-full items-center justify-between gap-4 rounded-full px-3 py-2 transition-all duration-500",
          scrolled
            ? "max-w-3xl glass-strong shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]"
            : "max-w-6xl border border-transparent"
        )}
      >
        <Link href="/" className="pl-2" aria-label="Halcyon home">
          <Logo />
        </Link>

        <nav
          className="hidden items-center md:flex"
          onMouseLeave={() => setHovered(null)}
        >
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onMouseEnter={() => setHovered(l.id)}
              className={cn(
                "relative rounded-full px-4 py-2 text-sm transition-colors",
                highlight === l.id ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {highlight === l.id && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-white/[0.07]"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <a href="#start">Start a room</a>
          </Button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-full glass md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-4 top-[4.5rem] flex flex-col gap-1 rounded-3xl glass-strong p-2 md:hidden"
          >
            {links.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
