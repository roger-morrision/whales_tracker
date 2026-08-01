"use client";

import { useMemo, useState } from "react";
import { Newspaper, ExternalLink, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { NEWS, TOKENS_BY_ID, type NewsItem } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { SectionHeader, Chip } from "./primitives";
import { cn } from "@/lib/utils";

const CATEGORIES = ["all", "Market", "DeFi", "Meme", "AI", "DePIN", "Regulation", "Macro"] as const;

export function NewsFeed() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");
  const openToken = useMoby((s) => s.openToken);

  const filtered = useMemo(
    () => (cat === "all" ? NEWS : NEWS.filter((n) => n.category === cat)),
    [cat]
  );

  return (
    <section>
      <SectionHeader title="Latest news" emoji="📰" action="All" onAction={() => {}} />
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors border",
              cat === c
                ? "bg-bull/15 text-bull border-bull/30"
                : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((n) => (
          <NewsCard key={n.id} item={n} onTokenClick={openToken} />
        ))}
      </div>
    </section>
  );
}

function NewsCard({
  item,
  onTokenClick,
}: {
  item: NewsItem;
  onTokenClick: (id: string) => void;
}) {
  const sentColor =
    item.sentiment === "bullish"
      ? "text-bull bg-bull/10"
      : item.sentiment === "bearish"
      ? "text-bear bg-bear/10"
      : "text-muted-foreground bg-surface-3";

  return (
    <a
      href={item.url}
      onClick={(e) => e.preventDefault()}
      className="block rounded-xl border border-border p-3 hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", sentColor)}>
          {item.sentiment === "bullish" ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : item.sentiment === "bearish" ? (
            <ArrowDownRight className="h-4 w-4" />
          ) : (
            <Newspaper className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Chip variant="outline">{item.category}</Chip>
            <span className="text-[10px] text-muted-foreground">{item.source}</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              {item.agoMinutes < 60 ? `${item.agoMinutes}m` : `${Math.floor(item.agoMinutes / 60)}h`}
            </span>
          </div>
          <p className="text-[13px] font-medium leading-snug">{item.headline}</p>
          {item.tokensMentioned.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tokensMentioned.map((id) => {
                const tk = TOKENS_BY_ID[id];
                if (!tk) return null;
                return (
                  <button
                    key={id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTokenClick(id);
                    }}
                    className="text-[10px] font-mono bg-surface-3 hover:bg-surface-3/70 px-1.5 py-0.5 rounded"
                  >
                    ${tk.symbol}
                  </button>
                );
              })}
              <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto self-center" />
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
