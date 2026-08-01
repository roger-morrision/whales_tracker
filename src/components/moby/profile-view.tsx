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
  Plus,
  Trash2,
  Gift,
} from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { TOKENS, fmtUsd, fmtNum, fmtPrice, fmtAge } from "@/lib/moby-data";
import { TokenIcon, Chip, SectionHeader } from "./primitives";
import { cn } from "@/lib/utils";

export function ProfileView() {
  const watchlist = useMoby((s) => s.watchlist);
  const followed = useMoby((s) => s.followedTraders);
  const setCopilotOpen = useMoby((s) => s.setCopilotOpen);
  const openToken = useMoby((s) => s.openToken);
  const signals = useMoby((s) => s.signals);
  const customAlerts = useMoby((s) => s.customAlerts);
  const openAlertCreator = useMoby((s) => s.openAlertCreator);
  const setSettingsOpen = useMoby((s) => s.setSettingsOpen);
  const disconnectWallet = useMoby((s) => s.disconnectWallet);
  const wallet = useMoby((s) => s.wallet);
  const setWalletOpen = useMoby((s) => s.setWalletOpen);

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

      {/* Trading tools grid — new batch 3 features */}
      <section>
        <SectionHeader title="Trading tools" emoji="⚡" />
        <div className="grid grid-cols-4 gap-2">
          <ToolButton emoji="📋" label="Copy Trade" onClick={() => useMoby.getState().setCopyTradeOpen(true)} />
          <ToolButton emoji="🎯" label="Limit" onClick={() => useMoby.getState().setLimitOrdersOpen(true)} />
          <ToolButton emoji="📅" label="DCA" onClick={() => useMoby.getState().setDcaOpen(true)} />
          <ToolButton emoji="📊" label="Rebalance" onClick={() => useMoby.getState().setRebalanceOpen(true)} />
          <ToolButton emoji="📜" label="Activity" onClick={() => useMoby.getState().setWalletActivityOpen(true)} />
          <ToolButton emoji="🌐" label="Solana" onClick={() => useMoby.getState().setSolanaStatsOpen(true)} />
          <ToolButton emoji="🏆" label="Leaderboard" onClick={() => useMoby.getState().setPnlLeaderboardOpen(true)} />
          <ToolButton emoji="💬" label="Social" onClick={() => useMoby.getState().setSocialOpen(true)} />
          <ToolButton emoji="⚡" label="Perps" onClick={() => useMoby.getState().setPerpsOpen(true)} />
          <ToolButton emoji="🚀" label="Launches" onClick={() => useMoby.getState().setLaunchScannerOpen(true)} />
          <ToolButton emoji="🌉" label="Bridge" onClick={() => useMoby.getState().setBridgeOpen(true)} />
          <ToolButton emoji="🔥" label="Staking" onClick={() => useMoby.getState().setStakingOpen(true)} />
          <ToolButton emoji="⛽" label="Gas" onClick={() => useMoby.getState().setGasOptimizerOpen(true)} />
          <ToolButton emoji="🎁" label="Airdrops" onClick={() => useMoby.getState().setAirdropOpen(true)} />
          <ToolButton emoji="🐋" label="Whales" onClick={() => useMoby.getState().setActiveTab("whales")} />
        </div>
      </section>

      {/* Achievements */}
      <section>
        <SectionHeader
          title="Achievements"
          emoji="🏆"
          action="View all"
          onAction={() => useMoby.getState().setAchievementsOpen(true)}
        />
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
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {t.smartMoneyHolders} smart · {fmtAge(t.ageHours)}
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

      {/* Custom alerts section */}
      <CustomAlertsSection />

      {/* Menu */}
      <section>
        <div className="rounded-xl border border-border overflow-hidden">
          <MenuItem
            icon={<Bell className="h-4 w-4" />}
            label="Create custom alert"
            sub={`${customAlerts.length} active`}
            onClick={() => openAlertCreator(null)}
          />
          <MenuItem
            icon={<Gift className="h-4 w-4" />}
            label="Refer & earn"
            sub="Get $25 per friend"
            onClick={() => useMoby.getState().setReferralOpen(true)}
          />
          <MenuItem
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
            sub="Slippage, notifications, privacy"
            onClick={() => setSettingsOpen(true)}
          />
          <MenuItem
            icon={<Shield className="h-4 w-4" />}
            label="Privacy & security"
            sub="Wallet connections"
            onClick={() => setSettingsOpen(true)}
          />
          <MenuItem
            icon={<Target className="h-4 w-4" />}
            label="Trading preferences"
            sub="Defaults, gas priority"
            onClick={() => setSettingsOpen(true)}
          />
          <MenuItem icon={<HelpCircle className="h-4 w-4" />} label="Help & support" />
          <MenuItem
            icon={<LogOut className="h-4 w-4" />}
            label="Disconnect wallet"
            variant="danger"
            onClick={() => disconnectWallet()}
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
  const wallet = useMoby((s) => s.wallet);
  const setWalletOpen = useMoby((s) => s.setWalletOpen);

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
      <button
        onClick={() => setWalletOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        {wallet ? (
          <>
            <span className="font-mono">{wallet.address}</span>
            <span className="text-bull tabular">· ${(wallet.balanceUsd / 1000).toFixed(1)}K</span>
          </>
        ) : (
          <>
            @ztrader · <span className="text-bull">Connect wallet →</span>
          </>
        )}
      </button>
      <div className="flex justify-center gap-1.5 mt-2">
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

function ToolButton({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-border bg-surface-2 p-2 hover:bg-surface-3 hover:border-bull/30 transition-colors text-center"
    >
      <div className="text-xl mb-0.5">{emoji}</div>
      <div className="text-[10px] font-medium text-muted-foreground truncate">{label}</div>
    </button>
  );
}

function MenuItem({
  icon,
  label,
  sub,
  trailing,
  variant = "default",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
  variant?: "default" | "danger";
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
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

function CustomAlertsSection() {
  const customAlerts = useMoby((s) => s.customAlerts);
  const removeAlert = useMoby((s) => s.removeCustomAlert);
  const openAlertCreator = useMoby((s) => s.openAlertCreator);
  const openToken = useMoby((s) => s.openToken);

  if (customAlerts.length === 0) {
    return (
      <section>
        <SectionHeader title="Custom alerts" emoji="🔔" />
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground mb-2">No alerts yet</p>
          <button
            onClick={() => openAlertCreator(null)}
            className="text-xs text-bull font-semibold hover:opacity-80 inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Create your first alert
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="Custom alerts"
        emoji="🔔"
        action="New"
        onAction={() => openAlertCreator(null)}
      />
      <div className="space-y-1.5">
        {customAlerts.map((a) => {
          const tk = TOKENS.find((t) => t.id === a.tokenId);
          const isPrice = a.condition === "price_above" || a.condition === "price_below";
          return (
            <div key={a.id} className="rounded-lg border border-border p-2.5 flex items-center gap-2">
              <button onClick={() => openToken(a.tokenId)}>
                <TokenIcon
                  symbol={a.tokenSymbol}
                  glyph={tk?.logoGlyph}
                  color={tk?.logoColor}
                  size="sm"
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">
                  ${a.tokenSymbol}{" "}
                  <span className="text-muted-foreground font-normal">
                    {a.condition.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground tabular">
                  {isPrice ? fmtPrice(a.threshold) : fmtUsd(a.threshold, { compact: true })}
                  {" · "}
                  {a.channels.join(", ")}
                </div>
              </div>
              <button
                onClick={() => removeAlert(a.id)}
                className="h-7 w-7 grid place-items-center rounded-md hover:bg-surface-3 text-muted-foreground hover:text-bear"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
