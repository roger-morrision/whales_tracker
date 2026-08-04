/**
 * Data Export / Webhooks
 * CSV/Parquet export, webhook on price/alert/trade events
 */

export interface ExportConfig {
  format: 'csv' | 'json' | 'parquet' | 'xlsx';
  tables: ExportTable[];
  dateRange: { start: number; end: number };
  filters?: ExportFilter[];
  compression?: 'none' | 'gzip' | 'zip';
  includeHeaders: boolean;
  delimiter?: string; // for CSV
}

export type ExportTable = 
  | 'trades' 
  | 'portfolio_snapshots' 
  | 'alerts' 
  | 'snipe_rules' 
  | 'dca_orders' 
  | 'positions' 
  | 'pnl' 
  | 'risk_metrics' 
  | 'yield_positions' 
  | 'tax_lots' 
  | 'audit_logs' 
  | 'webhook_deliveries';

export interface ExportFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'contains';
  value: any;
}

export interface ExportJob {
  id: string;
  userId: string;
  organizationId?: string;
  config: ExportConfig;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  fileUrl?: string;
  fileSize?: number;
  rowCount?: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  expiresAt: number; // Download link expiry
}

export interface WebhookEvent {
  id: string;
  event: string;
  timestamp: number;
  payload: any;
  metadata: {
    source: string;
    version: string;
    requestId: string;
  };
}

export interface WebhookSubscription {
  id: string;
  userId: string;
  organizationId?: string;
  url: string;
  events: string[];
  secret: string;
  headers?: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  filter?: WebhookFilter;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  lastTriggered?: number;
  successCount: number;
  failureCount: number;
}

export interface WebhookFilter {
  // Event-specific filters
  tokenMints?: string[];
  minValueUsd?: number;
  maxValueUsd?: number;
  chains?: number[];
  severity?: ('info' | 'warning' | 'critical')[];
  custom?: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: string;
  payload: any;
  attempt: number;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
  nextRetryAt?: number;
}

export interface ScheduledExport {
  id: string;
  userId: string;
  organizationId?: string;
  name: string;
  config: ExportConfig;
  schedule: {
    type: 'cron' | 'interval';
    value: string; // cron expression or interval in ms
    timezone: string;
  };
  active: boolean;
  lastRun?: number;
  nextRun: number;
  delivery: {
    type: 'webhook' | 'email' | 's3' | 'gcs' | 'azure_blob';
    config: Record<string, any>;
  };
  createdAt: number;
  updatedAt: number;
}

class DataExportManager {
  private exportJobs: Map<string, ExportJob> = new Map();
  private webhookSubscriptions: Map<string, WebhookSubscription> = new Map();
  private webhookDeliveries: Map<string, WebhookDelivery[]> = new Map();
  private scheduledExports: Map<string, ScheduledExport> = new Map();
  private deliveryQueue: WebhookDelivery[] = [];
  private subscribers: Set<() => void> = new Set();
  private processing = false;
  private config: DataExportConfig;

  constructor(config?: Partial<DataExportConfig>) {
    this.config = {
      maxConcurrentExports: 3,
      maxConcurrentDeliveries: 10,
      exportTimeoutMs: 300000, // 5 minutes
      webhookTimeoutMs: 10000,
      maxFileSize: 500 * 1024 * 1024, // 500MB
      defaultExpiryDays: 7,
      storageProvider: 'local', // 'local' | 's3' | 'gcs' | 'azure'
      storageConfig: {},
      ...config,
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize(): void {
    // Start delivery processor
    this.startDeliveryProcessor();
    
    // Start scheduled export checker
    this.startScheduledExportChecker();
    
    // Cleanup old jobs
    setInterval(() => this.cleanup(), 3600000);
  }

  // Export management
  async createExportJob(config: ExportConfig, userId: string, organizationId?: string): Promise<ExportJob> {
    const job: ExportJob = {
      id: `export_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      organizationId,
      config,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.config.defaultExpiryDays * 86400000),
    };

    this.exportJobs.set(job.id, job);
    this.queueExport(job.id);
    this.notifySubscribers();
    
    return job;
  }

  getExportJob(jobId: string): ExportJob | undefined {
    return this.exportJobs.get(jobId);
  }

  getUserExportJobs(userId: string, filters?: { status?: ExportJob['status']; limit?: number }): ExportJob[] {
    let jobs = Array.from(this.exportJobs.values())
      .filter(j => j.userId === userId);
    
    if (filters?.status) {
      jobs = jobs.filter(j => j.status === filters.status);
    }
    
    jobs.sort((a, b) => b.createdAt - a.createdAt);
    
    if (filters?.limit) {
      jobs = jobs.slice(0, filters.limit);
    }
    
    return jobs;
  }

  private async queueExport(jobId: string): Promise<void> {
    const job = this.exportJobs.get(jobId);
    if (!job) return;
    
    job.status = 'processing';
    job.startedAt = Date.now();
    this.notifySubscribers();
    
    try {
      const result = await this.executeExport(job);
      
      job.status = 'completed';
      job.progress = 100;
      job.fileUrl = result.fileUrl;
      job.fileSize = result.fileSize;
      job.rowCount = result.rowCount;
      job.completedAt = Date.now();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = Date.now();
    }
    
    this.notifySubscribers();
  }

  private async executeExport(job: ExportJob): Promise<{ fileUrl: string; fileSize: number; rowCount: number }> {
    const { config } = job;
    const allData: Record<string, any[]> = {};
    let totalRows = 0;
    
    // Fetch data for each table
    for (let i = 0; i < config.tables.length; i++) {
      const table = config.tables[i];
      job.progress = Math.round((i / config.tables.length) * 80);
      this.notifySubscribers();
      
      const data = await this.fetchTableData(table, config.dateRange, config.filters);
      allData[table] = data;
      totalRows += data.length;
    }
    
    job.progress = 85;
    this.notifySubscribers();
    
    // Generate file
    const fileData = await this.generateFile(allData, config);
    
    job.progress = 95;
    this.notifySubscribers();
    
    // Upload to storage
    const fileUrl = await this.uploadFile(fileData, job.id, config.format);
    
    return {
      fileUrl,
      fileSize: fileData.length,
      rowCount: totalRows,
    };
  }

  private async fetchTableData(
    table: ExportTable,
    dateRange: { start: number; end: number },
    filters?: ExportFilter[]
  ): Promise<any[]> {
    // In production, query database
    // For now, return mock data
    const mockData: Record<ExportTable, any[]> = {
      trades: [
        { id: '1', timestamp: Date.now() - 86400000, side: 'buy', token: 'WIF', amount: 10000, price: 0.142, valueUsd: 1420, fee: 1.42, pnl: 50 },
        { id: '2', timestamp: Date.now() - 172800000, side: 'sell', token: 'JUP', amount: 500, price: 0.85, valueUsd: 425, fee: 0.42, pnl: -12 },
      ],
      portfolio_snapshots: [
        { timestamp: Date.now() - 86400000, totalValueUsd: 12450, tokenCount: 5, chain: 'solana' },
        { timestamp: Date.now() - 172800000, totalValueUsd: 12100, tokenCount: 5, chain: 'solana' },
      ],
      alerts: [
        { id: '1', timestamp: Date.now() - 3600000, token: 'WIF', condition: 'price_above', value: 0.15, triggered: false },
        { id: '2', timestamp: Date.now() - 7200000, token: 'SOL', condition: 'price_change', value: 10, triggered: true },
      ],
      snipe_rules: [
        { id: '1', token: 'WIF', amountUsd: 200, securityMin: 70, active: true },
      ],
      dca_orders: [
        { id: '1', token: 'SOL', amountUsd: 50, interval: 'daily', maxOrders: 30, active: true },
      ],
      positions: [
        { token: 'WIF', amount: 10000, entryPrice: 0.135, currentPrice: 0.142, pnl: 70, pnlPercent: 5.2 },
        { token: 'JUP', amount: 500, entryPrice: 0.86, currentPrice: 0.842, pnl: -9, pnlPercent: -2.1 },
      ],
      pnl: [
        { period: '24h', totalPnL: 120, totalPnLPercent: 1.0, realized: 50, unrealized: 70 },
        { period: '7d', totalPnL: 890, totalPnLPercent: 7.8, realized: 400, unrealized: 490 },
      ],
      risk_metrics: [
        { metric: 'var95', value: 1120, timestamp: Date.now() },
        { metric: 'max_drawdown', value: 8.2, timestamp: Date.now() },
      ],
      yield_positions: [
        { protocol: 'Kamino', token: 'SOL', amount: 10, apy: 12.5, valueUsd: 729 },
      ],
      tax_lots: [
        { token: 'WIF', acquired: Date.now() - 86400000, amount: 10000, costBasis: 0.135, method: 'FIFO' },
      ],
      audit_logs: [
        { id: '1', timestamp: Date.now() - 3600000, action: 'trade', resource: 'trade', details: { side: 'buy', token: 'WIF' } },
      ],
      webhook_deliveries: [
        { id: '1', timestamp: Date.now() - 1800000, event: 'price_alert', status: 'delivered', attempts: 1 },
      ],
    };
    
    let data = mockData[table] || [];
    
    // Apply date range filter
    data = data.filter(row => {
      const ts = row.timestamp || row.createdAt || row.acquired;
      return ts >= dateRange.start && ts <= dateRange.end;
    });
    
    // Apply custom filters
    if (filters) {
      for (const filter of filters) {
        data = data.filter(row => this.matchFilter(row, filter));
      }
    }
    
    return data;
  }

  private matchFilter(row: any, filter: ExportFilter): boolean {
    const value = row[filter.field];
    if (value === undefined) return false;
    
    switch (filter.operator) {
      case '=': return value == filter.value;
      case '!=': return value != filter.value;
      case '>': return value > filter.value;
      case '<': return value < filter.value;
      case '>=': return value >= filter.value;
      case '<=': return value <= filter.value;
      case 'in': return Array.isArray(filter.value) && filter.value.includes(value);
      case 'not_in': return Array.isArray(filter.value) && !filter.value.includes(value);
      case 'contains': return String(value).includes(String(filter.value));
      default: return true;
    }
  }

  private async generateFile(data: Record<string, any[]>, config: ExportConfig): Promise<Uint8Array> {
    switch (config.format) {
      case 'csv':
        return this.generateCSV(data, config);
      case 'json':
        return this.generateJSON(data, config);
      case 'parquet':
        return this.generateParquet(data, config);
      case 'xlsx':
        return this.generateXLSX(data, config);
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
  }

  private generateCSV(data: Record<string, any[]>, config: ExportConfig): Uint8Array {
    const delimiter = config.delimiter || ',';
    let csv = '';
    
    for (const [table, rows] of Object.entries(data)) {
      if (rows.length === 0) continue;
      
      // Add table header
      csv += `# Table: ${table}\n`;
      
      // Headers
      if (config.includeHeaders) {
        const headers = Object.keys(rows[0]);
        csv += headers.join(delimiter) + '\n';
      }
      
      // Rows
      for (const row of rows) {
        const values = Object.values(row).map(v => {
          if (v === null || v === undefined) return '';
          const str = String(v);
          if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csv += values.join(delimiter) + '\n';
      }
      
      csv += '\n';
    }
    
    return new TextEncoder().encode(csv);
  }

  private generateJSON(data: Record<string, any[]>, config: ExportConfig): Uint8Array {
    const json = JSON.stringify(data, null, 2);
    return new TextEncoder().encode(json);
  }

  private generateParquet(data: Record<string, any[]>, config: ExportConfig): Uint8Array {
    // In production, use apache-arrow or parquet-js
    // For now, return JSON as placeholder
    return this.generateJSON(data, config);
  }

  private generateXLSX(data: Record<string, any[]>, config: ExportConfig): Uint8Array {
    // In production, use xlsx library
    // For now, return CSV
    return this.generateCSV(data, config);
  }

  private async uploadFile(data: Uint8Array, jobId: string, format: string): Promise<string> {
    // In production, upload to S3/GCS/Azure
    // For now, create blob URL
    const blob = new Blob([data], { type: this.getMimeType(format) });
    return URL.createObjectURL(blob);
  }

  private getMimeType(format: string): string {
    const types: Record<string, string> = {
      csv: 'text/csv',
      json: 'application/json',
      parquet: 'application/octet-stream',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return types[format] || 'application/octet-stream';
  }

  // Webhook management
  createWebhookSubscription(subscription: Omit<WebhookSubscription, 'id' | 'secret' | 'createdAt' | 'updatedAt' | 'successCount' | 'failureCount'>): WebhookSubscription {
    const newSub: WebhookSubscription = {
      ...subscription,
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      secret: this.generateWebhookSecret(),
      successCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.webhookSubscriptions.set(newSub.id, newSub);
    this.webhookDeliveries.set(newSub.id, []);
    this.notifySubscribers();
    
    return newSub;
  }

  getWebhookSubscription(subscriptionId: string): WebhookSubscription | undefined {
    return this.webhookSubscriptions.get(subscriptionId);
  }

  getUserWebhookSubscriptions(userId: string): WebhookSubscription[] {
    return Array.from(this.webhookSubscriptions.values())
      .filter(s => s.userId === userId);
  }

  updateWebhookSubscription(subscriptionId: string, updates: Partial<WebhookSubscription>): WebhookSubscription | null {
    const sub = this.webhookSubscriptions.get(subscriptionId);
    if (!sub) return null;
    
    Object.assign(sub, updates, { updatedAt: Date.now() });
    this.notifySubscribers();
    return sub;
  }

  deleteWebhookSubscription(subscriptionId: string): boolean {
    const deleted = this.webhookSubscriptions.delete(subscriptionId);
    if (deleted) {
      this.webhookDeliveries.delete(subscriptionId);
      this.notifySubscribers();
    }
    return deleted;
  }

  // Emit event to webhooks
  async emitEvent(event: string, payload: any, metadata?: { source?: string; requestId?: string }): Promise<void> {
    const eventData: WebhookEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      event,
      timestamp: Date.now(),
      payload,
      metadata: {
        source: metadata?.source || 'whales-tracker',
        version: '1.0',
        requestId: metadata?.requestId || `req_${Date.now()}`,
      },
    };
    
    // Find matching subscriptions
    for (const subscription of this.webhookSubscriptions.values()) {
      if (!subscription.active) continue;
      if (!subscription.events.includes(event)) continue;
      
      // Check filters
      if (subscription.filter && !this.matchWebhookFilter(payload, subscription.filter)) {
        continue;
      }
      
      // Queue delivery
      const delivery: WebhookDelivery = {
        id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        subscriptionId: subscription.id,
        event,
        payload: eventData,
        attempt: 0,
        status: 'pending',
        startedAt: Date.now(),
      };
      
      this.deliveryQueue.push(delivery);
      
      if (!this.webhookDeliveries.has(subscription.id)) {
        this.webhookDeliveries.set(subscription.id, []);
      }
      this.webhookDeliveries.get(subscription.id)!.push(delivery);
    }
  }

  private matchWebhookFilter(payload: any, filter: WebhookFilter): boolean {
    if (filter.tokenMints && filter.tokenMints.length > 0) {
      const tokenMint = payload.tokenMint || payload.token;
      if (!tokenMint || !filter.tokenMints.includes(tokenMint)) return false;
    }
    
    if (filter.minValueUsd !== undefined) {
      const value = payload.valueUsd || payload.amountUsd;
      if (value !== undefined && value < filter.minValueUsd) return false;
    }
    
    if (filter.maxValueUsd !== undefined) {
      const value = payload.valueUsd || payload.amountUsd;
      if (value !== undefined && value > filter.maxValueUsd) return false;
    }
    
    if (filter.chains && filter.chains.length > 0) {
      const chain = payload.chainId;
      if (chain !== undefined && !filter.chains.includes(chain)) return false;
    }
    
    if (filter.severity && filter.severity.length > 0) {
      const severity = payload.severity;
      if (severity !== undefined && !filter.severity.includes(severity)) return false;
    }
    
    return true;
  }

  private async processDeliveries(): Promise<void> {
    if (this.processing || this.deliveryQueue.length === 0) return;
    
    this.processing = true;
    
    const batch = this.deliveryQueue.splice(0, this.config.maxConcurrentDeliveries);
    
    await Promise.all(batch.map(delivery => this.deliverWebhook(delivery)));
    
    this.processing = false;
    
    // Process more if queue not empty
    if (this.deliveryQueue.length > 0) {
      setTimeout(() => this.processDeliveries(), 100);
    }
  }

  private async deliverWebhook(delivery: WebhookDelivery): Promise<void> {
    const subscription = this.webhookSubscriptions.get(delivery.subscriptionId);
    if (!subscription) {
      delivery.status = 'failed';
      delivery.error = 'Subscription not found';
      return;
    }
    
    delivery.attempt++;
    delivery.status = 'retrying';
    delivery.startedAt = Date.now();
    
    try {
      const signature = this.signPayload(delivery.payload, subscription.secret);
      
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Whales-Event': delivery.event,
          'X-Whales-Signature': signature,
          'X-Whales-Delivery': delivery.id,
          'X-Whales-Timestamp': String(delivery.payload.timestamp),
          'User-Agent': 'Whales-Tracker-Webhook/1.0',
          ...subscription.headers,
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(this.config.webhookTimeoutMs),
      });
      
      delivery.responseStatus = response.status;
      delivery.responseBody = await response.text().catch(() => '');
      
      if (response.ok) {
        delivery.status = 'delivered';
        delivery.completedAt = Date.now();
        subscription.successCount++;
        subscription.lastTriggered = Date.now();
      } else {
        throw new Error(`HTTP ${response.status}: ${delivery.responseBody}`);
      }
    } catch (error) {
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      
      if (delivery.attempt >= subscription.retryPolicy.maxRetries) {
        delivery.status = 'failed';
        delivery.completedAt = Date.now();
        subscription.failureCount++;
      } else {
        delivery.status = 'pending';
        const delay = Math.min(
          subscription.retryPolicy.initialDelayMs * Math.pow(subscription.retryPolicy.backoffMultiplier, delivery.attempt - 1),
          subscription.retryPolicy.maxDelayMs
        );
        delivery.nextRetryAt = Date.now() + delay;
        // Re-queue
        setTimeout(() => this.deliveryQueue.push(delivery), delay);
      }
    }
    
    subscription.updatedAt = Date.now();
    this.notifySubscribers();
  }

  private signPayload(payload: any, secret: string): string {
    // HMAC-SHA256
    return 'sha256=' + btoa(JSON.stringify(payload)); // Simplified
  }

  private startDeliveryProcessor(): void {
    setInterval(() => this.processDeliveries(), 1000);
  }

  // Get webhook deliveries
  getWebhookDeliveries(subscriptionId: string, filters?: { status?: WebhookDelivery['status']; limit?: number }): WebhookDelivery[] {
    let deliveries = this.webhookDeliveries.get(subscriptionId) || [];
    
    if (filters?.status) {
      deliveries = deliveries.filter(d => d.status === filters.status);
    }
    
    deliveries.sort((a, b) => b.startedAt - a.startedAt);
    
    if (filters?.limit) {
      deliveries = deliveries.slice(0, filters.limit);
    }
    
    return deliveries;
  }

  // Scheduled exports
  createScheduledExport(exportConfig: Omit<ScheduledExport, 'id' | 'lastRun' | 'nextRun' | 'createdAt' | 'updatedAt'>): ScheduledExport {
    const scheduled: ScheduledExport = {
      ...exportConfig,
      id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      nextRun: this.calculateNextRun(exportConfig.schedule),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.scheduledExports.set(scheduled.id, scheduled);
    this.notifySubscribers();
    return scheduled;
  }

  getScheduledExports(userId: string): ScheduledExport[] {
    return Array.from(this.scheduledExports.values())
      .filter(s => s.userId === userId);
  }

  private calculateNextRun(schedule: ScheduledExport['schedule']): number {
    if (schedule.type === 'interval') {
      return Date.now() + parseInt(schedule.value);
    }
    // For cron, would use a cron parser
    return Date.now() + 86400000; // Default 24h
  }

  private startScheduledExportChecker(): void {
    setInterval(() => {
      const now = Date.now();
      for (const scheduled of this.scheduledExports.values()) {
        if (!scheduled.active) continue;
        if (scheduled.nextRun <= now) {
          this.runScheduledExport(scheduled.id);
        }
      }
    }, 60000);
  }

  private async runScheduledExport(scheduledId: string): Promise<void> {
    const scheduled = this.scheduledExports.get(scheduledId);
    if (!scheduled) return;
    
    try {
      const job = await this.createExportJob(scheduled.config, scheduled.userId, scheduled.organizationId);
      
      // Update scheduled export
      scheduled.lastRun = Date.now();
      scheduled.nextRun = this.calculateNextRun(scheduled.schedule);
      scheduled.updatedAt = Date.now();
      
      // Deliver when complete
      // In production, wait for completion and deliver
    } catch (error) {
      console.error('[DataExport] Scheduled export failed:', error);
    }
    
    this.notifySubscribers();
  }

  // Cleanup
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 30 * 86400000; // 30 days
    
    // Clean old export jobs
    for (const [id, job] of this.exportJobs.entries()) {
      if (job.expiresAt < now || (job.completedAt && now - job.completedAt > maxAge)) {
        this.exportJobs.delete(id);
      }
    }
    
    // Clean old deliveries
    for (const [subId, deliveries] of this.webhookDeliveries.entries()) {
      const filtered = deliveries.filter(d => now - d.startedAt < maxAge);
      this.webhookDeliveries.set(subId, filtered);
    }
  }

  // Subscriptions
  onDataChange(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try { sub(); } catch (e) { console.error('[DataExport] Subscriber error:', e); }
    }
  }

  private generateWebhookSecret(): string {
    return 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export interface DataExportConfig {
  maxConcurrentExports: number;
  maxConcurrentDeliveries: number;
  exportTimeoutMs: number;
  webhookTimeoutMs: number;
  maxFileSize: number;
  defaultExpiryDays: number;
  storageProvider: 'local' | 's3' | 'gcs' | 'azure';
  storageConfig: Record<string, any>;
}

// Singleton
let dataExportManagerInstance: DataExportManager | null = null;

export function getDataExportManager(config?: Partial<DataExportConfig>): DataExportManager {
  if (!dataExportManagerInstance) {
    dataExportManagerInstance = new DataExportManager(config);
  }
  return dataExportManagerInstance;
}

// React hook
export function useDataExport(config?: Partial<DataExportConfig>) {
  const manager = getDataExportManager(config);
  
  return {
    createExportJob: (config: ExportConfig, userId: string, organizationId?: string) => 
      manager.createExportJob(config, userId, organizationId),
    getExportJob: (id: string) => manager.getExportJob(id),
    getUserExportJobs: (userId: string, filters?: any) => manager.getUserExportJobs(userId, filters),
    createWebhookSubscription: (sub: any) => manager.createWebhookSubscription(sub),
    getWebhookSubscription: (id: string) => manager.getWebhookSubscription(id),
    getUserWebhookSubscriptions: (userId: string) => manager.getUserWebhookSubscriptions(userId),
    updateWebhookSubscription: (id: string, updates: any) => manager.updateWebhookSubscription(id, updates),
    deleteWebhookSubscription: (id: string) => manager.deleteWebhookSubscription(id),
    emitEvent: (event: string, payload: any, metadata?: any) => manager.emitEvent(event, payload, metadata),
    getWebhookDeliveries: (subscriptionId: string, filters?: any) => manager.getWebhookDeliveries(subscriptionId, filters),
    createScheduledExport: (config: any) => manager.createScheduledExport(config),
    getScheduledExports: (userId: string) => manager.getScheduledExports(userId),
    onDataChange: (callback: () => void) => manager.onDataChange(callback),
  };
}

export type { ExportConfig, ExportTable, ExportFilter, ExportJob, WebhookEvent, WebhookSubscription, WebhookFilter, WebhookDelivery, ScheduledExport };