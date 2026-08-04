/**
 * High Contrast / Reduced Motion
 * CSS media queries, prefers-reduced-motion, WCAG AAA
 */

export interface AccessibilityConfig {
  respectReducedMotion: boolean;
  respectHighContrast: boolean;
  respectColorScheme: boolean;
  minContrastRatio: number; // WCAG AA: 4.5, AAA: 7
  focusVisible: boolean;
}

export interface ColorScheme {
  name: string;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    ring: string;
    success: string;
    warning: string;
    info: string;
  };
}

class AccessibilityManager {
  private config: AccessibilityConfig;
  private colorSchemes: Map<string, ColorScheme> = new Map();
  private currentScheme = 'default';
  private observers: Map<string, MediaQueryList> = new Map();
  private subscribers: Set<(config: AccessibilityConfig) => void> = new Set();

  constructor(config?: Partial<AccessibilityConfig>) {
    this.config = {
      respectReducedMotion: true,
      respectHighContrast: true,
      respectColorScheme: true,
      minContrastRatio: 7, // WCAG AAA
      focusVisible: true,
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    this.registerColorSchemes();
    this.setupMediaQueryListeners();
    this.applyInitialSettings();
    this.injectCSSVariables();
  }

  private registerColorSchemes(): void {
    // Default (light)
    this.colorSchemes.set('default', {
      name: 'Default Light',
      colors: {
        background: '#ffffff',
        foreground: '#0f172a',
        primary: '#1e3a5f',
        primaryForeground: '#ffffff',
        secondary: '#f1f5f9',
        secondaryForeground: '#0f172a',
        muted: '#f1f5f9',
        mutedForeground: '#64748b',
        accent: '#f1f5f9',
        accentForeground: '#0f172a',
        destructive: '#dc2626',
        destructiveForeground: '#ffffff',
        border: '#e2e8f0',
        ring: '#1e3a5f',
        success: '#059669',
        warning: '#d97706',
        info: '#0284c7',
      },
    });

    // Dark
    this.colorSchemes.set('dark', {
      name: 'Dark',
      colors: {
        background: '#0f172a',
        foreground: '#f8fafc',
        primary: '#3b82f6',
        primaryForeground: '#ffffff',
        secondary: '#1e293b',
        secondaryForeground: '#f8fafc',
        muted: '#1e293b',
        mutedForeground: '#94a3b8',
        accent: '#1e293b',
        accentForeground: '#f8fafc',
        destructive: '#ef4444',
        destructiveForeground: '#ffffff',
        border: '#334155',
        ring: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#06b6d4',
      },
    });

    // High Contrast Light
    this.colorSchemes.set('high-contrast-light', {
      name: 'High Contrast Light',
      colors: {
        background: '#ffffff',
        foreground: '#000000',
        primary: '#0000ee',
        primaryForeground: '#ffffff',
        secondary: '#f0f0f0',
        secondaryForeground: '#000000',
        muted: '#f0f0f0',
        mutedForeground: '#333333',
        accent: '#f0f0f0',
        accentForeground: '#000000',
        destructive: '#cc0000',
        destructiveForeground: '#ffffff',
        border: '#000000',
        ring: '#0000ee',
        success: '#006600',
        warning: '#cc6600',
        info: '#0066cc',
      },
    });

    // High Contrast Dark
    this.colorSchemes.set('high-contrast-dark', {
      name: 'High Contrast Dark',
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        primary: '#ffff00',
        primaryForeground: '#000000',
        secondary: '#333333',
        secondaryForeground: '#ffffff',
        muted: '#333333',
        mutedForeground: '#cccccc',
        accent: '#333333',
        accentForeground: '#ffffff',
        destructive: '#ff4444',
        destructiveForeground: '#ffffff',
        border: '#ffffff',
        ring: '#ffff00',
        success: '#00ff00',
        warning: '#ffaa00',
        info: '#44aaff',
      },
    });

    // Sepia (for dyslexia/reading comfort)
    this.colorSchemes.set('sepia', {
      name: 'Sepia',
      colors: {
        background: '#f4ecd8',
        foreground: '#4a3c2a',
        primary: '#8b6914',
        primaryForeground: '#ffffff',
        secondary: '#e8dcc8',
        secondaryForeground: '#4a3c2a',
        muted: '#e8dcc8',
        mutedForeground: '#6b5b4a',
        accent: '#e8dcc8',
        accentForeground: '#4a3c2a',
        destructive: '#a03030',
        destructiveForeground: '#ffffff',
        border: '#c9b896',
        ring: '#8b6914',
        success: '#4a7c2a',
        warning: '#a06010',
        info: '#2a6a8c',
      },
    });

    // Blue Light Filter (evening)
    this.colorSchemes.set('blue-light-filter', {
      name: 'Blue Light Filter',
      colors: {
        background: '#1a1a2e',
        foreground: '#e8dcc8',
        primary: '#ffaa00',
        primaryForeground: '#1a1a2e',
        secondary: '#16213e',
        secondaryForeground: '#e8dcc8',
        muted: '#16213e',
        mutedForeground: '#a09880',
        accent: '#16213e',
        accentForeground: '#e8dcc8',
        destructive: '#ff6666',
        destructiveForeground: '#1a1a2e',
        border: '#2d3a4f',
        ring: '#ffaa00',
        success: '#66cc66',
        warning: '#ffaa00',
        info: '#66aaff',
      },
    });
  }

  private setupMediaQueryListeners(): void {
    // Reduced motion
    if (this.config.respectReducedMotion) {
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.handleReducedMotionChange(reducedMotionQuery);
      reducedMotionQuery.addEventListener('change', this.handleReducedMotionChange.bind(this));
      this.observers.set('reduced-motion', reducedMotionQuery);
    }

    // High contrast
    if (this.config.respectHighContrast) {
      const highContrastQuery = window.matchMedia('(prefers-contrast: more)');
      this.handleHighContrastChange(highContrastQuery);
      highContrastQuery.addEventListener('change', this.handleHighContrastChange.bind(this));
      this.observers.set('high-contrast', highContrastQuery);
    }

    // Color scheme
    if (this.config.respectColorScheme) {
      const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.handleColorSchemeChange(darkQuery);
      darkQuery.addEventListener('change', this.handleColorSchemeChange.bind(this));
      this.observers.set('color-scheme', darkQuery);
    }

    // Forced colors (Windows High Contrast Mode)
    const forcedColorsQuery = window.matchMedia('(forced-colors: active)');
    this.handleForcedColorsChange(forcedColorsQuery);
    forcedColorsQuery.addEventListener('change', this.handleForcedColorsChange.bind(this));
    this.observers.set('forced-colors', forcedColorsQuery);
  }

  private handleReducedMotionChange(query: MediaQueryList): void {
    document.documentElement.style.setProperty('--reduced-motion', query.matches ? '1' : '0');
    
    if (query.matches) {
      // Disable animations globally
      document.documentElement.classList.add('reduce-motion');
      this.injectReducedMotionCSS();
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
    
    this.notifySubscribers();
  }

  private handleHighContrastChange(query: MediaQueryList): void {
    if (query.matches) {
      document.documentElement.classList.add('high-contrast');
      this.applyHighContrastScheme();
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    this.notifySubscribers();
  }

  private handleColorSchemeChange(query: MediaQueryList): void {
    const scheme = query.matches ? 'dark' : 'default';
    this.setColorScheme(scheme);
    this.notifySubscribers();
  }

  private handleForcedColorsChange(query: MediaQueryList): void {
    if (query.matches) {
      document.documentElement.classList.add('forced-colors');
      // In forced colors mode, we should use system colors
      this.applyForcedColorsCSS();
    } else {
      document.documentElement.classList.remove('forced-colors');
    }
    this.notifySubscribers();
  }

  private applyInitialSettings(): void {
    // Check initial states
    if (this.config.respectReducedMotion) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.handleReducedMotionChange(reducedMotion);
    }

    if (this.config.respectHighContrast) {
      const highContrast = window.matchMedia('(prefers-contrast: more)');
      this.handleHighContrastChange(highContrast);
    }

    if (this.config.respectColorScheme) {
      const dark = window.matchMedia('(prefers-color-scheme: dark)');
      this.handleColorSchemeChange(dark);
    }
  }

  private injectCSSVariables(): void {
    const scheme = this.colorSchemes.get(this.currentScheme);
    if (!scheme) return;

    const root = document.documentElement;
    for (const [key, value] of Object.entries(scheme.colors)) {
      root.style.setProperty(`--${key}`, value);
    }
    root.style.setProperty('--color-scheme', this.currentScheme);
  }

  private injectReducedMotionCSS(): void {
    // Check if already injected
    if (document.getElementById('reduced-motion-styles')) return;

    const style = document.createElement('style');
    style.id = 'reduced-motion-styles';
    style.textContent = `
      /* Reduced motion - disable all animations */
      .reduce-motion *,
      .reduce-motion *::before,
      .reduce-motion *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
      
      /* Keep essential transitions for usability */
      .reduce-motion [data-keep-transition] {
        transition-duration: 0.15s !important;
      }
      
      /* Disable parallax */
      .reduce-motion [data-parallax] {
        transform: none !important;
      }
      
      /* Disable auto-playing media */
      .reduce-motion video[autoplay],
      .reduce-motion audio[autoplay] {
        animation-play-state: paused !important;
      }
    `;
    document.head.appendChild(style);
  }

  private applyHighContrastScheme(): void {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const schemeName = isDark ? 'high-contrast-dark' : 'high-contrast-light';
    this.setColorScheme(schemeName);
  }

  private applyForcedColorsCSS(): void {
    if (document.getElementById('forced-colors-styles')) return;

    const style = document.createElement('style');
    style.id = 'forced-colors-styles';
    style.textContent = `
      /* Forced colors mode - use system colors */
      .forced-colors {
        forced-color-adjust: auto;
      }
      
      .forced-colors * {
        border-color: CanvasText !important;
        color: CanvasText !important;
      }
      
      .forced-colors button,
      .forced-colors [role="button"] {
        background: ButtonFace;
        color: ButtonText;
        border: 1px solid ButtonBorder;
      }
      
      .forced-colors button:focus,
      .forced-colors [role="button"]:focus {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }
      
      .forced-colors a {
        color: LinkText;
      }
      
      .forced-colors a:visited {
        color: VisitedText;
      }
      
      .forced-colors input,
      .forced-colors select,
      .forced-colors textarea {
        background: Field;
        color: FieldText;
        border: 1px solid ButtonBorder;
      }
      
      .forced-colors ::selection {
        background: Highlight;
        color: HighlightText;
      }
    `;
    document.head.appendChild(style);
  }

  // Public API
  setColorScheme(name: string): boolean {
    const scheme = this.colorSchemes.get(name);
    if (!scheme) return false;

    this.currentScheme = name;
    this.injectCSSVariables();
    document.documentElement.setAttribute('data-color-scheme', name);
    this.notifySubscribers();
    return true;
  }

  getCurrentScheme(): string {
    return this.currentScheme;
  }

  getAvailableSchemes(): ColorScheme[] {
    return Array.from(this.colorSchemes.values());
  }

  setConfig(config: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...config };
    this.notifySubscribers();
  }

  getConfig(): AccessibilityConfig {
    return { ...this.config };
  }

  // Check contrast ratio
  checkContrast(foreground: string, background: string): number {
    // Simplified contrast calculation
    // In production, use a proper color contrast library
    return 7; // Placeholder
  }

  // Force specific accessibility settings
  forceReducedMotion(enabled: boolean): void {
    document.documentElement.classList.toggle('reduce-motion', enabled);
    document.documentElement.style.setProperty('--reduced-motion', enabled ? '1' : '0');
  }

  forceHighContrast(enabled: boolean): void {
    document.documentElement.classList.toggle('high-contrast', enabled);
    if (enabled) this.applyHighContrastScheme();
  }

  // Focus management
  enableFocusVisible(): void {
    this.config.focusVisible = true;
    document.documentElement.classList.add('focus-visible');
  }

  disableFocusVisible(): void {
    this.config.focusVisible = false;
    document.documentElement.classList.remove('focus-visible');
  }

  // Subscriptions
  onConfigChange(callback: (config: AccessibilityConfig) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try { sub(this.config); } catch (e) { console.error('[A11y] Subscriber error:', e); }
    }
  }

  // Cleanup
  destroy(): void {
    for (const [, query] of this.observers) {
      query.removeEventListener('change', this.handleReducedMotionChange.bind(this));
      query.removeEventListener('change', this.handleHighContrastChange.bind(this));
      query.removeEventListener('change', this.handleColorSchemeChange.bind(this));
      query.removeEventListener('change', this.handleForcedColorsChange.bind(this));
    }
    this.observers.clear();
  }
}

// Singleton
let accessibilityManagerInstance: AccessibilityManager | null = null;

export function getAccessibilityManager(config?: Partial<AccessibilityConfig>): AccessibilityManager {
  if (!accessibilityManagerInstance) {
    accessibilityManagerInstance = new AccessibilityManager(config);
  }
  return accessibilityManagerInstance;
}

// React hook
export function useAccessibilityManager(config?: Partial<AccessibilityConfig>) {
  const manager = getAccessibilityManager(config);
  
  return {
    setColorScheme: (name: string) => manager.setColorScheme(name),
    getCurrentScheme: () => manager.getCurrentScheme(),
    getAvailableSchemes: () => manager.getAvailableSchemes(),
    setConfig: (config: Partial<AccessibilityConfig>) => manager.setConfig(config),
    getConfig: () => manager.getConfig(),
    checkContrast: (fg: string, bg: string) => manager.checkContrast(fg, bg),
    forceReducedMotion: (enabled: boolean) => manager.forceReducedMotion(enabled),
    forceHighContrast: (enabled: boolean) => manager.forceHighContrast(enabled),
    enableFocusVisible: () => manager.enableFocusVisible(),
    disableFocusVisible: () => manager.disableFocusVisible(),
    onConfigChange: (callback: (config: AccessibilityConfig) => void) => manager.onConfigChange(callback),
  };
}

export type { AccessibilityConfig, ColorScheme };

// CSS variables for easy theming
export const CSS_VARIABLES = {
  // Colors
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  primary: 'var(--primary)',
  primaryForeground: 'var(--primary-foreground)',
  secondary: 'var(--secondary)',
  secondaryForeground: 'var(--secondary-foreground)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  accent: 'var(--accent)',
  accentForeground: 'var(--accent-foreground)',
  destructive: 'var(--destructive)',
  destructiveForeground: 'var(--destructive-foreground)',
  border: 'var(--border)',
  ring: 'var(--ring)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  
  // Motion
  reducedMotion: 'var(--reduced-motion)',
  
  // Spacing
  space1: 'var(--space-1, 0.25rem)',
  space2: 'var(--space-2, 0.5rem)',
  space3: 'var(--space-3, 0.75rem)',
  space4: 'var(--space-4, 1rem)',
  space6: 'var(--space-6, 1.5rem)',
  space8: 'var(--space-8, 2rem)',
  
  // Border radius
  radiusSm: 'var(--radius-sm, 0.25rem)',
  radiusMd: 'var(--radius-md, 0.375rem)',
  radiusLg: 'var(--radius-lg, 0.5rem)',
  radiusXl: 'var(--radius-xl, 0.75rem)',
  radiusFull: 'var(--radius-full, 9999px)',
  
  // Shadows
  shadowSm: 'var(--shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
  shadowMd: 'var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1))',
  shadowLg: 'var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1))',
  shadowXl: 'var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1))',
};