'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useOrderBook } from '@/lib/order-book';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Minus, Plus } from 'lucide-react';
import type { OrderBookLevel } from '@/lib/order-book';

interface OrderBookProps {
  tokenMint: string;
  symbol: string;
  quoteMint?: string;
  initialDepth?: number;
}

export function OrderBook({ tokenMint, symbol, quoteMint, initialDepth = 20 }: OrderBookProps) {
  const { getSnapshot, calculateSlippage, getPriceImpactCurve } = useOrderBook(tokenMint, quoteMint);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState(initialDepth);
  const [selectedSide, setSelectedSide] = useState<'bids' | 'asks'>('asks');
  const [hoveredLevel, setHoveredLevel] = useState<{ side: 'bid' | 'ask'; index: number } | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSnapshot();
      setSnapshot(data);
    } catch (err) {
      setError('Failed to load order book');
      console.error('[OrderBook] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getSnapshot]);

  // Initial fetch - use ref to track mounted state
    const mountedRef = useRef(true);

    useEffect(() => {
      mountedRef.current = true;
      // Defer to avoid synchronous setState in effect
      setTimeout(() => {
        fetchSnapshot();
      }, 0);

      return () => {
        mountedRef.current = false;
      };
    }, [fetchSnapshot]);

  // Refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) fetchSnapshot();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  const visibleBids = useMemo(() => 
    snapshot?.bids?.slice(0, depth).reverse() || [], // Reverse for display (highest at bottom)
  [snapshot, depth]);

  const visibleAsks = useMemo(() => 
    snapshot?.asks?.slice(0, depth) || [],
  [snapshot, depth]);

  const maxBidTotal = useMemo(() => {
    if (visibleBids.length === 0) return 1;
    return Math.max(...visibleBids.map((b: any) => b.total));
  }, [visibleBids]);

  const maxAskTotal = useMemo(() => {
    if (visibleAsks.length === 0) return 1;
    return Math.max(...visibleAsks.map((a: any) => a.total));
  }, [visibleAsks]);

  const midPrice = useMemo(() => {
    if (!snapshot) return 0;
    const bestBid = snapshot.bids[0]?.price || 0;
    const bestAsk = snapshot.asks[0]?.price || 0;
    return (bestBid + bestAsk) / 2;
  }, [snapshot]);

  const spreadPct = useMemo(() => {
    if (!snapshot) return 0;
    const bestBid = snapshot.bids[0]?.price || 0;
    const bestAsk = snapshot.asks[0]?.price || 0;
    return bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0;
  }, [snapshot]);

  if (loading && !snapshot) {
    return (
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <span>Order Book</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Live</span>
          </span>
        </div>
        <div className="space-y-2" aria-busy="true">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex justify-between gap-4 h-6">
              <div className="w-1/2 h-full bg-muted animate-pulse rounded" />
              <div className="w-1/2 h-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        {error}
        <button 
          onClick={fetchSnapshot}
          className="mt-2 text-sm underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    if (price < 0.0001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
    if (amount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
    if (amount >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
    return amount.toFixed(2);
  };

  const formatUsd = (usd: number) => {
    if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(2) + 'B';
    if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(2) + 'M';
    if (usd >= 1e3) return '$' + (usd / 1e3).toFixed(2) + 'K';
    return '$' + usd.toFixed(2);
  };

  const renderLevel = (
    level: any, 
    index: number, 
    side: 'bid' | 'ask',
    maxTotal: number
  ) => {
    const isHovered = hoveredLevel?.side === side && hoveredLevel?.index === index;
    const pct = (level.total / maxTotal) * 100;
    
    return (
      <div
        key={`${side}-${index}`}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded transition-colors',
          isHovered ? 'bg-accent/50' : '',
          side === 'bid' ? 'text-green-400' : 'text-red-400'
        )}
        onMouseEnter={() => setHoveredLevel({ side, index })}
        onMouseLeave={() => setHoveredLevel(null)}
        style={{ minHeight: '22px' }}
      >
        {/* Cumulative bar */}
        <div className="relative w-20 flex-shrink-0">
          <div
            className={cn(
              'h-full absolute top-0 bottom-0 rounded transition-all duration-200',
              side === 'bid' 
                ? 'bg-green-500/20 right-0' 
                : 'bg-red-500/20 left-0'
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
          <span className="relative text-xs font-mono tabular-nums">
            {formatAmount(level.total)}
          </span>
        </div>

        {/* Price */}
        <div className="w-28 flex-shrink-0 text-right">
          <span className="font-mono tabular-nums text-sm">{formatPrice(level.price)}</span>
        </div>

        {/* Amount */}
        <div className="w-24 flex-shrink-0 text-right">
          <span className="font-mono tabular-nums text-xs text-muted-foreground">
            {formatAmount(level.amount)}
          </span>
        </div>

        {/* USD Value */}
        <div className="w-24 flex-shrink-0 text-right">
          <span className="font-mono tabular-nums text-xs text-muted-foreground">
            {formatUsd(level.valueUsd)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">{symbol} / SOL Order Book</h3>
          <span className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
            {snapshot?.dexes?.join(', ') || 'Aggregated'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-green-400">
            <ChevronUp className="w-3 h-3" />
            <span>Bid</span>
          </div>
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-1 text-red-400">
            <span>Ask</span>
            <ChevronDown className="w-3 h-3" />
          </div>
          <div className="w-px h-6 bg-border mx-1" />
          <span className="text-muted-foreground">
            Spread: {spreadPct.toFixed(4)}%
          </span>
        </div>
      </div>

      {/* Depth control */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Depth:</span>
        <div className="flex items-center gap-1 bg-muted rounded p-1">
          {[10, 20, 50, 100].map(d => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={cn(
                'px-3 py-1 text-xs rounded transition-colors',
                depth === d 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b border-border">
        <div className="w-20 text-left">Cumulative</div>
        <div className="w-28 text-right">Price</div>
        <div className="w-24 text-right">Amount</div>
        <div className="w-24 text-right">Value</div>
      </div>

      {/* Asks (Sell orders) - Red, top to bottom */}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-2">
        {visibleAsks.map((level: OrderBookLevel, i: number) => renderLevel(level, i, 'ask', maxAskTotal))}
      </div>

      {/* Spread indicator */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">
            Mid: {midPrice > 0 ? formatPrice(midPrice) : '—'}
          </span>
        </div>
      </div>

      {/* Bids (Buy orders) - Green, bottom to top (reversed) */}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-2">
        {visibleBids.map((level: OrderBookLevel, i: number) => renderLevel(level, i, 'bid', maxBidTotal))}
      </div>

      {/* Footer stats */}
      <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <span>Bids: {snapshot?.bids?.length || 0} levels</span>
        <span>Asks: {snapshot?.asks?.length || 0} levels</span>
        <span>Updated: {new Date(snapshot?.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

// Mini order book for token detail sheet
export function MiniOrderBook({ tokenMint, symbol, quoteMint }: OrderBookProps) {
  const { getSnapshot } = useOrderBook(tokenMint, quoteMint);
  const [snapshot, setSnapshot] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      const data = await getSnapshot();
      setSnapshot(data);
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [getSnapshot]);

  if (!snapshot) return null;

  const bestBid = snapshot.bids[0]?.price || 0;
  const bestAsk = snapshot.asks[0]?.price || 0;
  const spread = bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 10000 : 0;

  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{symbol} Order Book</span>
        <span className="text-xs text-muted-foreground">
          Spread: {spread.toFixed(1)} bps
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-right text-green-400 font-mono">
          {bestBid > 0 ? bestBid.toFixed(6) : '—'}
        </div>
        <div className="text-right text-muted-foreground">
          Best Bid
        </div>
        <div className="text-right text-red-400 font-mono">
          {bestAsk > 0 ? bestAsk.toFixed(6) : '—'}
        </div>
        <div className="text-right text-muted-foreground">
          Best Ask
        </div>
        <div className="text-right text-green-400 font-mono">
          {snapshot.bids[0]?.total ? snapshot.bids[0].total.toFixed(2) : '—'}
        </div>
        <div className="text-right text-muted-foreground">
          Bid Size
        </div>
        <div className="text-right text-red-400 font-mono">
          {snapshot.asks[0]?.total ? snapshot.asks[0].total.toFixed(2) : '—'}
        </div>
        <div className="text-right text-muted-foreground">
          Ask Size
        </div>
      </div>
    </div>
  );
}