import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center px-4">
      <AuroraBackground />
      <div className="glass-strong w-full max-w-sm rounded-3xl p-8 text-center">
        <Logo className="justify-center" />
        <h1 className="mt-6 font-display text-2xl font-bold">Nothing here</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page doesn&apos;t exist. Rooms live at <span className="font-mono">/room/&lt;code&gt;</span>.
        </p>
        <Button className="mt-6 w-full" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </main>
  );
}
