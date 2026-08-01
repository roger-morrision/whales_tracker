"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * Moby wordmark + whale glyph.
 * Used in TopBar and onboarding.
 */
export function MobyLogo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-[#14F195] via-[#22D3EE] to-[#9945FF] grid place-items-center shadow-[0_4px_24px_-6px_rgba(20,241,149,0.6)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-background" fill="currentColor" aria-hidden>
          {/* Stylized whale/spout */}
          <path d="M3 12c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6 0 2.4-1.4 4.5-3.5 5.4-.3.1-.6.1-.8-.1l-1.4-1.4c-.4-.4-1-.4-1.4 0l-1.4 1.4c-.4.4-1 .4-1.4 0L9.7 16c-.4-.4-1-.4-1.4 0l-1.4 1.4c-.2.2-.5.3-.8.1C4.4 16.5 3 14.4 3 12z" />
          <circle cx="8" cy="11" r="1.2" className="fill-background" />
        </svg>
      </div>
      {withText && (
        <span className="text-lg font-bold tracking-tight">
          Moby
        </span>
      )}
    </div>
  );
}

interface TokenIconProps {
  symbol: string;
  glyph?: string;
  color?: string; // tailwind gradient classes "from-x to-y"
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  live?: boolean;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

/**
 * Circular gradient token icon with optional "live" pulse ring.
 */
export function TokenIcon({ symbol, glyph, color, size = "md", className, live }: TokenIconProps) {
  const gradient = color ?? "from-[#64748B] to-[#334155]";
  const display = glyph ?? symbol.slice(0, 2);
  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "rounded-full bg-gradient-to-br grid place-items-center font-bold text-white ring-1 ring-white/10",
          sizeMap[size],
          gradient
        )}
      >
        <span className="drop-shadow-sm">{display}</span>
      </div>
      {live && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-bull ring-2 ring-background">
          <span className="absolute inset-0 rounded-full bg-bull live-dot" />
        </span>
      )}
    </div>
  );
}

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  bullish?: boolean;
  className?: string;
  showArea?: boolean;
}

/**
 * Minimal inline sparkline. Auto-scales to data range.
 */
export function Sparkline({
  data,
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  bullish,
  className,
  showArea = false,
}: SparklineProps) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  const isBull = bullish ?? data[data.length - 1] >= data[0];
  const color = isBull ? "var(--bull)" : "var(--bear)";

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth;
    return [x, y] as const;
  });

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const areaD = `${d} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${isBull ? "b" : "r"}-${Math.round(data[0] * 1000)}-${data.length}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradId})`} />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface PriceBadgeProps {
  value: number;
  delta: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Price + colored % delta. Tabular numbers, sign-aware color.
 */
export function PriceBadge({ value, delta, className, size = "md" }: PriceBadgeProps) {
  const isBull = delta >= 0;
  const priceStr =
    value >= 1000
      ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
      : value >= 1
      ? `$${value.toFixed(3)}`
      : value >= 0.01
      ? `$${value.toFixed(4)}`
      : value >= 0.0001
      ? `$${value.toFixed(6)}`
      : `$${value.toExponential(2)}`;
  const sizeCls = size === "sm" ? "text-xs" : size === "lg" ? "text-2xl" : "text-base";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("tabular font-semibold", sizeCls)}>{priceStr}</span>
      <span
        className={cn(
          "tabular text-xs font-medium px-1.5 py-0.5 rounded-md",
          isBull ? "text-bull bg-bull/10" : "text-bear bg-bear/10"
        )}
      >
        {isBull ? "+" : ""}
        {delta.toFixed(2)}%
      </span>
    </div>
  );
}

/**
 * Animated number — smoothly tweens between values.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.5, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("tabular", className)}
    >
      {format(value)}
    </motion.span>
  );
}

/**
 * Chip / tag pill. Default is muted; pass variant for accent.
 */
export function Chip({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "bull" | "bear" | "gold" | "outline";
  className?: string;
}) {
  const variants = {
    default: "bg-surface-3 text-muted-foreground",
    bull: "bg-bull/15 text-bull",
    bear: "bg-bear/15 text-bear",
    gold: "bg-gold/15 text-gold",
    outline: "border border-border text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Section header with title + optional "view all" link.
 */
export function SectionHeader({
  title,
  emoji,
  action,
  onAction,
}: {
  title: string;
  emoji?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        {emoji && <span aria-hidden>{emoji}</span>}
        {title}
      </h2>
      {action && (
        <button
          onClick={onAction}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {action} →
        </button>
      )}
    </div>
  );
}
