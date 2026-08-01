"use client";

import { useState } from "react";
import { ArrowRight, Check, Sparkles, Wallet, Waves } from "lucide-react";
import { useMoby } from "@/lib/moby-store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: 0,
    emoji: "🐋",
    title: "Track smart money",
    description:
      "Follow the wallets that actually make money. Moby scores wallets by their realized PnL, win rate, and timing — so you can see what the best traders are doing in real time.",
    accent: "from-[#14F195] to-[#22D3EE]",
    icon: Waves,
  },
  {
    id: 1,
    emoji: "⚡",
    title: "Get signals before the crowd",
    description:
      "Get alerted the moment smart money enters a position. Cluster buys, whale accumulations, and early entries land in your Signals tab before they show up on Twitter.",
    accent: "from-[#22D3EE] to-[#9945FF]",
    icon: Sparkles,
  },
  {
    id: 2,
    emoji: "👻",
    title: "Connect your wallet",
    description:
      "Track your full portfolio across Solana, Ethereum, and Base — crypto, NFTs, and even pre-IPO stocks. Get AI-powered insights on your holdings and tax estimates.",
    accent: "from-[#9945FF] to-[#14F195]",
    icon: Wallet,
  },
];

export function OnboardingOverlay() {
  const onboarded = useMoby((s) => s.onboarded);
  const setOnboarded = useMoby((s) => s.setOnboarded);
  const setWalletOpen = useMoby((s) => s.setWalletOpen);
  const [step, setStep] = useState(0);

  if (onboarded) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = () => {
    if (isLast) {
      setOnboarded(true);
      // Open wallet connect as the natural next step
      setTimeout(() => setWalletOpen(true), 300);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <AnimatePresence>
      {!onboarded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative w-full max-w-sm text-center"
          >
            {/* Logo + step indicator */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className={cn("h-20 w-20 rounded-2xl bg-gradient-to-br grid place-items-center text-4xl shadow-2xl", current.accent)}>
                  {current.emoji}
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === step ? "w-6 bg-bull" : i < step ? "w-1.5 bg-bull/40" : "w-1.5 bg-surface-3"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h1 className="text-2xl font-bold mb-3">{current.title}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 px-2">
                {current.description}
              </p>
            </motion.div>

            {/* Feature bullets */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-xl border p-2 transition-colors",
                      i === step
                        ? "border-bull/30 bg-bull/5"
                        : i < step
                        ? "border-bull/20 bg-bull/5 opacity-60"
                        : "border-border opacity-40"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 mx-auto mb-1", i === step ? "text-bull" : "text-muted-foreground")} />
                    <div className="text-[9px] font-medium text-muted-foreground truncate">{s.title}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 py-3 rounded-xl bg-bull text-background text-sm font-bold hover:opacity-90 flex items-center justify-center gap-2"
              >
                {isLast ? (
                  <>
                    Get started <Check className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {step === 0 && (
              <button
                onClick={() => setOnboarded(true)}
                className="mt-3 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Skip intro →
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
