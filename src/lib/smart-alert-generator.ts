/**
 * Smart Alert Generator
 * AI proposes alerts based on portfolio + market regime
 */

export interface AlertProposal {
  id: string;
  type: 'price' | 'volume' | 'smart_money' | 'technical' | 'security' | 'liquidity' | 'news' | 'portfolio' | 'yield' | 'launch';
  tokenMint?: string;
  tokenSymbol?: string;
  condition: AlertCondition;
  message: string;
  rationale: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  estimatedValue: string; // e.g., "Could save $500" or "Potential 2x entry"
  proposedActions: ProposedAction[];
  expiresAt?: number;
  createdAt: number;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | 'crosses' | 'changes_by_pct';
  value: number;
  timeframe?: string;
  source: 'price_feed' | 'gmgn' | 'dexscreener' | 'jupiter' | 'onchain' | 'social';
}

export interface ProposedAction {
  type: 'create_alert' | 'create_snipe_rule' | 'adjust_position' | 'research' | 'hedge';
  label: string;
  params: Record<string, any>;
}

export interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  category: AlertProposal['type'];
  conditionTemplate: Partial<AlertCondition>;
  defaultMessage: string;
  applicableTokens?: string[];
  applicableScenarios: string[];
}

class SmartAlertGenerator {
  private templates: AlertTemplate[] = [];
  private proposals: Map<string, AlertProposal> = new Map();
  private subscribers: Set<(proposals: AlertProposal[]) => void> = new Set();
  private generationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.templates = [
      // Price alerts
      {
        id: 'price_support',
        name: 'Support Level Test',
        description: 'Token approaching key support level',
        category: 'price',
        conditionTemplate: { metric: 'price_vs_support', operator: '<=', value: 1.02, source: 'price_feed' },
        defaultMessage: '{symbol} testing support at ${level}',
        applicableScenarios: ['accumulation', 'dip_buy'],
      },
      {
        id: 'price_resistance',
        name: 'Resistance Breakout',
        description: 'Token breaking through resistance',
        category: 'price',
        conditionTemplate: { metric: 'price_vs_resistance', operator: '>=', value: 0.98, source: 'price_feed' },
        defaultMessage: '{symbol} breaking resistance at ${level}',
        applicableScenarios: ['breakout', 'momentum'],
      },
      {
        id: 'price_target',
        name: 'Take Profit Target',
        description: 'Position reaching profit target',
        category: 'price',
        conditionTemplate: { metric: 'unrealized_pnl_pct', operator: '>=', value: 50, source: 'portfolio' },
        defaultMessage: '{symbol} up {pnl}% - consider taking profits',
        applicableScenarios: ['profit_taking'],
      },
      {
        id: 'stop_loss',
        name: 'Stop Loss Trigger',
        description: 'Position hitting stop loss',
        category: 'price',
        conditionTemplate: { metric: 'unrealized_pnl_pct', operator: '<=', value: -15, source: 'portfolio' },
        defaultMessage: '{symbol} down {pnl}% - stop loss triggered',
        applicableScenarios: ['risk_management'],
      },

      // Volume alerts
      {
        id: 'volume_spike',
        name: 'Volume Spike',
        description: 'Unusual volume activity',
        category: 'volume',
        conditionTemplate: { metric: 'volume_ratio_24h', operator: '>', value: 3, source: 'dexscreener' },
        defaultMessage: '{symbol} volume {ratio}x average - unusual activity',
        applicableScenarios: ['breakout', 'news', 'whale'],
      },
      {
        id: 'volume_dry_up',
        name: 'Volume Dry Up',
        description: 'Liquidity disappearing',
        category: 'volume',
        conditionTemplate: { metric: 'volume_ratio_24h', operator: '<', value: 0.3, source: 'dexscreener' },
        defaultMessage: '{symbol} volume dropped to {ratio}x average - liquidity risk',
        applicableScenarios: ['exit', 'caution'],
      },

      // Smart money alerts
      {
        id: 'smart_money_entry',
        name: 'Smart Money Accumulation',
        description: 'Top traders buying',
        category: 'smart_money',
        conditionTemplate: { metric: 'smart_money_net_flow', operator: '>', value: 10000, source: 'gmgn' },
        defaultMessage: 'Smart money net buying ${value} of {symbol}',
        applicableScenarios: ['follow_smart_money', 'early_entry'],
      },
      {
        id: 'smart_money_exit',
        name: 'Smart Money Distribution',
        description: 'Top traders selling',
        category: 'smart_money',
        conditionTemplate: { metric: 'smart_money_net_flow', operator: '<', value: -10000, source: 'gmgn' },
        defaultMessage: 'Smart money net selling ${value} of {symbol}',
        applicableScenarios: ['exit', 'caution'],
      },
      {
        id: 'whale_alert',
        name: 'Whale Activity',
        description: 'Large wallet movement',
        category: 'smart_money',
        conditionTemplate: { metric: 'whale_tx_count', operator: '>', value: 5, source: 'gmgn' },
        defaultMessage: '{count} whale transactions detected for {symbol}',
        applicableScenarios: ['whale_watching'],
      },

      // Technical alerts
      {
        id: 'rsi_oversold',
        name: 'RSI Oversold',
        description: 'RSI below 30 - potential bounce',
        category: 'technical',
        conditionTemplate: { metric: 'rsi_14', operator: '<', value: 30, source: 'price_feed' },
        defaultMessage: '{symbol} RSI at {value} - oversold bounce candidate',
        applicableScenarios: ['mean_reversion', 'dip_buy'],
      },
      {
        id: 'rsi_overbought',
        name: 'RSI Overbought',
        description: 'RSI above 70 - potential pullback',
        category: 'technical',
        conditionTemplate: { metric: 'rsi_14', operator: '>', value: 70, source: 'price_feed' },
        defaultMessage: '{symbol} RSI at {value} - overbought, consider profits',
        applicableScenarios: ['profit_taking', 'caution'],
      },
      {
        id: 'macd_bullish',
        name: 'MACD Bullish Cross',
        description: 'MACD crossing above signal',
        category: 'technical',
        conditionTemplate: { metric: 'macd_histogram', operator: 'crosses', value: 0, source: 'price_feed' },
        defaultMessage: '{symbol} MACD bullish cross - momentum shifting up',
        applicableScenarios: ['trend_following', 'entry'],
      },
      {
        id: 'ma_golden_cross',
        name: 'Golden Cross',
        description: '50 MA crossing above 200 MA',
        category: 'technical',
        conditionTemplate: { metric: 'ma_50_vs_200', operator: 'crosses', value: 0, source: 'price_feed' },
        defaultMessage: '{symbol} golden cross - long-term bullish signal',
        applicableScenarios: ['long_term_bullish'],
      },

      // Security alerts
      {
        id: 'security_downgrade',
        name: 'Security Score Drop',
        description: 'Token security deteriorating',
        category: 'security',
        conditionTemplate: { metric: 'security_score', operator: '<', value: 50, source: 'gmgn' },
        defaultMessage: '{symbol} security score dropped to {value}/100 - review position',
        applicableScenarios: ['risk_management', 'exit'],
      },
      {
        id: 'authority_change',
        name: 'Authority Change Detected',
        description: 'Token authority modified',
        category: 'security',
        conditionTemplate: { metric: 'authority_changed', operator: '==', value: true, source: 'onchain' },
        defaultMessage: '{symbol} token authority changed - potential rug risk',
        applicableScenarios: ['immediate_exit'],
      },

      // Liquidity alerts
      {
        id: 'liquidity_added',
        name: 'Liquidity Added',
        description: 'New LP position created',
        category: 'liquidity',
        conditionTemplate: { metric: 'liquidity_change_24h', operator: '>', value: 50, source: 'dexscreener' },
        defaultMessage: '{symbol} liquidity increased {pct}% - positive signal',
        applicableScenarios: ['confidence', 'entry'],
      },
      {
        id: 'liquidity_removed',
        name: 'Liquidity Removed',
        description: 'LP positions withdrawn',
        category: 'liquidity',
        conditionTemplate: { metric: 'liquidity_change_24h', operator: '<', value: -30, source: 'dexscreener' },
        defaultMessage: '{symbol} liquidity dropped {pct}% - rug pull risk',
        applicableScenarios: ['immediate_exit', 'caution'],
      },

      // Portfolio alerts
      {
        id: 'concentration_risk',
        name: 'Concentration Risk',
        description: 'Single position too large',
        category: 'portfolio',
        conditionTemplate: { metric: 'max_position_pct', operator: '>', value: 30, source: 'portfolio' },
        defaultMessage: '{symbol} is {pct}% of portfolio - concentration risk',
        applicableScenarios: ['rebalance', 'risk_management'],
      },
      {
        id: 'drawdown_alert',
        name: 'Portfolio Drawdown',
        description: 'Portfolio down from peak',
        category: 'portfolio',
        conditionTemplate: { metric: 'portfolio_drawdown_pct', operator: '>', value: 20, source: 'portfolio' },
        defaultMessage: 'Portfolio down {pct}% from peak - review risk',
        applicableScenarios: ['risk_management', 'reduce_exposure'],
      },

      // Yield alerts
      {
        id: 'yield_opportunity',
        name: 'High Yield Opportunity',
        description: 'Attractive APY available',
        category: 'yield',
        conditionTemplate: { metric: 'apy', operator: '>', value: 50, source: 'yield_aggregator' },
        defaultMessage: '{protocol} offering {apy}% APY on {token}',
        applicableScenarios: ['yield_farming', 'compound'],
      },
      {
        id: 'yield_drop',
        name: 'Yield Dropped',
        description: 'APY significantly decreased',
        category: 'yield',
        conditionTemplate: { metric: 'apy_change_7d', operator: '<', value: -30, source: 'yield_aggregator' },
        defaultMessage: '{protocol} {token} APY dropped {pct}% - consider moving funds',
        applicableScenarios: ['reallocate', 'exit'],
      },

      // Launch alerts
      {
        id: 'new_launch',
        name: 'New Token Launch',
        description: 'New pair detected on pump.fun/Raydium',
        category: 'launch',
        conditionTemplate: { metric: 'is_new_launch', operator: '==', value: true, source: 'launch_tracker' },
        defaultMessage: 'New launch: {symbol} - {description}',
        applicableScenarios: ['snipe', 'early_entry'],
      },
      {
        id: 'graduation',
        name: 'Graduation to Raydium',
        description: 'pump.fun token graduating',
        category: 'launch',
        conditionTemplate: { metric: 'is_graduating', operator: '==', value: true, source: 'launch_tracker' },
        defaultMessage: '{symbol} graduating to Raydium - liquidity event',
        applicableScenarios: ['liquidity_event', 'volatility'],
      },
    ];
  }

  async generateProposals(portfolio: any, marketData: any): Promise<AlertProposal[]> {
    const proposals: AlertProposal[] = [];
    const now = Date.now();

    // Get portfolio tokens
    const tokens = portfolio.tokenBalances || [];
    const totalValue = tokens.reduce((sum: number, t: any) => sum + (t.totalValueUsd || 0), 0);

    // Generate proposals for each token in portfolio
    for (const token of tokens) {
      const tokenProposals = await this.generateTokenProposals(token, portfolio, marketData);
      proposals.push(...tokenProposals);
    }

    // Generate portfolio-level proposals
    const portfolioProposals = this.generatePortfolioProposals(portfolio, totalValue);
    proposals.push(...portfolioProposals);

    // Generate market regime proposals
    const regimeProposals = this.generateRegimeProposals(marketData);
    proposals.push(...regimeProposals);

    // Generate yield proposals
    const yieldProposals = this.generateYieldProposals(marketData);
    proposals.push(...yieldProposals);

    // Generate launch proposals
    const launchProposals = await this.generateLaunchProposals(marketData);
    proposals.push(...launchProposals);

    // Sort by priority and confidence
    proposals.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    // Store proposals
    for (const p of proposals) {
      this.proposals.set(p.id, p);
    }

    // Notify subscribers
    this.notifySubscribers();

    return proposals;
  }

  private async generateTokenProposals(token: any, portfolio: any, marketData: any): Promise<AlertProposal[]> {
    const proposals: AlertProposal[] = [];
    const symbol = token.symbol;
    const pnlPct = token.pnlPercent || 0;
    const valueUsd = token.totalValueUsd || 0;
    const portfolioPct = valueUsd / (portfolio.totalValueUsd || 1) * 100;

    // Price-based proposals
    if (pnlPct >= 50) {
      proposals.push(this.createProposal({
        type: 'price',
        tokenMint: token.mint,
        tokenSymbol: symbol,
        condition: { metric: 'unrealized_pnl_pct', operator: '>=', value: 50, source: 'portfolio' },
        message: `${symbol} up ${pnlPct.toFixed(0)}% (${this.formatUsd(valueUsd * pnlPct / 100)}) - consider taking profits`,
        rationale: 'Large unrealized gains should be partially secured',
        priority: 'high',
        confidence: 0.85,
        estimatedValue: `Secure ${this.formatUsd(valueUsd * 0.5)}`,
        proposedActions: [
          { type: 'create_alert', label: 'Set 50% profit alert', params: { token: symbol, pnlPct: 50 } },
          { type: 'adjust_position', label: 'Sell 50%', params: { token: symbol, pct: 50 } },
        ],
      }));
    }

    if (pnlPct <= -15) {
      proposals.push(this.createProposal({
        type: 'price',
        tokenMint: token.mint,
        tokenSymbol: symbol,
        condition: { metric: 'unrealized_pnl_pct', operator: '<=', value: -15, source: 'portfolio' },
        message: `${symbol} down ${Math.abs(pnlPct).toFixed(0)}% - stop loss zone`,
        rationale: 'Position approaching typical stop-loss level',
        priority: 'critical',
        confidence: 0.9,
        estimatedValue: `Prevent additional ${this.formatUsd(valueUsd * 0.1)} loss`,
        proposedActions: [
          { type: 'create_alert', label: 'Set stop-loss alert', params: { token: symbol, pnlPct: -15 } },
          { type: 'adjust_position', label: 'Exit position', params: { token: symbol, pct: 100 } },
        ],
      }));
    }

    // Concentration risk
    if (portfolioPct > 25) {
      proposals.push(this.createProposal({
        type: 'portfolio',
        tokenMint: token.mint,
        tokenSymbol: symbol,
        condition: { metric: 'max_position_pct', operator: '>', value: 25, source: 'portfolio' },
        message: `${symbol} is ${portfolioPct.toFixed(0)}% of portfolio - high concentration`,
        rationale: 'Single position >25% creates idiosyncratic risk',
        priority: 'high',
        confidence: 0.9,
        estimatedValue: 'Reduce max drawdown by 15-25%',
        proposedActions: [
          { type: 'create_alert', label: 'Monitor concentration', params: { token: symbol, threshold: 25 } },
          { type: 'adjust_position', label: 'Reduce to 20%', params: { token: symbol, targetPct: 20 } },
        ],
      }));
    }

    // Smart money alerts for held tokens
    const smartMoneyData = marketData.smartMoney?.[token.mint];
    if (smartMoneyData) {
      if (smartMoneyData.netFlowUsd > 50000) {
        proposals.push(this.createProposal({
          type: 'smart_money',
          tokenMint: token.mint,
          tokenSymbol: symbol,
          condition: { metric: 'smart_money_net_flow', operator: '>', value: 50000, source: 'gmgn' },
          message: `Smart money net buying ${this.formatUsd(smartMoneyData.netFlowUsd)} of ${symbol}`,
          rationale: 'Top traders accumulating - bullish signal',
          priority: 'medium',
          confidence: 0.8,
          estimatedValue: 'Potential 20-50% upside follow-through',
          proposedActions: [
            { type: 'create_alert', label: 'Track smart money flow', params: { token: symbol } },
            { type: 'adjust_position', label: 'Add to position', params: { token: symbol, amountUsd: 500 } },
          ],
        }));
      }

      if (smartMoneyData.netFlowUsd < -50000) {
        proposals.push(this.createProposal({
          type: 'smart_money',
          tokenMint: token.mint,
          tokenSymbol: symbol,
          condition: { metric: 'smart_money_net_flow', operator: '<', value: -50000, source: 'gmgn' },
          message: `Smart money net selling ${this.formatUsd(Math.abs(smartMoneyData.netFlowUsd))} of ${symbol}`,
          rationale: 'Top traders distributing - bearish signal',
          priority: 'high',
          confidence: 0.85,
          estimatedValue: `Avoid ${this.formatUsd(valueUsd * 0.3)} additional loss`,
          proposedActions: [
            { type: 'create_alert', label: 'Track smart money exit', params: { token: symbol } },
            { type: 'adjust_position', label: 'Reduce position', params: { token: symbol, pct: 50 } },
          ],
        }));
      }
    }

    // Technical alerts
    const technical = marketData.technical?.[token.mint];
    if (technical) {
      if (technical.rsi14 < 30) {
        proposals.push(this.createProposal({
          type: 'technical',
          tokenMint: token.mint,
          tokenSymbol: symbol,
          condition: { metric: 'rsi_14', operator: '<', value: 30, source: 'price_feed' },
          message: `${symbol} RSI at ${technical.rsi14.toFixed(0)} - oversold`,
          rationale: 'RSI < 30 often precedes bounce',
          priority: 'medium',
          confidence: 0.7,
          estimatedValue: 'Potential 10-20% bounce',
          proposedActions: [
            { type: 'create_alert', label: 'RSI oversold alert', params: { token: symbol, rsi: 30 } },
            { type: 'create_snipe_rule', label: 'Snipe bounce', params: { token: symbol, trigger: 'rsi_oversold' } },
          ],
        }));
      }

      if (technical.rsi14 > 70) {
        proposals.push(this.createProposal({
          type: 'technical',
          tokenMint: token.mint,
          tokenSymbol: symbol,
          condition: { metric: 'rsi_14', operator: '>', value: 70, source: 'price_feed' },
          message: `${symbol} RSI at ${technical.rsi14.toFixed(0)} - overbought`,
          rationale: 'RSI > 70 often precedes pullback',
          priority: 'medium',
          confidence: 0.7,
          estimatedValue: 'Lock in gains before 10-15% pullback',
          proposedActions: [
            { type: 'create_alert', label: 'RSI overbought alert', params: { token: symbol, rsi: 70 } },
            { type: 'adjust_position', label: 'Take partial profits', params: { token: symbol, pct: 30 } },
          ],
        }));
      }
    }

    // Security monitoring
    const security = marketData.security?.[token.mint];
    if (security && security.score < 60) {
      proposals.push(this.createProposal({
        type: 'security',
        tokenMint: token.mint,
        tokenSymbol: symbol,
        condition: { metric: 'security_score', operator: '<', value: 60, source: 'gmgn' },
        message: `${symbol} security score: ${security.score}/100 - ${security.risks?.join(', ') || 'multiple risks'}`,
        rationale: 'Low security score increases rug/honeypot risk',
        priority: 'critical',
        confidence: 0.95,
        estimatedValue: `Protect ${this.formatUsd(valueUsd)} from potential loss`,
        proposedActions: [
          { type: 'create_alert', label: 'Security monitoring', params: { token: symbol } },
          { type: 'adjust_position', label: 'Exit immediately', params: { token: symbol, pct: 100 } },
        ],
      }));
    }

    return proposals;
  }

  private generatePortfolioProposals(portfolio: any, totalValue: number): AlertProposal[] {
    const proposals: AlertProposal[] = [];

    // Drawdown alert
    const drawdown = portfolio.drawdownPercent || 0;
    if (drawdown > 15) {
      proposals.push(this.createProposal({
        type: 'portfolio',
        condition: { metric: 'portfolio_drawdown_pct', operator: '>', value: 15, source: 'portfolio' },
        message: `Portfolio down ${drawdown.toFixed(1)}% from peak`,
        rationale: 'Significant drawdown requires risk review',
        priority: drawdown > 25 ? 'critical' : 'high',
        confidence: 0.9,
        estimatedValue: `Prevent further ${this.formatUsd(totalValue * 0.1)} loss`,
        proposedActions: [
          { type: 'create_alert', label: 'Portfolio drawdown alert', params: { threshold: 15 } },
          { type: 'adjust_position', label: 'Reduce risk exposure', params: { action: 'de-risk' } },
        ],
      }));
    }

    // Low stablecoin reserve
    const stableValue = portfolio.stableValueUsd || 0;
    const stablePct = totalValue > 0 ? (stableValue / totalValue) * 100 : 0;
    if (stablePct < 10 && totalValue > 1000) {
      proposals.push(this.createProposal({
        type: 'portfolio',
        condition: { metric: 'stablecoin_pct', operator: '<', value: 10, source: 'portfolio' },
        message: `Only ${stablePct.toFixed(0)}% in stablecoins (target: 15-25%)`,
        rationale: 'Low dry powder limits opportunity capture',
        priority: 'medium',
        confidence: 0.8,
        estimatedValue: 'Missed opportunities during dips',
        proposedActions: [
          { type: 'create_alert', label: 'Stablecoin reserve alert', params: { targetPct: 20 } },
          { type: 'adjust_position', label: 'Build stable reserve', params: { action: 'accumulate_stable', targetPct: 20 } },
        ],
      }));
    }

    return proposals;
  }

  private generateRegimeProposals(marketData: any): AlertProposal[] {
    const proposals: AlertProposal[] = [];
    const regime = marketData.regime;

    if (!regime) return proposals;

    if (regime.trend === 'bear' && regime.volatility === 'high') {
      proposals.push(this.createProposal({
        type: 'price',
        condition: { metric: 'market_regime', operator: '==', value: 'bear_high_vol', source: 'market' },
        message: 'Market regime: Bear + High Volatility - reduce exposure',
        rationale: 'Bear markets with high vol destroy leverage and cause whipsaws',
        priority: 'high',
        confidence: 0.8,
        estimatedValue: 'Reduce drawdown by 30-50%',
        proposedActions: [
          { type: 'create_alert', label: 'Regime change monitor', params: {} },
          { type: 'adjust_position', label: 'De-risk portfolio', params: { action: 'de-risk', targetCash: 30 } },
        ],
      }));
    }

    if (regime.trend === 'bull' && regime.phase === 'early') {
      proposals.push(this.createProposal({
        type: 'price',
        condition: { metric: 'market_regime', operator: '==', value: 'bull_early', source: 'market' },
        message: 'Early bull market detected - increase quality exposure',
        rationale: 'Early bull offers best risk/reward for quality assets',
        priority: 'medium',
        confidence: 0.75,
        estimatedValue: 'Capture 50-100% upside',
        proposedActions: [
          { type: 'create_alert', label: 'Bull market confirmation', params: {} },
          { type: 'adjust_position', label: 'Increase allocation', params: { action: 'increase_quality', targetCash: 10 } },
        ],
      }));
    }

    return proposals;
  }

  private generateYieldProposals(marketData: any): AlertProposal[] {
    const proposals: AlertProposal[] = [];
    const yields = marketData.yields || [];

    for (const yieldOpp of yields) {
      if (yieldOpp.apy > 40 && yieldOpp.riskScore < 40) {
        proposals.push(this.createProposal({
          type: 'yield',
          tokenMint: yieldOpp.tokenMint,
          tokenSymbol: yieldOpp.tokenSymbol,
          condition: { metric: 'apy', operator: '>', value: 40, source: 'yield_aggregator' },
          message: `${yieldOpp.protocol} offering ${yieldOpp.apy.toFixed(0)}% APY on ${yieldOpp.tokenSymbol} (risk: ${yieldOpp.riskScore}/100)`,
          rationale: 'High yield with low risk - excellent compounding opportunity',
          priority: 'medium',
          confidence: 0.8,
          estimatedValue: `Earn ${this.formatUsd(yieldOpp.apy / 100 * 10000)} annually per $10k`,
          proposedActions: [
            { type: 'create_alert', label: 'Yield opportunity alert', params: { protocol: yieldOpp.protocol, token: yieldOpp.tokenSymbol } },
            { type: 'adjust_position', label: 'Deploy capital', params: { protocol: yieldOpp.protocol, token: yieldOpp.tokenSymbol, amountUsd: 5000 } },
          ],
        }));
      }
    }

    return proposals;
  }

  private async generateLaunchProposals(marketData: any): Promise<AlertProposal[]> {
    const proposals: AlertProposal[] = [];
    const launches = marketData.newLaunches || [];

    for (const launch of launches.slice(0, 5)) {
      if (launch.smartMoneyInterest > 0.7 || launch.securityScore > 70) {
        proposals.push(this.createProposal({
          type: 'launch',
          tokenMint: launch.mint,
          tokenSymbol: launch.symbol,
          condition: { metric: 'is_new_launch', operator: '==', value: true, source: 'launch_tracker' },
          message: `New launch: ${launch.symbol} - ${launch.description} (Security: ${launch.securityScore}/100, Smart Money: ${(launch.smartMoneyInterest * 100).toFixed(0)}%)`,
          rationale: 'High-quality new launch with smart money interest',
          priority: 'medium',
          confidence: launch.smartMoneyInterest * 0.8 + (launch.securityScore / 100) * 0.2,
          estimatedValue: 'Potential 5-50x if successful',
          proposedActions: [
            { type: 'create_alert', label: 'Track new launch', params: { mint: launch.mint } },
            { type: 'create_snipe_rule', label: 'Create snipe rule', params: { mint: launch.mint, amountUsd: 200 } },
          ],
        }));
      }
    }

    return proposals;
  }

  private createProposal(params: Partial<AlertProposal> & { type: AlertProposal['type']; condition: AlertCondition }): AlertProposal {
    return {
      id: `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: params.type,
      tokenMint: params.tokenMint,
      tokenSymbol: params.tokenSymbol,
      condition: params.condition,
      message: params.message || '',
      rationale: params.rationale || '',
      priority: params.priority || 'medium',
      confidence: params.confidence || 0.5,
      estimatedValue: params.estimatedValue || '',
      proposedActions: params.proposedActions || [],
      createdAt: Date.now(),
    };
  }

  private formatUsd(value: number): string {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  }

  getProposals(filters?: { type?: AlertProposal['type']; priority?: AlertProposal['priority']; minConfidence?: number }): AlertProposal[] {
    let proposals = Array.from(this.proposals.values());
    
    if (filters) {
      if (filters.type) proposals = proposals.filter(p => p.type === filters.type);
      if (filters.priority) proposals = proposals.filter(p => p.priority === filters.priority);
      if (filters.minConfidence) proposals = proposals.filter(p => p.confidence >= filters.minConfidence);
    }

    return proposals.sort((a, b) => b.createdAt - a.createdAt);
  }

  subscribe(callback: (proposals: AlertProposal[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const proposals = this.getProposals();
    for (const sub of this.subscribers) {
      try { sub(proposals); } catch (e) { console.error('Alert subscriber error:', e); }
    }
  }

  // Auto-generate proposals periodically
  startAutoGeneration(
    portfolioProvider: () => Promise<any>,
    marketDataProvider: () => Promise<any>,
    intervalMs: number = 5 * 60 * 1000 // 5 minutes
  ): void {
    if (this.generationInterval) clearInterval(this.generationInterval);

    const run = async () => {
      try {
        const portfolio = await portfolioProvider();
        const marketData = await marketDataProvider();
        await this.generateProposals(portfolio, marketData);
      } catch (error) {
        console.error('[SmartAlert] Generation failed:', error);
      }
    };

    run();
    this.generationInterval = setInterval(run, intervalMs);
  }

  stopAutoGeneration(): void {
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
      this.generationInterval = null;
    }
  }
}

// Singleton
let alertGeneratorInstance: SmartAlertGenerator | null = null;

export function getSmartAlertGenerator(): SmartAlertGenerator {
  if (!alertGeneratorInstance) {
    alertGeneratorInstance = new SmartAlertGenerator();
  }
  return alertGeneratorInstance;
}

// React hook
export function useSmartAlertGenerator() {
  const generator = getSmartAlertGenerator();
  
  return {
    generateProposals: (portfolio: any, marketData: any) => generator.generateProposals(portfolio, marketData),
    getProposals: (filters?: any) => generator.getProposals(filters),
    subscribe: (callback: (proposals: AlertProposal[]) => void) => generator.subscribe(callback),
    startAutoGeneration: (portfolioProvider: () => Promise<any>, marketDataProvider: () => Promise<any>, intervalMs?: number) => 
      generator.startAutoGeneration(portfolioProvider, marketDataProvider, intervalMs),
    stopAutoGeneration: () => generator.stopAutoGeneration(),
  };
}

export type { AlertProposal, AlertCondition, ProposedAction, AlertTemplate };