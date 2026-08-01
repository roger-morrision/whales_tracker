"use client";

import { useMemo } from "react";
import {
  Settings,
  Star,
  Award,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Crown,
  Flame,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { TOKENS, fmtUsd, fmtNum } from "@/lib/moby-data";
import { TokenIcon, Chip, SectionHeader } from "./primitives";
import { cn } from "@/lib/utils";

export function ProfileView() {
  const watchlist = useMoby((s) => s.watchlist);
  const followed = useMoby((s) => s.followedTraders);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const openToken = useMoby((s) => s.openToken);
  const signals = useMoby((s) => s.signals);

  const watchlistTokens = useMemo(
    () => watchlist.map((id) => TOKENS.find((t) => t.id === id)).filter(Boolean),
    [watchlist]
  );

  return (
    <div className="space-y-5">
      <ProfileHeader />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox icon={<Star className="h-3.5 w-3.5" />} label="Watchlist" value={`${watchlist.length}`} accent="gold" />
        <StatBox icon={<TrendingUp className="h-3.5 w-3.5" />} label="Following" value={`${followed.length}`} accent="bull" />
        <StatBox icon={<Bell className="h-3.5 w-3.5" />} label="Alerts" value={`${signals.length}`} accent="bear" />
      </div>

      {/* Achievements */}
      <section>
        <SectionHeader title="Achievements" emoji="🏆" />
        <div className="grid grid-cols-3 gap-2">
          <Achievement icon="🐋" label="Whale Watcher" desc="Tracked 100+ whales" unlocked />
          <Achievement icon="⚡" label="Early Bird" desc="Caught 10 early entries" unlocked />
          <Achievement icon="🎯" label="Sniper" desc="Hit 5 cluster buys" unlocked />
          <Achievement icon="🚀" label="Diamond Hands" desc="Held 30+ days" unlocked />
          <Achievement icon="🔮" label="Oracle" desc="5 calls validated" />
          <Achievement icon="👑" label="Moby Maxi" desc="Follow 10 traders" />
        </div>
      </section>

      {/* Watchlist */}
      {watchlistTokens.length > 0 && (
        <section>
          <SectionHeader title="My watchlist" emoji="⭐" action="Edit" onAction={() => useMoby.getState().setActiveTab("discover")} />
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {watchlistTokens.map((t) => {
              if (!t) return null;
              return (
                <button
                  key={t.id}
                  onClick={() => openToken(t.id)}
                  className="shrink-0 w-32 p-2.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <TokenIcon symbol={t.symbol} glyph={t.logoGlyph} color={t.logoColor} size="sm" />
                    <span className="font-semibold text-sm">{t.symbol}</span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular mb-0.5">${t.price < 1 ? t.price.toFixed(4) : t.price.toFixed(2)}</div>
                  <div className={cn("text-[11px] tabular font-semibold", t.change24h >= 0 ? "text-bull" : "text-bear")}>
                    {t.change24h >= 0 ? "+" : ""}
                    {t.change24h.toFixed(2)}%
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Premium upsell */}
      <section>
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#F59E0B]/15 via-[#EF4444]/8 to-transparent border border-gold/30 relative overflow-hidden">
          <Crown className="absolute -top-2 -right-2 h-20 w-20 text-gold/10" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-gold" />
              <span className="text-sm font-semibold text-gold">Moby Pro</span>
              <Chip variant="gold" className="ml-auto">Save 30%</Chip>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Unlimited smart-money alerts, real-time whale push notifications, on-chain tax reports, and AI copilot calls.
            </p>
            <button className="w-full py-2 rounded-lg bg-gold text-background text-xs font-bold hover:opacity-90">
              Upgrade for $24/mo
            </button>
          </div>
        </div>
      </section>

      {/* Menu */}
      <section>
        <div className="rounded-xl border border-border overflow-hidden">
          <MenuItem icon={<Bell className="h-4 w-4" />} label="Notifications" sub="3 active alerts" />
          <MenuItem icon={<Shield className="h-4 w-4" />} label="Privacy & security" sub="Wallet connections" />
          <MenuItem icon={<Target className="h-4 w-4" />} label="Trading preferences" sub="Slippage, defaults" />
          <MenuItem icon={<HelpCircle className="h-4 w-4" />} label="Help & support" />
          <MenuItem
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
            trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
          />
          <MenuItem
            icon={<LogOut className="h-4 w-4" />}
            label="Disconnect wallet"
            variant="danger"
          />
        </div>
      </section>

      <div className="text-center text-[11px] text-muted-foreground pt-2 pb-2">
        Moby · v2.4.1 · Built on Z.ai
        <div className="mt-1">
          <button onClick={() => setCopilotOpen(true)} className="text-bull hover:opacity-80">
            Ask Moby anything →
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileHeader() {
  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-[#9945FF]/15 via-[#14F195]/8 to-transparent border border-border text-center">
      <div className="relative inline-block mb-2">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#14F195] to-[#9945FF] grid place-items-center text-3xl font-bold text-background mx-auto">
          Z
        </div>
        <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gold ring-2 ring-background grid place-items-center">
          <Crown className="h-3 w-3 text-background" />
        </span>
      </div>
      <h2 className="font-bold text-lg">Z Trader</h2>
      <div className="text-xs text-muted-foreground mb-2">@ztrader · 0x7a...3f4c</div>
      <div className="flex justify-center gap-1.5">
        <Chip variant="gold">Pro member</Chip>
        <Chip variant="bull">Smart money</Chip>
        <Chip variant="outline">Solana</Chip>
      </div>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "bull" | "bear" | "gold";
}) {
  const color =
    accent === "bull" ? "text-bull bg-bull/10" : accent === "bear" ? "text-bear bg-bear/10" : "text-gold bg-gold/10";
  return (
    <div className="rounded-xl border border-border p-3 text-center">
      <div className={cn("h-7 w-7 rounded-lg grid place-items-center mx-auto mb-1", color)}>{icon}</div>
      <div className="text-lg font-bold tabular">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Achievement({ icon, label, desc, unlocked }: { icon: string; label: string; desc: string; unlocked?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 text-center",
        unlocked ? "border-gold/30 bg-gold/5" : "border-border bg-surface-2 opacity-60"
      )}
    >
      <div className={cn("text-2xl mb-1", !unlocked && "grayscale opacity-50")}>{icon}</div>
      <div className="text-[11px] font-semibold truncate">{label}</div>
      <div className="text-[9px] text-muted-foreground truncate">{desc}</div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  sub,
  trailing,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors text-left border-b border-border last:border-b-0",
        variant === "danger" && "text-bear"
      )}
    >
      <span className={cn(variant === "danger" ? "text-bear" : "text-muted-foreground")}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      {trailing ?? <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}
