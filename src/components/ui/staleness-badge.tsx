'use client';

import React from 'react';
import { 
  calculateFreshness, 
  getQualityColor, 
  getQualityBg,
  formatAge,
  shouldAutoRefresh,
  getTimeSinceUpdate,
  StalenessBadgeProps 
} from '@/lib/freshness';
import { cn } from '@/lib/utils';
import { AlertCircle, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export function StalenessBadge({ 
  timestamp, 
  dataType = 'default',
  showIcon = true,
  showText = true,
  compact = false,
  className 
}: StalenessBadgeProps) {
  const freshness = calculateFreshness(timestamp, dataType);
  
  if (freshness.quality === 'unknown' && timestamp === 0) {
    return (
      <span 
        className={cn(
          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full',
          'bg-muted/50 text-muted-foreground border border-border',
          className
        )}
      >
        {showIcon && <Clock className="w-3 h-3" />}
        {showText && 'No data'}
      </span>
    );
  }
  
  const bgClass = getQualityBg(freshness.quality);
  const textClass = getQualityColor(freshness.quality);
  
  let Icon: React.ComponentType<{ className?: string }>;
  switch (freshness.quality) {
    case 'fresh': Icon = CheckCircle2; break;
    case 'recent': Icon = Clock; break;
    case 'stale': Icon = AlertTriangle; break;
    case 'critical': Icon = AlertCircle; break;
    default: Icon = Clock;
  }
  
  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border',
        bgClass,
        textClass,
        compact && 'px-1.5 py-0.5',
        className
      )}
      title={`Last updated: ${new Date(timestamp).toLocaleString()} (${freshness.ageDisplay})`}
    >
      {showIcon && <Icon className={cn('w-3 h-3', compact && 'w-2.5 h-2.5')} />}
      {showText && (
        <span className={cn('whitespace-nowrap', compact && 'hidden sm:inline')}>
          {freshness.ageDisplay}
        </span>
      )}
      {compact && showText && (
        <span className="inline-block w-4 text-center">
          {freshness.ageDisplay}
        </span>
      )}
    </span>
  );
}

interface FreshnessIndicatorProps {
  timestamp: number;
  dataType?: string;
  showDetails?: boolean;
  className?: string;
}

export function FreshnessIndicator({ 
  timestamp, 
  dataType = 'default',
  showDetails = false,
  className 
}: FreshnessIndicatorProps) {
  const freshness = calculateFreshness(timestamp, dataType);
  const { text, isRecent } = getTimeSinceUpdate(timestamp);
  
  if (freshness.quality === 'unknown' && timestamp === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Clock className="w-4 h-4 opacity-50" />
        <span>No data available</span>
      </div>
    );
  }
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <StalenessBadge 
        timestamp={timestamp} 
        dataType={dataType}
        showIcon={true}
        showText={true}
        compact={false}
      />
      {showDetails && (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{text}</span>
          <span>Updated: {new Date(timestamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}

// Hook for auto-refreshing stale data
export function useStaleRefresh(
  timestamp: number,
  dataType: string = 'default',
  onRefresh: () => void,
  intervalMs: number = 10000
) {
  React.useEffect(() => {
    const checkStaleness = () => {
      if (shouldAutoRefresh(timestamp, dataType)) {
        onRefresh();
      }
    };
    
    const interval = setInterval(checkStaleness, intervalMs);
    return () => clearInterval(interval);
  }, [timestamp, dataType, onRefresh, intervalMs]);
}

// Re-export for convenience
export { getTimeSinceUpdate } from '@/lib/freshness';
