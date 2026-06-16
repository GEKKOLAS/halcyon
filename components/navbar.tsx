"use client";

import Link from "next/link";
import { Logo, PresenceOrb } from "@/components/logo";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#privacy" className="transition-colors hover:text-foreground">
            Privacy
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <PresenceOrb />
            No sign-up
          </span>
          <Button size="sm" asChild>
            <a href="#start">Start a room</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
