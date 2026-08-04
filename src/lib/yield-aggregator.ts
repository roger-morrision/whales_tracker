/**
 * Yield Aggregator Dashboard
 * Kamino, Marginfi, Drift, Jito, Marinade, Solend, etc.
 */

export interface YieldPosition {
  id: string;
  protocol: 'kamino' | 'marginfi' | 'drift' | 'jito' | 'marinade' | 'solend' | 'lend' | 'tulip' | 'francium' | 'hubble';
  protocolName: string;
  type: 'lending' | 'borrowing' | 'staking' | 'liquid_staking' | 'vault' | 'concentrated_liquidity' | 'leveraged_farming';
  tokenMint: string;
  tokenSymbol: string;
  amount: number;
  valueUsd: number;
  apy: number;
  baseApy: number;
  rewardApy: number;
  rewardTokens: string[];
  entryTimestamp: number;
  accruedRewards: { token: string; amount: number; valueUsd: number }[];
  healthFactor?: number; // For borrowing
  liquidationPrice?: number; // For borrowing
  multiplier?: number; // For leveraged farming
  vaultAddress?: string;
  isActive: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  auditStatus: 'audited' | 'unaudited' | 'partial';
  tvlUsd: number;
}

export interface YieldOpportunity {
  protocol: string;
  type: string;
  tokenSymbol: string;
  apy: number;
  baseApy: number;
  rewardApy: number;
  tvlUsd: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  minDeposit: number;
  lockupPeriod: number; // days, 0 = flexible
  auditStatus: string;
  autoCompound: boolean;
  gasEstimateUsd: number;
  netApyAfterFees: number;
}

export interface PortfolioYieldSummary {
  totalValueUsd: number;
  totalApy: number; // Weighted average
  totalRewardsUsd: number;
  totalRewardsPendingUsd: number;
  byProtocol: { protocol: string; valueUsd: number; apy: number }[];
  byType: { type: string; valueUsd: number; apy: number }[];
  byToken: { token: string; valueUsd: number; apy: number }[];
  riskDistribution: { level: string; valueUsd: number; count: number }[];
}

export interface AutoCompoundConfig {
  protocol: string;
  vaultAddress: string;
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'threshold';
  threshold?: number; // Min rewards to trigger
  maxGasUsd: number;
  reinvestRewards: boolean;
  claimAndSellRewards: boolean; // Sell reward tokens for base token
}

class YieldAggregator {
  private positions: Map<string, YieldPosition> = new Map();
  private autoCompoundConfigs: Map<string, AutoCompoundConfig> = new Map();

  // Protocol APY data (in production, fetch from APIs)
  private readonly PROTOCOL_DATA: Record<string, {
    name: string;
    baseUrl: string;
    supportedTypes: YieldPosition['type'][];
    auditStatus: 'audited' | 'unaudited' | 'partial';
  }> = {
    kamino: { name: 'Kamino Finance', baseUrl: 'https://api.kamino.finance', supportedTypes: ['lending', 'vault', 'concentrated_liquidity'], auditStatus: 'audited' },
    marginfi: { name: 'MarginFi', baseUrl: 'https://api.marginfi.com', supportedTypes: ['lending', 'borrowing'], auditStatus: 'audited' },
    drift: { name: 'Drift Protocol', baseUrl: 'https://api.drift.trade', supportedTypes: ['lending', 'borrowing', 'vault'], auditStatus: 'audited' },
    jito: { name: 'Jito', baseUrl: 'https://api.jito.network', supportedTypes: ['liquid_staking'], auditStatus: 'audited' },
    marinade: { name: 'Marinade Finance', baseUrl: 'https://api.marinade.finance', supportedTypes: ['liquid_staking'], auditStatus: 'audited' },
    solend: { name: 'Solend', baseUrl: 'https://api.solend.fi', supportedTypes: ['lending', 'borrowing'], auditStatus: 'audited' },
    lend: { name: 'Lend', baseUrl: 'https://api.lend.fi', supportedTypes: ['lending'], auditStatus: 'unaudited' },
    tulip: { name: 'Tulip Protocol', baseUrl: 'https://api.tulip.garden', supportedTypes: ['leveraged_farming'], auditStatus: 'partial' },
    francium: { name: 'Francium', baseUrl: 'https://api.francium.io', supportedTypes: ['leveraged_farming'], auditStatus: 'partial' },
    hubble: { name: 'Hubble Protocol', baseUrl: 'https://api.hubbleprotocol.io', supportedTypes: ['lending', 'borrowing'], auditStatus: 'audited' },
  };

  /**
   * Add a yield position
   */
  addPosition(position: YieldPosition): void {
    this.positions.set(position.id, position);
  }

  /**
   * Remove a position
   */
  removePosition(id: string): void {
    this.positions.delete(id);
  }

  /**
   * Get all positions
   */
  getPositions(): YieldPosition[] {
    return Array.from(this.positions.values()).filter(p => p.isActive);
  }

  /**
   * Get positions by protocol
   */
  getPositionsByProtocol(protocol: string): YieldPosition[] {
    return this.getPositions().filter(p => p.protocol === protocol);
  }

  /**
   * Get portfolio summary
   */
  getPortfolioSummary(): PortfolioYieldSummary {
    const positions = this.getPositions();
    
    const totalValueUsd = positions.reduce((sum, p) => sum + p.valueUsd, 0);
    const totalApy = totalValueUsd > 0 
      ? positions.reduce((sum, p) => sum + p.apy * p.valueUsd, 0) / totalValueUsd 
      : 0;
    
    const totalRewardsUsd = positions.reduce((sum, p) => sum + p.accruedRewards.reduce((s, r) => s + r.valueUsd, 0), 0);
    const totalRewardsPendingUsd = totalRewardsUsd; // Simplified

    const byProtocolMap = new Map<string, { valueUsd: number; apySum: number; count: number }>();
    const byTypeMap = new Map<string, { valueUsd: number; apySum: number; count: number }>();
    const byTokenMap = new Map<string, { valueUsd: number; apySum: number; count: number }>();
    const riskMap = new Map<string, { valueUsd: number; count: number }>();

    for (const p of positions) {
      // By protocol
      const proto = byProtocolMap.get(p.protocol) || { valueUsd: 0, apySum: 0, count: 0 };
      proto.valueUsd += p.valueUsd;
      proto.apySum += p.apy * p.valueUsd;
      proto.count += 1;
      byProtocolMap.set(p.protocol, proto);

      // By type
      const type = byTypeMap.get(p.type) || { valueUsd: 0, apySum: 0, count: 0 };
      type.valueUsd += p.valueUsd;
      type.apySum += p.apy * p.valueUsd;
      type.count += 1;
      byTypeMap.set(p.type, type);

      // By token
      const token = byTokenMap.get(p.tokenSymbol) || { valueUsd: 0, apySum: 0, count: 0 };
      token.valueUsd += p.valueUsd;
      token.apySum += p.apy * p.valueUsd;
      token.count += 1;
      byTokenMap.set(p.tokenSymbol, token);

      // Risk distribution
      const risk = riskMap.get(p.riskLevel) || { valueUsd: 0, count: 0 };
      risk.valueUsd += p.valueUsd;
      risk.count += 1;
      riskMap.set(p.riskLevel, risk);
    }

    return {
      totalValueUsd,
      totalApy,
      totalRewardsUsd,
      totalRewardsPendingUsd,
      byProtocol: Array.from(byProtocolMap.entries()).map(([protocol, data]) => ({
        protocol: this.PROTOCOL_DATA[protocol]?.name || protocol,
        valueUsd: data.valueUsd,
        apy: data.valueUsd > 0 ? data.apySum / data.valueUsd : 0,
      })).sort((a, b) => b.valueUsd - a.valueUsd),
      byType: Array.from(byTypeMap.entries()).map(([type, data]) => ({
        type,
        valueUsd: data.valueUsd,
        apy: data.valueUsd > 0 ? data.apySum / data.valueUsd : 0,
      })).sort((a, b) => b.valueUsd - a.valueUsd),
      byToken: Array.from(byTokenMap.entries()).map(([token, data]) => ({
        token,
        valueUsd: data.valueUsd,
        apy: data.valueUsd > 0 ? data.apySum / data.valueUsd : 0,
      })).sort((a, b) => b.valueUsd - a.valueUsd),
      riskDistribution: Array.from(riskMap.entries()).map(([level, data]) => ({
        level,
        valueUsd: data.valueUsd,
        count: data.count,
      })),
    };
  }

  /**
   * Fetch current yield opportunities from all protocols
   */
  async fetchOpportunities(): Promise<YieldOpportunity[]> {
    const opportunities: YieldOpportunity[] = [];

    // In production, fetch from each protocol's API
    // For now, return mock data
    
    const mockOpportunities: YieldOpportunity[] = [
      // Liquid Staking
      { protocol: 'Jito', type: 'liquid_staking', tokenSymbol: 'JitoSOL', apy: 7.5, baseApy: 7.0, rewardApy: 0.5, tvlUsd: 500_000_000, riskLevel: 'low', minDeposit: 0.01, lockupPeriod: 0, auditStatus: 'audited', autoCompound: true, gasEstimateUsd: 0.001, netApyAfterFees: 7.45 },
      { protocol: 'Marinade', type: 'liquid_staking', tokenSymbol: 'mSOL', apy: 7.2, baseApy: 6.8, rewardApy: 0.4, tvlUsd: 400_000_000, riskLevel: 'low', minDeposit: 0.01, lockupPeriod: 0, auditStatus: 'audited', autoCompound: true, gasEstimateUsd: 0.001, netApyAfterFees: 7.15 },
      
      // Lending
      { protocol: 'Kamino', type: 'lending', tokenSymbol: 'SOL', apy: 5.8, baseApy: 4.5, rewardApy: 1.3, tvlUsd: 200_000_000, riskLevel: 'low', minDeposit: 0.1, lockupPeriod: 0, auditStatus: 'audited', autoCompound: false, gasEstimateUsd: 0.002, netApyAfterFees: 5.75 },
      { protocol: 'MarginFi', type: 'lending', tokenSymbol: 'USDC', apy: 8.5, baseApy: 6.0, rewardApy: 2.5, tvlUsd: 150_000_000, riskLevel: 'low', minDeposit: 10, lockupPeriod: 0, auditStatus: 'audited', autoCompound: false, gasEstimateUsd: 0.002, netApyAfterFees: 8.4 },
      { protocol: 'Drift', type: 'lending', tokenSymbol: 'SOL', apy: 6.2, baseApy: 5.0, rewardApy: 1.2, tvlUsd: 100_000_000, riskLevel: 'low', minDeposit: 0.1, lockupPeriod: 0, auditStatus: 'audited', autoCompound: false, gasEstimateUsd: 0.002, netApyAfterFees: 6.1 },
      { protocol: 'Solend', type: 'lending', tokenSymbol: 'USDT', apy: 9.2, baseApy: 7.0, rewardApy: 2.2, tvlUsd: 80_000_000, riskLevel: 'medium', minDeposit: 10, lockupPeriod: 0, auditStatus: 'audited', autoCompound: false, gasEstimateUsd: 0.002, netApyAfterFees: 9.1 },
      
      // Vaults
      { protocol: 'Kamino', type: 'vault', tokenSymbol: 'SOL-USDC', apy: 25.5, baseApy: 15.0, rewardApy: 10.5, tvlUsd: 50_000_000, riskLevel: 'medium', minDeposit: 100, lockupPeriod: 0, auditStatus: 'audited', autoCompound: true, gasEstimateUsd: 0.005, netApyAfterFees: 24.0 },
      { protocol: 'Kamino', type: 'vault', tokenSymbol: 'JitoSOL-SOL', apy: 18.3, baseApy: 12.0, rewardApy: 6.3, tvlUsd: 30_000_000, riskLevel: 'low', minDeposit: 100, lockupPeriod: 0, auditStatus: 'audited', autoCompound: true, gasEstimateUsd: 0.005, netApyAfterFees: 17.5 },
      
      // Concentrated Liquidity
      { protocol: 'Kamino', type: 'concentrated_liquidity', tokenSymbol: 'WIF-SOL', apy: 145.0, baseApy: 120.0, rewardApy: 25.0, tvlUsd: 10_000_000, riskLevel: 'high', minDeposit: 500, lockupPeriod: 0, auditStatus: 'audited', autoCompound: true, gasEstimateUsd: 0.01, netApyAfterFees: 120.0 },
      { protocol: 'Meteora', type: 'concentrated_liquidity', tokenSymbol: 'BONK-SOL', apy: 200.0, baseApy: 180.0, rewardApy: 20.0, tvlUsd: 5_000_000, riskLevel: 'extreme', minDeposit: 100, lockupPeriod: 0, auditStatus: 'partial', autoCompound: true, gasEstimateUsd: 0.01, netApyAfterFees: 160.0 },
      
      // Leveraged Farming
      { protocol: 'Tulip', type: 'leveraged_farming', tokenSymbol: 'SOL-USDC (3x)', apy: 45.0, baseApy: 30.0, rewardApy: 15.0, tvlUsd: 20_000_000, riskLevel: 'high', minDeposit: 100, lockupPeriod: 0, auditStatus: 'partial', autoCompound: true, gasEstimateUsd: 0.005, netApyAfterFees: 40.0 },
      { protocol: 'Francium', type: 'leveraged_farming', tokenSymbol: 'JitoSOL-SOL (2x)', apy: 35.0, baseApy: 25.0, rewardApy: 10.0, tvlUsd: 15_000_000, riskLevel: 'high', minDeposit: 100, lockupPeriod: 0, auditStatus: 'partial', autoCompound: true, gasEstimateUsd: 0.005, netApyAfterFees: 32.0 },
    ];

    return mockOpportunities;
  }

  /**
   * Compare opportunities
   */
  compareOpportunities(opportunities: YieldOpportunity[], criteria: {
    maxRisk?: 'low' | 'medium' | 'high' | 'extreme';
    minApy?: number;
    maxLockup?: number;
    minTvl?: number;
    requireAudited?: boolean;
    tokenSymbol?: string;
  } = {}): YieldOpportunity[] {
    return opportunities
      .filter(o => {
        if (criteria.maxRisk && this.riskOrder(o.riskLevel) > this.riskOrder(criteria.maxRisk)) return false;
        if (criteria.minApy && o.apy < criteria.minApy) return false;
        if (criteria.maxLockup && o.lockupPeriod > criteria.maxLockup) return false;
        if (criteria.minTvl && o.tvlUsd < criteria.minTvl) return false;
        if (criteria.requireAudited && o.auditStatus !== 'audited') return false;
        if (criteria.tokenSymbol && o.tokenSymbol !== criteria.tokenSymbol) return false;
        return true;
      })
      .sort((a, b) => b.netApyAfterFees - a.netApyAfterFees);
  }

  /**
   * Configure auto-compound
   */
  setAutoCompound(config: AutoCompoundConfig): void {
    this.autoCompoundConfigs.set(`${config.protocol}-${config.vaultAddress}`, config);
  }

  /**
   * Get auto-compound config
   */
  getAutoCompound(protocol: string, vaultAddress: string): AutoCompoundConfig | undefined {
    return this.autoCompoundConfigs.get(`${protocol}-${vaultAddress}`);
  }

  /**
   * Get all auto-compound configs
   */
  getAllAutoCompound(): AutoCompoundConfig[] {
    return Array.from(this.autoCompoundConfigs.values()).filter(c => c.enabled);
  }

  /**
   * Calculate projected returns
   */
  calculateProjection(
    principal: number,
    apy: number,
    days: number,
    compoundFrequency: number = 365,
    additionalDeposit: number = 0,
    depositFrequency: number = 30 // days
  ): { finalValue: number; totalInterest: number; apyEffective: number } {
    const rate = apy / 100;
    const periods = days / 365 * compoundFrequency;
    const periodRate = rate / compoundFrequency;
    
    // Future value with periodic deposits
    let finalValue = principal * Math.pow(1 + periodRate, periods);
    
    if (additionalDeposit > 0 && depositFrequency > 0) {
      const depositPeriods = days / depositFrequency;
      const depositPeriodRate = rate * (depositFrequency / 365);
      // Future value of annuity
      finalValue += additionalDeposit * ((Math.pow(1 + depositPeriodRate, depositPeriods) - 1) / depositPeriodRate);
    }
    
    const totalInterest = finalValue - principal - (additionalDeposit * Math.max(0, days / depositFrequency));
    const apyEffective = principal > 0 ? (Math.pow(finalValue / principal, 365 / days) - 1) * 100 : 0;
    
    return { finalValue, totalInterest, apyEffective };
  }

  /**
   * Risk assessment for a protocol
   */
  assessProtocolRisk(protocol: string): {
    overallRisk: 'low' | 'medium' | 'high' | 'extreme';
    factors: { factor: string; risk: 'low' | 'medium' | 'high'; description: string }[];
    recommendations: string[];
  } {
    const protocolInfo = this.PROTOCOL_DATA[protocol];
    const factors: any[] = [];
    const recommendations: string[] = [];

    if (!protocolInfo) {
      return { overallRisk: 'extreme', factors: [], recommendations: ['Protocol not recognized'] };
    }

    // Audit status
    factors.push({
      factor: 'Audit Status',
      risk: protocolInfo.auditStatus === 'audited' ? 'low' : protocolInfo.auditStatus === 'partial' ? 'medium' : 'high',
      description: protocolInfo.auditStatus === 'audited' ? 'Fully audited by reputable firms' : 
        protocolInfo.auditStatus === 'partial' ? 'Partially audited' : 'Unaudited - higher smart contract risk',
    });

    // TVL (mock)
    factors.push({
      factor: 'TVL',
      risk: 'low',
      description: 'High TVL provides stability and battle-testing',
    });

    // Age
    factors.push({
      factor: 'Protocol Age',
      risk: 'low',
      description: 'Established protocol with track record',
    });

    // Admin keys / upgradability
    factors.push({
      factor: 'Admin Keys',
      risk: 'medium',
      description: 'Upgradable contracts - admin could change parameters',
    });

    // Oracle risk
    factors.push({
      factor: 'Oracle Risk',
      risk: 'low',
      description: 'Uses Pyth/Switchboard - decentralized oracles',
    });

    // Liquidity risk
    factors.push({
      factor: 'Liquidity Risk',
      risk: 'medium',
      description: 'Market conditions may affect withdrawal liquidity',
    });

    // Calculate overall risk
    const riskScores = factors.map(f => f.risk === 'low' ? 1 : f.risk === 'medium' ? 2 : f.risk === 'high' ? 3 : 4);
    const avgRisk = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    
    let overallRisk: 'low' | 'medium' | 'high' | 'extreme' = 'low';
    if (avgRisk >= 3.5) overallRisk = 'extreme';
    else if (avgRisk >= 2.5) overallRisk = 'high';
    else if (avgRisk >= 1.5) overallRisk = 'medium';

    if (protocolInfo.auditStatus !== 'audited') {
      recommendations.push('Consider protocols with full audits for larger deposits');
    }
    recommendations.push('Diversify across multiple protocols');
    recommendations.push('Monitor protocol announcements for parameter changes');
    recommendations.push('Keep position sizes within your risk tolerance');

    return { overallRisk, factors, recommendations };
  }

  private riskOrder(risk: string): number {
    const order: Record<string, number> = { low: 1, medium: 2, high: 3, extreme: 4 };
    return order[risk] || 0;
  }
}

// Singleton
let yieldAggregatorInstance: YieldAggregator | null = null;

export function getYieldAggregator(): YieldAggregator {
  if (!yieldAggregatorInstance) {
    yieldAggregatorInstance = new YieldAggregator();
  }
  return yieldAggregatorInstance;
}

// React hook
export function useYieldAggregator() {
  const aggregator = getYieldAggregator();
  
  return {
    addPosition: (position: YieldPosition) => aggregator.addPosition(position),
    removePosition: (id: string) => aggregator.removePosition(id),
    getPositions: () => aggregator.getPositions(),
    getPositionsByProtocol: (protocol: string) => aggregator.getPositionsByProtocol(protocol),
    getPortfolioSummary: () => aggregator.getPortfolioSummary(),
    fetchOpportunities: () => aggregator.fetchOpportunities(),
    compareOpportunities: (opportunities: YieldOpportunity[], criteria?: any) => 
      aggregator.compareOpportunities(opportunities, criteria),
    setAutoCompound: (config: AutoCompoundConfig) => aggregator.setAutoCompound(config),
    getAutoCompound: (protocol: string, vault: string) => aggregator.getAutoCompound(protocol, vault),
    getAllAutoCompound: () => aggregator.getAllAutoCompound(),
    calculateProjection: (principal: number, apy: number, days: number, compoundFreq?: number, addDeposit?: number, depFreq?: number) => 
      aggregator.calculateProjection(principal, apy, days, compoundFreq, addDeposit, depFreq),
    assessProtocolRisk: (protocol: string) => aggregator.assessProtocolRisk(protocol),
  };
}

export type { YieldPosition, YieldOpportunity, PortfolioYieldSummary, AutoCompoundConfig };