import { cn } from "@/lib/utils";

export function PresenceOrb({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-3 w-3", className)}>
      <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-aurora-teal to-aurora-violet shadow-[0_0_20px_-4px_rgba(45,212,191,0.6)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-background" fill="none">
          <path
            d="M4 8a4 4 0 014-4h5a4 4 0 014 4v3a4 4 0 01-4 4H9l-4 3v-3a4 4 0 01-1-2.6V8z"
            fill="currentColor"
            opacity="0.9"
          />
          <circle cx="9" cy="9.5" r="1.1" fill="hsl(230 35% 7%)" />
          <circle cx="13" cy="9.5" r="1.1" fill="hsl(230 35% 7%)" />
        </svg>
      </div>
      <span className="font-display text-xl font-bold tracking-tight">Halcyon</span>
    </div>
  );
}
