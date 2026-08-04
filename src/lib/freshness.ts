/**
 * Data Freshness Utilities
 * Provides timestamps, staleness badges, and freshness indicators for all data sources
 */

export interface DataFreshness {
  source: string;
  timestamp: number;
  ageMs: number;
  ageDisplay: string;
  isStale: boolean;
  isCritical: boolean;
  quality: 'fresh' | 'recent' | 'stale' | 'critical' | 'unknown';
}

export interface FreshnessConfig {
  freshThresholdMs: number;      // < 30s = fresh
  recentThresholdMs: number;     // < 2min = recent
  staleThresholdMs: number;      // < 5min = stale
  criticalThresholdMs: number;   // >= 5min = critical
}

// Default thresholds for different data types
export const FRESHNESS_CONFIGS: Record<string, FreshnessConfig> = {
  price: {
    freshThresholdMs: 5000,      // 5s
    recentThresholdMs: 15000,    // 15s
    staleThresholdMs: 30000,     // 30s
    criticalThresholdMs: 60000,  // 1min
  },
  tokenInfo: {
    freshThresholdMs: 30000,     // 30s
    recentThresholdMs: 120000,   // 2min
    staleThresholdMs: 300000,    // 5min
    criticalThresholdMs: 600000, // 10min
  },
  holders: {
    freshThresholdMs: 60000,     // 1min
    recentThresholdMs: 300000,   // 5min
    staleThresholdMs: 600000,    // 10min
    criticalThresholdMs: 1800000, // 30min
  },
  trades: {
    freshThresholdMs: 10000,     // 10s
    recentThresholdMs: 60000,    // 1min
    staleThresholdMs: 300000,    // 5min
    criticalThresholdMs: 600000, // 10min
  },
  portfolio: {
    freshThresholdMs: 30000,     // 30s
    recentThresholdMs: 120000,   // 2min
    staleThresholdMs: 300000,    // 5min
    criticalThresholdMs: 600000, // 10min
  },
  smartMoney: {
    freshThresholdMs: 30000,     // 30s
    recentThresholdMs: 120000,   // 2min
    staleThresholdMs: 300000,    // 5min
    criticalThresholdMs: 600000, // 10min
  },
  orderBook: {
    freshThresholdMs: 5000,      // 5s
    recentThresholdMs: 15000,    // 15s
    staleThresholdMs: 30000,     // 30s
    criticalThresholdMs: 60000,  // 1min
  },
  default: {
    freshThresholdMs: 30000,
    recentThresholdMs: 120000,
    staleThresholdMs: 300000,
    criticalThresholdMs: 600000,
  },
};

export function getFreshnessConfig(dataType: string): FreshnessConfig {
  return FRESHNESS_CONFIGS[dataType] || FRESHNESS_CONFIGS.default;
}

export function calculateFreshness(
  timestamp: number,
  dataType: string = 'default'
): DataFreshness {
  const now = Date.now();
  const ageMs = now - timestamp;
  const config = getFreshnessConfig(dataType);
  
  let quality: DataFreshness['quality'];
  let isStale = false;
  let isCritical = false;
  
  if (ageMs < config.freshThresholdMs) {
    quality = 'fresh';
  } else if (ageMs < config.recentThresholdMs) {
    quality = 'recent';
  } else if (ageMs < config.staleThresholdMs) {
    quality = 'stale';
    isStale = true;
  } else if (ageMs < config.criticalThresholdMs) {
    quality = 'critical';
    isStale = true;
    isCritical = true;
  } else {
    quality = 'unknown';
    isStale = true;
    isCritical = true;
  }
  
  return {
    source: dataType,
    timestamp,
    ageMs,
    ageDisplay: formatAge(ageMs),
    isStale,
    isCritical,
    quality,
  };
}

export function formatAge(ageMs: number): string {
  if (ageMs < 1000) return 'just now';
  if (ageMs < 60000) return `${Math.floor(ageMs / 1000)}s ago`;
  if (ageMs < 3600000) return `${Math.floor(ageMs / 60000)}m ago`;
  if (ageMs < 86400000) return `${Math.floor(ageMs / 3600000)}h ago`;
  return `${Math.floor(ageMs / 86400000)}d ago`;
}

export function getQualityColor(quality: DataFreshness['quality']): string {
  switch (quality) {
    case 'fresh': return 'text-green-400';
    case 'recent': return 'text-yellow-400';
    case 'stale': return 'text-orange-400';
    case 'critical': return 'text-red-400';
    default: return 'text-muted-foreground';
  }
}

export function getQualityBg(quality: DataFreshness['quality']): string {
  switch (quality) {
    case 'fresh': return 'bg-green-500/10 border-green-500/20';
    case 'recent': return 'bg-yellow-500/10 border-yellow-500/20';
    case 'stale': return 'bg-orange-500/10 border-orange-500/20';
    case 'critical': return 'bg-red-500/10 border-red-500/20';
    default: return 'bg-muted/50 border-border';
  }
}

// Staleness badge component props
export interface StalenessBadgeProps {
  timestamp: number;
  dataType?: string;
  showIcon?: boolean;
  showText?: boolean;
  compact?: boolean;
  className?: string;
}

// Auto-refresh trigger
export function shouldAutoRefresh(
  timestamp: number,
  dataType: string = 'default',
  forceThresholdMs?: number
): boolean {
  const ageMs = Date.now() - timestamp;
  const config = getFreshnessConfig(dataType);
  const threshold = forceThresholdMs || config.staleThresholdMs;
  return ageMs > threshold;
}

// Time since last update in human readable format
export function getTimeSinceUpdate(timestamp: number): {
  text: string;
  isRecent: boolean;
} {
  const ageMs = Date.now() - timestamp;
  const isRecent = ageMs < 60000; // 1 minute
  
  if (ageMs < 1000) return { text: 'just now', isRecent: true };
  if (ageMs < 60000) return { text: `${Math.floor(ageMs / 1000)}s ago`, isRecent };
  if (ageMs < 3600000) return { text: `${Math.floor(ageMs / 60000)}m ago`, isRecent: false };
  if (ageMs < 86400000) return { text: `${Math.floor(ageMs / 3600000)}h ago`, isRecent: false };
  return { text: `${Math.floor(ageMs / 86400000)}d ago`, isRecent: false };
}

// Batch freshness calculation for multiple data points
export function calculateBatchFreshness(
  items: Array<{ id: string; timestamp: number; dataType?: string }>
): Map<string, DataFreshness> {
  const results = new Map<string, DataFreshness>();
  
  for (const item of items) {
    const dataType = item.dataType || 'default';
    results.set(item.id, calculateFreshness(item.timestamp, dataType));
  }
  
  return results;
}

// Get overall freshness for a data source with multiple timestamps
export function getOverallFreshness(
  timestamps: number[],
  dataType: string = 'default'
): DataFreshness {
  if (timestamps.length === 0) {
    return {
      source: dataType,
      timestamp: 0,
      ageMs: Infinity,
      ageDisplay: 'never',
      isStale: true,
      isCritical: true,
      quality: 'unknown',
    };
  }
  
  // Use the most recent timestamp
  const latest = Math.max(...timestamps);
  return calculateFreshness(latest, dataType);
}