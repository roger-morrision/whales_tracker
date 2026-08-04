/**
 * Natural Language → Trade/Rule Parser
 * Converts "Buy $500 WIF if smart money enters" → snipe rule
 */

export interface ParsedIntent {
  action: 'buy' | 'sell' | 'snipe' | 'dca' | 'trailing_stop' | 'alert' | 'copy_trade' | 'rebalance';
  confidence: number;
  entities: ExtractedEntities;
  conditions: ParsedCondition[];
  rawText: string;
}

export interface ExtractedEntities {
  token?: {
    symbol?: string;
    mint?: string;
    name?: string;
  };
  amount?: {
    value: number;
    currency: 'USD' | 'SOL' | '%';
  };
  price?: {
    value: number;
    currency: 'USD' | 'SOL';
    type: 'limit' | 'market' | 'stop' | 'target';
  };
  percentage?: number;
  timeframe?: string;
  wallet?: string;
  protocol?: string;
  strategy?: string;
}

export interface ParsedCondition {
  type: 'price' | 'volume' | 'smart_money' | 'technical' | 'time' | 'social' | 'security' | 'liquidity';
  operator: '>' | '<' | '>=' | '<=' | '==' | 'crosses_above' | 'crosses_below' | 'changes_by';
  value: number | string;
  timeframe?: string;
  logic?: 'AND' | 'OR';
}

export interface ExecutableRule {
  id: string;
  name: string;
  type: 'snipe' | 'trailing_stop' | 'dca' | 'copy_trade' | 'alert' | 'rebalance';
  enabled: boolean;
  priority: number;
  conditions: ExecutableCondition[];
  actions: ExecutableAction[];
  riskLimits: RiskLimits;
  metadata: {
    createdFrom: 'nl' | 'manual';
    originalText: string;
    confidence: number;
    createdAt: number;
  };
}

export interface ExecutableCondition {
  type: string;
  operator: string;
  value: number | string;
  timeframe?: string;
  source: 'gmgn' | 'dexscreener' | 'jupiter' | 'price_feed' | 'custom';
}

export interface ExecutableAction {
  type: 'buy' | 'sell' | 'alert' | 'notify' | 'execute_dca' | 'update_trailing' | 'copy_trade';
  params: Record<string, any>;
  maxRetries: number;
  retryDelayMs: number;
}

export interface RiskLimits {
  maxPositionUsd: number;
  maxDailyLossUsd: number;
  maxSlippageBps: number;
  requireConfirmation: boolean;
  allowedTokens?: string[];
  blockedTokens?: string[];
}

class NLToRuleParser {
  private tokenAliases: Map<string, string> = new Map([
    ['wif', 'dogwifhat'],
    ['bonk', 'BONK'],
    ['jup', 'JUP'],
    ['sol', 'SOL'],
    ['usdc', 'USDC'],
    ['usdt', 'USDT'],
    ['ray', 'RAY'],
    ['orca', 'ORCA'],
    ['mngo', 'MNGO'],
    ['srm', 'SRM'],
    ['step', 'STEP'],
    ['maps', 'MAPS'],
    ['oxy', 'OXY'],
    ['samo', 'SAMO'],
    ['cheems', 'CHEEMS'],
    ['popcat', 'POPCAT'],
    ['wen', 'WEN'],
    ['book', 'BOOK'],
    ['mew', 'MEW'],
    ['michi', 'MICHI'],
    ['pnut', 'PNUT'],
    ['act', 'ACT'],
    ['fartcoin', 'FARTCOIN'],
    ['ai16z', 'AI16Z'],
    ['zerebro', 'ZEREBRO'],
    ['griffain', 'GRIFFAIN'],
    ['arc', 'ARC'],
    ['sora', 'SORA'],
  ]);

  private actionPatterns = [
    { pattern: /\b(buy|purchase|long|enter|get into|ape into)\b/i, action: 'buy' },
    { pattern: /\b(sell|exit|close|dump|get out)\b/i, action: 'sell' },
    { pattern: /\b(snipe|sniper|instant buy|front run|front-run)\b/i, action: 'snipe' },
    { pattern: /\b(dca|dollar cost average|dollar-cost|recurring buy|auto buy)\b/i, action: 'dca' },
    { pattern: /\b(trailing stop|trailing-stop|trail stop|dynamic stop)\b/i, action: 'trailing_stop' },
    { pattern: /\b(alert|notify|ping|tell me|watch|monitor)\b/i, action: 'alert' },
    { pattern: /\b(copy trade|copy-trade|mirror|follow)\b/i, action: 'copy_trade' },
    { pattern: /\b(rebalance|re-balance|reallocate)\b/i, action: 'rebalance' },
  ];

  private conditionPatterns = [
    { pattern: /\b(smart money|whale|whales|big money|institutional)\s+(buy|buys|bought|enter|enters|entered|accumulate|accumulating)\b/i, type: 'smart_money', operator: '>', value: 1 },
    { pattern: /\b(smart money|whale|whales)\s+(sell|sells|sold|exit|exits|exited|dump|dumping)\b/i, type: 'smart_money', operator: '<', value: -1 },
    { pattern: /\b(price|value)\s+(above|over|greater than|>)\s*\$?(\d+(?:\.\d+)?)\b/i, type: 'price', operator: '>', value: 0 },
    { pattern: /\b(price|value)\s+(below|under|less than|<)\s*\$?(\d+(?:\.\d+)?)\b/i, type: 'price', operator: '<', value: 0 },
    { pattern: /\b(price|value)\s+(hits|reaches|touches)\s*\$?(\d+(?:\.\d+)?)\b/i, type: 'price', operator: '>=', value: 0 },
    { pattern: /\b(volume|vol)\s+(above|over|>)\s*\$?(\d+(?:\.\d+)?)\s*[mkb]?/i, type: 'volume', operator: '>', value: 0 },
    { pattern: /\b(volume|vol)\s+(spike|spikes|surge|surges)\b/i, type: 'volume', operator: '>', value: 2 },
    { pattern: /\b(rsi)\s+(above|over|>)\s*(\d+)/i, type: 'technical', operator: '>', value: 0, indicator: 'rsi' },
    { pattern: /\b(rsi)\s+(below|under|<)\s*(\d+)/i, type: 'technical', operator: '<', value: 0, indicator: 'rsi' },
    { pattern: /\b(macd)\s+(cross|signal)\b/i, type: 'technical', operator: 'crosses_above', value: 0, indicator: 'macd' },
    { pattern: /\b(ema|sma)\s*(\d+)\s+(cross|crosses)\s+(above|below)\s*(ema|sma)\s*(\d+)/i, type: 'technical', operator: 'crosses_above', value: 0, indicator: 'ma_cross' },
    { pattern: /\b(security score|safety score|rug score)\s+(above|over|>)\s*(\d+)/i, type: 'security', operator: '>', value: 0 },
    { pattern: /\b(liquidity|liq)\s+(above|over|>)\s*\$?(\d+(?:\.\d+)?)\s*[mkb]?/i, type: 'liquidity', operator: '>', value: 0 },
    { pattern: /\b(market cap|mcap)\s+(above|over|>)\s*\$?(\d+(?:\.\d+)?)\s*[mkb]?/i, type: 'price', operator: '>', value: 0, metric: 'market_cap' },
    { pattern: /\b(holder|holders)\s+(increase|grow|up)\b/i, type: 'social', operator: '>', value: 0, metric: 'holders' },
    { pattern: /\b(social|twitter|mentions)\s+(spike|surge|viral)\b/i, type: 'social', operator: '>', value: 2, metric: 'mentions' },
    { pattern: /\b(new pair|new token|launch|listing)\b/i, type: 'custom', operator: '==', value: 'new_launch' },
    { pattern: /\b(graduat|migrate to raydium)\b/i, type: 'custom', operator: '==', value: 'graduation' },
  ];

  private amountPattern = /\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(usd|sol|%|percent)?/i;
  private percentagePattern = /(\d+(?:\.\d+)?)\s*%/i;
  private tokenPattern = /\b([A-Z]{2,10}|[a-z]{2,10})\b/;
  private timeframePattern = /\b(\d+)\s*(min|mins|minute|minutes|hour|hours|hr|hrs|day|days|week|weeks|month|months)\b/i;

  parse(text: string): ParsedIntent {
    const lowerText = text.toLowerCase();
    
    // Detect action
    let action: ParsedIntent['action'] = 'buy';
    let actionConfidence = 0;
    
    for (const { pattern, action: act } of this.actionPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        action = act;
        actionConfidence = 0.9;
        break;
      }
    }

    // Extract entities
    const entities = this.extractEntities(text, action);
    
    // Extract conditions
    const conditions = this.extractConditions(lowerText);
    
    // Calculate overall confidence
    const entityConfidence = entities.token ? 0.8 : 0.5;
    const conditionConfidence = conditions.length > 0 ? 0.8 : 0.6;
    const confidence = (actionConfidence + entityConfidence + conditionConfidence) / 3;

    return {
      action,
      confidence,
      entities,
      conditions,
      rawText: text,
    };
  }

  private extractEntities(text: string, action: ParsedIntent['action']): ExtractedEntities {
    const entities: ExtractedEntities = {};
    const lowerText = text.toLowerCase();

    // Extract amount
    const amountMatch = text.match(this.amountPattern);
    if (amountMatch) {
      const value = parseFloat(amountMatch[1].replace(/,/g, ''));
      const currency = (amountMatch[2]?.toUpperCase() || 'USD') as 'USD' | 'SOL' | '%';
      entities.amount = { value, currency };
    }

    // Extract percentage
    const pctMatch = text.match(this.percentagePattern);
    if (pctMatch) {
      entities.percentage = parseFloat(pctMatch[1]);
    }

    // Extract token
    const tokens = this.extractToken(text);
    if (tokens) {
      entities.token = tokens;
    }

    // Extract price targets
    const priceEntities = this.extractPriceTargets(text);
    if (priceEntities) {
      entities.price = priceEntities;
    }

    // Extract timeframe
    const tfMatch = text.match(this.timeframePattern);
    if (tfMatch) {
      entities.timeframe = tfMatch[0];
    }

    // Extract wallet address
    const walletMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (walletMatch) {
      entities.wallet = walletMatch[0];
    }

    // Extract protocol
    const protocols = ['jupiter', 'raydium', 'orca', 'meteora', 'phoenix', 'pump.fun', 'pumpfun', 'gmgn'];
    for (const proto of protocols) {
      if (lowerText.includes(proto)) {
        entities.protocol = proto;
        break;
      }
    }

    return entities;
  }

  private extractToken(text: string): ExtractedEntities['token'] {
    const lowerText = text.toLowerCase();
    
    // Check for known token aliases
    for (const [alias, fullName] of this.tokenAliases) {
      if (lowerText.includes(alias)) {
        // Try to find the symbol in the text near the alias
        const symbolMatch = text.match(new RegExp(`\\b${alias}\\b`, 'i'));
        if (symbolMatch) {
          return { symbol: alias.toUpperCase(), name: fullName };
        }
      }
    }

    // Look for $TOKEN pattern
    const dollarTokenMatch = text.match(/\$([A-Z]{2,10})/);
    if (dollarTokenMatch) {
      return { symbol: dollarTokenMatch[1] };
    }

    // Look for common patterns like "buy WIF" or "WIF token"
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-zA-Z]/g, '').toUpperCase();
      if (word.length >= 2 && word.length <= 10 && /^[A-Z]+$/.test(word)) {
        // Check if it's a known token context
        const prevWord = words[i - 1]?.toLowerCase();
        const nextWord = words[i + 1]?.toLowerCase();
        const contextWords = ['buy', 'sell', 'snipe', 'token', 'coin', 'long', 'short', 'enter', 'exit'];
        if (contextWords.includes(prevWord) || contextWords.includes(nextWord)) {
          if (this.tokenAliases.has(word.toLowerCase())) {
            return { symbol: word, name: this.tokenAliases.get(word.toLowerCase()) };
          }
          return { symbol: word };
        }
      }
    }

    return undefined;
  }

  private extractPriceTargets(text: string): ExtractedEntities['price'] | undefined {
    const lowerText = text.toLowerCase();
    const prices: { value: number; currency: 'USD' | 'SOL'; type: 'limit' | 'market' | 'stop' | 'target' }[] = [];

    // Limit price
    const limitMatch = text.match(/(?:limit|at)\s*\$?(\d+(?:\.\d+)?)/i);
    if (limitMatch) {
      prices.push({ value: parseFloat(limitMatch[1]), currency: 'USD', type: 'limit' });
    }

    // Stop loss
    const stopMatch = text.match(/(?:stop.loss|stop|sl)\s*\$?(\d+(?:\.\d+)?)/i);
    if (stopMatch) {
      prices.push({ value: parseFloat(stopMatch[1]), currency: 'USD', type: 'stop' });
    }

    // Take profit
    const tpMatch = text.match(/(?:take.profit|tp|target)\s*\$?(\d+(?:\.\d+)?)/i);
    if (tpMatch) {
      prices.push({ value: parseFloat(tpMatch[1]), currency: 'USD', type: 'target' });
    }

    // Trailing stop percentage
    const trailMatch = text.match(/(?:trail|trailing)\s*(\d+(?:\.\d+)?)\s*%/i);
    if (trailMatch) {
      prices.push({ value: parseFloat(trailMatch[1]), currency: 'USD', type: 'stop' });
    }

    return prices.length > 0 ? prices[0] : undefined;
  }

  private extractConditions(lowerText: string): ParsedCondition[] {
    const conditions: ParsedCondition[] = [];

    for (const { pattern, type, operator, value, indicator, metric } of this.conditionPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const extractedValue = typeof value === 'number' && match[2] 
          ? parseFloat(match[2]) 
          : value;
        
        conditions.push({
          type,
          operator,
          value: extractedValue,
          timeframe: this.extractTimeframe(lowerText),
          logic: lowerText.includes(' and ') ? 'AND' : lowerText.includes(' or ') ? 'OR' : undefined,
        });
      }
    }

    return conditions;
  }

  private extractTimeframe(text: string): string | undefined {
    const match = text.match(this.timeframePattern);
    return match ? match[0] : undefined;
  }

  // Convert parsed intent to executable rule
  toExecutableRule(parsed: ParsedIntent): ExecutableRule {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const conditions: ExecutableCondition[] = parsed.conditions.map(c => ({
      type: c.type,
      operator: c.operator,
      value: c.value,
      timeframe: c.timeframe,
      source: this.getSourceForCondition(c.type),
    }));

    const actions: ExecutableAction[] = this.generateActions(parsed);
    
    const riskLimits: RiskLimits = {
      maxPositionUsd: parsed.entities.amount?.currency === 'USD' 
        ? parsed.entities.amount.value * 2 
        : 1000,
      maxDailyLossUsd: 500,
      maxSlippageBps: 300,
      requireConfirmation: true,
    };

    return {
      id: ruleId,
      name: this.generateRuleName(parsed),
      type: parsed.action,
      enabled: true,
      priority: 1,
      conditions,
      actions,
      riskLimits,
      metadata: {
        createdFrom: 'nl',
        originalText: parsed.rawText,
        confidence: parsed.confidence,
        createdAt: Date.now(),
      },
    };
  }

  private getSourceForCondition(type: string): ExecutableCondition['source'] {
    switch (type) {
      case 'smart_money': return 'gmgn';
      case 'price': return 'price_feed';
      case 'volume': return 'dexscreener';
      case 'technical': return 'price_feed';
      case 'security': return 'gmgn';
      case 'liquidity': return 'dexscreener';
      case 'social': return 'gmgn';
      default: return 'custom';
    }
  }

  private generateActions(parsed: ParsedIntent): ExecutableAction[] {
    const actions: ExecutableAction[] = [];
    const token = parsed.entities.token?.symbol || 'UNKNOWN';
    const amount = parsed.entities.amount?.value || 100;
    const currency = parsed.entities.amount?.currency || 'USD';

    switch (parsed.action) {
      case 'snipe':
        actions.push({
          type: 'buy',
          params: {
            token,
            amount,
            currency,
            type: 'market',
            slippageBps: 500,
          },
          maxRetries: 3,
          retryDelayMs: 1000,
        });
        break;

      case 'buy':
        actions.push({
          type: 'buy',
          params: {
            token,
            amount,
            currency,
            type: parsed.entities.price?.type || 'limit',
            price: parsed.entities.price?.value,
            slippageBps: 100,
          },
          maxRetries: 3,
          retryDelayMs: 2000,
        });
        break;

      case 'sell':
        actions.push({
          type: 'sell',
          params: {
            token,
            amount,
            currency,
            type: parsed.entities.price?.type || 'market',
            price: parsed.entities.price?.value,
            slippageBps: 100,
          },
          maxRetries: 3,
          retryDelayMs: 2000,
        });
        break;

      case 'trailing_stop':
        actions.push({
          type: 'update_trailing',
          params: {
            token,
            trailPercent: parsed.entities.percentage || parsed.entities.price?.value || 15,
            activateAtProfit: parsed.entities.price?.value ? true : false,
          },
          maxRetries: 1,
          retryDelayMs: 5000,
        });
        break;

      case 'dca':
        actions.push({
          type: 'execute_dca',
          params: {
            token,
            amountPerInterval: amount,
            currency,
            interval: parsed.entities.timeframe || 'daily',
            maxOrders: 30,
            slippageBps: 100,
          },
          maxRetries: 3,
          retryDelayMs: 60000,
        });
        break;

      case 'alert':
        actions.push({
          type: 'alert',
          params: {
            token,
            condition: parsed.conditions[0]?.type || 'price',
            threshold: parsed.conditions[0]?.value,
            message: `${token} alert triggered`,
          },
          maxRetries: 1,
          retryDelayMs: 0,
        });
        break;

      case 'copy_trade':
        actions.push({
          type: 'copy_trade',
          params: {
            wallet: parsed.entities.wallet,
            maxPositionUsd: amount,
            copySells: true,
            copyBuys: true,
            delayMs: 5000,
          },
          maxRetries: 3,
          retryDelayMs: 10000,
        });
        break;

      case 'rebalance':
        actions.push({
          type: 'buy', // Will be handled by rebalancer
          params: {
            triggerRebalance: true,
          },
          maxRetries: 1,
          retryDelayMs: 0,
        });
        break;
    }

    // Add notification action for all
    actions.push({
      type: 'notify',
      params: {
        channel: 'telegram',
        template: `Rule "${this.generateRuleName(parsed)}" executed: {{action}} {{token}}`,
      },
      maxRetries: 3,
      retryDelayMs: 5000,
    });

    return actions;
  }

  private generateRuleName(parsed: ParsedIntent): string {
    const token = parsed.entities.token?.symbol || 'Token';
    const action = parsed.action.charAt(0).toUpperCase() + parsed.action.slice(1);
    return `${action} ${token} (NL)`;
  }
}

// Singleton
let nlParserInstance: NLToRuleParser | null = null;

export function getNLToRuleParser(): NLToRuleParser {
  if (!nlParserInstance) {
    nlParserInstance = new NLToRuleParser();
  }
  return nlParserInstance;
}

// React hook
export function useNLParser() {
  const parser = getNLToRuleParser();
  
  return {
    parse: (text: string) => parser.parse(text),
    toRule: (parsed: ParsedIntent) => parser.toExecutableRule(parsed),
    parseAndCreateRule: (text: string) => parser.toExecutableRule(parser.parse(text)),
  };
}

export type { ParsedIntent, ExtractedEntities, ParsedCondition, ExecutableRule, ExecutableCondition, ExecutableAction, RiskLimits };