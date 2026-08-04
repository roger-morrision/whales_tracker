/**
 * iOS/Android Home Screen Icons
 * Maskable icons, splash screens, shortcuts
 */

export interface IconConfig {
  purpose: 'any' | 'maskable' | 'monochrome';
  sizes: string;
  src: string;
  type: string;
}

export interface SplashScreenConfig {
  src: string;
  media: string;
  sizes: string;
}

export interface ShortcutConfig {
  name: string;
  short_name: string;
  description: string;
  url: string;
  icons: IconConfig[];
}

export interface PWAManifestConfig {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'portrait' | 'landscape' | 'any';
  background_color: string;
  theme_color: string;
  scope: string;
  icons: IconConfig[];
  splash_screens?: SplashScreenConfig[];
  shortcuts?: ShortcutConfig[];
  categories?: string[];
  screenshots?: { src: string; sizes: string; type: string; form_factor: 'wide' | 'narrow' }[];
  prefer_related_applications?: boolean;
  related_applications?: { platform: 'play' | 'itunes' | 'webapp'; url: string; id?: string }[];
}

class PWAIconManager {
  private config: PWAManifestConfig;
  private linkElements: Map<string, HTMLLinkElement> = new Map();

  constructor(config?: Partial<PWAManifestConfig>) {
    this.config = {
      name: 'Whales Tracker',
      short_name: 'Whales',
      description: 'Solana whale tracking and trading terminal',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0f172a',
      theme_color: '#1e3a5f',
      scope: '/',
      icons: [
        { purpose: 'any', sizes: '48x48', src: '/icons/icon-48.png', type: 'image/png' },
        { purpose: 'any', sizes: '72x72', src: '/icons/icon-72.png', type: 'image/png' },
        { purpose: 'any', sizes: '96x96', src: '/icons/icon-96.png', type: 'image/png' },
        { purpose: 'any', sizes: '128x128', src: '/icons/icon-128.png', type: 'image/png' },
        { purpose: 'any', sizes: '144x144', src: '/icons/icon-144.png', type: 'image/png' },
        { purpose: 'any', sizes: '152x152', src: '/icons/icon-152.png', type: 'image/png' },
        { purpose: 'any', sizes: '192x192', src: '/icons/icon-192.png', type: 'image/png' },
        { purpose: 'any', sizes: '384x384', src: '/icons/icon-384.png', type: 'image/png' },
        { purpose: 'any', sizes: '512x512', src: '/icons/icon-512.png', type: 'image/png' },
        // Maskable icons (for Android adaptive icons)
        { purpose: 'maskable', sizes: '192x192', src: '/icons/icon-192-maskable.png', type: 'image/png' },
        { purpose: 'maskable', sizes: '512x512', src: '/icons/icon-512-maskable.png', type: 'image/png' },
        // Monochrome (for Safari pinned tabs)
        { purpose: 'monochrome', sizes: '192x192', src: '/icons/icon-192-mono.png', type: 'image/png' },
        { purpose: 'monochrome', sizes: '512x512', src: '/icons/icon-512-mono.png', type: 'image/png' },
      ],
      splash_screens: [
        { src: '/splashes/splash-640x1136.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)', sizes: '640x1136' },
        { src: '/splashes/splash-750x1334.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)', sizes: '750x1334' },
        { src: '/splashes/splash-828x1792.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)', sizes: '828x1792' },
        { src: '/splashes/splash-1125x2436.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)', sizes: '1125x2436' },
        { src: '/splashes/splash-1242x2208.png', media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)', sizes: '1242x2208' },
        { src: '/splashes/splash-1242x2688.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)', sizes: '1242x2688' },
        { src: '/splashes/splash-1536x2048.png', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)', sizes: '1536x2048' },
        { src: '/splashes/splash-1668x2224.png', media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)', sizes: '1668x2224' },
        { src: '/splashes/splash-1668x2388.png', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)', sizes: '1668x2388' },
        { src: '/splashes/splash-2048x2732.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)', sizes: '2048x2732' },
      ],
      shortcuts: [
        {
          name: 'Portfolio',
          short_name: 'Portfolio',
          description: 'View your portfolio',
          url: '/portfolio',
          icons: [{ purpose: 'any', sizes: '96x96', src: '/icons/shortcut-portfolio.png', type: 'image/png' }],
        },
        {
          name: 'Trade',
          short_name: 'Trade',
          description: 'Quick trade',
          url: '/trade',
          icons: [{ purpose: 'any', sizes: '96x96', src: '/icons/shortcut-trade.png', type: 'image/png' }],
        },
        {
          name: 'Snipe',
          short_name: 'Snipe',
          description: 'Launch sniper',
          url: '/snipe',
          icons: [{ purpose: 'any', sizes: '96x96', src: '/icons/shortcut-snipe.png', type: 'image/png' }],
        },
        {
          name: 'Alerts',
          short_name: 'Alerts',
          description: 'Price alerts',
          url: '/alerts',
          icons: [{ purpose: 'any', sizes: '96x96', src: '/icons/shortcut-alerts.png', type: 'image/png' }],
        },
      ],
      categories: ['finance', 'business', 'productivity'],
      screenshots: [
        { src: '/screenshots/home-wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide' },
        { src: '/screenshots/portfolio-wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide' },
        { src: '/screenshots/trading-narrow.png', sizes: '750x1334', type: 'image/png', form_factor: 'narrow' },
        { src: '/screenshots/alerts-narrow.png', sizes: '750x1334', type: 'image/png', form_factor: 'narrow' },
      ],
      prefer_related_applications: false,
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    this.updateManifest();
    this.addAppleTouchIcons();
    this.addTileIcons();
    this.addThemeColor();
  }

  private updateManifest(): void {
    // Update or create manifest link
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    // Generate manifest JSON
    const manifest = this.generateManifest();
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/manifest+json' });
    const url = URL.createObjectURL(blob);
    manifestLink.href = url;
  }

  private generateManifest(): any {
    return {
      name: this.config.name,
      short_name: this.config.short_name,
      description: this.config.description,
      start_url: this.config.start_url,
      display: this.config.display,
      orientation: this.config.orientation,
      background_color: this.config.background_color,
      theme_color: this.config.theme_color,
      scope: this.config.scope,
      icons: this.config.icons.map(icon => ({
        src: icon.src,
        sizes: icon.sizes,
        type: icon.type,
        purpose: icon.purpose,
      })),
      shortcuts: this.config.shortcuts?.map(shortcut => ({
        name: shortcut.name,
        short_name: shortcut.short_name,
        description: shortcut.description,
        url: shortcut.url,
        icons: shortcut.icons.map(icon => ({
          src: icon.src,
          sizes: icon.sizes,
          type: icon.type,
          purpose: icon.purpose,
        })),
      })),
      categories: this.config.categories,
      screenshots: this.config.screenshots,
      prefer_related_applications: this.config.prefer_related_applications,
      related_applications: this.config.related_applications,
    };
  }

  private addAppleTouchIcons(): void {
    // Apple touch icons for iOS home screen
    const sizes = [57, 60, 72, 76, 114, 120, 144, 152, 180, 192, 512];
    
    for (const size of sizes) {
      const rel = size >= 180 ? 'apple-touch-icon' : 'apple-touch-icon';
      const href = `/icons/apple-touch-icon-${size}x${size}.png`;
      
      this.updateLinkElement(`apple-touch-icon-${size}`, {
        rel,
        sizes: `${size}x${size}`,
        href,
      });
    }

    // Apple touch icon precomposed (legacy)
    this.updateLinkElement('apple-touch-icon-precomposed', {
      rel: 'apple-touch-icon-precomposed',
      href: '/icons/apple-touch-icon-180x180.png',
    });

    // Apple mobile web app capable
    this.updateMetaElement('apple-mobile-web-app-capable', 'yes');
    this.updateMetaElement('apple-mobile-web-app-status-bar-style', 'black-translucent');
    this.updateMetaElement('apple-mobile-web-app-title', this.config.short_name);
  }

  private addTileIcons(): void {
    // Windows tile icons
    const tileSizes = [70, 150, 310, 558];
    for (const size of tileSizes) {
      this.updateMetaElement(`msapplication-TileImage`, `/icons/tile-${size}x${size}.png`);
    }
    this.updateMetaElement('msapplication-TileColor', this.config.theme_color);
    this.updateMetaElement('msapplication-config', '/browserconfig.xml');
  }

  private addThemeColor(): void {
    // Theme color for browser UI
    this.updateMetaElement('theme-color', this.config.theme_color, { media: '(prefers-color-scheme: light)' });
    this.updateMetaElement('theme-color', '#0f172a', { media: '(prefers-color-scheme: dark)' });
  }

  private updateLinkElement(id: string, attrs: Record<string, string>): void {
    let link = this.linkElements.get(id);
    
    if (!link) {
      link = document.createElement('link');
      this.linkElements.set(id, link);
      document.head.appendChild(link);
    }

    for (const [key, value] of Object.entries(attrs)) {
      link.setAttribute(key, value);
    }
  }

  private updateMetaElement(name: string, content: string, attrs?: Record<string, string>): void {
    let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    
    meta.content = content;
    
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        meta.setAttribute(key, value);
      }
    }
  }

  // Dynamic updates
  updateThemeColor(color: string, media?: string): void {
    this.updateMetaElement('theme-color', color, media ? { media } : undefined);
    this.config.theme_color = color;
  }

  updateShortcuts(shortcuts: typeof this.config.shortcuts): void {
    this.config.shortcuts = shortcuts;
    this.updateManifest();
  }

  addShortcut(shortcut: typeof this.config.shortcuts[0]): void {
    if (!this.config.shortcuts) this.config.shortcuts = [];
    this.config.shortcuts.push(shortcut);
    this.updateManifest();
  }

  removeShortcut(name: string): void {
    if (!this.config.shortcuts) return;
    this.config.shortcuts = this.config.shortcuts.filter(s => s.name !== name);
    this.updateManifest();
  }

  // Generate icon SVG programmatically
  generateIconSVG(size: number, options: {
    backgroundColor?: string;
    foregroundColor?: string;
    symbol?: string;
    maskable?: boolean;
  } = {}): string {
    const {
      backgroundColor = this.config.theme_color,
      foregroundColor = '#ffffff',
      symbol = '🐋',
      maskable = false,
    } = options;

    const safeZone = maskable ? 0.4 : 0; // Maskable icons need 40% safe zone
    const padding = size * safeZone;
    const iconSize = size - padding * 2;

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="${backgroundColor}"/>
        ${maskable ? `<rect x="${padding}" y="${padding}" width="${iconSize}" height="${iconSize}" fill="none" stroke="${foregroundColor}" stroke-width="2"/>` : ''}
        <text 
          x="${size / 2}" 
          y="${size / 2 + size * 0.15}" 
          font-size="${iconSize * 0.6}" 
          text-anchor="middle" 
          dominant-baseline="middle"
          fill="${foregroundColor}"
          font-family="system-ui, sans-serif"
        >
          ${symbol}
        </text>
      </svg>
    `;
  }

  // Generate all icons as data URLs
  generateAllIcons(): Map<string, string> {
    const icons = new Map<string, string>();
    const sizes = [48, 72, 96, 128, 144, 152, 192, 384, 512];

    for (const size of sizes) {
      // Regular
      icons.set(`icon-${size}.png`, this.generateIconSVG(size));
      
      // Maskable
      icons.set(`icon-${size}-maskable.png`, this.generateIconSVG(size, { maskable: true }));
      
      // Monochrome (simplified)
      icons.set(`icon-${size}-mono.png`, this.generateIconSVG(size, { 
        backgroundColor: 'transparent',
        foregroundColor: '#000000',
      }));
    }

    // Apple touch icons
    const appleSizes = [57, 60, 72, 76, 114, 120, 144, 152, 180];
    for (const size of appleSizes) {
      icons.set(`apple-touch-icon-${size}x${size}.png`, this.generateIconSVG(size));
    }

    // Windows tiles
    const tileSizes = [70, 150, 310, 558];
    for (const size of tileSizes) {
      icons.set(`tile-${size}x${size}.png`, this.generateIconSVG(size, { 
        backgroundColor: this.config.theme_color,
        foregroundColor: '#ffffff',
      }));
    }

    return icons;
  }

  // Get manifest as JSON
  getManifest(): string {
    return JSON.stringify(this.generateManifest(), null, 2);
  }

  // Save manifest to file (for build process)
  async saveManifest(path: string = '/public/manifest.json'): Promise<void> {
    const manifest = this.getManifest();
    // In production, this would write to filesystem
    console.log('[PWA Icons] Manifest:', manifest);
  }
}

// Singleton
let pwaIconManagerInstance: PWAIconManager | null = null;

export function getPWAIconManager(config?: Partial<PWAManifestConfig>): PWAIconManager {
  if (!pwaIconManagerInstance) {
    pwaIconManagerInstance = new PWAIconManager(config);
  }
  return pwaIconManagerInstance;
}

// React hook
export function usePWAIcons(config?: Partial<PWAManifestConfig>) {
  const manager = getPWAIconManager(config);
  
  return {
    updateThemeColor: (color: string, media?: string) => manager.updateThemeColor(color, media),
    updateShortcuts: (shortcuts: any[]) => manager.updateShortcuts(shortcuts),
    addShortcut: (shortcut: any) => manager.addShortcut(shortcut),
    removeShortcut: (name: string) => manager.removeShortcut(name),
    generateIconSVG: (size: number, options?: any) => manager.generateIconSVG(size, options),
    generateAllIcons: () => manager.generateAllIcons(),
    getManifest: () => manager.getManifest(),
    saveManifest: (path?: string) => manager.saveManifest(path),
  };
}

export type { PWAManifestConfig, IconConfig, SplashScreenConfig, ShortcutConfig };

// React component for PWA meta tags
export function PWAMetaTags({ 
  config 
}: { 
  config?: Partial<PWAManifestConfig>; 
}) {
  const manager = getPWAIconManager(config);
  
  // This component just ensures the manager is initialized
  // The actual meta tags are injected by the manager
  return null;
}

// Browser config for Windows tiles
export const BROWSER_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/icons/tile-70x70.png"/>
      <square150x150logo src="/icons/tile-150x150.png"/>
      <square310x310logo src="/icons/tile-310x310.png"/>
      <wide310x150logo src="/icons/tile-558x150.png"/>
      <TileColor>${'#1e3a5f'}</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;