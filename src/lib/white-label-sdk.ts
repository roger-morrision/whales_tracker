/**
 * White-Label SDK
 * Embeddable widget: <MobyWidget token="WIF" /> for partners
 */

export interface WidgetConfig {
  // Required
  token?: string; // Token mint or symbol
  
  // Display
  theme?: 'light' | 'dark' | 'auto';
  size?: 'compact' | 'standard' | 'full';
  layout?: 'price' | 'chart' | 'orderbook' | 'trade' | 'portfolio' | 'full';
  
  // Features
  showPrice?: boolean;
  showChart?: boolean;
  showOrderBook?: boolean;
  showTrade?: boolean;
  showPortfolio?: boolean;
  showSmartMoney?: boolean;
  showAlerts?: boolean;
  
  // Chart options
  chartTimeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
  chartType?: 'candlestick' | 'line' | 'area';
  chartIndicators?: string[];
  
  // Trading
  enabledExchanges?: string[];
  defaultSlippageBps?: number;
  defaultAmount?: number;
  defaultCurrency?: 'USD' | 'SOL' | 'USDC';
  
  // Branding
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  hideBranding?: boolean;
  customCSS?: string;
  
  // Behavior
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
  readOnly?: boolean;
  requireAuth?: boolean;
  
  // Events
  onTrade?: (trade: WidgetTradeEvent) => void;
  onPriceChange?: (price: WidgetPriceEvent) => void;
  onError?: (error: WidgetErrorEvent) => void;
  onReady?: () => void;
  onAuthRequired?: () => void;
}

export interface WidgetTradeEvent {
  type: 'buy' | 'sell';
  token: string;
  amount: number;
  price: number;
  txHash: string;
  timestamp: number;
}

export interface WidgetPriceEvent {
  token: string;
  price: number;
  change24h: number;
  timestamp: number;
}

export interface WidgetErrorEvent {
  code: string;
  message: string;
  details?: any;
}

export interface SDKConfig {
  apiKey: string;
  environment?: 'production' | 'staging' | 'development';
  baseUrl?: string;
  cdnUrl?: string;
  version?: string;
}

export interface WidgetInstance {
  id: string;
  config: WidgetConfig;
  element: HTMLElement;
  iframe: HTMLIFrameElement;
  destroy: () => void;
  updateConfig: (config: Partial<WidgetConfig>) => void;
  getPrice: (token: string) => Promise<number>;
  executeTrade: (trade: { side: 'buy' | 'sell'; token: string; amount: number; slippage?: number }) => Promise<WidgetTradeEvent>;
  subscribe: (event: string, callback: (data: any) => void) => () => void;
}

class WhiteLabelSDK {
  private config: SDKConfig;
  private widgets: Map<string, WidgetInstance> = new Map();
  private eventHandlers: Map<string, ((...args: any[]) => void)[]> = new Map();
  private isInitialized = false;

  constructor(config: SDKConfig) {
    this.config = {
      environment: 'production',
      baseUrl: 'https://api.whales-tracker.com',
      cdnUrl: 'https://cdn.whales-tracker.com',
      version: '1.0.0',
      ...config,
    };
  }

  // Initialize SDK
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Validate API key
    const valid = await this.validateApiKey();
    if (!valid) {
      throw new Error('Invalid API key');
    }
    
    // Load widget runtime
    await this.loadWidgetRuntime();
    
    this.isInitialized = true;
    this.emit('ready');
  }

  private async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/sdk/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async loadWidgetRuntime(): Promise<void> {
    // In production, load from CDN
    // For now, inject widget styles
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById('whales-sdk-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'whales-sdk-styles';
    style.textContent = `
      .whales-widget-container {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 200px;
        border-radius: 8px;
        overflow: hidden;
        background: var(--widget-bg, #0f172a);
        font-family: var(--widget-font, system-ui, sans-serif);
        color: var(--widget-fg, #f8fafc);
      }
      .whales-widget-iframe {
        width: 100%;
        height: 100%;
        border: none;
        border-radius: inherit;
        background: transparent;
      }
      .whales-widget-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--widget-muted, #94a3b8);
      }
      .whales-widget-error {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--widget-destructive, #ef4444);
        padding: 1rem;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  // Create widget
  createWidget(element: HTMLElement | string, config: WidgetConfig): WidgetInstance {
    if (!this.isInitialized) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }

    const container = typeof element === 'string' 
      ? document.querySelector(element) 
      : element;
    
    if (!container) {
      throw new Error('Container element not found');
    }

    const widgetId = `widget_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'whales-widget-iframe';
    iframe.src = this.buildWidgetUrl(config);
    iframe.setAttribute('allow', 'clipboard-write; clipboard-read');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');

    // Clear container and add iframe
    container.innerHTML = '';
    container.className = 'whales-widget-container';
    container.style.setProperty('--widget-theme', config.theme || 'auto');
    container.style.setProperty('--widget-primary', config.primaryColor || '#1e3a5f');
    container.style.setProperty('--widget-bg', config.backgroundColor || '#0f172a');
    container.style.setProperty('--widget-font', config.fontFamily || 'system-ui, sans-serif');
    container.style.setProperty('--widget-radius', config.borderRadius || '8px');
    container.appendChild(iframe);

    // Apply custom CSS
    if (config.customCSS) {
      const style = document.createElement('style');
      style.textContent = config.customCSS;
      container.appendChild(style);
    }

    const instance: WidgetInstance = {
      id: widgetId,
      config,
      element: container as HTMLElement,
      iframe,
      destroy: () => this.destroyWidget(widgetId),
      updateConfig: (newConfig) => this.updateWidget(widgetId, newConfig),
      getPrice: (token) => this.getPrice(token),
      executeTrade: (trade) => this.executeTrade(widgetId, trade),
      subscribe: (event, callback) => this.subscribeToWidget(widgetId, event, callback),
    };

    this.widgets.set(widgetId, instance);
    
    // Handle iframe messages
    this.setupWidgetMessaging(widgetId, iframe);
    
    return instance;
  }

  private buildWidgetUrl(config: WidgetConfig): string {
    const params = new URLSearchParams();
    
    if (config.token) params.set('token', config.token);
    params.set('theme', config.theme || 'auto');
    params.set('size', config.size || 'standard');
    params.set('layout', config.layout || 'full');
    
    if (config.showPrice !== undefined) params.set('showPrice', String(config.showPrice));
    if (config.showChart !== undefined) params.set('showChart', String(config.showChart));
    if (config.showOrderBook !== undefined) params.set('showOrderBook', String(config.showOrderBook));
    if (config.showTrade !== undefined) params.set('showTrade', String(config.showTrade));
    if (config.showPortfolio !== undefined) params.set('showPortfolio', String(config.showPortfolio));
    if (config.showSmartMoney !== undefined) params.set('showSmartMoney', String(config.showSmartMoney));
    if (config.showAlerts !== undefined) params.set('showAlerts', String(config.showAlerts));
    
    if (config.chartTimeframe) params.set('chartTimeframe', config.chartTimeframe);
    if (config.chartType) params.set('chartType', config.chartType);
    if (config.chartIndicators) params.set('chartIndicators', config.chartIndicators.join(','));
    
    if (config.defaultSlippageBps) params.set('defaultSlippageBps', String(config.defaultSlippageBps));
    if (config.defaultAmount) params.set('defaultAmount', String(config.defaultAmount));
    if (config.defaultCurrency) params.set('defaultCurrency', config.defaultCurrency);
    
    if (config.autoRefresh !== undefined) params.set('autoRefresh', String(config.autoRefresh));
    if (config.refreshInterval) params.set('refreshInterval', String(config.refreshInterval));
    if (config.readOnly !== undefined) params.set('readOnly', String(config.readOnly));
    if (config.requireAuth !== undefined) params.set('requireAuth', String(config.requireAuth));
    if (config.hideBranding !== undefined) params.set('hideBranding', String(config.hideBranding));
    
    params.set('apiKey', this.config.apiKey);
    params.set('sdkVersion', this.config.version || '1.0.0');
    params.set('origin', window.location.origin);

    return `${this.config.cdnUrl}/widget.html?${params.toString()}`;
  }

  private setupWidgetMessaging(widgetId: string, iframe: HTMLIFrameElement): void {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      
      const { type, payload } = event.data;
      
      switch (type) {
        case 'ready':
          this.emit(`widget:${widgetId}:ready`, payload);
          if (this.widgets.get(widgetId)?.config.onReady) {
            this.widgets.get(widgetId)!.config.onReady!();
          }
          break;
        case 'trade':
          this.emit(`widget:${widgetId}:trade`, payload);
          if (this.widgets.get(widgetId)?.config.onTrade) {
            this.widgets.get(widgetId)!.config.onTrade!(payload);
          }
          break;
        case 'price_change':
          this.emit(`widget:${widgetId}:price_change`, payload);
          if (this.widgets.get(widgetId)?.config.onPriceChange) {
            this.widgets.get(widgetId)!.config.onPriceChange!(payload);
          }
          break;
        case 'error':
          this.emit(`widget:${widgetId}:error`, payload);
          if (this.widgets.get(widgetId)?.config.onError) {
            this.widgets.get(widgetId)!.config.onError!(payload);
          }
          break;
        case 'auth_required':
          this.emit(`widget:${widgetId}:auth_required`, payload);
          if (this.widgets.get(widgetId)?.config.onAuthRequired) {
            this.widgets.get(widgetId)!.config.onAuthRequired!();
          }
          break;
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Store handler for cleanup
    (iframe as any)._whalesMessageHandler = handleMessage;
  }

  private destroyWidget(widgetId: string): void {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;
    
    // Remove message listener
    const handler = widget.iframe._whalesMessageHandler;
    if (handler) {
      window.removeEventListener('message', handler);
    }
    
    // Remove iframe
    widget.iframe.remove();
    widget.element.innerHTML = '';
    widget.element.className = '';
    
    this.widgets.delete(widgetId);
  }

  private updateWidget(widgetId: string, newConfig: Partial<WidgetConfig>): void {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;
    
    widget.config = { ...widget.config, ...newConfig };
    widget.iframe.src = this.buildWidgetUrl(widget.config);
  }

  // Get real-time price
  async getPrice(token: string): Promise<number> {
    const response = await fetch(`${this.config.baseUrl}/v1/sdk/price?token=${encodeURIComponent(token)}`, {
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
    });
    const data = await response.json();
    return data.price;
  }

  // Execute trade through widget
  async executeTrade(widgetId: string, trade: { side: 'buy' | 'sell'; token: string; amount: number; slippage?: number }): Promise<WidgetTradeEvent> {
    const widget = this.widgets.get(widgetId);
    if (!widget) throw new Error('Widget not found');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Trade timeout')), 30000);
      
      const handler = (event: MessageEvent) => {
        if (event.source !== widget.iframe.contentWindow) return;
        if (event.data.type === 'trade_result') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          if (event.data.payload.success) {
            resolve(event.data.payload.trade);
          } else {
            reject(new Error(event.data.payload.error));
          }
        }
      };
      
      window.addEventListener('message', handler);
      widget.iframe.contentWindow?.postMessage({ type: 'execute_trade', payload: trade }, '*');
    });
  }

  // Subscribe to widget events
  subscribeToWidget(widgetId: string, event: string, callback: (data: any) => void): () => void {
    const handler = (data: any) => callback(data);
    this.on(`widget:${widgetId}:${event}`, handler);
    return () => this.off(`widget:${widgetId}:${event}`, handler);
  }

  // Event emitter
  private on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
    this.eventHandlers.get(event)!.push(handler);
  }

  private off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
  }

  private emit(event: string, payload: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try { handler(payload); } catch (e) { console.error('[SDK] Event handler error:', e); }
    }
  }

  // Get all widgets
  getWidgets(): WidgetInstance[] {
    return Array.from(this.widgets.values());
  }

  // Get widget by ID
  getWidget(widgetId: string): WidgetInstance | undefined {
    return this.widgets.get(widgetId);
  }

  // React component for easy integration
  static Widget = function WhalesWidget({ 
    config, 
    onTrade, 
    onPriceChange, 
    onError, 
    onReady,
    onAuthRequired,
    ...props 
  }: { 
    config: WidgetConfig;
    onTrade?: (trade: WidgetTradeEvent) => void;
    onPriceChange?: (price: WidgetPriceEvent) => void;
    onError?: (error: WidgetErrorEvent) => void;
    onReady?: () => void;
    onAuthRequired?: () => void;
  }) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const widgetRef = React.useRef<WidgetInstance | null>(null);
    const sdkRef = React.useRef<WhiteLabelSDK | null>(null);

    React.useEffect(() => {
      if (!containerRef.current) return;

      // Get or create SDK instance
      if (!sdkRef.current) {
        // In production, get from context/provider
        sdkRef.current = (window as any).__WHALES_SDK__;
      }
      
      if (!sdkRef.current) {
        console.error('Whales SDK not initialized. Call WhalesSDK.initialize() first.');
        return;
      }

      const widget = sdkRef.current.createWidget(containerRef.current, {
        ...config,
        onTrade,
        onPriceChange,
        onError,
        onReady,
        onAuthRequired,
      });
      
      widgetRef.current = widget;

      return () => {
        widget.destroy();
        widgetRef.current = null;
      };
    }, [config.token, config.theme, config.layout]);

    return React.createElement('div', { 
      ref: containerRef,
      style: { width: '100%', height: '100%', minHeight: 200, ...props.style },
      className: props.className,
    });
  };
}

// Provider component for React
export function WhalesSDKProvider({ 
  children, 
  apiKey, 
  environment = 'production',
  onReady 
}: { 
  children: React.ReactNode;
  apiKey: string;
  environment?: 'production' | 'staging' | 'development';
  onReady?: () => void;
}) {
  const sdkRef = React.useRef<WhiteLabelSDK | null>(null);
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const sdk = new WhiteLabelSDK({ apiKey, environment });
    sdkRef.current = sdk;
    (window as any).__WHALES_SDK__ = sdk;

    sdk.initialize().then(() => {
      onReady?.();
    }).catch(console.error);

    return () => {
      // Cleanup widgets
      for (const widget of sdk.getWidgets()) {
        widget.destroy();
      }
      delete (window as any).__WHALES_SDK__;
    };
  }, [apiKey, environment]);

  return React.createElement(React.Fragment, null, children);
}

// Hook for using SDK
export function useWhalesSDK(): WhiteLabelSDK | null {
  return React.useMemo(() => (window as any).__WHALES_SDK__ || null, []);
}

// Hook for creating widget
export function useWidget(config: WidgetConfig): WidgetInstance | null {
  const sdk = useWhalesSDK();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [widget, setWidget] = React.useState<WidgetInstance | null>(null);

  React.useEffect(() => {
    if (!sdk || !containerRef.current) return;

    const newWidget = sdk.createWidget(containerRef.current, config);
    setWidget(newWidget);

    return () => newWidget.destroy();
  }, [sdk, config.token, config.theme, config.layout, config.size]);

  return widget;
}

// Need React
import React from 'react';

// Export types
export type { WidgetConfig, WidgetTradeEvent, WidgetPriceEvent, WidgetErrorEvent, SDKConfig, WidgetInstance };

// CDN entry point for direct script usage
declare global {
  interface Window {
    WhalesSDK: typeof WhiteLabelSDK;
    __WHALES_SDK__: WhiteLabelSDK | undefined;
  }
}

// Auto-register if loaded via script tag
if (typeof window !== 'undefined') {
  window.WhalesSDK = WhiteLabelSDK;
}