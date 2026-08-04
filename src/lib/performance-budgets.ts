/**
 * Performance Budgets
 * Bundle < 200KB gzipped, TTI < 3s, 60fps scroll, LCP < 2.5s
 */

export interface PerformanceBudget {
  name: string;
  metric: string;
  threshold: number;
  unit: 'ms' | 'kb' | 'mb' | 'fps' | 'score' | 'bytes';
  severity: 'error' | 'warning' | 'info';
}

export interface PerformanceMetrics {
  // Bundle metrics
  totalBundleSize: number; // bytes
  gzippedBundleSize: number; // bytes
  jsBundleSize: number; // bytes
  cssBundleSize: number; // bytes
  
  // Loading metrics
  lcp: number; // ms
  fcp: number; // ms
  ttfb: number; // ms
  tti: number; // ms
  fid: number; // ms
  cls: number; // score
  
  // Runtime metrics
  fps: number;
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  
  // Network metrics
  totalRequests: number;
  totalTransferSize: number; // bytes
  thirdPartyRequests: number;
  
  // Custom metrics
  apiLatencyP50: number; // ms
  apiLatencyP95: number; // ms
  apiLatencyP99: number; // ms
  
  timestamp: number;
}

export interface BudgetReport {
  passed: boolean;
  results: BudgetResult[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  metrics: PerformanceMetrics;
}

export interface BudgetResult {
  budget: PerformanceBudget;
  actual: number;
  passed: boolean;
  difference: number; // positive = over budget
  percentage: number; // actual / threshold * 100
}

export interface PerformanceObserverEntry extends PerformanceEntry {
  value?: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
}

class PerformanceBudgetManager {
  private budgets: PerformanceBudget[] = [];
  private metrics: PerformanceMetrics | null = null;
  private observers: PerformanceObserver[] = [];
  private subscribers: Set<(report: BudgetReport) => void> = new Set();
  private measurementInterval: NodeJS.Timeout | null = null;

  constructor(budgets?: PerformanceBudget[]) {
    this.budgets = budgets || this.getDefaultBudgets();
    
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private getDefaultBudgets(): PerformanceBudget[] {
    return [
      // Bundle budgets
      { name: 'Total Bundle Size (gzipped)', metric: 'gzippedBundleSize', threshold: 200 * 1024, unit: 'bytes', severity: 'error' },
      { name: 'JS Bundle Size (gzipped)', metric: 'jsBundleSize', threshold: 150 * 1024, unit: 'bytes', severity: 'error' },
      { name: 'CSS Bundle Size (gzipped)', metric: 'cssBundleSize', threshold: 30 * 1024, unit: 'bytes', severity: 'warning' },
      
      // Core Web Vitals
      { name: 'Largest Contentful Paint (LCP)', metric: 'lcp', threshold: 2500, unit: 'ms', severity: 'error' },
      { name: 'First Contentful Paint (FCP)', metric: 'fcp', threshold: 1800, unit: 'ms', severity: 'warning' },
      { name: 'Time to First Byte (TTFB)', metric: 'ttfb', threshold: 800, unit: 'ms', severity: 'warning' },
      { name: 'Time to Interactive (TTI)', metric: 'tti', threshold: 3000, unit: 'ms', severity: 'error' },
      { name: 'First Input Delay (FID)', metric: 'fid', threshold: 100, unit: 'ms', severity: 'error' },
      { name: 'Cumulative Layout Shift (CLS)', metric: 'cls', threshold: 0.1, unit: 'score', severity: 'error' },
      
      // Runtime
      { name: 'Frame Rate (FPS)', metric: 'fps', threshold: 60, unit: 'fps', severity: 'warning' },
      { name: 'Memory Usage', metric: 'memoryUsage', threshold: 100 * 1024 * 1024, unit: 'bytes', severity: 'warning' },
      
      // Network
      { name: 'Total Transfer Size', metric: 'totalTransferSize', threshold: 500 * 1024, unit: 'bytes', severity: 'warning' },
      { name: 'Total Requests', metric: 'totalRequests', threshold: 50, unit: 'score', severity: 'info' },
      { name: 'Third Party Requests', metric: 'thirdPartyRequests', threshold: 10, unit: 'score', severity: 'info' },
      
      // API
      { name: 'API Latency P50', metric: 'apiLatencyP50', threshold: 200, unit: 'ms', severity: 'warning' },
      { name: 'API Latency P95', metric: 'apiLatencyP95', threshold: 500, unit: 'ms', severity: 'error' },
      { name: 'API Latency P99', metric: 'apiLatencyP99', threshold: 1000, unit: 'ms', severity: 'error' },
    ];
  }

  private initialize(): void {
    this.setupPerformanceObservers();
    this.measureInitialMetrics();
    this.startPeriodicMeasurement();
  }

  private setupPerformanceObservers(): void {
    // LCP
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceObserverEntry;
          if (lastEntry) {
            this.updateMetric('lcp', lastEntry.startTime);
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        this.observers.push(lcpObserver);
      } catch (e) { console.warn('[Perf] LCP observer not supported'); }

      // FID
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            this.updateMetric('fid', entry.processingStart - entry.startTime);
          }
        });
        fidObserver.observe({ type: 'first-input', buffered: true });
        this.observers.push(fidObserver);
      } catch (e) { console.warn('[Perf] FID observer not supported'); }

      // CLS
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const clsEntry = entry as any;
            if (!clsEntry.hadRecentInput) {
              clsValue += clsEntry.value;
            }
          }
          this.updateMetric('cls', clsValue);
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
        this.observers.push(clsObserver);
      } catch (e) { console.warn('[Perf] CLS observer not supported'); }

      // FCP
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.name === 'first-contentful-paint') {
              this.updateMetric('fcp', entry.startTime);
            }
          }
        });
        fcpObserver.observe({ type: 'paint', buffered: true });
        this.observers.push(fcpObserver);
      } catch (e) { console.warn('[Perf] FCP observer not supported'); }

      // Navigation timing
      try {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const navEntry = entry as PerformanceNavigationTiming;
            this.updateMetric('ttfb', navEntry.responseStart - navEntry.requestStart);
            // TTI is more complex, approximate
            this.updateMetric('tti', navEntry.domInteractive);
          }
        });
        navObserver.observe({ type: 'navigation', buffered: true });
        this.observers.push(navObserver);
      } catch (e) { console.warn('[Perf] Navigation observer not supported'); }

      // Resource timing
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          this.analyzeResources(list.getEntries());
        });
        resourceObserver.observe({ type: 'resource', buffered: true });
        this.observers.push(resourceObserver);
      } catch (e) { console.warn('[Perf] Resource observer not supported'); }
    }
  }

  private analyzeResources(entries: PerformanceEntry[]): void {
    let totalSize = 0;
    let requestCount = 0;
    let thirdPartyCount = 0;
    const currentOrigin = window.location.origin;

    for (const entry of entries) {
      const resourceEntry = entry as PerformanceResourceTiming;
      totalSize += resourceEntry.transferSize || 0;
      requestCount++;

      try {
        const url = new URL(resourceEntry.name);
        if (url.origin !== currentOrigin) {
          thirdPartyCount++;
        }
      } catch (e) {
        // Invalid URL
      }
    }

    this.updateMetric('totalTransferSize', totalSize);
    this.updateMetric('totalRequests', requestCount);
    this.updateMetric('thirdPartyRequests', thirdPartyCount);
  }

  private measureInitialMetrics(): void {
    // Bundle size (from build info or resource timing)
    this.estimateBundleSizes();
    
    // Memory
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.updateMetric('memoryUsage', memory.usedJSHeapSize);
    }

    // FPS estimation
    this.startFPSMonitoring();
  }

  private estimateBundleSizes(): void {
    // Get from resource timing
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let jsSize = 0;
    let cssSize = 0;

    for (const resource of resources) {
      if (resource.name.endsWith('.js') || resource.name.includes('.js?')) {
        jsSize += resource.transferSize || 0;
      } else if (resource.name.endsWith('.css') || resource.name.includes('.css?')) {
        cssSize += resource.transferSize || 0;
      }
    }

    this.updateMetric('jsBundleSize', jsSize);
    this.updateMetric('cssBundleSize', cssSize);
    this.updateMetric('gzippedBundleSize', jsSize + cssSize);
  }

  private startFPSMonitoring(): void {
    let frames = 0;
    let lastTime = performance.now();

    const measureFPS = (now: number) => {
      frames++;
      const elapsed = now - lastTime;
      
      if (elapsed >= 1000) {
        const fps = Math.round((frames * 1000) / elapsed);
        this.updateMetric('fps', fps);
        frames = 0;
        lastTime = now;
      }
      
      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  private startPeriodicMeasurement(): void {
    this.measurementInterval = setInterval(() => {
      this.updateMemoryUsage();
      this.checkBudgets();
    }, 30000); // Every 30 seconds
  }

  private updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.updateMetric('memoryUsage', memory.usedJSHeapSize);
    }
  }

  private updateMetric(metric: keyof PerformanceMetrics, value: number): void {
    if (!this.metrics) {
      this.metrics = this.getEmptyMetrics();
    }
    (this.metrics as any)[metric] = value;
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalBundleSize: 0,
      gzippedBundleSize: 0,
      jsBundleSize: 0,
      cssBundleSize: 0,
      lcp: 0,
      fcp: 0,
      ttfb: 0,
      tti: 0,
      fid: 0,
      cls: 0,
      fps: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      totalRequests: 0,
      totalTransferSize: 0,
      thirdPartyRequests: 0,
      apiLatencyP50: 0,
      apiLatencyP95: 0,
      apiLatencyP99: 0,
      timestamp: Date.now(),
    };
  }

  // Record API latency
  recordAPILatency(latency: number): void {
    if (!this.metrics) this.metrics = this.getEmptyMetrics();
    
    // Store in session storage for percentile calculation
    const stored = sessionStorage.getItem('api_latencies');
    const latencies: number[] = stored ? JSON.parse(stored) : [];
    latencies.push(latency);
    
    // Keep last 100
    if (latencies.length > 100) latencies.shift();
    
    sessionStorage.setItem('api_latencies', JSON.stringify(latencies));
    
    // Calculate percentiles
    const sorted = [...latencies].sort((a, b) => a - b);
    this.updateMetric('apiLatencyP50', sorted[Math.floor(sorted.length * 0.5)] || 0);
    this.updateMetric('apiLatencyP95', sorted[Math.floor(sorted.length * 0.95)] || 0);
    this.updateMetric('apiLatencyP99', sorted[Math.floor(sorted.length * 0.99)] || 0);
  }

  // Check all budgets
  checkBudgets(): BudgetReport {
    if (!this.metrics) {
      this.metrics = this.getEmptyMetrics();
    }

    const results: BudgetResult[] = [];
    let errors = 0;
    let warnings = 0;
    let info = 0;

    for (const budget of this.budgets) {
      const actual = (this.metrics as any)[budget.metric] || 0;
      const passed = actual <= budget.threshold;
      const difference = actual - budget.threshold;
      const percentage = budget.threshold > 0 ? (actual / budget.threshold) * 100 : 0;

      const result: BudgetResult = {
        budget,
        actual,
        passed,
        difference,
        percentage,
      };

      results.push(result);

      if (!passed) {
        switch (budget.severity) {
          case 'error': errors++; break;
          case 'warning': warnings++; break;
          case 'info': info++; break;
        }
      }
    }

    const report: BudgetReport = {
      passed: errors === 0,
      results,
      summary: { errors, warnings, info },
      metrics: this.metrics,
    };

    // Notify subscribers
    for (const sub of this.subscribers) {
      try { sub(report); } catch (e) { console.error('[Perf] Subscriber error:', e); }
    }

    return report;
  }

  // Get current report
  getReport(): BudgetReport {
    return this.checkBudgets();
  }

  // Get metrics
  getMetrics(): PerformanceMetrics | null {
    return this.metrics;
  }

  // Add custom budget
  addBudget(budget: PerformanceBudget): void {
    this.budgets.push(budget);
  }

  // Remove budget
  removeBudget(name: string): boolean {
    const index = this.budgets.findIndex(b => b.name === name);
    if (index !== -1) {
      this.budgets.splice(index, 1);
      return true;
    }
    return false;
  }

  // Update budget
  updateBudget(name: string, updates: Partial<PerformanceBudget>): boolean {
    const budget = this.budgets.find(b => b.name === name);
    if (budget) {
      Object.assign(budget, updates);
      return true;
    }
    return false;
  }

  // Get all budgets
  getBudgets(): PerformanceBudget[] {
    return [...this.budgets];
  }

  // Subscriptions
  onBudgetCheck(callback: (report: BudgetReport) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Generate CI-friendly report
  generateCIReport(): string {
    const report = this.getReport();
    let output = 'Performance Budget Report\n';
    output += '==========================\n\n';
    
    for (const result of report.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const severity = result.budget.severity.toUpperCase();
      output += `${status} [${severity}] ${result.budget.name}\n`;
      output += `  Threshold: ${this.formatValue(result.budget.threshold, result.budget.unit)}\n`;
      output += `  Actual:    ${this.formatValue(result.actual, result.budget.unit)}\n`;
      output += `  Diff:      ${result.difference >= 0 ? '+' : ''}${this.formatValue(result.difference, result.budget.unit)} (${result.percentage.toFixed(1)}%)\n\n`;
    }

    output += `Summary: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.info} info\n`;
    output += `Overall: ${report.passed ? 'PASSED' : 'FAILED'}\n`;

    return output;
  }

  private formatValue(value: number, unit: string): string {
    switch (unit) {
      case 'bytes':
        if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
        if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
        return `${value} B`;
      case 'ms':
        if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
        return `${value.toFixed(0)} ms`;
      case 'fps':
        return `${value.toFixed(0)} fps`;
      case 'score':
        return value.toFixed(3);
      default:
        return value.toString();
    }
  }

  // Cleanup
  destroy(): void {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];
    if (this.measurementInterval) {
      clearInterval(this.measurementInterval);
    }
  }
}

// Singleton
let performanceBudgetManagerInstance: PerformanceBudgetManager | null = null;

export function getPerformanceBudgetManager(budgets?: PerformanceBudget[]): PerformanceBudgetManager {
  if (!performanceBudgetManagerInstance) {
    performanceBudgetManagerInstance = new PerformanceBudgetManager(budgets);
  }
  return performanceBudgetManagerInstance;
}

// React hook
export function usePerformanceBudget(budgets?: PerformanceBudget[]) {
  const manager = getPerformanceBudgetManager(budgets);
  
  return {
    checkBudgets: () => manager.checkBudgets(),
    getReport: () => manager.getReport(),
    getMetrics: () => manager.getMetrics(),
    recordAPILatency: (latency: number) => manager.recordAPILatency(latency),
    addBudget: (budget: PerformanceBudget) => manager.addBudget(budget),
    removeBudget: (name: string) => manager.removeBudget(name),
    updateBudget: (name: string, updates: Partial<PerformanceBudget>) => manager.updateBudget(name, updates),
    getBudgets: () => manager.getBudgets(),
    generateCIReport: () => manager.generateCIReport(),
    onBudgetCheck: (callback: (report: BudgetReport) => void) => manager.onBudgetCheck(callback),
  };
}

export type { PerformanceBudget, PerformanceMetrics, BudgetReport, BudgetResult };

// Webpack/Bundle analyzer integration
export interface BundleAnalyzerConfig {
  analyzerMode: 'static' | 'server' | 'disabled';
  openAnalyzer: boolean;
  reportFilename: string;
  defaultSizes: 'parsed' | 'gzip' | 'stat';
  generateStatsFile: boolean;
  statsFilename: string;
  logLevel: 'info' | 'warn' | 'error' | 'silent';
}

// Next.js bundle analyzer wrapper
export function withBundleAnalyzer(config: BundleAnalyzerConfig = {}) {
  const defaultConfig: BundleAnalyzerConfig = {
    analyzerMode: process.env.ANALYZE === 'true' ? 'static' : 'disabled',
    openAnalyzer: false,
    reportFilename: 'bundle-report.html',
    defaultSizes: 'gzip',
    generateStatsFile: true,
    statsFilename: 'bundle-stats.json',
    logLevel: 'info',
    ...config,
  };

  return defaultConfig;
}

// Performance marks for custom measurements
export function markStart(name: string): void {
  performance.mark(`${name}-start`);
}

export function markEnd(name: string): number {
  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);
  
  const measures = performance.getEntriesByName(name, 'measure');
  const duration = measures[measures.length - 1]?.duration || 0;
  
  // Clean up
  performance.clearMarks(`${name}-start`);
  performance.clearMarks(`${name}-end`);
  performance.clearMeasures(name);
  
  return duration;
}

export function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  markStart(name);
  return fn().finally(() => {
    markEnd(name);
  });
}