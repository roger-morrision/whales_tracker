/**
 * PWA Offline Mode
 * Service worker caches prices, portfolio, recent tokens
 */

export interface CacheStrategy {
  name: string;
  patterns: string[];
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';
  maxAge?: number; // seconds
  maxEntries?: number;
}

export interface OfflineConfig {
  cacheName: string;
  version: string;
  strategies: CacheStrategy[];
  precacheUrls: string[];
  offlineFallback: string;
  backgroundSyncTags: string[];
}

export interface SyncQueueItem {
  id: string;
  type: 'trade' | 'alert' | 'snipe' | 'dca' | 'rebalance' | 'settings';
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

class PWAOfflineManager {
  private config: OfflineConfig;
  private registration: ServiceWorkerRegistration | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private isOnline = true;
  private subscribers: Set<(online: boolean) => void> = new Set();
  private queueSubscribers: Set<(queue: SyncQueueItem[]) => void> = new Set();

  constructor(config?: Partial<OfflineConfig>) {
    this.config = {
      cacheName: 'whales-tracker',
      version: '1.0.0',
      strategies: [
        { name: 'static-assets', patterns: ['/static/**', '/_next/static/**'], strategy: 'cache-first', maxAge: 31536000, maxEntries: 100 },
        { name: 'api-prices', patterns: ['/api/price/**', '/api/dexscreener/**'], strategy: 'stale-while-revalidate', maxAge: 30, maxEntries: 50 },
        { name: 'api-portfolio', patterns: ['/api/portfolio/**', '/api/wallet/**'], strategy: 'network-first', maxAge: 60, maxEntries: 20 },
        { name: 'api-trading', patterns: ['/api/trade/**', '/api/snipe/**', '/api/dca/**'], strategy: 'network-only' },
        { name: 'api-analytics', patterns: ['/api/analytics/**', '/api/risk/**', '/api/yield/**'], strategy: 'stale-while-revalidate', maxAge: 300, maxEntries: 30 },
        { name: 'images', patterns: ['/images/**', '/icons/**', '/logos/**'], strategy: 'cache-first', maxAge: 2592000, maxEntries: 100 },
        { name: 'fonts', patterns: ['/fonts/**', '/_next/static/media/**'], strategy: 'cache-first', maxAge: 31536000, maxEntries: 20 },
      ],
      precacheUrls: [
        '/',
        '/manifest.json',
        '/offline.html',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ],
      offlineFallback: '/offline.html',
      backgroundSyncTags: ['trade', 'alert', 'snipe', 'dca', 'rebalance', 'settings'],
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        console.log('[PWA] Service worker registered:', this.registration.scope);

        // Listen for updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.notifyUpdateAvailable();
              }
            });
          }
        });

        // Background sync
        if ('sync' in this.registration) {
          this.setupBackgroundSync();
        }
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    }

    // Online/offline detection
    this.isOnline = navigator.onLine;
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Load sync queue from IndexedDB
    await this.loadSyncQueue();
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.notifyOnlineStatus(true);
    this.processSyncQueue();
  }

  private handleOffline(): void {
    this.isOnline = false;
    this.notifyOnlineStatus(false);
  }

  private notifyOnlineStatus(online: boolean): void {
    for (const sub of this.subscribers) {
      try { sub(online); } catch (e) { console.error('[PWA] Online subscriber error:', e); }
    }
  }

  // Background sync setup
  private setupBackgroundSync(): void {
    if (!this.registration) return;

    for (const tag of this.config.backgroundSyncTags) {
      try {
        (this.registration as any).sync.register(tag);
      } catch (error) {
        console.warn('[PWA] Background sync registration failed for:', tag, error);
      }
    }
  }

  // Queue management
  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();
    this.notifyQueueChange();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processSyncQueue();
    } else {
      // Register background sync
      if (this.registration && 'sync' in this.registration) {
        try {
          (this.registration as any).sync.register(item.type);
        } catch (e) {
          console.warn('[PWA] Failed to register sync:', e);
        }
      }
    }

    return queueItem.id;
  }

  async removeFromQueue(id: string): Promise<boolean> {
    const index = this.syncQueue.findIndex(item => item.id === id);
    if (index === -1) return false;

    this.syncQueue.splice(index, 1);
    await this.saveSyncQueue();
    this.notifyQueueChange();
    return true;
  }

  getQueue(): SyncQueueItem[] {
    return [...this.syncQueue].sort((a, b) => a.timestamp - b.timestamp);
  }

  private notifyQueueChange(): void {
    for (const sub of this.queueSubscribers) {
      try { sub(this.getQueue()); } catch (e) { console.error('[PWA] Queue subscriber error:', e); }
    }
  }

  // Process sync queue
  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    const pending = this.syncQueue.filter(item => item.retries < item.maxRetries);
    
    for (const item of pending) {
      try {
        await this.syncItem(item);
        await this.removeFromQueue(item.id);
      } catch (error) {
        console.error('[PWA] Sync failed for item:', item.id, error);
        item.retries++;
        if (item.retries >= item.maxRetries) {
          // Move to dead letter queue or notify user
          console.error('[PWA] Max retries exceeded for:', item.id);
          await this.removeFromQueue(item.id);
        } else {
          await this.saveSyncQueue();
        }
      }
    }

    this.notifyQueueChange();
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    // In production, this would make actual API calls
    // For now, simulate
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Example endpoints based on type
    const endpoints: Record<string, string> = {
      trade: '/api/trade/execute',
      alert: '/api/alerts/create',
      snipe: '/api/snipe/create',
      dca: '/api/dca/create',
      rebalance: '/api/portfolio/rebalance',
      settings: '/api/settings/update',
    };

    const endpoint = endpoints[item.type];
    if (!endpoint) throw new Error(`Unknown sync type: ${item.type}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.payload),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }

  // IndexedDB persistence
  private async saveSyncQueue(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      const db = await this.openDB();
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      
      // Clear and rewrite
      await store.clear();
      for (const item of this.syncQueue) {
        await store.put(item);
      }
      
      await tx.done;
    } catch (error) {
      console.error('[PWA] Failed to save sync queue:', error);
    }
  }

  private async loadSyncQueue(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      const db = await this.openDB();
      const tx = db.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const items = await store.getAll();
      
      this.syncQueue = items.sort((a, b) => a.timestamp - b.timestamp);
      this.notifyQueueChange();
    } catch (error) {
      console.error('[PWA] Failed to load sync queue:', error);
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('whales-tracker-pwa', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cachedData')) {
          db.createObjectStore('cachedData', { keyPath: 'key' });
        }
      };
    });
  }

  // Cache management
  async cacheData(key: string, data: any, maxAge: number = 3600): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      const db = await this.openDB();
      const tx = db.transaction('cachedData', 'readwrite');
      const store = tx.objectStore('cachedData');
      
      await store.put({
        key,
        data,
        timestamp: Date.now(),
        maxAge: maxAge * 1000,
      });
      
      await tx.done;
    } catch (error) {
      console.error('[PWA] Failed to cache data:', error);
    }
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined') return null;
    
    try {
      const db = await this.openDB();
      const tx = db.transaction('cachedData', 'readonly');
      const store = tx.objectStore('cachedData');
      const result = await store.get(key);
      
      if (!result) return null;
      
      // Check expiration
      if (Date.now() - result.timestamp > result.maxAge) {
        // Expired, delete it
        const tx2 = db.transaction('cachedData', 'readwrite');
        await tx2.objectStore('cachedData').delete(key);
        await tx2.done;
        return null;
      }
      
      return result.data as T;
    } catch (error) {
      console.error('[PWA] Failed to get cached data:', error);
      return null;
    }
  }

  async clearCache(pattern?: string): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      const db = await this.openDB();
      const tx = db.transaction('cachedData', 'readwrite');
      const store = tx.objectStore('cachedData');
      
      if (pattern) {
        // Would need cursor for pattern matching
        const all = await store.getAll();
        for (const item of all) {
          if (item.key.includes(pattern)) {
            await store.delete(item.key);
          }
        }
      } else {
        await store.clear();
      }
      
      await tx.done;
    } catch (error) {
      console.error('[PWA] Failed to clear cache:', error);
    }
  }

  // Service worker communication
  async sendMessageToSW(message: any): Promise<any> {
    if (!this.registration?.active) return null;
    
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data);
      };
      
      this.registration!.active!.postMessage(message, [channel.port2]);
    });
  }

  async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // Update handling
  private notifyUpdateAvailable(): void {
    // Dispatch custom event for UI to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sw-update-available'));
    }
  }

  // Subscriptions
  onOnlineStatusChange(callback: (online: boolean) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  onQueueChange(callback: (queue: SyncQueueItem[]) => void): () => void {
    this.queueSubscribers.add(callback);
    return () => this.queueSubscribers.delete(callback);
  }

  // Status
  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  // Manual sync trigger
  async syncNow(): Promise<void> {
    await this.processSyncQueue();
  }

  // Install prompt
  getInstallPrompt(): Promise<BeforeInstallPromptEvent | null> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(null);
        return;
      }

      let deferredPrompt: BeforeInstallPromptEvent | null = null;
      
      const handler = (e: BeforeInstallPromptEvent) => {
        e.preventDefault();
        deferredPrompt = e;
        window.removeEventListener('beforeinstallprompt', handler);
        resolve(deferredPrompt);
      };
      
      window.addEventListener('beforeinstallprompt', handler);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('beforeinstallprompt', handler);
        resolve(deferredPrompt);
      }, 5000);
    });
  }

  async promptInstall(): Promise<boolean> {
    const promptEvent = await this.getInstallPrompt();
    if (!promptEvent) return false;
    
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    return result.outcome === 'accepted';
  }
}

// Singleton
let pwaManagerInstance: PWAOfflineManager | null = null;

export function getPWAOfflineManager(config?: Partial<OfflineConfig>): PWAOfflineManager {
  if (!pwaManagerInstance) {
    pwaManagerInstance = new PWAOfflineManager(config);
  }
  return pwaManagerInstance;
}

// React hook
export function usePWAOffline() {
  const manager = getPWAOfflineManager();
  
  return {
    isOnline: () => manager.isOnlineStatus(),
    addToQueue: (item: any) => manager.addToQueue(item),
    removeFromQueue: (id: string) => manager.removeFromQueue(id),
    getQueue: () => manager.getQueue(),
    cacheData: (key: string, data: any, maxAge?: number) => manager.cacheData(key, data, maxAge),
    getCachedData: (key: string) => manager.getCachedData(key),
    clearCache: (pattern?: string) => manager.clearCache(pattern),
    syncNow: () => manager.syncNow(),
    promptInstall: () => manager.promptInstall(),
    onOnlineStatusChange: (callback: (online: boolean) => void) => manager.onOnlineStatusChange(callback),
    onQueueChange: (callback: (queue: SyncQueueItem[]) => void) => manager.onQueueChange(callback),
    getRegistration: () => manager.getRegistration(),
  };
}

export type { CacheStrategy, OfflineConfig, SyncQueueItem };

// Export for service worker
export const OFFLINE_CONFIG_DEFAULT: OfflineConfig = {
  cacheName: 'whales-tracker',
  version: '1.0.0',
  strategies: [
    { name: 'static-assets', patterns: ['/static/**', '/_next/static/**'], strategy: 'cache-first', maxAge: 31536000, maxEntries: 100 },
    { name: 'api-prices', patterns: ['/api/price/**', '/api/dexscreener/**'], strategy: 'stale-while-revalidate', maxAge: 30, maxEntries: 50 },
    { name: 'api-portfolio', patterns: ['/api/portfolio/**', '/api/wallet/**'], strategy: 'network-first', maxAge: 60, maxEntries: 20 },
    { name: 'api-trading', patterns: ['/api/trade/**', '/api/snipe/**', '/api/dca/**'], strategy: 'network-only' },
    { name: 'api-analytics', patterns: ['/api/analytics/**', '/api/risk/**', '/api/yield/**'], strategy: 'stale-while-revalidate', maxAge: 300, maxEntries: 30 },
    { name: 'images', patterns: ['/images/**', '/icons/**', '/logos/**'], strategy: 'cache-first', maxAge: 2592000, maxEntries: 100 },
    { name: 'fonts', patterns: ['/fonts/**', '/_next/static/media/**'], strategy: 'cache-first', maxAge: 31536000, maxEntries: 20 },
  ],
  precacheUrls: [
    '/',
    '/manifest.json',
    '/offline.html',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
  ],
  offlineFallback: '/offline.html',
  backgroundSyncTags: ['trade', 'alert', 'snipe', 'dca', 'rebalance', 'settings'],
};