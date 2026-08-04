"use client";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["1m", "5m", "30m", "1h", "6h", "24h"] as const;
export type TrendTimeframe = typeof TIMEFRAMES[number];

interface Props {
  value: TrendTimeframe;
  onChange: (tf: TrendTimeframe) => void;
  disabled?: boolean;
  className?: string;
}

export function TimeframeSelector({ value, onChange, disabled, className }: Props) {
  return (
    <div className={cn("flex items-center gap-0.5 bg-surface-2 rounded-md p-0.5", className)}>
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => !disabled && onChange(tf)}
          disabled={disabled}
          className={cn(
            "px-2 py-1 text-[10px] font-mono font-semibold rounded transition-colors",
            value === tf
              ? "bg-bull/15 text-bull"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}