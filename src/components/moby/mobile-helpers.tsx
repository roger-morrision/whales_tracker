"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/**
 * Pull-to-refresh hook for mobile.
 * Usage:
 * const { pullDistance, isRefreshing, refresh } = usePullToRefresh(() => fetchData());
 * <div style={{ transform: `translateY(${pullDistance}px)` }} onTouchStart={...}>
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0 && diff < 120) {
      setPullDistance(diff * 0.5); // Damping
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance > 60) {
      setIsRefreshing(true);
      setPullDistance(40);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  return {
    pullDistance,
    isRefreshing,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

/**
 * Haptic feedback hook.
 * Usage: const { vibrate } = useHaptics();
 * vibrate("success"); // on trade confirmation
 */
export function useHaptics() {
  const vibrate = useCallback((pattern: "success" | "error" | "warning" | "selection" | "light") => {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;

    const patterns: Record<string, number | number[]> = {
      success: [10, 30, 10], // Double tap
      error: [50, 50, 50], // Triple buzz
      warning: [30], // Single buzz
      selection: [5], // Very light tap
      light: [10], // Light tap
    };

    navigator.vibrate(patterns[pattern] || 10);
  }, []);

  return { vibrate };
}

/**
 * Hook to detect if running as installed PWA
 */
export function useIsPWA() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const checkPWA = () => {
      return window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
    };
    Promise.resolve().then(() => setIsPWA(checkPWA()));

    const handler = (e: MediaQueryListEvent) => setIsPWA(e.matches);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", handler);
    return () => window.matchMedia("(display-mode: standalone)").removeEventListener("change", handler);
  }, []);

  return isPWA;
}
