/**
 * Haptic Feedback System
 * iOS/Android vibration patterns for trade, alert, error
 */

export interface HapticPattern {
  name: string;
  pattern: number | number[];
  description: string;
}

export interface HapticConfig {
  enabled: boolean;
  intensity: 'light' | 'medium' | 'heavy';
  patterns: Record<string, HapticPattern>;
}

class HapticFeedback {
  private config: HapticConfig;
  private supported = false;
  private audioContext: AudioContext | null = null;

  constructor(config?: Partial<HapticConfig>) {
    this.config = {
      enabled: true,
      intensity: 'medium',
      patterns: {
        // Trade feedback
        trade_buy: { name: 'Trade Buy', pattern: [10, 50, 10], description: 'Buy executed - double tap' },
        trade_sell: { name: 'Trade Sell', pattern: [20, 30, 20], description: 'Sell executed - double tap longer' },
        trade_partial: { name: 'Partial Fill', pattern: [15], description: 'Partial fill - single tap' },
        trade_failed: { name: 'Trade Failed', pattern: [50, 50, 50, 50], description: 'Trade failed - error pattern' },
        
        // Alert feedback
        alert_price: { name: 'Price Alert', pattern: [30, 100, 30], description: 'Price alert triggered' },
        alert_smart_money: { name: 'Smart Money', pattern: [10, 50, 10, 50, 10], description: 'Smart money activity' },
        alert_launch: { name: 'New Launch', pattern: [100, 50, 100], description: 'New token launch detected' },
        alert_security: { name: 'Security Warning', pattern: [200, 100, 200], description: 'Security score dropped' },
        
        // Navigation
        nav_tab: { name: 'Tab Switch', pattern: 10, description: 'Tab navigation' },
        nav_back: { name: 'Back Navigation', pattern: 15, description: 'Edge swipe back' },
        nav_refresh: { name: 'Pull Refresh', pattern: 20, description: 'Pull to refresh' },
        nav_modal_open: { name: 'Modal Open', pattern: [10, 30, 10], description: 'Modal opened' },
        nav_modal_close: { name: 'Modal Close', pattern: 10, description: 'Modal closed' },
        
        // Actions
        action_confirm: { name: 'Confirm', pattern: [10, 50, 10], description: 'Action confirmed' },
        action_cancel: { name: 'Cancel', pattern: 30, description: 'Action cancelled' },
        action_copy: { name: 'Copy', pattern: [5, 10, 5], description: 'Copied to clipboard' },
        action_save: { name: 'Save', pattern: [10, 50, 10], description: 'Settings saved' },
        
        // Errors & warnings
        error: { name: 'Error', pattern: [50, 50, 50, 50], description: 'General error' },
        warning: { name: 'Warning', pattern: [30, 30, 30], description: 'Warning' },
        success: { name: 'Success', pattern: [10, 50, 10], description: 'Success' },
        
        // Sliders & inputs
        slider_snap: { name: 'Slider Snap', pattern: 5, description: 'Slider hit tick' },
        input_focus: { name: 'Input Focus', pattern: 8, description: 'Input field focused' },
        
        // Long press
        long_press: { name: 'Long Press', pattern: 30, description: 'Long press detected' },
      },
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.checkSupport();
    }
  }

  private checkSupport(): void {
    // Check Vibration API
    this.supported = 'vibrate' in navigator;
    
    // Check for haptic feedback on iOS (requires user interaction)
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // iOS supports vibration but with limitations
      this.supported = true;
    }
  }

  // Core vibration method
  vibrate(pattern: number | number[]): boolean {
    if (!this.config.enabled || !this.supported) return false;

    try {
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.warn('[Haptic] Vibration failed:', error);
      return false;
    }
  }

  // Play named pattern
  play(patternName: string): boolean {
    const pattern = this.config.patterns[patternName];
    if (!pattern) {
      console.warn('[Haptic] Pattern not found:', patternName);
      return false;
    }
    return this.vibrate(pattern.pattern);
  }

  // Predefined feedback methods
  // Trade feedback
  tradeBuy(): boolean { return this.play('trade_buy'); }
  tradeSell(): boolean { return this.play('trade_sell'); }
  tradePartial(): boolean { return this.play('trade_partial'); }
  tradeFailed(): boolean { return this.play('trade_failed'); }

  // Alert feedback
  alertPrice(): boolean { return this.play('alert_price'); }
  alertSmartMoney(): boolean { return this.play('alert_smart_money'); }
  alertLaunch(): boolean { return this.play('alert_launch'); }
  alertSecurity(): boolean { return this.play('alert_security'); }

  // Navigation feedback
  navTab(): boolean { return this.play('nav_tab'); }
  navBack(): boolean { return this.play('nav_back'); }
  navRefresh(): boolean { return this.play('nav_refresh'); }
  navModalOpen(): boolean { return this.play('nav_modal_open'); }
  navModalClose(): boolean { return this.play('nav_modal_close'); }

  // Action feedback
  actionConfirm(): boolean { return this.play('action_confirm'); }
  actionCancel(): boolean { return this.play('action_cancel'); }
  actionCopy(): boolean { return this.play('action_copy'); }
  actionSave(): boolean { return this.play('action_save'); }

  // Status feedback
  success(): boolean { return this.play('success'); }
  warning(): boolean { return this.play('warning'); }
  error(): boolean { return this.play('error'); }

  // UI feedback
  sliderSnap(): boolean { return this.play('slider_snap'); }
  inputFocus(): boolean { return this.play('input_focus'); }
  longPress(): boolean { return this.play('long_press'); }

  // Custom pattern
  custom(pattern: number | number[]): boolean {
    return this.vibrate(pattern);
  }

  // Intensity control
  setIntensity(intensity: 'light' | 'medium' | 'heavy'): void {
    this.config.intensity = intensity;
    // Adjust all patterns based on intensity
    const multipliers = { light: 0.5, medium: 1, heavy: 1.5 };
    const multiplier = multipliers[intensity];
    
    for (const key of Object.keys(this.config.patterns)) {
      const pattern = this.config.patterns[key];
      if (Array.isArray(pattern.pattern)) {
        pattern.pattern = pattern.pattern.map(v => Math.round(v * multiplier));
      } else {
        pattern.pattern = Math.round(pattern.pattern * multiplier);
      }
    }
  }

  // Enable/disable
  enable(): void { this.config.enabled = true; }
  disable(): void { this.config.enabled = false; }
  isEnabled(): boolean { return this.config.enabled; }
  isSupported(): boolean { return this.supported; }

  // Get all patterns
  getPatterns(): Record<string, HapticPattern> {
    return { ...this.config.patterns };
  }

  // Add custom pattern
  addPattern(name: string, pattern: number | number[], description: string): void {
    this.config.patterns[name] = { name, pattern, description };
  }

  // Remove pattern
  removePattern(name: string): boolean {
    return delete this.config.patterns[name];
  }

  // Audio fallback for desktop (Web Audio API)
  async playAudioFeedback(type: 'click' | 'pop' | 'success' | 'error' | 'warning'): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = this.audioContext;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;
      
      switch (type) {
        case 'click':
          oscillator.frequency.setValueAtTime(800, now);
          oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.05);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          oscillator.stop(now + 0.05);
          break;
        case 'pop':
          oscillator.frequency.setValueAtTime(1200, now);
          oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.03);
          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
          oscillator.stop(now + 0.03);
          break;
        case 'success':
          oscillator.frequency.setValueAtTime(523, now); // C5
          oscillator.frequency.setValueAtTime(659, now + 0.1); // E5
          oscillator.frequency.setValueAtTime(784, now + 0.2); // G5
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          oscillator.stop(now + 0.4);
          break;
        case 'error':
          oscillator.frequency.setValueAtTime(400, now);
          oscillator.frequency.setValueAtTime(300, now + 0.1);
          oscillator.frequency.setValueAtTime(200, now + 0.2);
          gainNode.gain.setValueAtTime(0.2, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          oscillator.stop(now + 0.4);
          break;
        case 'warning':
          oscillator.frequency.setValueAtTime(600, now);
          oscillator.frequency.setValueAtTime(500, now + 0.15);
          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          oscillator.stop(now + 0.3);
          break;
      }

      oscillator.start(now);
    } catch (error) {
      console.warn('[Haptic] Audio feedback failed:', error);
    }
  }

  // Combined haptic + audio feedback
  async feedback(action: string): Promise<void> {
    // Try haptic first
    const hapticPlayed = this.play(action);
    
    // On desktop, also play audio
    if (!this.supported || /Mac|Windows|Linux/.test(navigator.userAgent)) {
      const audioMap: Record<string, 'click' | 'pop' | 'success' | 'error' | 'warning'> = {
        trade_buy: 'success',
        trade_sell: 'success',
        trade_failed: 'error',
        alert_price: 'pop',
        alert_smart_money: 'pop',
        alert_security: 'warning',
        nav_tab: 'click',
        nav_back: 'click',
        nav_refresh: 'pop',
        action_confirm: 'success',
        action_cancel: 'click',
        success: 'success',
        error: 'error',
        warning: 'warning',
      };
      
      const audioType = audioMap[action] || 'click';
      await this.playAudioFeedback(audioType);
    }
  }
}

// Singleton
let hapticFeedbackInstance: HapticFeedback | null = null;

export function getHapticFeedback(config?: Partial<HapticConfig>): HapticFeedback {
  if (!hapticFeedbackInstance) {
    hapticFeedbackInstance = new HapticFeedback(config);
  }
  return hapticFeedbackInstance;
}

// React hook
export function useHapticFeedback(config?: Partial<HapticConfig>) {
  const haptic = getHapticFeedback(config);
  
  return {
    // Core
    vibrate: (pattern: number | number[]) => haptic.vibrate(pattern),
    play: (name: string) => haptic.play(name),
    custom: (pattern: number | number[]) => haptic.custom(pattern),
    
    // Trade
    tradeBuy: () => haptic.tradeBuy(),
    tradeSell: () => haptic.tradeSell(),
    tradePartial: () => haptic.tradePartial(),
    tradeFailed: () => haptic.tradeFailed(),
    
    // Alerts
    alertPrice: () => haptic.alertPrice(),
    alertSmartMoney: () => haptic.alertSmartMoney(),
    alertLaunch: () => haptic.alertLaunch(),
    alertSecurity: () => haptic.alertSecurity(),
    
    // Navigation
    navTab: () => haptic.navTab(),
    navBack: () => haptic.navBack(),
    navRefresh: () => haptic.navRefresh(),
    navModalOpen: () => haptic.navModalOpen(),
    navModalClose: () => haptic.navModalClose(),
    
    // Actions
    actionConfirm: () => haptic.actionConfirm(),
    actionCancel: () => haptic.actionCancel(),
    actionCopy: () => haptic.actionCopy(),
    actionSave: () => haptic.actionSave(),
    
    // Status
    success: () => haptic.success(),
    warning: () => haptic.warning(),
    error: () => haptic.error(),
    
    // UI
    sliderSnap: () => haptic.sliderSnap(),
    inputFocus: () => haptic.inputFocus(),
    longPress: () => haptic.longPress(),
    
    // Combined
    feedback: (action: string) => haptic.feedback(action),
    
    // Config
    setIntensity: (intensity: 'light' | 'medium' | 'heavy') => haptic.setIntensity(intensity),
    enable: () => haptic.enable(),
    disable: () => haptic.disable(),
    isEnabled: () => haptic.isEnabled(),
    isSupported: () => haptic.isSupported(),
    getPatterns: () => haptic.getPatterns(),
    addPattern: (name: string, pattern: number | number[], description: string) => haptic.addPattern(name, pattern, description),
    removePattern: (name: string) => haptic.removePattern(name),
  };
}

export type { HapticPattern, HapticConfig };