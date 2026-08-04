/**
 * Background Sync
 * Queue trades/alerts when offline, replay on reconnect
 */

export interface BackgroundSyncConfig {
  dbName: string;
  version: number;
  stores: SyncStoreConfig[];
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
  syncIntervalMs: number;
}

export interface SyncStoreConfig {
  name: string;
  keyPath: string;
  indexes: { name: string; keyPath: string; unique?: boolean }[];
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  store: string;
  data: any;
  timestamp: number;
  retries: number;
  metadata?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: SyncError[];
}

export interface SyncError {
  operationId: string;
  error: string;
  timestamp: number;
  retries: number;
}

class BackgroundSyncManager {
  private config: BackgroundSyncConfig;
  private db: IDBDatabase | null = null;
  private syncQueue: SyncOperation[] = [];
  private isSyncing = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private online = true;
  private subscribers: Set<(result: SyncResult) => void> = new Set();
  private statusSubscribers: Set<(status: SyncStatus) => void> = new Set();

  constructor(config?: Partial<BackgroundSyncConfig>) {
    this.config = {
      dbName: 'whales-tracker-sync',
      version: 1,
      stores: [
        {
          name: 'trades',
          keyPath: 'id',
          indexes: [
            { name: 'timestamp', keyPath: 'timestamp' },
            { name: 'status', keyPath: 'status' },
            { name: 'token', keyPath: 'token' },
          ],
        },
        {
          name: 'alerts',
          keyPath: 'id',
          indexes: [
            { name: 'timestamp', keyPath: 'timestamp' },
            { name: 'triggered', keyPath: 'triggered' },
          ],
        },
        {
          name: 'snipe_rules',
          keyPath: 'id',
          indexes: [
            { name: 'token', keyPath: 'token' },
            { name: 'active', keyPath: 'active' },
          ],
        },
        {
          name: 'dca_orders',
          keyPath: 'id',
          indexes: [
            { name: 'nextRun', keyPath: 'nextRun' },
            { name: 'active', keyPath: 'active' },
          ],
        },
        {
          name: 'portfolio_snapshots',
          keyPath: 'id',
          indexes: [
            { name: 'timestamp', keyPath: 'timestamp' },
          ],
        },
        {
          name: 'settings',
          keyPath: 'key',
          indexes: [],
        },
        {
          name: 'sync_operations',
          keyPath: 'id',
          indexes: [
            { name: 'store', keyPath: 'store' },
            { name: 'timestamp', keyPath: 'timestamp' },
          ],
        },
      ],
      maxRetries: 5,
      retryDelayMs: 5000,
      batchSize: 50,
      syncIntervalMs: 30000,
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    await this.openDB();
    await this.loadPendingOperations();
    this.setupOnlineListener();
    this.startSyncTimer();
  }

  private async openDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        for (const storeConfig of this.config.stores) {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, { keyPath: storeConfig.keyPath });
            for (const index of storeConfig.indexes) {
              store.createIndex(index.name, index.keyPath, { unique: index.unique });
            }
          }
        }
      };
    });
  }

  private setupOnlineListener(): void {
    this.online = navigator.onLine;
    
    window.addEventListener('online', () => {
      this.online = true;
      this.notifyStatusChange();
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this.notifyStatusChange();
    });
  }

  private startSyncTimer(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    
    this.syncTimer = setInterval(() => {
      if (this.online) {
        this.processQueue();
      }
    }, this.config.syncIntervalMs);
  }

  private async loadPendingOperations(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_operations', 'readonly');
      const store = tx.objectStore('sync_operations');
      const request = store.getAll();

      request.onsuccess = () => {
        this.syncQueue = request.result
          .filter(op => op.retries < this.config.maxRetries)
          .sort((a, b) => a.timestamp - b.timestamp);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Queue operations
  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const syncOp: SyncOperation = {
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };

    // Save to IndexedDB
    await this.saveOperation(syncOp);
    
    // Add to memory queue
    this.syncQueue.push(syncOp);
    this.syncQueue.sort((a, b) => a.timestamp - b.timestamp);

    // Try immediate sync if online
    if (this.online) {
      this.processQueue();
    }

    return syncOp.id;
  }

  private async saveOperation(operation: SyncOperation): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_operations', 'readwrite');
      const store = tx.objectStore('sync_operations');
      const request = store.put(operation);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async removeOperation(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_operations', 'readwrite');
      const store = tx.objectStore('sync_operations');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async updateOperation(operation: SyncOperation): Promise<void> {
    await this.saveOperation(operation);
  }

  // Process queue
  async processQueue(): Promise<SyncResult> {
    if (this.isSyncing || !this.online || this.syncQueue.length === 0) {
      return { success: true, synced: 0, failed: 0, errors: [] };
    }

    this.isSyncing = true;
    this.notifyStatusChange();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    // Process in batches
    const batch = this.syncQueue.slice(0, this.config.batchSize);
    
    for (const operation of batch) {
      try {
        await this.executeOperation(operation);
        await this.removeOperation(operation.id);
        
        // Remove from memory queue
        const index = this.syncQueue.findIndex(op => op.id === operation.id);
        if (index !== -1) this.syncQueue.splice(index, 1);
        
        result.synced++;
      } catch (error) {
        operation.retries++;
        
        if (operation.retries >= this.config.maxRetries) {
          // Max retries exceeded - remove from queue
          await this.removeOperation(operation.id);
          const index = this.syncQueue.findIndex(op => op.id === operation.id);
          if (index !== -1) this.syncQueue.splice(index, 1);
          
          result.errors.push({
            operationId: operation.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
            retries: operation.retries,
          });
          result.failed++;
        } else {
          // Update retry count
          await this.updateOperation(operation);
          result.errors.push({
            operationId: operation.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
            retries: operation.retries,
          });
        }
      }
    }

    result.success = result.failed === 0;
    this.isSyncing = false;
    this.notifyStatusChange();
    this.notifySubscribers(result);

    return result;
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    // Map store names to API endpoints
    const endpoints: Record<string, string> = {
      trades: '/api/trades',
      alerts: '/api/alerts',
      snipe_rules: '/api/snipe/rules',
      dca_orders: '/api/dca/orders',
      portfolio_snapshots: '/api/portfolio/snapshots',
      settings: '/api/settings',
    };

    const endpoint = endpoints[operation.store];
    if (!endpoint) {
      throw new Error(`Unknown store: ${operation.store}`);
    }

    const method = operation.type === 'delete' ? 'DELETE' : 
                   operation.type === 'create' ? 'POST' : 'PUT';

    const url = method === 'DELETE' ? `${endpoint}/${operation.data.id}` : endpoint;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'DELETE' ? JSON.stringify(operation.data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.status} - ${errorText}`);
    }
  }

  // Convenience methods for common operations
  async queueTrade(trade: any): Promise<string> {
    return this.queueOperation({
      type: 'create',
      store: 'trades',
      data: trade,
    });
  }

  async queueAlert(alert: any): Promise<string> {
    return this.queueOperation({
      type: 'create',
      store: 'alerts',
      data: alert,
    });
  }

  async queueSnipeRule(rule: any): Promise<string> {
    return this.queueOperation({
      type: 'create',
      store: 'snipe_rules',
      data: rule,
    });
  }

  async queueDCAOrder(order: any): Promise<string> {
    return this.queueOperation({
      type: 'create',
      store: 'dca_orders',
      data: order,
    });
  }

  async queuePortfolioSnapshot(snapshot: any): Promise<string> {
    return this.queueOperation({
      type: 'create',
      store: 'portfolio_snapshots',
      data: snapshot,
    });
  }

  async queueSetting(key: string, value: any): Promise<string> {
    return this.queueOperation({
      type: 'update',
      store: 'settings',
      data: { key, value },
    });
  }

  // Get pending operations
  getPendingOperations(): SyncOperation[] {
    return [...this.syncQueue];
  }

  getPendingCount(): number {
    return this.syncQueue.length;
  }

  // Force sync
  async syncNow(): Promise<SyncResult> {
    return this.processQueue();
  }

  // Clear queue
  async clearQueue(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_operations', 'readwrite');
      const store = tx.objectStore('sync_operations');
      const request = store.clear();

      request.onsuccess = () => {
        this.syncQueue = [];
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Status
  isOnlineStatus(): boolean {
    return this.online;
  }

  isSyncingStatus(): boolean {
    return this.isSyncing;
  }

  getSyncStatus(): SyncStatus {
    return {
      online: this.online,
      syncing: this.isSyncing,
      pendingCount: this.syncQueue.length,
      lastSync: this.getLastSyncTime(),
    };
  }

  private getLastSyncTime(): number | null {
    // Would need to track this
    return null;
  }

  // Subscriptions
  onSyncComplete(callback: (result: SyncResult) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusSubscribers.add(callback);
    return () => this.statusSubscribers.delete(callback);
  }

  private notifySubscribers(result: SyncResult): void {
    for (const sub of this.subscribers) {
      try { sub(result); } catch (e) { console.error('[BackgroundSync] Subscriber error:', e); }
    }
  }

  private notifyStatusChange(): void {
    const status = this.getSyncStatus();
    for (const sub of this.statusSubscribers) {
      try { sub(status); } catch (e) { console.error('[BackgroundSync] Status subscriber error:', e); }
    }
  }

  // Cleanup
  destroy(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.db) this.db.close();
  }
}

export interface SyncStatus {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  lastSync: number | null;
}

// Singleton
let backgroundSyncManagerInstance: BackgroundSyncManager | null = null;

export function getBackgroundSyncManager(config?: Partial<BackgroundSyncConfig>): BackgroundSyncManager {
  if (!backgroundSyncManagerInstance) {
    backgroundSyncManagerInstance = new BackgroundSyncManager(config);
  }
  return backgroundSyncManagerInstance;
}

// React hook
export function useBackgroundSync(config?: Partial<BackgroundSyncConfig>) {
  const manager = getBackgroundSyncManager(config);
  
  return {
    queueOperation: (op: any) => manager.queueOperation(op),
    queueTrade: (trade: any) => manager.queueTrade(trade),
    queueAlert: (alert: any) => manager.queueAlert(alert),
    queueSnipeRule: (rule: any) => manager.queueSnipeRule(rule),
    queueDCAOrder: (order: any) => manager.queueDCAOrder(order),
    queuePortfolioSnapshot: (snapshot: any) => manager.queuePortfolioSnapshot(snapshot),
    queueSetting: (key: string, value: any) => manager.queueSetting(key, value),
    getPendingOperations: () => manager.getPendingOperations(),
    getPendingCount: () => manager.getPendingCount(),
    syncNow: () => manager.syncNow(),
    clearQueue: () => manager.clearQueue(),
    isOnline: () => manager.isOnlineStatus(),
    isSyncing: () => manager.isSyncingStatus(),
    getStatus: () => manager.getSyncStatus(),
    onSyncComplete: (callback: (result: SyncResult) => void) => manager.onSyncComplete(callback),
    onStatusChange: (callback: (status: SyncStatus) => void) => manager.onStatusChange(callback),
  };
}

export type { BackgroundSyncConfig, SyncStoreConfig, SyncOperation, SyncResult, SyncError, SyncStatus };