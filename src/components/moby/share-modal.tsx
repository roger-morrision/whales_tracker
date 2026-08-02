"use client";

import { useState } from "react";
import { Share2, X, Copy, Check, Twitter, MessageCircle, Send } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShareData {
  title: string;
  description: string;
  url?: string;
}

export function ShareModal({ data, open, onClose }: { data: ShareData; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const shareText = `${data.title}\n\n${data.description}\n\nVia Moby — Trade Smarter 🐋`;
  const shareUrl = data.url || "https://moby.win";

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitter = () => {
    const tweet = encodeURIComponent(shareText);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${tweet}&url=${url}`, "_blank");
  };

  const handleTelegram = () => {
    const text = encodeURIComponent(shareText);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: data.description,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-sm bg-background border-t sm:border border-border rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Share2 className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Share</h2>
              <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Preview */}
              <div className="rounded-xl border border-border p-3 bg-surface-2/50">
                <div className="text-sm font-semibold mb-1">{data.title}</div>
                <p className="text-[11px] text-muted-foreground">{data.description}</p>
                <div className="text-[10px] text-bull mt-2">via Moby 🐋</div>
              </div>

              {/* Share buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={handleTwitter}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border hover:bg-surface-2 transition-colors"
                >
                  <Twitter className="h-5 w-5 text-foreground" />
                  <span className="text-[9px] font-medium text-muted-foreground">X / Twitter</span>
                </button>
                <button
                  onClick={handleTelegram}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border hover:bg-surface-2 transition-colors"
                >
                  <Send className="h-5 w-5 text-[#229ED9]" />
                  <span className="text-[9px] font-medium text-muted-foreground">Telegram</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border hover:bg-surface-2 transition-colors"
                >
                  {copied ? <Check className="h-5 w-5 text-bull" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-[9px] font-medium text-muted-foreground">{copied ? "Copied!" : "Copy"}</span>
                </button>
                <button
                  onClick={handleNativeShare}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border hover:bg-surface-2 transition-colors"
                >
                  <Share2 className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[9px] font-medium text-muted-foreground">More</span>
                </button>
              </div>

              {/* Copy text */}
              <div className="rounded-xl border border-border p-2.5">
                <div className="text-[10px] text-muted-foreground mb-1">Share text</div>
                <div className="text-[11px] text-foreground/80 max-h-20 overflow-y-auto scrollbar-thin whitespace-pre-wrap">{shareText}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to open share modal from any component
 */
export function useShare() {
  const [shareData, setShareData] = useState<ShareData | null>(null);

  const share = (data: ShareData) => setShareData(data);
  const close = () => setShareData(null);

  return { shareData, share, close, ShareModal: () => shareData ? <ShareModal data={shareData} open={!!shareData} onClose={close} /> : null };
}
