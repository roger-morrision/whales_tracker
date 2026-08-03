"use client";

import { findTraderForWallet } from "@/lib/moby-data";
import { useMoby } from "@/lib/moby-store";
import { cn } from "@/lib/utils";

/**
 * A clickable wallet label or address. Clicking opens the linked trader's
 * portfolio detail sheet. The TraderDetailSheet renders at z-[60] so it
 * appears above any modal the WalletLink lives inside.
 *
 * Visual cue: subtle hover underline + color shift to bull-green.
 */
export function WalletLink({
  label,
  address,
  className,
  showAddress = false,
  variant = "default",
}: {
  label: string;
  address?: string;
  className?: string;
  /** Also render the truncated address after the label */
  showAddress?: boolean;
  variant?: "default" | "muted" | "mono";
}) {
  const openTrader = useMoby((s) => s.openTrader);
  const traderId = findTraderForWallet(label, address);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (traderId) {
      // Use getState() to ensure we call the latest openTrader function
      useMoby.getState().openTrader(traderId);
    } else if (address) {
      // Unknown wallet — open wallet detail sheet
      useMoby.getState().openWalletDetail(address, label);
    }
  };

  // For unknown wallets with an address, make them clickable too
  if (!traderId && address) {
    const baseCls =
      variant === "mono"
        ? "font-mono text-bull hover:underline cursor-pointer"
        : variant === "muted"
        ? "text-muted-foreground hover:text-bull hover:underline cursor-pointer transition-colors"
        : "text-foreground hover:text-bull hover:underline cursor-pointer transition-colors";

    return (
      <button
        onClick={handleClick}
        className={cn("inline-flex items-center gap-1 text-left", baseCls, className)}
        title={`View ${label}'s wallet →`}
      >
        {label}
        {showAddress && (
          <span className="font-mono text-muted-foreground/70 text-[10px] hover:text-bull/70">{address}</span>
        )}
      </button>
    );
  }

  if (!traderId) {
    // Non-clickable display for exchanges / funds / protocols
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1",
          variant === "mono" && "font-mono",
          variant === "muted" ? "text-muted-foreground" : "",
          className
        )}
        title="Exchange / protocol wallet"
      >
        {label}
        {showAddress && address && (
          <span className="font-mono text-muted-foreground/70 text-[10px]">{address}</span>
        )}
      </span>
    );
  }

  const baseCls =
    variant === "mono"
      ? "font-mono text-bull hover:underline cursor-pointer"
      : variant === "muted"
      ? "text-muted-foreground hover:text-bull hover:underline cursor-pointer transition-colors"
      : "text-foreground hover:text-bull hover:underline cursor-pointer transition-colors";

  return (
    <button
      onClick={handleClick}
      className={cn("inline-flex items-center gap-1 text-left", baseCls, className)}
      title={`View ${label}'s portfolio →`}
    >
      {label}
      {showAddress && address && (
        <span className="font-mono text-muted-foreground/70 text-[10px] hover:text-bull/70">{address}</span>
      )}
    </button>
  );
}
