import {
  Lock,
  Zap,
  Smartphone,
  MessageSquare,
  Globe,
  MicOff,
  Link2,
  Users,
  ShieldCheck,
} from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { Navbar } from "@/components/navbar";
import { StartRoom } from "@/components/start-room";
import { Logo, PresenceOrb } from "@/components/logo";

const features = [
  {
    icon: Lock,
    title: "End-to-end by design",
    body: "Media flows peer-to-peer over an encrypted WebRTC channel. Your video never lands on our servers because we don't have any.",
  },
  {
    icon: Zap,
    title: "Connect in seconds",
    body: "No downloads, no accounts, no waiting rooms. Open a room, share the link, and you're talking.",
  },
  {
    icon: Smartphone,
    title: "Web and mobile",
    body: "One responsive client adapts from a phone in your hand to a monitor on your desk. Camera, mic, and chat all travel with you.",
  },
  {
    icon: MessageSquare,
    title: "Live chat alongside",
    body: "Drop links and notes in a side chat that rides the same direct connection as your call.",
  },
  {
    icon: Globe,
    title: "Anywhere, low latency",
    body: "Direct connections take the shortest path between peers, so conversations feel immediate.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing to leak",
    body: "No recordings, no transcripts, no profiles. When the call ends, it's gone.",
  },
];

const steps = [
  {
    n: "01",
    icon: Link2,
    title: "Open a room",
    body: "Hit create and you get a private room with a shareable link.",
  },
  {
    n: "02",
    icon: Users,
    title: "Share the link",
    body: "Send it to whoever you want. They join straight from the browser.",
  },
  {
    n: "03",
    icon: MicOff,
    title: "Talk freely",
    body: "Mute, swap cameras, chat on the side. Hang up and leave no trace.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <AuroraBackground />
      <Navbar />

      {/* Hero */}
      <section className="container relative pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
              <PresenceOrb />
              Peer-to-peer · serverless · private
            </div>
            <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Calm video calls,
              <br />
              <span className="aurora-text">just between you two.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Halcyon is a video app with no middle. The call travels straight
              from your device to theirs — encrypted, account-free, and gone the
              moment you hang up.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Connect in seconds
              </span>
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" /> Web &amp; mobile
              </span>
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> No sign-up
              </span>
            </div>
          </div>

          <div
            className="animate-fade-up"
            style={{ animationDelay: "0.15s" }}
          >
            <StartRoom />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Why Halcyon
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a call needs.
            <br />
            <span className="text-muted-foreground">Nothing it doesn&apos;t.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-3xl glass p-6 transition-all hover:-translate-y-1 hover:border-primary/30"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            How it works
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps to a private call.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-3xl glass p-8">
              <span className="font-display text-5xl font-bold text-primary/20">
                {s.n}
              </span>
              <div className="mt-4 flex items-center gap-3">
                <s.icon className="h-5 w-5 text-primary" />
                <h3 className="font-display text-xl font-semibold">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy band */}
      <section id="privacy" className="container py-20 sm:py-28">
        <div className="relative overflow-hidden rounded-[2rem] glass-strong p-10 text-center sm:p-16">
          <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-aurora-violet/20 blur-3xl" />
          <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            We can&apos;t see your calls. That&apos;s the point.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Halcyon negotiates a direct connection between two devices and then
            steps out of the way. There&apos;s no stream to intercept, no archive
            to subpoena, no account to breach.
          </p>
          <div className="mt-8">
            <a
              href="#start"
              className="inline-flex h-14 items-center gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-[0_0_36px_-4px_hsl(168_76%_50%/0.7)] transition-all hover:brightness-110"
            >
              Start a room
            </a>
          </div>
        </div>
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
