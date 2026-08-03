"use client";

import { useState } from "react";
import {
  X,
  Settings as SettingsIcon,
  Zap,
  Bell,
  Shield,
  Eye,
  DollarSign,
  Sliders,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { useMoby, DEFAULT_SETTINGS, type AppSettings } from "@/lib/moby-store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Section = "trading" | "notifications" | "privacy" | "display";

export function SettingsModal() {
  const open = useMoby((s) => s.settingsOpen);
  const setOpen = useMoby((s) => s.setSettingsOpen);
  const settings = useMoby((s) => s.settings);
  const setSettings = useMoby((s) => s.setSettings);
  const [section, setSection] = useState<Section>("trading");

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
            role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md h-[88vh] flex flex-col bg-background border-t sm:border border-bull/20 rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-bull" />
              <h2 className="font-semibold text-sm flex-1">Settings</h2>
              <button
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-3 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Section tabs */}
            <div className="flex gap-1 p-1 bg-surface-2 m-3 rounded-lg">
              {[
                { k: "trading", label: "Trading", icon: Zap },
                { k: "notifications", label: "Alerts", icon: Bell },
                { k: "privacy", label: "Privacy", icon: Shield },
                { k: "display", label: "Display", icon: Eye },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.k}
                    onClick={() => setSection(s.k as Section)}
                    className={cn(
                      "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors flex items-center justify-center gap-1",
                      section === s.k ? "bg-surface-3 text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" /> {s.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
              {section === "trading" && (
                <TradingSettings settings={settings} setSettings={setSettings} />
              )}
              {section === "notifications" && (
                <NotificationsSettings settings={settings} setSettings={setSettings} />
              )}
              {section === "privacy" && (
                <PrivacySettings settings={settings} setSettings={setSettings} />
              )}
              {section === "display" && (
                <DisplaySettings settings={settings} setSettings={setSettings} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TradingSettings({
  settings,
  setSettings,
}: {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-4">
      <Section title="Default slippage" emoji="🎯">
        <div className="flex gap-1.5">
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSettings({ defaultSlippage: s })}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-semibold border",
                settings.defaultSlippage === s
                  ? "bg-bull/15 text-bull border-bull/30"
                  : "bg-surface-2 text-muted-foreground border-border"
              )}
            >
              {s}%
            </button>
          ))}
        </div>
      </Section>

      <Section title="Default gas priority" emoji="⛽">
        <div className="flex gap-1.5">
          {[
            { k: "slow", label: "Slow", desc: "~$0.0004" },
            { k: "standard", label: "Standard", desc: "~$0.0008" },
            { k: "fast", label: "Fast", desc: "~$0.0014" },
          ].map((g) => (
            <button
              key={g.k}
              onClick={() => setSettings({ defaultGas: g.k as AppSettings["defaultGas"] })}
              className={cn(
                "flex-1 py-2 rounded-lg border text-center",
                settings.defaultGas === g.k
                  ? "bg-bull/15 border-bull/30"
                  : "bg-surface-2 border-border"
              )}
            >
              <div className="text-xs font-semibold">{g.label}</div>
              <div className="text-[9px] text-muted-foreground">{g.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Priority fee" emoji="⚡">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.0001}
            max={0.01}
            step={0.0001}
            value={settings.priorityFee}
            onChange={(e) => setSettings({ priorityFee: Number(e.target.value) })}
            className="flex-1 accent-bull"
          />
          <span className="text-xs font-semibold tabular w-16 text-right">
            {settings.priorityFee.toFixed(4)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          Higher priority = faster inclusion, higher cost
        </div>
      </Section>

      <Section title="Portfolio display" emoji="📊">
        <Toggle
          label="Hide small balances"
          desc={`Tokens under $${settings.smallBalanceThreshold} are hidden`}
          value={settings.hideSmallBalances}
          onChange={(v) => setSettings({ hideSmallBalances: v })}
        />
        <Toggle
          label="Show hidden tokens"
          desc="Display tokens you've manually hidden"
          value={settings.showHiddenTokens}
          onChange={(v) => setSettings({ showHiddenTokens: v })}
        />
      </Section>
    </div>
  );
}

function NotificationsSettings({
  settings,
  setSettings,
}: {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-4">
      <Section title="Smart money" emoji="🐋">
        <Toggle
          label="Smart money entries"
          desc="When tracked wallets open new positions"
          value={settings.notifications.smartMoneyEntry}
          onChange={(v) =>
            setSettings({
              notifications: { ...settings.notifications, smartMoneyEntry: v },
            })
          }
        />
        <Toggle
          label="Whale accumulation"
          desc="Large buys from tracked wallets"
          value={settings.notifications.whaleAccumulation}
          onChange={(v) =>
            setSettings({
              notifications: { ...settings.notifications, whaleAccumulation: v },
            })
          }
        />
      </Section>

      <Section title="Tokens" emoji="🪙">
        <Toggle
          label="Price alerts"
          desc="Your custom price thresholds"
          value={settings.notifications.priceAlerts}
          onChange={(v) =>
            setSettings({
              notifications: { ...settings.notifications, priceAlerts: v },
            })
          }
        />
        <Toggle
          label="New token launches"
          desc="When trending tokens launch"
          value={settings.notifications.newTokenLaunch}
          onChange={(v) =>
            setSettings({
              notifications: { ...settings.notifications, newTokenLaunch: v },
            })
          }
        />
      </Section>

      <Section title="Portfolio" emoji="💼">
        <Toggle
          label="Portfolio milestones"
          desc="When your portfolio crosses thresholds"
          value={settings.notifications.portfolioMilestones}
          onChange={(v) =>
            setSettings({
              notifications: { ...settings.notifications, portfolioMilestones: v },
            })
          }
        />
        <Toggle
          label="Weekly digest"
          desc="Sunday summary of your week"
          value={settings.notifications.weeklyDigest}
          onChange={(v) =>
            setSettings({
              notifications: { ...settings.notifications, weeklyDigest: v },
            })
          }
        />
      </Section>
    </div>
  );
}

function PrivacySettings({
  settings,
  setSettings,
}: {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-4">
      <Section title="Privacy" emoji="🔒">
        <Toggle
          label="Hide balances in screenshots"
          desc="Blur portfolio values when taking screenshots"
          value={settings.privacy.hideBalances}
          onChange={(v) =>
            setSettings({
              privacy: { ...settings.privacy, hideBalances: v },
            })
          }
        />
        <Toggle
          label="Block transaction tracking"
          desc="Prevent third-party trackers from linking your wallet"
          value={settings.privacy.blockTransactionTracking}
          onChange={(v) =>
            setSettings({
              privacy: { ...settings.privacy, blockTransactionTracking: v },
            })
          }
        />
      </Section>

      <Section title="Data" emoji="📡">
        <div className="text-[11px] text-muted-foreground">
          Moby never shares your wallet activity with third parties. Your data is encrypted at rest and in transit.
        </div>
        <button
          onClick={() => useMoby.getState().pushToast({ title: "Data export started", description: "Your data will be downloaded as JSON.", type: "info" })}
          className="w-full py-2 rounded-lg border border-border text-xs font-semibold hover:bg-surface-2"
        >
          Download my data
        </button>
        <button
          onClick={() => useMoby.getState().pushToast({ title: "Account deletion", description: "This is a demo — no real account was deleted.", type: "warn" })}
          className="w-full py-2 rounded-lg border border-bear/30 text-bear text-xs font-semibold hover:bg-bear/10"
        >
          Delete account
        </button>
      </Section>
    </div>
  );
}

function DisplaySettings({
  settings,
  setSettings,
}: {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;
}) {
  return (
    <div className="space-y-4">
      <Section title="Currency" emoji="💵">
        <div className="flex gap-1.5">
          {(["USD", "EUR", "JPY", "CNY"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setSettings({ display: { ...settings.display, currency: c } })}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-semibold border",
                settings.display.currency === c
                  ? "bg-bull/15 text-bull border-bull/30"
                  : "bg-surface-2 text-muted-foreground border-border"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Layout" emoji="📐">
        <Toggle
          label="Compact mode"
          desc="Tighter spacing for power users"
          value={settings.display.compactMode}
          onChange={(v) => setSettings({ display: { ...settings.display, compactMode: v } })}
        />
        <Toggle
          label="Show sparklines"
          desc="Mini charts in token lists"
          value={settings.display.showSparklines}
          onChange={(v) => setSettings({ display: { ...settings.display, showSparklines: v } })}
        />
      </Section>
    </div>
  );
}

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
        <span>{emoji}</span>
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-surface-2 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">{desc}</div>
      </div>
      <div
        className={cn(
          "h-5 w-9 rounded-full p-0.5 transition-colors shrink-0",
          value ? "bg-bull" : "bg-surface-3"
        )}
      >
        <div
          className={cn(
            "h-4 w-4 rounded-full bg-white transition-transform",
            value && "translate-x-4"
          )}
        />
      </div>
    </button>
  );
}
