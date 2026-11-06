"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X } from "lucide-react";
import type { ChatMessage } from "@/hooks/use-webrtc";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
  disabled: boolean;
}

const QUICK = ["👋 Hi!", "Can you hear me?", "One sec…", "👍"];

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function ChatPanel({ messages, onSend, onClose, disabled }: ChatPanelProps) {
  const [val, setVal] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const send = (text = val) => {
    if (!text.trim()) return;
    onSend(text.trim());
    setVal("");
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl glass-strong">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <h3 className="font-display font-semibold">Chat</h3>
          <p className="text-[11px] text-muted-foreground">
            Peer-to-peer · not stored anywhere
          </p>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-2xl">
              💬
            </div>
            <p className="text-sm text-muted-foreground">
              {disabled ? "Chat opens once you're connected." : "No messages yet. Say hi!"}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped = prev && prev.mine === m.mine && m.ts - prev.ts < 60_000;
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  className={cn(
                    "flex flex-col",
                    m.mine ? "items-end" : "items-start",
                    !grouped && i > 0 && "pt-2"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] break-words rounded-2xl px-3.5 py-2 text-sm",
                      m.mine
                        ? "rounded-br-md bg-gradient-to-br from-aurora-teal to-aurora-cyan text-primary-foreground"
                        : "rounded-bl-md bg-white/[0.07] text-secondary-foreground"
                    )}
                  >
                    {m.text}
                  </div>
                  {!grouped && (
                    <span className="mt-1 px-1 text-[10px] text-muted-foreground">
                      {m.mine ? "You" : "Guest"} · {time(m.ts)}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={endRef} />
      </div>

      {!disabled && messages.length === 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="p-3"
      >
        <div className="flex items-center gap-2 rounded-full border border-input bg-black/20 p-1.5 pl-4 transition-colors focus-within:border-primary/50">
          <input
            ref={inputRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={disabled ? "Connect to chat…" : "Message…"}
            disabled={disabled}
            className="h-9 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.88 }}
            disabled={disabled || !val.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
      </form>
    </div>
  );
}
