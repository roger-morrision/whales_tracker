/**
 * Service Worker Registration and Management
 * Handles PWA installation, offline caching, background sync, and push notifications
 */

interface SWRegistrationOptions {
  scope?: string;
  updateInterval?: number; // ms
  skipWaiting?: boolean;
}

interface CacheStrategy {
  name: string;
  patterns: RegExp[];
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';
  maxAge?: number; // seconds
  maxEntries?: number;
}

interface BackgroundSyncTask {
  id: string;
  type: 'trade' | 'alert' | 'analytics' | 'portfolio' | 'custom';
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private isOnline = true;
  private pendingSyncTasks: BackgroundSyncTask[] = [];
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  // Cache strategies for different resource types
  private readonly CACHE_STRATEGIES: CacheStrategy[] = [
    {
      name: 'static-assets',
      patterns: [/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp)$/],
      strategy: 'cache-first',
      maxAge: 31536000, // 1 year
      maxEntries: 100,
    },
    {
      name: 'api-responses',
      patterns: [/\/api\//],
      strategy: 'stale-while-revalidate',
      maxAge: 300, // 5 minutes
      maxEntries: 50,
    },
    {
      name: 'price-data',
      patterns: [/\/api\/(prices|quote)/],
      strategy: 'network-first',
      maxAge: 30, // 30 seconds
      maxEntries: 20,
    },
    {
      name: 'html-pages',
      patterns: [/\.html$/, /\/$/],
      strategy: 'network-first',
      maxAge: 3600, // 1 hour
      maxEntries: 20,
    },
  ];

  async register(options: SWRegistrationOptions = {}): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: options.scope || '/',
      });

      console.log('[SW] Registered:', this.registration.scope);

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.emit('update-available', { registration: this.registration });
              if (options.skipWaiting) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            }
          });
        }
      });

      // Listen for controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.emit('controller-change', {});
        window.location.reload();
      });

      // Set up periodic update checks
      if (options.updateInterval) {
        this.startUpdateChecks(options.updateInterval);
      }

      // Handle messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleSWMessage(event);
      });

      // Online/offline detection
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      this.isOnline = navigator.onLine;

      return true;
    } catch (error) {
      console.error('[SW] Registration failed:', error);
      return false;
    }
  }

  unregister(): Promise<boolean> {
    if (this.registration) {
      this.stopUpdateChecks();
      return this.registration.unregister();
    }
    return Promise.resolve(false);
  }

  async update(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  private startUpdateChecks(intervalMs: number): void {
    this.stopUpdateChecks();
    this.updateInterval = setInterval(() => {
      this.registration?.update().catch(console.error);
    }, intervalMs);
  }

  private stopUpdateChecks(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private handleSWMessage(event: MessageEvent): void {
    const { type, payload } = event.data || {};
    
    switch (type) {
      case 'SYNC_COMPLETE':
        this.handleSyncComplete(payload);
        break;
      case 'CACHE_UPDATE':
        this.emit('cache-update', payload);
        break;
      case 'PUSH_RECEIVED':
        this.emit('push', payload);
        break;
      case 'BACKGROUND_FETCH_COMPLETE':
        this.emit('background-fetch-complete', payload);
        break;
    }
  }

  private handleSyncComplete(payload: { taskId: string; success: boolean; error?: string }): void {
    const task = this.pendingSyncTasks.find(t => t.id === payload.taskId);
    if (task) {
      if (payload.success) {
        this.pendingSyncTasks = this.pendingSyncTasks.filter(t => t.id !== payload.taskId);
        this.emit('sync-success', { taskId: payload.taskId, type: task.type });
      } else if (task.retries < task.maxRetries) {
        task.retries++;
        this.scheduleSync(task);
      } else {
        this.pendingSyncTasks = this.pendingSyncTasks.filter(t => t.id !== payload.taskId);
        this.emit('sync-failed', { taskId: payload.taskId, error: payload.error, type: task.type });
      }
    }
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.emit('online', {});
    this.processPendingSync();
  }

  private handleOffline(): void {
    this.isOnline = false;
    this.emit('offline', {});
  }

  // Background Sync API
  async scheduleBackgroundSync(task: Omit<BackgroundSyncTask, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const taskId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullTask: BackgroundSyncTask = {
      ...task,
      id: taskId,
      timestamp: Date.now(),
      retries: 0,
    };

    this.pendingSyncTasks.push(fullTask);

    if (this.isOnline && 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await this.registration?.sync.register(`sync-${task.type}-${taskId}`);
      } catch (error) {
        console.warn('[SW] Background sync registration failed:', error);
        // Fallback to manual processing
        this.processTaskLocally(fullTask);
      }
    } else {
      // Process immediately if online, or queue for later
      if (this.isOnline) {
        this.processTaskLocally(fullTask);
      }
    }

    return taskId;
  }

  private async processPendingSync(): void {
    const tasks = [...this.pendingSyncTasks];
    for (const task of tasks) {
      await this.processTaskLocally(task);
    }
  }

  private async processTaskLocally(task: BackgroundSyncTask): Promise<void> {
    try {
      switch (task.type) {
        case 'trade':
          await this.syncTrade(task.payload);
          break;
        case 'alert':
          await this.syncAlert(task.payload);
          break;
        case 'analytics':
          await this.syncAnalytics(task.payload);
          break;
        case 'portfolio':
          await this.syncPortfolio(task.payload);
          break;
        case 'custom':
          if (task.payload.url) {
            await fetch(task.payload.url, {
              method: task.payload.method || 'POST',
              headers: task.payload.headers,
              body: JSON.stringify(task.payload.data),
            });
          }
          break;
      }
      
      this.pendingSyncTasks = this.pendingSyncTasks.filter(t => t.id !== task.id);
      this.emit('sync-success', { taskId: task.id, type: task.type });
    } catch (error) {
      console.error('[SW] Sync task failed:', error);
      if (task.retries < task.maxRetries) {
        task.retries++;
        this.scheduleSync(task);
      } else {
        this.pendingSyncTasks = this.pendingSyncTasks.filter(t => t.id !== task.id);
        this.emit('sync-failed', { taskId: task.id, error: String(error), type: task.type });
      }
    }
  }

  private scheduleSync(task: BackgroundSyncTask): void {
    setTimeout(() => this.processTaskLocally(task), 5000 * task.retries);
  }

  // Sync implementations (to be customized per app)
  private async syncTrade(payload: any): Promise<void> {
    await fetch('/api/trades/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private async syncAlert(payload: any): Promise<void> {
    await fetch('/api/alerts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private async syncAnalytics(payload: any): Promise<void> {
    await fetch('/api/analytics/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private async syncPortfolio(payload: any): Promise<void> {
    await fetch('/api/portfolio/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // Push Notifications
  async subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!('pushManager' in this.registration!)) {
      console.warn('[SW] Push not supported');
      return null;
    }

    try {
      const subscription = await this.registration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      return subscription;
    } catch (error) {
      console.error('[SW] Push subscription failed:', error);
      return null;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    try {
      const subscription = await this.registration?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        return true;
      }
    } catch (error) {
      console.error('[SW] Push unsubscription failed:', error);
    }
    return false;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Cache management
  async clearCache(cacheName?: string): Promise<void> {
    if (cacheName) {
      await caches.delete(cacheName);
    } else {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    this.emit('cache-cleared', { cacheName });
  }

  async getCacheSize(): Promise<{ total: number; byCache: Record<string, number> }> {
    const cacheNames = await caches.keys();
    let total = 0;
    const byCache: Record<string, number> = {};

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      let size = 0;
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          size += blob.size;
        }
      }
      byCache[name] = size;
      total += size;
    }

    return { total, byCache };
  }

  // Event system
  on(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error(`[SW] Listener error for ${event}:`, e); }
    });
  }

  getPendingSyncCount(): number {
    return this.pendingSyncTasks.length;
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }
}

// IndexedDB Manager for offline storage
class IndexedDBManager {
  private dbName = 'WhalesTrackerDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  private readonly STORES = {
    trades: { keyPath: 'id', indexes: ['timestamp', 'tokenMint', 'signature'] },
    alerts: { keyPath: 'id', indexes: ['timestamp', 'tokenMint', 'read'] },
    portfolio: { keyPath: 'tokenMint', indexes: ['lastUpdated'] },
    tokens: { keyPath: 'id', indexes: ['symbol', 'chain'] },
    prices: { keyPath: 'tokenMint', indexes: ['timestamp'] },
    settings: { keyPath: 'key' },
    pendingSync: { keyPath: 'id', indexes: ['timestamp', 'type'] },
    analytics: { keyPath: 'id', indexes: ['timestamp', 'type'] },
  };

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        for (const [storeName, config] of Object.entries(this.STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
            for (const indexName of config.indexes) {
              store.createIndex(indexName, indexName, { unique: false });
            }
          }
        }
      };
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async transaction<T>(storeNames: string | string[], mode: IDBTransactionMode, operation: (stores: IDBObjectStore[]) => Promise<T>): Promise<T> {
    if (!this.db) await this.open();
    
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = this.db!.transaction(names, mode);
    const stores = names.map(name => transaction.objectStore(name));
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      
      operation(stores).then(resolve).catch(reject);
    });
  }

  // Generic CRUD
  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    return this.transaction(storeName, 'readonly', async ([store]) => {
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getAll<T>(storeName: string, indexName?: string, query?: IDBValidKey | IDBKeyRange): Promise<T[]> {
    return this.transaction(storeName, 'readonly', async ([store]) => {
      return new Promise((resolve, reject) => {
        const source = indexName ? store.index(indexName) : store;
        const request = query ? source.getAll(query) : source.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    return this.transaction(storeName, 'readwrite', async ([store]) => {
      return new Promise((resolve, reject) => {
        const request = store.put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async putMany<T>(storeName: string, values: T[]): Promise<void> {
    return this.transaction(storeName, 'readwrite', async ([store]) => {
      return Promise.all(values.map(value => 
        new Promise<void>((resolve, reject) => {
          const request = store.put(value);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
      ));
    });
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    return this.transaction(storeName, 'readwrite', async ([store]) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async clear(storeName: string): Promise<void> {
    return this.transaction(storeName, 'readwrite', async ([store]) => {
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async count(storeName: string, indexName?: string, query?: IDBValidKey | IDBKeyRange): Promise<number> {
    return this.transaction(storeName, 'readonly', async ([store]) => {
      return new Promise((resolve, reject) => {
        const source = indexName ? store.index(indexName) : store;
        const request = query ? source.count(query) : source.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Specific methods for app data
  async saveTrade(trade: any): Promise<void> {
    await this.put('trades', { ...trade, synced: false });
  }

  async getTrades(limit = 100, offset = 0): Promise<any[]> {
    const all = await this.getAll<any>('trades', 'timestamp');
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(offset, offset + limit);
  }

  async saveAlert(alert: any): Promise<void> {
    await this.put('alerts', { ...alert, read: false });
  }

  async getUnreadAlerts(): Promise<any[]> {
    const all = await this.getAll<any>('alerts', 'read', IDBKeyRange.only(false));
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  async markAlertRead(id: string): Promise<void> {
    const alert = await this.get('alerts', id);
    if (alert) {
      await this.put('alerts', { ...alert, read: true });
    }
  }

  async savePortfolioHolding(holding: any): Promise<void> {
    await this.put('portfolio', { ...holding, lastUpdated: Date.now() });
  }

  async getPortfolio(): Promise<any[]> {
    return this.getAll('portfolio');
  }

  async savePrice(tokenMint: string, price: number): Promise<void> {
    await this.put('prices', { tokenMint, price, timestamp: Date.now() });
  }

  async getPriceHistory(tokenMint: string, hours = 24): Promise<any[]> {
    const since = Date.now() - hours * 60 * 60 * 1000;
    const all = await this.getAll('prices', 'timestamp', IDBKeyRange.lowerBound(since));
    return all.filter(p => p.tokenMint === tokenMint).sort((a, b) => a.timestamp - b.timestamp);
  }

  async saveSetting(key: string, value: any): Promise<void> {
    await this.put('settings', { key, value });
  }

  async getSetting(key: string): Promise<any> {
    const result = await this.get('settings', key);
    return result?.value;
  }

  async queueForSync(task: any): Promise<void> {
    await this.put('pendingSync', { ...task, id: task.id || `sync_${Date.now()}`, timestamp: Date.now() });
  }

  async getPendingSync(): Promise<any[]> {
    return this.getAll('pendingSync', 'timestamp');
  }

  async removeSyncedTask(id: string): Promise<void> {
    await this.delete('pendingSync', id);
  }
}

// Singletons
let swManagerInstance: ServiceWorkerManager | null = null;
let idbManagerInstance: IndexedDBManager | null = null;

export function getServiceWorkerManager(): ServiceWorkerManager {
  if (!swManagerInstance) {
    swManagerInstance = new ServiceWorkerManager();
  }
  return swManagerInstance;
}

export function getIndexedDBManager(): IndexedDBManager {
  if (!idbManagerInstance) {
    idbManagerInstance = new IndexedDBManager();
  }
  return idbManagerInstance;
}

// React hooks
export function useServiceWorker() {
  const manager = getServiceWorkerManager();
  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingSync, setPendingSync] = React.useState(0);

  React.useEffect(() => {
    const unsubUpdate = manager.on('update-available', () => setUpdateAvailable(true));
    const unsubOnline = manager.on('online', () => setIsOnline(true));
    const unsubOffline = manager.on('offline', () => setIsOnline(false));
    const unsubSync = manager.on('sync-success', () => setPendingSync(manager.getPendingSyncCount()));
    
    // Defer initial state sync to avoid synchronous setState in effect
    setTimeout(() => {
      setIsOnline(manager.isOnlineStatus());
      setPendingSync(manager.getPendingSyncCount());
    }, 0);

    return () => {
      unsubUpdate();
      unsubOnline();
      unsubOffline();
      unsubSync();
    };
  }, [manager]);

  return {
    register: (options?: SWRegistrationOptions) => manager.register(options),
    update: () => manager.update(),
    skipWaiting: () => manager.skipWaiting(),
    updateAvailable,
    isOnline,
    pendingSync,
    subscribeToPush: (key: string) => manager.subscribeToPush(key),
    unsubscribeFromPush: () => manager.unsubscribeFromPush(),
    scheduleBackgroundSync: (task: Omit<BackgroundSyncTask, 'id' | 'timestamp' | 'retries'>) => 
      manager.scheduleBackgroundSync(task),
    clearCache: (name?: string) => manager.clearCache(name),
    getCacheSize: () => manager.getCacheSize(),
  };
}

export function useIndexedDB() {
  const manager = getIndexedDBManager();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    manager.open().then(() => setReady(true)).catch(console.error);
    return () => manager.close();
  }, [manager]);

  return {
    ready,
    // Trades
    saveTrade: (trade: any) => manager.saveTrade(trade),
    getTrades: (limit?: number, offset?: number) => manager.getTrades(limit, offset),
    // Alerts
    saveAlert: (alert: any) => manager.saveAlert(alert),
    getUnreadAlerts: () => manager.getUnreadAlerts(),
    markAlertRead: (id: string) => manager.markAlertRead(id),
    // Portfolio
    savePortfolioHolding: (holding: any) => manager.savePortfolioHolding(holding),
    getPortfolio: () => manager.getPortfolio(),
    // Prices
    savePrice: (tokenMint: string, price: number) => manager.savePrice(tokenMint, price),
    getPriceHistory: (tokenMint: string, hours?: number) => manager.getPriceHistory(tokenMint, hours),
    // Settings
    saveSetting: (key: string, value: any) => manager.saveSetting(key, value),
    getSetting: (key: string) => manager.getSetting(key),
    // Sync
    queueForSync: (task: any) => manager.queueForSync(task),
    getPendingSync: () => manager.getPendingSync(),
    removeSyncedTask: (id: string) => manager.removeSyncedTask(id),
    // Generic
    get: <T>(store: string, key: IDBValidKey) => manager.get<T>(store, key),
    getAll: <T>(store: string, index?: string, query?: IDBValidKey | IDBKeyRange) => manager.getAll<T>(store, index, query),
    put: <T>(store: string, value: T) => manager.put(store, value),
    delete: (store: string, key: IDBValidKey) => manager.delete(store, key),
  };
}

// Need React for hooks
import React from 'react';

export type { ServiceWorkerManager, IndexedDBManager, BackgroundSyncTask, CacheStrategy, SWRegistrationOptions };