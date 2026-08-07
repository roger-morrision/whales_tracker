/**
 * Pulse Feed Engine
 * Real-time new token launch detection via Solana Geyser/Yellowstone gRPC
 * Detects Pump.fun launches, Raydium migrations, and new pool creations instantly
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface PulseLaunch {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokenImage?: string;
  launchType: 'pump_fun' | 'raydium' | 'orca' | 'other';
  launchPlatform: string;
  creator: string;
  timestamp: number;
  slot: number;
  signature: string;
  initialLiquiditySol: number;
  initialLiquidityUsd: number;
  initialMarketCap: number;
  bondingCurveProgress?: number; // For pump.fun
  isMigrating?: boolean;
  migrationTarget?: string; // Raydium pool address
  riskFlags: PulseRiskFlag[];
  socialSignals: PulseSocialSignal[];
  smartMoneyInterest: number; // 0-100
}

export interface PulseRiskFlag {
  type: 'BUNDLED' | 'INSIDER' | 'LOW_LIQUIDITY' | 'HONEYPOT_RISK' | 'MINT_AUTHORITY' | 'FREEZE_AUTHORITY' | 'SNIPER_HEAVY' | 'DEV_HOLDINGS_HIGH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface PulseSocialSignal {
  platform: 'twitter' | 'telegram' | 'discord' | 'website';
  metric: 'mentions' | 'followers' | 'engagement' | 'created';
  value: number;
  timestamp: number;
}

export interface PulseFilter {
  minLiquiditySol?: number;
  maxLiquiditySol?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  platforms?: PulseLaunch['launchPlatform'][];
  excludeRiskFlags?: PulseRiskFlag['type'][];
  minSmartMoneyInterest?: number;
  keywords?: string[]; // Token name/symbol keywords
  creatorWhitelist?: string[];
  creatorBlacklist?: string[];
}

export interface PulseSubscription {
  id: string;
  filters: PulseFilter;
  callback: (launch: PulseLaunch) => void;
  createdAt: number;
  isActive: boolean;
}

export interface GeyserAccountUpdate {
  pubkey: string;
  owner: string;
  lamports: number;
  data: string; // base64 encoded
  executable: boolean;
  rentEpoch: number;
  slot: number;
  writeVersion: number;
  txnSignature: string;
}

export interface PumpFunBondingCurveAccount {
  mint: PublicKey;
  creator: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseReserve: bigint;
  quoteReserve: bigint;
  baseSupply: bigint;
  quoteSupply: bigint;
  complete: boolean;
  virtualBaseReserve: bigint;
  virtualQuoteReserve: bigint;
  realBaseReserve: bigint;
  realQuoteReserve: bigint;
}

class PulseFeedEngine {
  private connection: Connection;
  private subscriptions = new Map<string, PulseSubscription>();
  private recentLaunches: PulseLaunch[] = [];
  private readonly MAX_RECENT = 100;
  private geyserWs: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private pumpFunProgramId = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'); // Pump.fun program
  private raydiumAmmProgramId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'); // Raydium AMM v4
  private monitoredAccounts = new Set<string>();

  constructor(rpcEndpoint?: string, geyserEndpoint?: string) {
    this.connection = new Connection(
      rpcEndpoint || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    
    // Geyser WebSocket endpoint for real-time account updates
    this.geyserEndpoint = geyserEndpoint || process.env.GEYSER_WS_ENDPOINT || 'wss://yellowstone.helius-rpc.com/ws';
    
    this.initializeGeyserConnection();
  }

  private geyserEndpoint: string;

  /**
   * Initialize Geyser WebSocket connection for real-time account monitoring
   */
  private async initializeGeyserConnection(): Promise<void> {
    try {
      this.geyserWs = new WebSocket(this.geyserEndpoint);
      
      this.geyserWs.onopen = () => {
        console.log('[Pulse] Geyser WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.subscribeToProgramAccounts();
      };

      this.geyserWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleGeyserMessage(message);
        } catch (error) {
          console.warn('[Pulse] Failed to parse Geyser message:', error);
        }
      };

      this.geyserWs.onerror = (error) => {
        console.warn('[Pulse] Geyser WebSocket error:', error);
      };

      this.geyserWs.onclose = () => {
        console.log('[Pulse] Geyser WebSocket closed, reconnecting...');
        this.isConnected = false;
        this.scheduleReconnect();
      };
    } catch (error) {
      console.warn('[Pulse] Failed to initialize Geyser connection:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[Pulse] Max reconnect attempts reached, falling back to polling');
      this.startPollingFallback();
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    setTimeout(() => this.initializeGeyserConnection(), delay);
  }

  private startPollingFallback(): void {
    console.log('[Pulse] Starting polling fallback (every 5s)');
    setInterval(() => this.pollForNewLaunches(), 5000);
  }

  private async subscribeToProgramAccounts(): Promise<void> {
    if (!this.geyserWs || this.geyserWs.readyState !== WebSocket.OPEN) return;

    // Subscribe to Pump.fun program account changes
    const subscribeMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'subscribeAccountUpdates',
      params: {
        accounts: [
          this.pumpFunProgramId.toBase58(),
          this.raydiumAmmProgramId.toBase58(),
        ],
        commitment: 'confirmed',
        encoding: 'base64',
      },
    };

    this.geyserWs.send(JSON.stringify(subscribeMessage));
  }

  private handleGeyserMessage(message: any): void {
    if (message.method === 'accountUpdate') {
      const update = message.params as GeyserAccountUpdate;
      this.processAccountUpdate(update);
    }
  }

  private processAccountUpdate(update: GeyserAccountUpdate): void {
    // Check if this is a new Pump.fun bonding curve creation
    if (update.owner === this.pumpFunProgramId.toBase58()) {
      this.analyzePumpFunAccount(update);
    }
    
    // Check for Raydium pool creation
    if (update.owner === this.raydiumAmmProgramId.toBase58()) {
      this.analyzeRaydiumPool(update);
    }
  }

  private async analyzePumpFunAccount(update: GeyserAccountUpdate): Promise<void> {
    try {
      // Decode Pump.fun bonding curve account
      const curveData = this.decodePumpFunBondingCurve(update.data);
      if (!curveData) return;

      // Check if this is a new curve (not in our monitored set)
      const curveKey = `${curveData.mint.toBase58()}:${update.slot}`;
      if (this.monitoredAccounts.has(curveKey)) return;
      this.monitoredAccounts.add(curveKey);

      // Fetch token metadata
      const tokenInfo = await this.fetchTokenMetadata(curveData.mint.toBase58());
      
      // Calculate initial metrics
      const initialLiquiditySol = Number(curveData.realQuoteReserve) / 1e9;
      const initialMarketCap = initialLiquiditySol * 2; // Rough estimate for bonding curve start
      
      // Check risk flags
      const riskFlags = await this.checkRiskFlags(curveData.mint.toBase58(), curveData);
      
      // Check smart money interest (placeholder)
      const smartMoneyInterest = await this.checkSmartMoneyInterest(curveData.mint.toBase58());

      const launch: PulseLaunch = {
        id: `launch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        tokenMint: curveData.mint.toBase58(),
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        tokenImage: tokenInfo.image,
        launchType: 'pump_fun',
        launchPlatform: 'pump.fun',
        creator: curveData.creator.toBase58(),
        timestamp: Date.now(),
        slot: update.slot,
        signature: update.txnSignature,
        initialLiquiditySol,
        initialLiquidityUsd: initialLiquiditySol * (await this.getSolPrice()),
        initialMarketCap,
        bondingCurveProgress: this.calculateBondingCurveProgress(curveData),
        riskFlags,
        socialSignals: [],
        smartMoneyInterest,
      };

      this.emitLaunch(launch);
    } catch (error) {
      console.warn('[Pulse] Failed to analyze Pump.fun account:', error);
    }
  }

  private decodePumpFunBondingCurve(data: string): PumpFunBondingCurveAccount | null {
    try {
      const buffer = Buffer.from(data, 'base64');
      if (buffer.length < 200) return null; // Minimum size check

      // Pump.fun bonding curve layout (simplified)
      // This is a simplified decoder - actual implementation would use proper Borsh deserialization
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      
      // Skip discriminator (8 bytes)
      let offset = 8;
      
      const mint = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;
      
      const creator = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;
      
      const baseMint = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;
      
      const quoteMint = new PublicKey(buffer.slice(offset, offset + 32));
      offset += 32;
      
      const baseReserve = view.getBigUint64(offset, true); offset += 8;
      const quoteReserve = view.getBigUint64(offset, true); offset += 8;
      const baseSupply = view.getBigUint64(offset, true); offset += 8;
      const quoteSupply = view.getBigUint64(offset, true); offset += 8;
      const complete = view.getUint8(offset) === 1; offset += 1;
      const virtualBaseReserve = view.getBigUint64(offset, true); offset += 8;
      const virtualQuoteReserve = view.getBigUint64(offset, true); offset += 8;
      const realBaseReserve = view.getBigUint64(offset, true); offset += 8;
      const realQuoteReserve = view.getBigUint64(offset, true);

      return {
        mint,
        creator,
        baseMint,
        quoteMint,
        baseReserve,
        quoteReserve,
        baseSupply,
        quoteSupply,
        complete,
        virtualBaseReserve,
        virtualQuoteReserve,
        realBaseReserve,
        realQuoteReserve,
      };
    } catch (error) {
      return null;
    }
  }

  private calculateBondingCurveProgress(curve: PumpFunBondingCurveAccount): number {
    if (curve.complete) return 100;
    // Progress = realQuoteReserve / virtualQuoteReserve * 100
    const progress = Number(curve.realQuoteReserve) / Number(curve.virtualQuoteReserve) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  private async analyzeRaydiumPool(update: GeyserAccountUpdate): Promise<void> {
    // Check if this is a new Raydium pool (migration from Pump.fun)
    // This would decode the AMM account and check if it's a new pool
    // For now, placeholder
  }

  private async fetchTokenMetadata(mint: string): Promise<{ symbol: string; name: string; image?: string }> {
    // Would fetch from Metaplex or Jupiter token list
    return {
      symbol: mint.slice(0, 4).toUpperCase(),
      name: `Token ${mint.slice(0, 6)}`,
    };
  }

  private async checkRiskFlags(mint: string, curve: PumpFunBondingCurveAccount): Promise<PulseRiskFlag[]> {
    const flags: PulseRiskFlag[] = [];

    // Check mint authority
    try {
      const mintAccount = await this.connection.getParsedAccountInfo(new PublicKey(mint));
      const mintData = mintAccount.value?.data as any;
      if (mintData?.parsed?.info?.mintAuthority) {
        flags.push({
          type: 'MINT_AUTHORITY',
          severity: 'HIGH',
          description: 'Mint authority not revoked - dev can mint more tokens',
        });
      }
      if (mintData?.parsed?.info?.freezeAuthority) {
        flags.push({
          type: 'FREEZE_AUTHORITY',
          severity: 'HIGH',
          description: 'Freeze authority not revoked - dev can freeze accounts',
        });
      }
    } catch {}

    // Check liquidity
    if (Number(curve.realQuoteReserve) < 1e9) { // < 1 SOL
      flags.push({
        type: 'LOW_LIQUIDITY',
        severity: 'MEDIUM',
        description: 'Initial liquidity below 1 SOL',
      });
    }

    // Check dev holdings (creator balance)
    // Would need to check creator's token account

    return flags;
  }

  private async checkSmartMoneyInterest(mint: string): Promise<number> {
    // Would query GMGN or other smart money tracking APIs
    // Return 0-100 score
    return 0;
  }

  private async getSolPrice(): Promise<number> {
    try {
      const response = await fetch('https://api.jup.ag/v6/price?ids=SOL');
      const data = await response.json();
      return data.data?.SOL?.price || 100;
    } catch {
      return 100;
    }
  }

  private emitLaunch(launch: PulseLaunch): void {
    // Add to recent launches
    this.recentLaunches.unshift(launch);
    if (this.recentLaunches.length > this.MAX_RECENT) {
      this.recentLaunches.pop();
    }

    // Notify subscribers
    for (const [, subscription] of this.subscriptions) {
      if (!subscription.isActive) continue;
      if (this.matchesFilters(launch, subscription.filters)) {
        try {
          subscription.callback(launch);
        } catch (error) {
          console.warn('[Pulse] Subscriber callback error:', error);
        }
      }
    }
  }

  private matchesFilters(launch: PulseLaunch, filters: PulseFilter): boolean {
    if (filters.minLiquiditySol && launch.initialLiquiditySol < filters.minLiquiditySol) return false;
    if (filters.maxLiquiditySol && launch.initialLiquiditySol > filters.maxLiquiditySol) return false;
    if (filters.minMarketCap && launch.initialMarketCap < filters.minMarketCap) return false;
    if (filters.maxMarketCap && launch.initialMarketCap > filters.maxMarketCap) return false;
    if (filters.platforms && !filters.platforms.includes(launch.launchPlatform)) return false;
    if (filters.excludeRiskFlags && launch.riskFlags.some(f => filters.excludeRiskFlags!.includes(f.type))) return false;
    if (filters.minSmartMoneyInterest && launch.smartMoneyInterest < filters.minSmartMoneyInterest) return false;
    if (filters.keywords) {
      const text = `${launch.tokenName} ${launch.tokenSymbol}`.toLowerCase();
      if (!filters.keywords.some(k => text.includes(k.toLowerCase()))) return false;
    }
    if (filters.creatorWhitelist && !filters.creatorWhitelist.includes(launch.creator)) return false;
    if (filters.creatorBlacklist && filters.creatorBlacklist.includes(launch.creator)) return false;
    return true;
  }

  /**
   * Polling fallback when Geyser is unavailable
   */
  private async pollForNewLaunches(): Promise<void> {
    try {
      // Get recent Pump.fun transactions
      const signatures = await this.connection.getSignaturesForAddress(
        this.pumpFunProgramId,
        { limit: 20 }
      );

      for (const sigInfo of signatures) {
        if (sigInfo.err) continue;
        
        const tx = await this.connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        
        if (tx) {
          this.analyzeTransactionForLaunch(tx, sigInfo.slot);
        }
      }
    } catch (error) {
      console.warn('[Pulse] Polling failed:', error);
    }
  }

  private analyzeTransactionForLaunch(tx: any, slot: number): void {
    // Analyze transaction for new token creation
    // This would decode the transaction and look for Pump.fun create instructions
  }

  /**
   * Subscribe to pulse feed
   */
  subscribe(filters: PulseFilter, callback: (launch: PulseLaunch) => void): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.subscriptions.set(id, {
      id,
      filters,
      callback,
      createdAt: Date.now(),
      isActive: true,
    });
    return id;
  }

  /**
   * Unsubscribe
   */
  unsubscribe(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  /**
   * Get recent launches
   */
  getRecentLaunches(filters?: PulseFilter): PulseLaunch[] {
    let launches = [...this.recentLaunches];
    if (filters) {
      launches = launches.filter(l => this.matchesFilters(l, filters));
    }
    return launches;
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; reconnectAttempts: number; recentCount: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      recentCount: this.recentLaunches.length,
    };
  }

  /**
   * Cleanup
   */
  disconnect(): void {
    if (this.geyserWs) {
      this.geyserWs.close();
      this.geyserWs = null;
    }
    this.subscriptions.clear();
    this.recentLaunches = [];
  }
}

// Singleton
let pulseEngineInstance: PulseFeedEngine | null = null;

export function getPulseEngine(rpcEndpoint?: string, geyserEndpoint?: string): PulseFeedEngine {
  if (!pulseEngineInstance) {
    pulseEngineInstance = new PulseFeedEngine(rpcEndpoint, geyserEndpoint);
  }
  return pulseEngineInstance;
}

// React hook
export function usePulseFeed(filters?: PulseFilter) {
  const engine = getPulseEngine();
  const [launches, setLaunches] = React.useState<PulseLaunch[]>([]);
  const [status, setStatus] = React.useState(engine.getStatus());

  React.useEffect(() => {
    const subscriptionId = engine.subscribe(filters || {}, (launch) => {
      setLaunches(prev => [launch, ...prev].slice(0, 50));
    });

    // Update status periodically
    const statusInterval = setInterval(() => {
      setStatus(engine.getStatus());
    }, 5000);

    // Initial load
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLaunches(engine.getRecentLaunches(filters));

    return () => {
      engine.unsubscribe(subscriptionId);
      clearInterval(statusInterval);
    };
  }, [filters]);

  return { launches, status, subscribe: engine.subscribe.bind(engine), unsubscribe: engine.unsubscribe.bind(engine) };
}

import React from 'react';

export type { PulseLaunch, PulseRiskFlag, PulseSocialSignal, PulseFilter, PulseSubscription, GeyserAccountUpdate, PumpFunBondingCurveAccount };