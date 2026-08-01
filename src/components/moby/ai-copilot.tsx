"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Trash2, ArrowRight } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { TOKENS_BY_ID } from "@/lib/moby-data";
import { TokenIcon } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What's smart money doing right now?",
  "Analyze $WIF",
  "Summarize my portfolio",
  "What narratives are trending?",
  "Estimate my crypto taxes",
];

export function AICopilot() {
  const open = useMoby((s) => s.copilotOpen);
  const setOpen = useMoby((s) => s.setCopilotOpen);
  const chat = useMoby((s) => s.chat);
  const sendChat = useMoby((s) => s.sendChat);
  const clearChat = useMoby((s) => s.clearChat);
  const openToken = useMoby((s) => s.openToken);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chat]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendChat(trimmed);
    setInput("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md h-[80vh] sm:h-[600px] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#14F195] to-[#22D3EE] grid place-items-center">
                <Sparkles className="h-4 w-4 text-background" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">Moby AI Copilot</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" />
                  Online · Onchain-aware
                </div>
              </div>
              <button
                onClick={clearChat}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
                aria-label="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-3">
              {chat.map((m) => (
                <MessageBubble key={m.id} message={m} onTokenClick={(id) => {
                  setOpen(false);
                  setTimeout(() => openToken(id), 200);
                }} />
              ))}
            </div>

            {/* Suggestions */}
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
              className="p-3 border-t border-border flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a token, your portfolio, or what smart money is doing…"
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bull/40"
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-10 w-10 grid place-items-center rounded-xl bg-bull text-background disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({
  message,
  onTokenClick,
}: {
  message: ReturnType<typeof useMoby.getState>["chat"][number];
  onTokenClick: (id: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "bg-bull text-background rounded-br-md"
            : "bg-surface-2 border border-border rounded-bl-md"
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-1 mb-1">
            <div className="h-4 w-4 rounded bg-gradient-to-br from-[#14F195] to-[#22D3EE]" />
            <span className="text-[10px] font-semibold text-muted-foreground">Moby</span>
          </div>
        )}
        {message.pending ? (
          <div className="flex items-center gap-1 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" style={{ animationDelay: "200ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-bull live-dot" style={{ animationDelay: "400ms" }} />
          </div>
        ) : (
          <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}
        {!isUser && !message.pending && message.suggestedTokens && message.suggestedTokens.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border">
            {message.suggestedTokens.map((id) => {
              const tk = TOKENS_BY_ID[id];
              if (!tk) return null;
              return (
                <button
                  key={id}
                  onClick={() => onTokenClick(id)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-3 hover:bg-surface-3/70 border border-border text-[11px] font-medium"
                >
                  <TokenIcon symbol={tk.symbol} glyph={tk.logoGlyph} color={tk.logoColor} size="xs" />
                  {tk.symbol}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
