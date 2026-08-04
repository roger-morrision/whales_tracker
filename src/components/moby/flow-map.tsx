'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useFlowMap } from '@/lib/flow-map';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCw, ZoomIn, ZoomOut, Target, Filter, Info } from 'lucide-react';

interface FlowMapProps {
  tokenMint?: string;
  symbol?: string;
  timeRangeHours?: number;
  className?: string;
}

export function FlowMap({ tokenMint, symbol, timeRangeHours = 24, className }: FlowMapProps) {
  const { getFlowMap } = useFlowMap(tokenMint, timeRangeHours);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(timeRangeHours);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const setDataSafe = (data: any) => {
    if (mountedRef.current) {
      setData(data);
    }
  };
  const setLoadingSafe = (loading: boolean) => {
    if (mountedRef.current) {
      setLoading(loading);
    }
  };
  const setErrorSafe = (error: string | null) => {
    if (mountedRef.current) {
      setError(error);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const flowData = await getFlowMap();
      setData(flowData);
    } catch (err) {
      setError('Failed to load flow map');
      console.error('[FlowMap] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getFlowMap]);

  // Initial fetch - use ref to track mounted state
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    if (mountedRef.current) fetchData();
    
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  // Refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) fetchData();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Draw legend
    const drawLegend = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const legendX = 10;
      let legendY = 10;
    
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(legendX - 5, legendY - 5, 180, 120);
    
      // Title
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText('Wallet Types', legendX, legendY + 15);
      legendY += 20;
    
      const types = [
        { type: 'whale', color: '#F59E0B', label: 'Whale' },
        { type: 'smart_money', color: '#14F195', label: 'Smart Money' },
        { type: 'kol', color: '#EC4899', label: 'KOL' },
        { type: 'fund', color: '#8B5CF6', label: 'Fund' },
        { type: 'mev', color: '#EF4444', label: 'MEV' },
      ];
    
      for (const t of types) {
        ctx.beginPath();
        ctx.arc(legendX + 8, legendY + 6, 6, 0, Math.PI * 2);
        ctx.fillStyle = t.color;
        ctx.fill();
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(t.label, legendX + 20, legendY + 10);
        legendY += 18;
      }
    };

    // Render using Canvas for performance
    useEffect(() => {
      if (!canvasRef.current || !data) return;
    
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
    
      const container = containerRef.current;
      if (!container) return;
    
      // Set canvas size
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    
      const draw = () => {
        if (!canvasRef.current || !data) return;
      
        const ctx = canvasRef.current.getContext('2d')!;
        const width = rect.width;
        const height = rect.height;
      
        // Clear
        ctx.clearRect(0, 0, width, height);
      
        // Apply transform
        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
      
        // Draw edges first (behind nodes)
        if (data.edges) {
          for (const edge of data.edges) {
            const fromNode = data.nodes.find((n: any) => n.address === edge.from);
            const toNode = data.nodes.find((n: any) => n.address === edge.to);
          
            if (!fromNode || !toNode || fromNode.x === undefined || toNode.x === undefined) continue;
          
            const progress = isPlaying ? (Date.now() % 2000) / 2000 : 0;
          
            // Draw curved line
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
          
            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const offset = Math.min(dist * 0.3, 100);
            const perpX = -dy / dist * offset;
            const perpY = dx / dist * offset;
          
            ctx.quadraticCurveTo(midX + perpX, midY + perpY, toNode.x, toNode.y);
          
            // Gradient based on direction
            const gradient = ctx.createLinearGradient(fromNode.x, fromNode.y, toNode.x, toNode.y);
            if (edge.direction === 'inflow') {
              gradient.addColorStop(0, 'rgba(20, 241, 149, 0.3)');
              gradient.addColorStop(1, 'rgba(20, 241, 149, 0.8)');
            } else {
              gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
              gradient.addColorStop(1, 'rgba(239, 68, 68, 0.8)');
            }
          
            ctx.strokeStyle = gradient;
            ctx.lineWidth = Math.max(1, Math.min(4, edge.amountUsd / 50000));
            ctx.stroke();
          
            // Draw animated particle
            if (isPlaying && progress > 0 && progress < 1) {
              const particleX = fromNode.x + (toNode.x - fromNode.x) * progress;
              const particleY = fromNode.y + (toNode.y - fromNode.y) * progress;
            
              ctx.beginPath();
              ctx.arc(particleX, particleY, 4, 0, Math.PI * 2);
              ctx.fillStyle = edge.direction === 'inflow' ? '#14F195' : '#EF4444';
              ctx.fill();
            }
          
            // Arrow head
            const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
            const arrowSize = 8;
            ctx.beginPath();
            ctx.moveTo(toNode.x - arrowSize * Math.cos(angle - Math.PI / 6), toNode.y - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(toNode.x, toNode.y);
            ctx.lineTo(toNode.x - arrowSize * Math.cos(angle + Math.PI / 6), toNode.y - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.fillStyle = edge.direction === 'inflow' ? '#14F195' : '#EF4444';
            ctx.fill();
          }
        }
      
        // Draw nodes
        if (data.nodes) {
          for (const node of data.nodes) {
            if (node.x === undefined || node.y === undefined) continue;
          
            const isSelected = selectedNode?.address === node.address;
            const radius = Math.max(8, Math.min(30, (node.size || 10) * zoom));
          
            // Node glow
            if (isSelected) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
              ctx.fillStyle = node.color + '40';
              ctx.fill();
            }
          
            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.fill();
          
            // Node border
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = isSelected ? '#fff' : 'rgba(0,0,0,0.2)';
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.stroke();
          
            // Node label (for larger nodes)
            if (radius > 12) {
              ctx.font = `${Math.max(10, 12 * zoom)}px system-ui, sans-serif`;
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const label = node.label.length > 10 ? node.label.slice(0, 8) + '..' : node.label;
              ctx.fillText(label, node.x, node.y);
            }
          
            // Type indicator
            ctx.font = '10px system-ui, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.textAlign = 'center';
            ctx.fillText(node.type.slice(0, 1).toUpperCase(), node.x, node.y + radius + 12);
          }
        }
      
        ctx.restore();
      
        // Draw legend
        drawLegend(ctx, width, height);
      
        if (isPlaying) {
          requestAnimationFrame(draw);
        }
      };
    
      draw();
    }, [data, selectedNode, zoom, pan, isPlaying, drawLegend]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    
    // Find clicked node
    for (const node of data.nodes) {
      if (node.x === undefined || node.y === undefined) continue;
      const radius = Math.max(8, Math.min(30, (node.size || 10) * zoom));
      const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (dist <= radius) {
        setSelectedNode(node);
        return;
      }
    }
    
    setSelectedNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startPanX = pan.x;
    const startPanY = pan.y;
    
    const handleMove = (e: MouseEvent) => {
      setPan({
        x: startPanX + (e.clientX - startX),
        y: startPanY + (e.clientY - startY),
      });
    };
    
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (loading && !data) {
    return (
      <div className={cn('relative h-96 rounded-lg border bg-muted/50 flex items-center justify-center', className)}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading flow map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('relative h-96 rounded-lg border bg-destructive/10 flex items-center justify-center', className)}>
        <div className="text-center text-destructive">
          <p>{error}</p>
          <button onClick={fetchData} className="mt-2 text-sm underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className={cn('relative h-96 rounded-lg border bg-muted/50 flex items-center justify-center', className)}>
        <div className="text-center text-muted-foreground">
          <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No smart money flows detected</p>
          <p className="text-sm mt-1">Try a different time range or token</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn('relative h-96 rounded-lg border bg-card overflow-hidden', className)}
      style={{ touchAction: 'none' }}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab"
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ touchAction: 'none' }}
      />

      {/* Controls */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg bg-background/90 backdrop-blur px-3 py-1 rounded">
            {symbol ? `${symbol} Smart Money Flows` : 'Smart Money Flow Map'}
          </h3>
          <span className="px-2 py-1 text-xs rounded bg-background/90 backdrop-blur text-muted-foreground">
            {data.nodes.length} wallets · {data.edges.length} flows · ${(data.totalVolumeUsd / 1e6).toFixed(1)}M volume
          </span>
        </div>
        
        <div className="flex items-center gap-1 bg-background/90 backdrop-blur rounded-lg p-1 border">
          <select
            value={timeRange}
            onChange={(e) => { setTimeRange(parseInt(e.target.value)); fetchData(); }}
            className="px-2 py-1 text-sm rounded border-none bg-transparent focus:outline-none"
          >
            <option value={1}>1H</option>
            <option value={6}>6H</option>
            <option value={24}>24H</option>
            <option value={72}>3D</option>
            <option value={168}>7D</option>
          </select>
          
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title={isPlaying ? 'Pause animation' : 'Play animation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setZoom(prev => Math.max(0.3, prev / 1.2))}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <button
            onClick={resetView}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Reset view"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={fetchData}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4 animate-spin" />
          </button>
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <div className="bg-background/95 backdrop-blur border rounded-lg p-4 max-w-md mx-auto shadow-lg animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  {selectedNode.type.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{selectedNode.label}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedNode.address.slice(0, 10)}...{selectedNode.address.slice(-6)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Score</p>
                <p className="font-semibold">{selectedNode.score}/100</p>
              </div>
              <div>
                <p className="text-muted-foreground">30d PnL</p>
                <p className="font-semibold text-green-400">${selectedNode.pnl30d.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Win Rate</p>
                <p className="font-semibold">{selectedNode.winRate}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">24h Volume</p>
                <p className="font-semibold">${(selectedNode.volume24h / 1000).toFixed(0)}K</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Top Tokens</p>
                <p className="font-semibold">{selectedNode.topTokens.slice(0, 5).join(', ') || '—'}</p>
              </div>
            </div>
            
            <div className="mt-3 flex gap-2">
              <button className="flex-1 px-3 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                View Wallet
              </button>
              <button className="flex-1 px-3 py-2 text-sm rounded border hover:bg-accent transition-colors">
                Follow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Tokens Sidebar */}
      {data.topTokens.length > 0 && (
        <div className="absolute top-3 right-3 bottom-3 w-48 z-10">
          <div className="bg-background/95 backdrop-blur border rounded-lg p-3 h-full overflow-y-auto shadow-lg">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" />
              Top Tokens
            </h4>
            <div className="space-y-1">
              {data.topTokens.slice(0, 8).map((token: any, i: number) => (
                <div key={token.symbol} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-accent transition-colors">
                  <span className="font-medium">{token.symbol}</span>
                  <span className="text-muted-foreground">${(token.volumeUsd / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Time indicator */}
      <div className="absolute bottom-3 left-3 z-10 text-xs text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded">
        Updated: {new Date(data.timeRange.end).toLocaleTimeString()}
        {isPlaying && <span className="ml-2 text-green-400 animate-pulse">● Live</span>}
      </div>
    </div>
  );
}

// Mini version for token detail sheet
export function MiniFlowMap({ tokenMint, symbol, timeRangeHours = 24 }: FlowMapProps) {
  const { getFlowMap } = useFlowMap(tokenMint, timeRangeHours);
  const [data, setData] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const d = await getFlowMap();
      setData(d);
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [getFlowMap]);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 300;
    const height = 200;
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    ctx.clearRect(0, 0, width, height);
    
    // Simple mini visualization
    if (data.nodes.length > 0) {
      // Draw nodes in a cluster
      const centerX = width / 2;
      const centerY = height / 2;
      
      data.nodes.slice(0, 10).forEach((node: any, i: number) => {
        const angle = (i / Math.min(data.nodes.length, 10)) * Math.PI * 2;
        const radius = 60;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
      });
      
      // Center token
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#14F195';
      ctx.fill();
      
      // Lines from center to nodes
      data.nodes.slice(0, 10).forEach((node: any, i: number) => {
        const angle = (i / Math.min(data.nodes.length, 10)) * Math.PI * 2;
        const radius = 60;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = node.color + '60';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.fillText(symbol || 'Token', centerX, centerY + 4);
  }, [data, symbol]);

  if (!data) return null;

  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Smart Money Flow</span>
        <span className="text-xs text-muted-foreground">
          {data.nodes.length} wallets · {data.edges.length} flows
        </span>
      </div>
      <canvas ref={canvasRef} className="w-full h-40 rounded" />
      <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <span>Inflow: <span className="text-green-400 font-mono">{data.edges.filter((e: any) => e.direction === 'inflow').length}</span></span>
        <span>Outflow: <span className="text-red-400 font-mono">{data.edges.filter((e: any) => e.direction === 'outflow').length}</span></span>
      </div>
    </div>
  );
}