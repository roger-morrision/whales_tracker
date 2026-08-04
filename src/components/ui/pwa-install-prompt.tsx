'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Download, X, Smartphone, Monitor, CheckCircle2 } from 'lucide-react';

interface PWAInstallPromptProps {
  className?: string;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export function PWAInstallPrompt({ className, onInstall, onDismiss }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const dismissedKey = 'pwa-install-dismissed';

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    
    if (isStandalone || isInWebAppiOS) {
      // Defer to avoid synchronous setState in effect
      setTimeout(() => {
        setIsInstalled(true);
      }, 0);
      return;
    }

    // Check if dismissed
    const dismissed = localStorage.getItem(dismissedKey);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Re-show after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Detect iOS
    // Defer to avoid synchronous setState in effect
    setTimeout(() => {
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }, 0);

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      onInstall?.();
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onInstall]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      onInstall?.();
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(dismissedKey, Date.now().toString());
    onDismiss?.();
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div 
      className={cn(
        'fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-4 duration-300',
        className
      )}
      role="dialog"
      aria-label="Install Moby app"
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-bull/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6 text-bull" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Install Moby</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Add to home screen for instant access, offline support & push notifications
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg hover:bg-surface-2 text-muted-foreground transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <FeatureIcon icon={Monitor} label="Desktop-like" />
            <FeatureIcon icon={CheckCircle2} label="Offline ready" />
            <FeatureIcon icon={Smartphone} label="Native feel" />
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={handleInstall}
              className="flex-1 bg-bull text-background font-semibold py-3 px-4 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Install App
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Later
            </button>
          </div>

          {isIOS && (
            <div className="mt-4 p-3 bg-surface-2 rounded-xl text-xs text-center text-muted-foreground">
              <p>On iOS: Tap <span className="font-mono bg-background px-1.5 py-0.5 rounded">Share</span> → <span className="font-mono bg-background px-1.5 py-0.5 rounded">Add to Home Screen</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureIcon({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-surface-2">
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// Hook for PWA install
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = React.useState(false);
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    
    if (isStandalone || isInWebAppiOS) {
      // Defer to avoid synchronous setState in effect
      setTimeout(() => {
        setIsInstalled(true);
      }, 0);
      return;
    }

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = React.useCallback(async () => {
    if (!deferredPrompt) return false;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      return true;
    }
    
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable,
    isInstalled,
    install,
  };
}

// Type for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}