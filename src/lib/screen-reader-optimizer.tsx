/**
 * Screen Reader Optimization
 * Full ARIA tree, live regions for prices/alerts, skip links
 */
import React from 'react';

export interface A11yConfig {
  announcePriceChanges: boolean;
  announceAlerts: boolean;
  announcePortfolioChanges: boolean;
  verboseMode: boolean;
  language: string;
}

export interface LiveRegionConfig {
  politeness: 'off' | 'polite' | 'assertive';
  atomic: boolean;
  relevant: 'additions' | 'removals' | 'text' | 'all';
}

class ScreenReaderOptimizer {
  private config: A11yConfig;
  private liveRegions: Map<string, HTMLElement> = new Map();
  private priceAnnouncements: Map<string, { price: number; timestamp: number }> = new Map();
  private announcementQueue: string[] = [];
  private isAnnouncing = false;
  private subscribers: Set<(message: string, priority: 'polite' | 'assertive') => void> = new Set();

  constructor(config?: Partial<A11yConfig>) {
    this.config = {
      announcePriceChanges: true,
      announceAlerts: true,
      announcePortfolioChanges: true,
      verboseMode: false,
      language: 'en',
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    this.createLiveRegions();
    this.setupSkipLinks();
    this.enhanceFocusManagement();
    this.setupKeyboardNavigation();
  }

  private createLiveRegions(): void {
    // Price announcements (polite)
    this.createLiveRegion('price-announcer', {
      politeness: 'polite',
      atomic: true,
      relevant: 'additions',
    });

    // Critical alerts (assertive)
    this.createLiveRegion('alert-announcer', {
      politeness: 'assertive',
      atomic: true,
      relevant: 'additions',
    });

    // Portfolio updates (polite)
    this.createLiveRegion('portfolio-announcer', {
      politeness: 'polite',
      atomic: false,
      relevant: 'additions text',
    });

    // Status updates (polite)
    this.createLiveRegion('status-announcer', {
      politeness: 'polite',
      atomic: true,
      relevant: 'additions',
    });

    // Trade confirmations (assertive)
    this.createLiveRegion('trade-announcer', {
      politeness: 'assertive',
      atomic: true,
      relevant: 'additions',
    });
  }

  private createLiveRegion(id: string, config: LiveRegionConfig): HTMLElement {
    let region = document.getElementById(id);
    if (!region) {
      region = document.createElement('div');
      region.id = id;
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', config.politeness);
      region.setAttribute('aria-atomic', config.atomic.toString());
      region.setAttribute('aria-relevant', config.relevant);
      region.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(region);
    }
    this.liveRegions.set(id, region);
    return region;
  }

  private setupSkipLinks(): void {
    // Add skip links at the top of the page
    if (!document.getElementById('skip-links')) {
      const skipLinks = document.createElement('nav');
      skipLinks.id = 'skip-links';
      skipLinks.setAttribute('aria-label', 'Skip links');
      skipLinks.style.cssText = `
        position: absolute;
        top: -100%;
        left: 0;
        right: 0;
        z-index: 10000;
        padding: 1rem;
        background: var(--background);
        border-bottom: 1px solid var(--border);
      `;
      
      skipLinks.innerHTML = `
        <ul style="display: flex; gap: 1rem; list-style: none; margin: 0; padding: 0;">
          <li><a href="#main-content" style="color: var(--primary); text-decoration: underline;">Skip to main content</a></li>
          <li><a href="#navigation" style="color: var(--primary); text-decoration: underline;">Skip to navigation</a></li>
          <li><a href="#portfolio" style="color: var(--primary); text-decoration: underline;">Skip to portfolio</a></li>
          <li><a href="#trading" style="color: var(--primary); text-decoration: underline;">Skip to trading</a></li>
          <li><a href="#alerts" style="color: var(--primary); text-decoration: underline;">Skip to alerts</a></li>
        </ul>
      `;
      
      // Show on focus
      const style = document.createElement('style');
      style.textContent = `
        #skip-links:focus-within { top: 0; }
        #skip-links a:focus { 
          position: absolute; 
          top: 1rem; 
          left: 1rem; 
          background: var(--primary); 
          color: var(--primary-foreground); 
          padding: 0.5rem 1rem; 
          border-radius: 0.25rem; 
          z-index: 10001;
        }
      `;
      document.head.appendChild(style);
      
      document.body.insertBefore(skipLinks, document.body.firstChild);
    }
  }

  private enhanceFocusManagement(): void {
    // Trap focus in modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (modal) {
          this.trapFocus(modal as HTMLElement, e);
        }
      }
      
      // Escape to close modals
      if (e.key === 'Escape') {
        const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (modal) {
          const closeBtn = modal.querySelector('[data-close], [aria-label="Close"]') as HTMLElement;
          if (closeBtn) closeBtn.click();
        }
      }
    });

    // Announce route changes
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        this.announce('Page changed', 'polite');
        lastUrl = currentUrl;
      }
    }).observe(document, { subtree: true, childList: true });
  }

  private trapFocus(element: HTMLElement, event: KeyboardEvent): void {
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }

  private setupKeyboardNavigation(): void {
    // Add keyboard hints
    const style = document.createElement('style');
    style.textContent = `
      /* Focus visible for keyboard users */
      :focus:not(:focus-visible) { outline: none; }
      :focus-visible { 
        outline: 2px solid var(--primary); 
        outline-offset: 2px; 
      }
      
      /* Skip link styles */
      .skip-link { 
        position: absolute; 
        top: -100%; 
        left: 50%; 
        transform: translateX(-50%); 
        padding: 0.75rem 1.5rem; 
        background: var(--primary); 
        color: var(--primary-foreground); 
        border-radius: 0.5rem; 
        z-index: 10000; 
        text-decoration: none; 
        font-weight: 500;
      }
      .skip-link:focus { top: 1rem; }
      
      /* Screen reader only */
      .sr-only { 
        position: absolute; 
        width: 1px; 
        height: 1px; 
        padding: 0; 
        margin: -1px; 
        overflow: hidden; 
        clip: rect(0, 0, 0, 0); 
        white-space: nowrap; 
        border: 0; 
      }
    `;
    document.head.appendChild(style);
  }

  // Announcement methods
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const regionId = priority === 'assertive' ? 'alert-announcer' : 'status-announcer';
    const region = this.liveRegions.get(regionId);
    
    if (region) {
      // Clear and set new message
      region.textContent = '';
      // Force reflow
      void region.offsetHeight;
      region.textContent = message;
    }

    // Also notify subscribers
    for (const sub of this.subscribers) {
      try { sub(message, priority); } catch (e) { console.error('[A11y] Subscriber error:', e); }
    }
  }

  announcePriceChange(symbol: string, oldPrice: number, newPrice: number): void {
    if (!this.config.announcePriceChanges) return;

    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    const direction = change >= 0 ? 'up' : 'down';
    const absChange = Math.abs(change).toFixed(2);
    
    const message = `${symbol} ${direction} ${absChange}% to $${newPrice.toFixed(newPrice < 0.01 ? 6 : newPrice < 1 ? 4 : 2)}`;
    
    // Throttle announcements for same token
    const lastAnnouncement = this.priceAnnouncements.get(symbol);
    const now = Date.now();
    if (lastAnnouncement && now - lastAnnouncement.timestamp < 5000) {
      return; // Skip if announced recently
    }
    
    this.priceAnnouncements.set(symbol, { price: newPrice, timestamp: now });
    this.announce(message, 'polite');
  }

  announceAlert(alert: { token?: string; message: string; type: string }): void {
    if (!this.config.announceAlerts) return;
    
    let message = alert.message;
    if (alert.token) {
      message = `${alert.token}: ${message}`;
    }
    
    this.announce(`Alert: ${message}`, 'assertive');
  }

  announceTrade(trade: { side: 'buy' | 'sell'; token: string; amount: number; price: number; status: 'submitted' | 'filled' | 'failed' }): void {
    const action = trade.side === 'buy' ? 'Bought' : 'Sold';
    const statusText = trade.status === 'filled' ? 'filled' : trade.status === 'submitted' ? 'submitted' : 'failed';
    
    let message = `${action} ${trade.amount} ${trade.token} at $${trade.price.toFixed(4)} - ${statusText}`;
    
    if (trade.status === 'failed') {
      message += '. Please check your positions.';
    }
    
    this.announce(message, trade.status === 'failed' ? 'assertive' : 'polite');
  }

  announcePortfolioChange(change: { totalValue: number; change24h: number; topMover?: { symbol: string; change: number } }): void {
    if (!this.config.announcePortfolioChanges) return;

    const direction = change.change24h >= 0 ? 'up' : 'down';
    let message = `Portfolio value $${change.totalValue.toLocaleString()}, ${direction} ${Math.abs(change.change24h).toFixed(2)}% today`;
    
    if (change.topMover) {
      const moverDir = change.topMover.change >= 0 ? 'up' : 'down';
      message += `. Biggest mover: ${change.topMover.symbol} ${moverDir} ${Math.abs(change.topMover.change).toFixed(1)}%`;
    }
    
    this.announce(message, 'polite');
  }

  announcePositionUpdate(position: { token: string; pnl: number; pnlPercent: number; action?: string }): void {
    const direction = position.pnl >= 0 ? 'profit' : 'loss';
    let message = `${position.token} ${direction} of $${Math.abs(position.pnl).toFixed(2)} (${Math.abs(position.pnlPercent).toFixed(1)}%)`;
    
    if (position.action) {
      message += `, ${position.action}`;
    }
    
    this.announce(message, 'polite');
  }

  // ARIA helpers
  setAriaLabel(element: HTMLElement, label: string): void {
    element.setAttribute('aria-label', label);
  }

  setAriaDescribedBy(element: HTMLElement, descriptionId: string): void {
    element.setAttribute('aria-describedby', descriptionId);
  }

  setAriaExpanded(element: HTMLElement, expanded: boolean): void {
    element.setAttribute('aria-expanded', expanded.toString());
  }

  setAriaSelected(element: HTMLElement, selected: boolean): void {
    element.setAttribute('aria-selected', selected.toString());
  }

  setAriaPressed(element: HTMLElement, pressed: boolean): void {
    element.setAttribute('aria-pressed', pressed.toString());
  }

  setAriaChecked(element: HTMLElement, checked: boolean): void {
    element.setAttribute('aria-checked', checked.toString());
  }

  setAriaDisabled(element: HTMLElement, disabled: boolean): void {
    element.setAttribute('aria-disabled', disabled.toString());
    if (disabled) {
      element.setAttribute('tabindex', '-1');
    } else {
      element.removeAttribute('tabindex');
    }
  }

  // Create accessible description element
  createDescription(text: string): HTMLElement {
    const id = `desc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const desc = document.createElement('div');
    desc.id = id;
    desc.className = 'sr-only';
    desc.textContent = text;
    document.body.appendChild(desc);
    return desc;
  }

  // Announce loading states
  announceLoading(context: string): void {
    this.announce(`Loading ${context}...`, 'polite');
  }

  announceLoaded(context: string): void {
    this.announce(`${context} loaded`, 'polite');
  }

  announceError(context: string, error?: string): void {
    this.announce(`Error loading ${context}${error ? `: ${error}` : ''}`, 'assertive');
  }

  // Subscriptions
  onAnnouncement(callback: (message: string, priority: 'polite' | 'assertive') => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Config
  setConfig(config: Partial<A11yConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): A11yConfig {
    return { ...this.config };
  }
}

// Singleton
let screenReaderOptimizerInstance: ScreenReaderOptimizer | null = null;

export function getScreenReaderOptimizer(config?: Partial<A11yConfig>): ScreenReaderOptimizer {
  if (!screenReaderOptimizerInstance) {
    screenReaderOptimizerInstance = new ScreenReaderOptimizer(config);
  }
  return screenReaderOptimizerInstance;
}

// React hook
export function useScreenReaderOptimizer(config?: Partial<A11yConfig>) {
  const optimizer = getScreenReaderOptimizer(config);
  
  return {
    announce: (message: string, priority?: 'polite' | 'assertive') => optimizer.announce(message, priority),
    announcePriceChange: (symbol: string, oldPrice: number, newPrice: number) => optimizer.announcePriceChange(symbol, oldPrice, newPrice),
    announceAlert: (alert: any) => optimizer.announceAlert(alert),
    announceTrade: (trade: any) => optimizer.announceTrade(trade),
    announcePortfolioChange: (change: any) => optimizer.announcePortfolioChange(change),
    announcePositionUpdate: (position: any) => optimizer.announcePositionUpdate(position),
    announceLoading: (context: string) => optimizer.announceLoading(context),
    announceLoaded: (context: string) => optimizer.announceLoaded(context),
    announceError: (context: string, error?: string) => optimizer.announceError(context, error),
    setAriaLabel: (element: HTMLElement, label: string) => optimizer.setAriaLabel(element, label),
    setAriaDescribedBy: (element: HTMLElement, id: string) => optimizer.setAriaDescribedBy(element, id),
    setAriaExpanded: (element: HTMLElement, expanded: boolean) => optimizer.setAriaExpanded(element, expanded),
    setAriaSelected: (element: HTMLElement, selected: boolean) => optimizer.setAriaSelected(element, selected),
    setAriaPressed: (element: HTMLElement, pressed: boolean) => optimizer.setAriaPressed(element, pressed),
    setAriaChecked: (element: HTMLElement, checked: boolean) => optimizer.setAriaChecked(element, checked),
    setAriaDisabled: (element: HTMLElement, disabled: boolean) => optimizer.setAriaDisabled(element, disabled),
    createDescription: (text: string) => optimizer.createDescription(text),
    onAnnouncement: (callback: (message: string, priority: 'polite' | 'assertive') => void) => optimizer.onAnnouncement(callback),
    setConfig: (config: Partial<A11yConfig>) => optimizer.setConfig(config),
    getConfig: () => optimizer.getConfig(),
  };
}

export type { A11yConfig, LiveRegionConfig };

// React components for accessibility
export function LiveRegion({ 
  id, 
  politeness = 'polite', 
  atomic = true, 
  children 
}: { 
  id: string; 
  politeness?: 'off' | 'polite' | 'assertive'; 
  atomic?: boolean; 
  children?: React.ReactNode; 
}) {
  return (
    <div
      id={id}
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      style={{
        position: 'absolute',
        left: -10000,
        width: 1,
        height: 1,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

export function SkipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a 
      href={href} 
      className="skip-link"
    >
      {children}
    </a>
  );
}

export function SkipLinks() {
  return (
    <nav id="skip-links" aria-label="Skip links" style={{ position: 'absolute', top: -10000, left: 0, right: 0, zIndex: 10000 }}>
      <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', margin: 0, padding: '1rem', background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
        <li><SkipLink href="#main-content">Skip to main content</SkipLink></li>
        <li><SkipLink href="#navigation">Skip to navigation</SkipLink></li>
        <li><SkipLink href="#portfolio">Skip to portfolio</SkipLink></li>
        <li><SkipLink href="#trading">Skip to trading</SkipLink></li>
        <li><SkipLink href="#alerts">Skip to alerts</SkipLink></li>
      </ul>
      <style jsx>{`
        #skip-links:focus-within { top: 0; }
        #skip-links a:focus { 
          position: absolute; top: 1rem; left: 1rem; 
          background: var(--primary); color: var(--primary-foreground); 
          padding: 0.5rem 1rem; border-radius: 0.25rem; z-index: 10001;
        }
      `}</style>
    </nav>
  );
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only" style={{
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }}>
      {children}
    </span>
  );
}