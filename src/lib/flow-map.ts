/**
 * Smart Money Flow Map - Graph visualization of wallet-to-wallet flows
 * Uses GMGN smart money tracking data
 */

export interface WalletNode {
  address: string;
  label: string;
  type: 'whale' | 'smart_money' | 'kol' | 'fund' | 'mev' | 'unknown';
  score: number; // 0-100
  pnl30d: number;
  winRate: number;
  volume24h: number;
  topTokens: string[];
  color: string;
  size: number; // Node size based on volume/score
  x?: number;
  y?: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  token: string;
  tokenSymbol: string;
  amountUsd: number;
  amountToken: number;
  timestamp: number;
  type: 'buy' | 'sell' | 'transfer';
  direction: 'inflow' | 'outflow'; // From perspective of 'to' wallet
}

export interface FlowMapData {
  nodes: WalletNode[];
  edges: FlowEdge[];
  timeRange: { start: number; end: number };
  totalVolumeUsd: number;
  topTokens: { symbol: string; volumeUsd: number }[];
}

class SmartMoneyFlowMapper {
  private cache: Map<string, { data: FlowMapData; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute

  async getFlowMap(
    tokenMint?: string,
    timeRangeHours: number = 24,
    limit: number = 100
  ): Promise<FlowMapData | null> {
    const cacheKey = `flow-${tokenMint || 'all'}-${timeRangeHours}h-${limit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Fetch smart money trades from GMGN
      const smartMoneyTrades = await this.fetchSmartMoneyTrades(tokenMint, timeRangeHours, limit);
      const kolTrades = await this.fetchKolTrades(tokenMint, timeRangeHours, limit);
      
      // Combine and process
      const allTrades = [...smartMoneyTrades, ...kolTrades];
      
      if (allTrades.length === 0) {
        return this.getEmptyFlowMap();
      }

      // Build nodes (unique wallets)
      const walletMap = new Map<string, WalletNode>();
      
      for (const trade of allTrades) {
        const walletAddress = trade.wallet_address;
        if (!walletMap.has(walletAddress)) {
          walletMap.set(walletAddress, this.createWalletNode(walletAddress, trade));
        }
        // Update node with trade data
        this.updateWalletNode(walletMap.get(walletAddress)!, trade);
      }

      // Build edges (flows between wallets for same token)
      const edges = this.buildEdges(allTrades);

      const nodes = Array.from(walletMap.values());
      
      // Calculate positions using force-directed layout (simplified)
      this.layoutNodes(nodes, edges);

      const data: FlowMapData = {
        nodes,
        edges,
        timeRange: {
          start: Date.now() - timeRangeHours * 3600000,
          end: Date.now(),
        },
        totalVolumeUsd: allTrades.reduce((sum, t) => sum + t.amount_usd, 0),
        topTokens: this.getTopTokens(allTrades),
      };

      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('[FlowMap] Failed to fetch:', error);
      return null;
    }
  }

  private async fetchSmartMoneyTrades(
    tokenMint?: string,
    timeRangeHours: number = 24,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        chain: 'sol',
        limit: limit.toString(),
      });
      if (tokenMint) params.append('address', tokenMint);

      const response = await fetch(`/api/gmgn/smart-money-feed?${params}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.trades || [];
    } catch {
      return [];
    }
  }

  private async fetchKolTrades(
    tokenMint?: string,
    timeRangeHours: number = 24,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        chain: 'sol',
        limit: limit.toString(),
      });
      if (tokenMint) params.append('address', tokenMint);

      const response = await fetch(`/api/gmgn/kol-feed?${params}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.trades || [];
    } catch {
      return [];
    }
  }

  private createWalletNode(address: string, trade: any): WalletNode {
    const type = trade.wallet_tag?.toLowerCase() || 'unknown';
    const colors: Record<string, string> = {
      whale: '#F59E0B',
      smart_money: '#14F195',
      kol: '#EC4899',
      fund: '#8B5CF6',
      mev: '#EF4444',
      unknown: '#6B7280',
    };

    return {
      address,
      label: trade.wallet_label || this.shortenAddress(address),
      type: type as WalletNode['type'],
      score: 50,
      pnl30d: 0,
      winRate: 0,
      volume24h: 0,
      topTokens: [],
      color: colors[type] || colors.unknown,
      size: 10,
    };
  }

  private updateWalletNode(node: WalletNode, trade: any) {
    node.volume24h += trade.amount_usd;
    node.size = Math.max(10, Math.min(50, 10 + Math.log10(node.volume24h + 1) * 5));
    
    if (!node.topTokens.includes(trade.token_symbol)) {
      node.topTokens.push(trade.token_symbol);
      if (node.topTokens.length > 5) node.topTokens.shift();
    }
  }

  private buildEdges(trades: any[]): FlowEdge[] {
    // Group trades by token
    const tradesByToken = new Map<string, any[]>();
    for (const trade of trades) {
      if (!tradesByToken.has(trade.token_address)) {
        tradesByToken.set(trade.token_address, []);
      }
      tradesByToken.get(trade.token_address)!.push(trade);
    }

    const edges: FlowEdge[] = [];

    // For each token, find wallets that traded in opposite directions around same time
    for (const [tokenAddress, tokenTrades] of tradesByToken) {
      const buys = tokenTrades.filter(t => t.type === 'buy');
      const sells = tokenTrades.filter(t => t.type === 'sell');

      // Simple heuristic: match buys and sells by time proximity
      for (const buy of buys) {
        for (const sell of sells) {
          const timeDiff = Math.abs(buy.ts - sell.ts);
          // Within 1 hour
          if (timeDiff < 3600) {
            edges.push({
              from: sell.wallet_address,
              to: buy.wallet_address,
              token: tokenAddress,
              tokenSymbol: buy.token_symbol,
              amountUsd: Math.min(buy.amount_usd, sell.amount_usd),
              amountToken: Math.min(buy.amount_token, sell.amount_token),
              timestamp: Math.max(buy.ts, sell.ts),
              type: 'buy',
              direction: 'inflow',
            });
          }
        }
      }
    }

    // Sort by amount and limit
    return edges
      .sort((a, b) => b.amountUsd - a.amountUsd)
      .slice(0, 200);
  }

  private layoutNodes(nodes: WalletNode[], edges: FlowEdge[]) {
    // Simple force-directed layout
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize positions in a circle
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = 200;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });

    // Run force simulation (simplified, few iterations)
    for (let iter = 0; iter < 50; iter++) {
      const forces = new Map<string, { x: number; y: number }>();
      
      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x! - nodes[j].x!;
          const dy = nodes[i].y! - nodes[j].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1000 / (dist * dist);
          
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          forces.set(nodes[i].address, {
            x: (forces.get(nodes[i].address)?.x || 0) + fx,
            y: (forces.get(nodes[i].address)?.y || 0) + fy,
          });
          forces.set(nodes[j].address, {
            x: (forces.get(nodes[j].address)?.x || 0) - fx,
            y: (forces.get(nodes[j].address)?.y || 0) - fy,
          });
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const fromNode = nodes.find(n => n.address === edge.from);
        const toNode = nodes.find(n => n.address === edge.to);
        if (!fromNode || !toNode) continue;

        const dx = toNode.x! - fromNode.x!;
        const dy = toNode.y! - fromNode.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * 0.01 * (edge.amountUsd / 10000);

        forces.set(edge.from, {
          x: (forces.get(edge.from)?.x || 0) + (dx / dist) * force,
          y: (forces.get(edge.from)?.y || 0) + (dy / dist) * force,
        });
        forces.set(edge.to, {
          x: (forces.get(edge.to)?.x || 0) - (dx / dist) * force,
          y: (forces.get(edge.to)?.y || 0) - (dy / dist) * force,
        });
      }

      // Apply forces
      for (const node of nodes) {
        const force = forces.get(node.address);
        if (force) {
          node.x! += force.x * 0.1;
          node.y! += force.y * 0.1;
          
          // Keep in bounds
          node.x = Math.max(50, Math.min(width - 50, node.x!));
          node.y = Math.max(50, Math.min(height - 50, node.y!));
        }
      }
    }
  }

  private getTopTokens(trades: any[]): { symbol: string; volumeUsd: number }[] {
    const tokenVolumes = new Map<string, number>();
    for (const trade of trades) {
      tokenVolumes.set(trade.token_symbol, (tokenVolumes.get(trade.token_symbol) || 0) + trade.amount_usd);
    }
    return Array.from(tokenVolumes.entries())
      .map(([symbol, volumeUsd]) => ({ symbol, volumeUsd }))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, 10);
  }

  private getEmptyFlowMap(): FlowMapData {
    return {
      nodes: [],
      edges: [],
      timeRange: { start: Date.now(), end: Date.now() },
      totalVolumeUsd: 0,
      topTokens: [],
    };
  }

  private shortenAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}

// Singleton
let flowMapperInstance: SmartMoneyFlowMapper | null = null;

export function getFlowMapper(): SmartMoneyFlowMapper {
  if (!flowMapperInstance) {
    flowMapperInstance = new SmartMoneyFlowMapper();
  }
  return flowMapperInstance;
}

// React hook
export function useFlowMap(tokenMint?: string, timeRangeHours?: number) {
  const mapper = getFlowMapper();
  
  return {
    getFlowMap: () => mapper.getFlowMap(tokenMint, timeRangeHours),
  };
}

export type { WalletNode, FlowEdge, FlowMapData };