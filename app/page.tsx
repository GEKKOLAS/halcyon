import {
  Lock,
  Zap,
  Smartphone,
  MessageSquare,
  Globe,
  ShieldCheck,
  ArrowRight,
  Smile,
} from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { Navbar } from "@/components/navbar";
import { StartRoom } from "@/components/start-room";
import { HeroPreview } from "@/components/hero-preview";
import { HowSteps } from "@/components/how-steps";
import { Reveal, SpotlightCard } from "@/components/motion";
import { Logo, PresenceOrb } from "@/components/logo";

const features = [
  {
    icon: Lock,
    title: "End-to-end by design",
    body: "Media flows peer-to-peer over an encrypted WebRTC channel. Your video never lands on our servers because we don't have any.",
    span: "lg:col-span-2",
    visual: "lock",
  },
  {
    icon: Zap,
    title: "Connect in seconds",
    body: "No downloads, no accounts, no waiting rooms.",
  },
  {
    icon: Smile,
    title: "Live reactions",
    body: "Fire off a 👋 or 🎉 that floats across both screens.",
  },
  {
    icon: MessageSquare,
    title: "Chat alongside",
    body: "Links and notes ride the same direct connection as your call.",
  },
  {
    icon: Smartphone,
    title: "Web and mobile",
    body: "One responsive client from a phone in your hand to a monitor on your desk.",
  },
  {
    icon: Globe,
    title: "Low latency, anywhere",
    body: "Direct connections take the shortest path between peers, so conversations feel immediate.",
    span: "lg:col-span-2",
    visual: "map",
  },
];

const stats = [
  { v: "0", l: "servers in the media path" },
  { v: "1", l: "code to swap" },
  { v: "∞", l: "minutes, free" },
  { v: "0", l: "accounts needed" },
];

function FeatureVisual({ kind }: { kind?: string }) {
  if (kind === "lock")
    return (
      <div className="pointer-events-none absolute -right-6 -top-6 hidden h-40 w-40 sm:block">
        <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-primary/30" />
        <div className="absolute inset-6 animate-spin-slow rounded-full border border-dashed border-aurora-violet/30 [animation-direction:reverse]" />
        <div className="absolute inset-12 grid place-items-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
      </div>
    );
  if (kind === "map")
    return (
      <svg
        viewBox="0 0 300 80"
        className="pointer-events-none mt-6 h-20 w-full text-primary/60"
        fill="none"
      >
        <path
          d="M10 60 C 80 0, 220 0, 290 50"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <circle cx="10" cy="60" r="5" className="fill-aurora-teal" />
        <circle cx="290" cy="50" r="5" className="fill-aurora-violet" />
        <circle r="4" className="fill-white">
          <animateMotion dur="2.4s" repeatCount="indefinite" path="M10 60 C 80 0, 220 0, 290 50" />
        </circle>
      </svg>
    );
  return null;
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <AuroraBackground />
      <Navbar />

      {/* Hero */}
      <section id="top" className="container relative pb-24 pt-32 sm:pt-40">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
              <PresenceOrb />
              Peer-to-peer · no accounts · private
            </div>
            <h1 className="text-balance font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl xl:text-[4.25rem]">
              Calm video calls,{" "}
              <span className="aurora-text bg-[length:200%_auto] animate-shimmer">
                just between you two.
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Halcyon is a video app with no middle. The call travels straight
              from your device to theirs — encrypted, account-free, and gone the
              moment you hang up.
            </p>
            <div className="mt-8 max-w-md">
              <StartRoom />
            </div>
          </div>

          <div className="animate-fade-up pb-8" style={{ animationDelay: "0.15s" }}>
            <HeroPreview />
            <p className="mt-12 text-center text-xs text-muted-foreground">
              Try it — tap a reaction ↑
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container">
        <Reveal className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl glass md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="bg-background/40 p-6 text-center">
              <div className="font-display text-4xl font-bold aurora-text">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Features (bento) */}
      <section id="features" className="container scroll-mt-24 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Why Halcyon
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Everything a call needs.
            <br />
            <span className="text-muted-foreground">Nothing it doesn&apos;t.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.06} className={f.span}>
              <SpotlightCard className="group relative h-full overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1">
                <FeatureVisual kind={f.visual} />
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container scroll-mt-24 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            How it works
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Three steps to a private call.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <HowSteps />
        </Reveal>
      </section>

      {/* Privacy band */}
      <section id="privacy" className="container scroll-mt-24 py-24 sm:py-32">
        <Reveal>
          <SpotlightCard className="relative overflow-hidden rounded-[2.5rem] p-10 text-center sm:p-20">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-aurora-violet/25 blur-3xl" />
            <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <h2 className="relative mx-auto mt-6 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-5xl">
              We can&apos;t see your calls. That&apos;s the point.
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-muted-foreground">
              Halcyon negotiates a direct connection between two devices and then
              steps out of the way. There&apos;s no stream to intercept, no archive
              to subpoena, no account to breach.
            </p>
            <a
              href="#start"
              className="group relative mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-[0_0_36px_-4px_hsl(168_76%_50%/0.7)] transition-all hover:brightness-110"
            >
              Start a room
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </SpotlightCard>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="container flex flex-col items-center justify-between gap-6 py-10 sm:flex-row">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Built with WebRTC · Next.js · Tailwind
          </p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Halcyon
          </p>
        </div>
      </footer>
    </main>
  );
}
