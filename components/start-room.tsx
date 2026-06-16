"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { nanoid } from "nanoid";
import { ArrowRight, Plus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StartRoom() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const createRoom = () => {
    const id = nanoid(8).toLowerCase();
    router.push(`/room/${id}?host=1`);
  };

  const joinRoom = () => {
    const id = code.trim().toLowerCase();
    if (id) router.push(`/room/${id}`);
  };

  return (
    <div id="start" className="glass-strong rounded-3xl p-2 shadow-2xl">
      <div className="rounded-[1.35rem] bg-card/40 p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={createRoom}>
            <Plus className="h-5 w-5" />
            Create a new room
            <ArrowRight className="ml-auto h-5 w-5" />
          </Button>

          <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or join with a code
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              placeholder="room code"
              className="font-mono"
              aria-label="Room code"
            />
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={joinRoom}
              aria-label="Join room"
            >
              <LogIn className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Free · No account · Calls stay between you and your peer
        </p>
      </div>
    </div>
  );
}
