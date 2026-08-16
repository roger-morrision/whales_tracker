/**
 * WebSocket Manager
 * Real-time price feeds, trade updates, and smart money alerts
 * Supports multiple providers with automatic fallback
 */

type WSState = 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting';

interface WSConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  messageHandlers?: Map<string, (data: any) => void>;
}

interface Subscription {
  id: string;
  channel: string;
  params?: Record<string, any>;
  handler: (data: any) => void;
  unsubscribe: () => void;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WSConfig;
  private state: WSState = 'closed';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptions = new Map<string, Subscription>();
  private messageQueue: Array<{ type: string; payload: any }> = [];
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  private requestId = 0;

  // Event callbacks
  private onStateChangeCallbacks: Array<(state: WSState) => void> = [];
  private onMessageCallbacks: Array<(message: WSMessage) => void> = [];
  private onErrorCallbacks: Array<(error: Error) => void> = [];

  constructor(config: Partial<WSConfig> = {}) {
    this.config = {
      url: config.url || this.getDefaultWSUrl(),
      protocols: config.protocols,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      messageHandlers: config.messageHandlers || new Map(),
    };
  }

  private getDefaultWSUrl(): string {
    // The Next.js App Router does not own a WebSocket upgrade endpoint.
    // Only connect when a real provider endpoint is explicitly configured.
    return typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_WS_URL || ''
      : process.env.WS_URL || '';
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.url) {
        this.setState('closed');
        reject(new Error('No WebSocket endpoint configured'));
        return;
      }
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setState('connecting');

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.setState('open');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.resubscribeAll();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Closed:', event.code, event.reason);
          this.setState('closed');
          this.stopHeartbeat();
          
          if (!event.wasClean) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          // An error event does not guarantee a close event in every browser.
          // Explicitly close so reconnect state is restored consistently.
          this.ws?.close();
          this.onErrorCallbacks.forEach(cb => cb(new Error('WebSocket error')));
          
          if (this.state === 'connecting') {
            reject(new Error('Connection failed'));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.setState('closed');
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setState('closed');
    this.subscriptions.clear();
    this.messageQueue = [];
  }

  private setState(state: WSState): void {
    this.state = state;
    this.onStateChangeCallbacks.forEach(cb => cb(state));
  }

  onStateChange(callback: (state: WSState) => void): () => void {
    this.onStateChangeCallbacks.push(callback);
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter(c => c !== callback);
    };
  }

  onMessage(callback: (message: WSMessage) => void): () => void {
    this.onMessageCallbacks.push(callback);
    return () => {
      this.onMessageCallbacks = this.onMessageCallbacks.filter(c => c !== callback);
    };
  }

  emitMessage(message: WSMessage): void {
    this.onMessageCallbacks.forEach(cb => cb(message));
  }

  onError(callback: (error: Error) => void): () => void {
    this.onErrorCallbacks.push(callback);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter(c => c !== callback);
    };
  }

  private handleMessage(data: string | ArrayBuffer): void {
    try {
      let message: WSMessage;
      
      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else {
        // Binary message - decode
        const decoder = new TextDecoder();
        message = JSON.parse(decoder.decode(data));
      }

      // Handle request responses
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(message.id)!;
        clearTimeout(timeout);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          reject(new Error(message.error.message || 'Request failed'));
        } else {
          resolve(message.result);
        }
        return;
      }

      // Handle subscriptions
      if (message.channel && this.subscriptions.has(message.channel)) {
        const sub = this.subscriptions.get(message.channel)!;
        sub.handler(message.data);
        return;
      }

      // Broadcast to general listeners
      this.emitMessage(message);
    } catch (error) {
      console.error('[WS] Message parse error:', error);
    }
  }

  // Request-response pattern
  async request<T>(type: string, payload: any, timeoutMs = 10000): Promise<T> {
    if (this.state !== 'open') {
      throw new Error('WebSocket not connected');
    }

    const id = `req_${++this.requestId}_${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      this.send({ id, type, payload });
    });
  }

  // Fire-and-forget
  send(message: { type: string; payload: any; id?: string }): void {
    const data = JSON.stringify(message);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.messageQueue.push({ type: message.type, payload: message.payload });
    }
  }

  // Subscribe to a channel
  subscribe(channel: string, params: Record<string, any> = {}, handler: (data: any) => void): Subscription {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const subscription: Subscription = {
      id,
      channel,
      params,
      handler,
      unsubscribe: () => this.unsubscribe(channel),
    };

    this.subscriptions.set(channel, subscription);
    
    if (this.state === 'open') {
      this.send({
        type: 'subscribe',
        payload: { channel, params, id },
      });
    }

    return subscription;
  }

  unsubscribe(channel: string): void {
    const sub = this.subscriptions.get(channel);
    if (sub) {
      this.subscriptions.delete(channel);
      this.send({
        type: 'unsubscribe',
        payload: { channel },
      });
    }
  }

  private resubscribeAll(): void {
    for (const [channel, sub] of this.subscriptions) {
      this.send({
        type: 'subscribe',
        payload: { channel, params: sub.params, id: sub.id },
      });
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      this.send({ type: msg.type, payload: msg.payload });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', payload: { timestamp: Date.now() } });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.log('[WS] Max reconnect attempts reached');
      this.onErrorCallbacks.forEach(cb => cb(new Error('Max reconnect attempts reached')));
      return;
    }

    this.setState('reconnecting');
    this.reconnectAttempts++;
    
    const delay = Math.min(
      (this.config.reconnectInterval || 5000) * Math.pow(1.5, this.reconnectAttempts - 1),
      60000
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(err => {
        console.error('[WS] Reconnect failed:', err);
      });
    }, delay);
  }

  getState(): WSState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'open';
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Message types
export interface WSMessage {
  id?: string;
  type?: string;
  channel?: string;
  payload?: any;
  data?: any;
  result?: any;
  error?: { code: number; message: string };
}

// Predefined channel types
export const WSChannels = {
  PRICE_UPDATES: 'price_updates',
  TRADE_UPDATES: 'trade_updates',
  SMART_MONEY_ALERTS: 'smart_money_alerts',
  WHALE_ALERTS: 'whale_alerts',
  NEW_TOKENS: 'new_tokens',
  PORTFOLIO_UPDATES: 'portfolio_updates',
  ORDER_BOOK: 'order_book',
  NEWS: 'news',
  SYSTEM: 'system',
} as const;

// Provider-specific WebSocket managers
class DexScreenerWSManager extends WebSocketManager {
  constructor() {
    super({
      url: 'wss://io.dexscreener.com/ws',
      reconnectInterval: 3000,
      heartbeatInterval: 20000,
    });
  }

  subscribeToToken(tokenAddress: string, chain: string = 'solana'): Subscription {
    return this.subscribe(WSChannels.PRICE_UPDATES, { tokenAddress, chain }, (data) => {
      // Handle price update
    });
  }

  subscribeToPair(pairAddress: string): Subscription {
    return this.subscribe(WSChannels.ORDER_BOOK, { pairAddress }, (data) => {
      // Handle order book update
    });
  }
}

class JupiterWSManager extends WebSocketManager {
  constructor() {
    super({
      url: 'wss://api.jup.ag/ws',
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
    });
  }

  subscribeToPrice(tokens: string[]): Subscription {
    return this.subscribe(WSChannels.PRICE_UPDATES, { tokens }, (data) => {
      // Handle price update
    });
  }

  subscribeToSwaps(): Subscription {
    return this.subscribe(WSChannels.TRADE_UPDATES, {}, (data) => {
      // Handle swap events
    });
  }
}

// Composite manager with fallback
export class RealtimeManager {
  private managers: Map<string, WebSocketManager> = new Map();
  private primaryManager: WebSocketManager | null = null;
  private fallbackManager: WebSocketManager | null = null;
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private tradeCache: any[] = [];
  private alertCache: any[] = [];

  constructor() {
    // Initialize managers
    this.managers.set('dexscreener', new DexScreenerWSManager());
    this.managers.set('jupiter', new JupiterWSManager());
    
    // Custom app WebSocket
    this.managers.set('app', new WebSocketManager());
  }

  async connect(): Promise<void> {
    // Try primary (app WS) first
    this.primaryManager = this.managers.get('app')!;
    
    try {
      await this.primaryManager.connect();
      console.log('[Realtime] Primary WS connected');
    } catch (error) {
      console.warn('[Realtime] Primary WS failed, trying fallback:', error);
      await this.connectFallback();
    }

    // Set up cross-manager event forwarding
    this.setupEventForwarding();
  }

  private async connectFallback(): Promise<void> {
    for (const [name, manager] of this.managers) {
      if (manager === this.primaryManager) continue;
      
      try {
        await manager.connect();
        this.fallbackManager = manager;
        console.log(`[Realtime] Fallback WS connected: ${name}`);
        return;
      } catch (error) {
        console.warn(`[Realtime] Fallback ${name} failed:`, error);
      }
    }
    
    throw new Error('All WebSocket connections failed');
  }

  private setupEventForwarding(): void {
    // Forward messages from fallback to primary handlers
    for (const [name, manager] of this.managers) {
      if (manager === this.primaryManager) continue;
      
      manager.onMessage((message) => {
        // Re-broadcast to primary manager's listeners
        this.primaryManager?.emitMessage(message);
      });
    }
  }

  // Price subscriptions
  subscribeToPrices(tokens: string[], chain: string = 'solana'): () => void {
    const unsubscribers: Array<() => void> = [];

    // Try DexScreener first
    const dexManager = this.managers.get('dexscreener') as DexScreenerWSManager | undefined;
    if (dexManager?.isConnected()) {
      for (const token of tokens) {
        const sub = dexManager.subscribeToToken(token, chain);
        unsubscribers.push(sub.unsubscribe);
      }
    }

    // Fallback to Jupiter
    const jupManager = this.managers.get('jupiter') as JupiterWSManager | undefined;
    if (jupManager?.isConnected()) {
      const sub = jupManager.subscribeToPrice(tokens);
      unsubscribers.push(sub.unsubscribe);
    }

    // App WS as last resort
    if (this.primaryManager?.isConnected()) {
      const sub = this.primaryManager.subscribe(WSChannels.PRICE_UPDATES, { tokens, chain }, (data) => {
        this.handlePriceUpdate(data);
      });
      unsubscribers.push(sub.unsubscribe);
    }

    return () => unsubscribers.forEach(u => u());
  }

  private handlePriceUpdate(data: any): void {
    if (data.token && data.price) {
      this.priceCache.set(data.token, {
        price: data.price,
        timestamp: data.timestamp || Date.now(),
      });
    }
  }

  getCachedPrice(token: string): { price: number; timestamp: number } | undefined {
    return this.priceCache.get(token);
  }

  // Trade subscriptions
  subscribeToTrades(handler: (trade: any) => void): () => void {
    const unsubscribers: Array<() => void> = [];

    const jupManager = this.managers.get('jupiter') as JupiterWSManager | undefined;
    if (jupManager?.isConnected()) {
      const sub = jupManager.subscribeToSwaps();
      unsubscribers.push(sub.unsubscribe);
    }

    if (this.primaryManager?.isConnected()) {
      const sub = this.primaryManager.subscribe(WSChannels.TRADE_UPDATES, {}, (data) => {
        this.handleTradeUpdate(data);
        handler(data);
      });
      unsubscribers.push(sub.unsubscribe);
    }

    return () => unsubscribers.forEach(u => u());
  }

  private handleTradeUpdate(data: any): void {
    this.tradeCache.unshift(data);
    if (this.tradeCache.length > 1000) {
      this.tradeCache = this.tradeCache.slice(0, 1000);
    }
  }

  getRecentTrades(limit = 50): any[] {
    return this.tradeCache.slice(0, limit);
  }

  // Smart money / whale alerts
  subscribeToAlerts(handler: (alert: any) => void): () => void {
    if (this.primaryManager?.isConnected()) {
      const sub = this.primaryManager.subscribe(WSChannels.SMART_MONEY_ALERTS, {}, (data) => {
        this.handleAlert(data);
        handler(data);
      });
      return sub.unsubscribe;
    }
    return () => {};
  }

  private handleAlert(data: any): void {
    this.alertCache.unshift(data);
    if (this.alertCache.length > 500) {
      this.alertCache = this.alertCache.slice(0, 500);
    }
  }

  getRecentAlerts(limit = 50): any[] {
    return this.alertCache.slice(0, limit);
  }

  // Connection state
  getConnectionState(): { primary: string; fallback: string | null } {
    return {
      primary: this.primaryManager?.getState() || 'none',
      fallback: this.fallbackManager?.getState() || null,
    };
  }

  isConnected(): boolean {
    return this.primaryManager?.isConnected() || this.fallbackManager?.isConnected() || false;
  }

  disconnect(): void {
    for (const manager of this.managers.values()) {
      manager.disconnect();
    }
    this.primaryManager = null;
    this.fallbackManager = null;
  }
}

// Singleton
let realtimeManagerInstance: RealtimeManager | null = null;

export function getRealtimeManager(): RealtimeManager {
  if (!realtimeManagerInstance) {
    realtimeManagerInstance = new RealtimeManager();
  }
  return realtimeManagerInstance;
}

// React hook
export function useRealtime() {
  const manager = getRealtimeManager();

  return {
    connect: () => manager.connect(),
    disconnect: () => manager.disconnect(),
    subscribeToPrices: (tokens: string[], chain?: string) => manager.subscribeToPrices(tokens, chain),
    subscribeToTrades: (handler: (trade: any) => void) => manager.subscribeToTrades(handler),
    subscribeToAlerts: (handler: (alert: any) => void) => manager.subscribeToAlerts(handler),
    getCachedPrice: (token: string) => manager.getCachedPrice(token),
    getRecentTrades: (limit?: number) => manager.getRecentTrades(limit),
    getRecentAlerts: (limit?: number) => manager.getRecentAlerts(limit),
    getConnectionState: () => manager.getConnectionState(),
    isConnected: () => manager.isConnected(),
  };
}

export type { WebSocketManager, Subscription, WSConfig };
