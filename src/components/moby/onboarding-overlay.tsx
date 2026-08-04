'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  ChevronRight, ChevronLeft, X, Check, 
  Zap, Users, Shield, Brain, Target,
  SkipForward, SkipBack
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  element?: string; // CSS selector for highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

interface OnboardingProps {
  steps: OnboardingStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  storageKey?: string;
  autoStart?: boolean;
  className?: string;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Moby',
    description: 'Your mobile-first crypto trading intelligence platform. Track smart money, whales, and token analytics on Solana.',
    position: 'center',
  },
  {
    id: 'discover',
    title: 'Discover Tokens',
    description: 'Browse trending tokens, new launches, and smart money picks. Filter by narratives, risk level, and timeframes.',
    element: '[data-onboarding="discover"]',
    position: 'bottom',
  },
  {
    id: 'whales',
    title: 'Track Smart Money',
    description: 'Follow whale wallets, KOLs, and smart money flows in real-time. See who\'s buying and selling before the market moves.',
    element: '[data-onboarding="whales"]',
    position: 'bottom',
  },
  {
    id: 'portfolio',
    title: 'Portfolio Analytics',
    description: 'Track your PnL, unrealized gains, risk metrics, and tax reports. Connect your wallet for automatic sync.',
    element: '[data-onboarding="portfolio"]',
    position: 'bottom',
  },
  {
    id: 'trade',
    title: 'Lightning Fast Trading',
    description: 'Execute swaps with Jupiter Ultra API. MEV protection, priority fees, and real-time quotes.',
    element: '[data-onboarding="trade"]',
    position: 'top',
  },
  {
    id: 'alerts',
    title: 'Smart Alerts',
    description: 'Set price alerts, smart money entry notifications, and whale accumulation signals. Never miss a move.',
    element: '[data-onboarding="alerts"]',
    position: 'top',
  },
  {
    id: 'complete',
    title: 'You\'re Ready!',
    description: 'Start exploring tokens, tracking whales, and trading with confidence. Tap the help icon anytime for a refresher.',
    position: 'center',
  },
];

export function OnboardingOverlay({ 
  steps = DEFAULT_STEPS,
  onComplete,
  onSkip,
  storageKey = 'moby-onboarding-completed',
  autoStart = true,
  className 
}: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed && autoStart) {
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, [storageKey, autoStart]);

  useEffect(() => {
      if (!isVisible) return;

      const step = steps[currentStep];
      if (step.element) {
        const el = document.querySelector(step.element) as HTMLElement;
        // Defer to avoid synchronous setState in effect
        setTimeout(() => {
          setHighlightedElement(el);
        }, 0);
        // Scroll into view if needed
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Defer to avoid synchronous setState in effect
        setTimeout(() => {
          setHighlightedElement(null);
        }, 0);
      }
    }, [currentStep, isVisible, steps]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const skipOnboarding = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    onSkip?.();
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn('fixed inset-0 z-50 flex items-center justify-center', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
      >
        {/* Background overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/90 backdrop-blur-sm"
          onClick={skipOnboarding}
        />

        {/* Highlighted element overlay */}
        {highlightedElement && (
          <HighlightOverlay element={highlightedElement} position={step.position} />
        )}

        {/* Onboarding card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-md mx-4 sm:mx-0 z-10"
        >
          <div className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Progress indicator */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <button
                  onClick={skipOnboarding}
                  className="p-1 rounded-lg hover:bg-surface-2 text-muted-foreground transition-colors"
                  aria-label="Skip onboarding"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <motion.div
                  key={currentStep}
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                  className="h-full bg-bull rounded-full"
                />
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="text-center">
                <StepIcon stepId={step.id} className="w-16 h-16 mx-auto mb-4" />
                <h2 id="onboarding-title" className="text-xl font-bold">{step.title}</h2>
                <p id="onboarding-description" className="text-muted-foreground mt-2 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Action button for interactive steps */}
              {step.action && (
                <button
                  onClick={step.action}
                  className="w-full bg-bull/10 text-bull font-semibold py-3 px-4 rounded-xl hover:bg-bull/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Try it now
                </button>
              )}
            </div>

            {/* Navigation */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <button
                onClick={prevStep}
                disabled={isFirst}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors',
                  isFirst
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <motion.button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      i === currentStep
                        ? 'bg-bull w-6'
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    )}
                    aria-label={`Go to step ${i + 1}`}
                    aria-current={i === currentStep ? 'step' : undefined}
                  />
                ))}
              </div>

              <button
                onClick={isLast ? completeOnboarding : nextStep}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-bull text-background hover:opacity-90 transition-opacity"
              >
                {isLast ? 'Get Started' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Highlight overlay for targeted elements
function HighlightOverlay({ element, position = 'center' }: { element: HTMLElement; position?: string }) {
  const rect = element.getBoundingClientRect();
  const padding = 8;
  const radius = 12;

  return (
    <>
      {/* Top */}
      <div className="fixed inset-0 pointer-events-none z-10" style={{
        clipPath: `polygon(0 0, 100% 0, 100% ${rect.top - padding}px, 0 ${rect.top - padding}px)`
      }}>
        <div className="absolute inset-0 bg-background/90" />
      </div>
      {/* Bottom */}
      <div className="fixed inset-0 pointer-events-none z-10" style={{
        clipPath: `polygon(0 ${rect.bottom + padding}px, 100% ${rect.bottom + padding}px, 100% 100%, 0 100%)`
      }}>
        <div className="absolute inset-0 bg-background/90" />
      </div>
      {/* Left */}
      <div className="fixed inset-0 pointer-events-none z-10" style={{
        clipPath: `polygon(0 ${rect.top - padding}px, ${rect.left - padding}px ${rect.top - padding}px, ${rect.left - padding}px ${rect.bottom + padding}px, 0 ${rect.bottom + padding}px)`
      }}>
        <div className="absolute inset-0 bg-background/90" />
      </div>
      {/* Right */}
      <div className="fixed inset-0 pointer-events-none z-10" style={{
        clipPath: `polygon(${rect.right + padding}px ${rect.top - padding}px, 100% ${rect.top - padding}px, 100% ${rect.bottom + padding}px, ${rect.right + padding}px ${rect.bottom + padding}px)`
      }}>
        <div className="absolute inset-0 bg-background/90" />
      </div>
      {/* Highlight ring */}
      <div className="fixed pointer-events-none z-20" style={{
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }}>
        <div className="absolute inset-0 rounded-xl border-2 border-bull/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.8)] animate-pulse" style={{ borderRadius: radius }} />
      </div>
    </>
  );
}

// Step-specific icons
function StepIcon({ stepId, className }: { stepId: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    welcome: <Zap className="w-full h-full text-bull" />,
    discover: <Target className="w-full h-full text-blue-400" />,
    whales: <Users className="w-full h-full text-purple-400" />,
    portfolio: <Shield className="w-full h-full text-green-400" />,
    trade: <Zap className="w-full h-full text-gold" />,
    alerts: <Brain className="w-full h-full text-pink-400" />,
    complete: <Check className="w-full h-full text-bull" />,
  };

  return (
    <div className={cn('rounded-2xl bg-gradient-to-br from-bull/20 to-gold/20 flex items-center justify-center', className)}>
      {icons[stepId] || icons.welcome}
    </div>
  );
}

// Hook for onboarding
export function useOnboarding(storageKey = 'moby-onboarding-completed') {
  const [completed, setCompleted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(storageKey);
    // Defer to avoid synchronous setState in effect
    setTimeout(() => {
      setCompleted(!!done);
    }, 0);
  }, [storageKey]);

  const start = () => setVisible(true);
  const complete = () => {
    localStorage.setItem(storageKey, 'true');
    setCompleted(true);
    setVisible(false);
  };
  const reset = () => {
    localStorage.removeItem(storageKey);
    setCompleted(false);
  };

  return { completed, visible, setVisible, start, complete, reset };
}

// Contextual help tooltip
interface HelpTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click';
  className?: string;
}

export function HelpTooltip({ 
  children, 
  content, 
  position = 'top',
  trigger = 'hover',
  className 
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
          tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={triggerRef}>
      {React.cloneElement(children as React.ReactElement, {
        onClick: trigger === 'click' ? () => setOpen(!open) : undefined,
        onMouseEnter: trigger === 'hover' ? () => setOpen(true) : undefined,
        onMouseLeave: trigger === 'hover' ? () => setOpen(false) : undefined,
      })}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? -8 : 8 }}
            ref={tooltipRef}
            className={cn(
              'fixed z-50 px-3 py-2 text-sm text-background bg-foreground rounded-lg shadow-lg',
              'whitespace-nowrap max-w-xs',
              position === 'top' && 'bottom-full mb-2',
              position === 'bottom' && 'top-full mt-2',
              position === 'left' && 'right-full mr-2',
              position === 'right' && 'left-full ml-2',
            )}
            style={{ zIndex: 50 }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}