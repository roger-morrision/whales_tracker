/**
 * AI Copilot
 * Intelligent trading assistant with tool use capabilities
 * Integrates with z-ai-web-dev-sdk or OpenAI/Anthropic for natural language queries
 */

import { getJupiterExecutor } from './jupiter-executor';
import { getSmartMoneyIntelligence } from './smart-money-intel';
import { getPortfolioAnalytics } from './portfolio-analytics';
import { getOrderManager } from './advanced-orders';
import { getRealtimeManager } from './websocket-manager';

export interface CopilotTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<any>;
}

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
  error?: string;
}

export interface CopilotContext {
  userAddress?: string;
  selectedToken?: string;
  portfolioValue?: number;
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  tradingMode?: 'manual' | 'semi-auto' | 'full-auto';
}

class AICopilot {
  private tools: Map<string, CopilotTool> = new Map();
  private conversationHistory: CopilotMessage[] = [];
  private context: CopilotContext = {};
  private systemPrompt: string;
  private modelProvider: 'z-ai' | 'openai' | 'anthropic' | 'local' = 'z-ai';

  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
    this.registerTools();
  }

  private buildSystemPrompt(): string {
    return `You are Moby AI, an expert crypto trading assistant for the Whales Tracker platform.
You help users analyze tokens, execute trades, manage portfolios, and track smart money.

CAPABILITIES:
- Token analysis (price, liquidity, holders, smart money, risk)
- Trade execution via Jupiter Ultra API (MEV protected)
- Portfolio management (PnL, risk metrics, tax reporting)
- Smart money tracking (whales, KOLs, institutional flows)
- Advanced orders (limit, DCA, stop-loss, trailing stop)
- Real-time alerts and notifications
- Cross-chain analysis (Solana, Ethereum, Base, BSC)
- Narrative detection and trend analysis

TOOLS AVAILABLE:
You have access to various tools for fetching data and executing actions.
Always use tools for real-time data - never guess prices or metrics.

TRADING PHILOSOPHY:
- Risk management first: never recommend position sizes > 5% portfolio without explicit user consent
- MEV protection: always use Jupiter Ultra for swaps
- Smart money signals: prioritize tokens with smart money inflow
- Transparency: explain reasoning and show data sources
- User control: never execute trades without explicit confirmation

RESPONSE STYLE:
- Concise but informative
- Use data to back claims
- Show relevant metrics inline
- Ask clarifying questions when needed
- Format: Analysis → Recommendation → Action Items`;
  }

  private registerTools(): void {
    // Token analysis tools
    this.registerTool({
      name: 'get_token_info',
      description: 'Get comprehensive token information including price, liquidity, holders, and smart money metrics',
      parameters: {
        type: 'object',
        properties: {
          tokenMint: { type: 'string', description: 'Token mint address' },
          chain: { type: 'string', default: 'solana' },
        },
        required: ['tokenMint'],
      },
      execute: async ({ tokenMint, chain = 'solana' }) => {
        const intel = getSmartMoneyIntelligence();
        return intel.getTokenIntelligence(tokenMint, chain);
      },
    });

    this.registerTool({
      name: 'get_token_price',
      description: 'Get current token price from multiple sources',
      parameters: {
        type: 'object',
        properties: {
          tokenMint: { type: 'string' },
          chain: { type: 'string', default: 'solana' },
        },
        required: ['tokenMint'],
      },
      execute: async ({ tokenMint, chain = 'solana' }) => {
        const jupiter = getJupiterExecutor();
        const prices = await jupiter.getTokenPrices([tokenMint]);
        return { tokenMint, price: prices[tokenMint] || 0, source: 'jupiter' };
      },
    });

    this.registerTool({
      name: 'get_smart_money_flow',
      description: 'Get smart money activity for a token',
      parameters: {
        type: 'object',
        properties: {
          tokenMint: { type: 'string' },
          chain: { type: 'string', default: 'solana' },
          limit: { type: 'number', default: 20 },
        },
        required: ['tokenMint'],
      },
      execute: async ({ tokenMint, chain = 'solana', limit = 20 }) => {
        const intel = getSmartMoneyIntelligence();
        return intel.getSmartMoneyFeed(chain, limit);
      },
    });

    this.registerTool({
      name: 'get_narrative_clusters',
      description: 'Get emerging narrative clusters with smart money inflow',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 10 },
        },
      },
      execute: async ({ limit = 10 }) => {
        const intel = getSmartMoneyIntelligence();
        return intel.getNarrativeClusters();
      },
    });

    this.registerTool({
      name: 'get_cross_chain_presence',
      description: 'Check token presence across multiple chains',
      parameters: {
        type: 'object',
        properties: {
          tokenMints: { type: 'array', items: { type: 'string' } },
        },
        required: ['tokenMints'],
      },
      execute: async ({ tokenMints }) => {
        const intel = getSmartMoneyIntelligence();
        return intel.getCrossChainTokens(tokenMints);
      },
    });

    // Trading tools
    this.registerTool({
      name: 'get_swap_quote',
      description: 'Get a swap quote from Jupiter Ultra API',
      parameters: {
        type: 'object',
        properties: {
          inputMint: { type: 'string' },
          outputMint: { type: 'string' },
          amount: { type: 'number', description: 'Raw amount in lamports/smallest unit' },
          slippageBps: { type: 'number', default: 100 },
        },
        required: ['inputMint', 'outputMint', 'amount'],
      },
      execute: async ({ inputMint, outputMint, amount, slippageBps = 100 }) => {
        const jupiter = getJupiterExecutor();
        return jupiter.getQuote({ inputMint, outputMint, amount, slippageBps });
      },
    });

    this.registerTool({
      name: 'execute_swap',
      description: 'Execute a swap transaction (requires user wallet connection)',
      parameters: {
        type: 'object',
        properties: {
          quote: { type: 'object', description: 'Quote from get_swap_quote' },
          userPublicKey: { type: 'string' },
          priorityFee: { type: 'string', enum: ['low', 'medium', 'high', 'veryHigh'], default: 'medium' },
        },
        required: ['quote', 'userPublicKey'],
      },
      execute: async ({ quote, userPublicKey, priorityFee = 'medium' }) => {
        const jupiter = getJupiterExecutor();
        // Note: This requires a signTransaction function from the user's wallet
        // In practice, this would be called from the frontend with wallet access
        return { 
          success: false, 
          error: 'Execute swap requires wallet connection. Call from frontend with signTransaction.' 
        };
      },
    });

    this.registerTool({
      name: 'simulate_swap',
      description: 'Simulate a swap to check for errors without executing',
      parameters: {
        type: 'object',
        properties: {
          quote: { type: 'object' },
          userPublicKey: { type: 'string' },
        },
        required: ['quote', 'userPublicKey'],
      },
      execute: async ({ quote, userPublicKey }) => {
        const jupiter = getJupiterExecutor();
        return jupiter.simulateSwap(quote, userPublicKey);
      },
    });

    // Portfolio tools
    this.registerTool({
      name: 'get_portfolio_metrics',
      description: 'Get portfolio analytics including PnL, risk metrics, and allocation',
      parameters: {
        type: 'object',
        properties: {
          userAddress: { type: 'string' },
        },
      },
      execute: async ({ userAddress }) => {
        const analytics = getPortfolioAnalytics();
        return analytics.calculateMetrics();
      },
    });

    this.registerTool({
      name: 'get_portfolio_holdings',
      description: 'Get current portfolio holdings with unrealized PnL',
      parameters: {
        type: 'object',
        properties: {
          userAddress: { type: 'string' },
        },
      },
      execute: async ({ userAddress }) => {
        const analytics = getPortfolioAnalytics();
        return analytics.getAllHoldings();
      },
    });

    this.registerTool({
      name: 'generate_tax_report',
      description: 'Generate tax report (Form 8949) for a tax year',
      parameters: {
        type: 'object',
        properties: {
          taxYear: { type: 'number' },
          userAddress: { type: 'string' },
        },
        required: ['taxYear'],
      },
      execute: async ({ taxYear }) => {
        const analytics = getPortfolioAnalytics();
        return analytics.generateTaxReport(taxYear);
      },
    });

    // Advanced orders
    this.registerTool({
      name: 'create_limit_order',
      description: 'Create a limit order',
      parameters: {
        type: 'object',
        properties: {
          userPublicKey: { type: 'string' },
          tokenMint: { type: 'string' },
          tokenSymbol: { type: 'string' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          targetPrice: { type: 'number' },
          amount: { type: 'number' },
          slippageBps: { type: 'number', default: 100 },
          expiresAt: { type: 'number' },
        },
        required: ['userPublicKey', 'tokenMint', 'tokenSymbol', 'side', 'targetPrice', 'amount'],
      },
      execute: async (params) => {
        const orders = getOrderManager();
        const order = orders.createLimitOrder(params);
        orders.addOrder(order);
        return order;
      },
    });

    this.registerTool({
      name: 'create_dca_order',
      description: 'Create a DCA (dollar-cost averaging) strategy',
      parameters: {
        type: 'object',
        properties: {
          userPublicKey: { type: 'string' },
          tokenMint: { type: 'string' },
          tokenSymbol: { type: 'string' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          totalAmount: { type: 'number' },
          amountPerOrder: { type: 'number' },
          intervalMs: { type: 'number' },
          maxOrders: { type: 'number' },
          slippageBps: { type: 'number', default: 100 },
        },
        required: ['userPublicKey', 'tokenMint', 'tokenSymbol', 'side', 'totalAmount', 'amountPerOrder', 'intervalMs', 'maxOrders'],
      },
      execute: async (params) => {
        const orders = getOrderManager();
        const order = orders.createDCAOrder(params);
        orders.addOrder(order);
        return order;
      },
    });

    this.registerTool({
      name: 'create_stop_loss',
      description: 'Create a stop-loss order',
      parameters: {
        type: 'object',
        properties: {
          userPublicKey: { type: 'string' },
          tokenMint: { type: 'string' },
          tokenSymbol: { type: 'string' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          triggerPrice: { type: 'number' },
          amount: { type: 'number' },
          slippageBps: { type: 'number', default: 100 },
        },
        required: ['userPublicKey', 'tokenMint', 'tokenSymbol', 'side', 'triggerPrice', 'amount'],
      },
      execute: async (params) => {
        const orders = getOrderManager();
        const order = orders.createStopLossOrder(params);
        orders.addOrder(order);
        return order;
      },
    });

    this.registerTool({
      name: 'create_trailing_stop',
      description: 'Create a trailing stop order',
      parameters: {
        type: 'object',
        properties: {
          userPublicKey: { type: 'string' },
          tokenMint: { type: 'string' },
          tokenSymbol: { type: 'string' },
          trailPercent: { type: 'number' },
          amount: { type: 'number' },
          slippageBps: { type: 'number', default: 100 },
          initialPrice: { type: 'number' },
        },
        required: ['userPublicKey', 'tokenMint', 'tokenSymbol', 'trailPercent', 'amount', 'initialPrice'],
      },
      execute: async (params) => {
        const orders = getOrderManager();
        const order = orders.createTrailingStopOrder(params);
        orders.addOrder(order);
        return order;
      },
    });

    this.registerTool({
      name: 'get_active_orders',
      description: 'Get all active orders for a user',
      parameters: {
        type: 'object',
        properties: {
          userPublicKey: { type: 'string' },
        },
        required: ['userPublicKey'],
      },
      execute: async ({ userPublicKey }) => {
        const orders = getOrderManager();
        return orders.getActiveOrders(userPublicKey);
      },
    });

    // Alerts and monitoring
    this.registerTool({
      name: 'create_price_alert',
      description: 'Create a price alert for a token',
      parameters: {
        type: 'object',
        properties: {
          tokenMint: { type: 'string' },
          tokenSymbol: { type: 'string' },
          condition: { type: 'string', enum: ['above', 'below', 'change_pct'] },
          threshold: { type: 'number' },
          channels: { type: 'array', items: { type: 'string' }, default: ['push'] },
        },
        required: ['tokenMint', 'tokenSymbol', 'condition', 'threshold'],
      },
      execute: async (params) => {
        // Would integrate with alert system
        return { success: true, alertId: `alert_${Date.now()}`, ...params };
      },
    });

    this.registerTool({
      name: 'get_recent_alerts',
      description: 'Get recent smart money and whale alerts',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 20 },
        },
      },
      execute: async ({ limit = 20 }) => {
        const realtime = getRealtimeManager();
        return realtime.getRecentAlerts(limit);
      },
    });

    // Market data
    this.registerTool({
      name: 'get_trending_tokens',
      description: 'Get trending tokens with smart money metrics',
      parameters: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['1m', '5m', '1h', '6h', '24h'], default: '1h' },
          orderBy: { type: 'string', enum: ['volume', 'tx_count', 'market_cap', 'smart_money'], default: 'smart_money' },
          limit: { type: 'number', default: 20 },
        },
      },
      execute: async ({ timeframe = '1h', orderBy = 'smart_money', limit = 20 }) => {
        // Would call GMGN trending endpoint
        return { timeframe, orderBy, limit, tokens: [] };
      },
    });

    this.registerTool({
      name: 'get_new_tokens',
      description: 'Get newly launched tokens',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 20 },
        },
      },
      execute: async ({ limit = 20 }) => {
        // Would call GMGN new pairs endpoint
        return { limit, tokens: [] };
      },
    });
  }

  private registerTool(tool: CopilotTool): void {
    this.tools.set(tool.name, tool);
  }

  getTools(): CopilotTool[] {
    return Array.from(this.tools.values());
  }

  setContext(context: Partial<CopilotContext>): void {
    this.context = { ...this.context, ...context };
  }

  getContext(): CopilotContext {
    return this.context;
  }

  addMessage(message: CopilotMessage): void {
    this.conversationHistory.push(message);
    // Keep last 50 messages
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  getHistory(): CopilotMessage[] {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  async processMessage(userMessage: string): Promise<CopilotMessage> {
    // Add user message
    const userMsg: CopilotMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.addMessage(userMsg);

    // Build messages for model
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // In a real implementation, this would call the AI model
    // For now, we'll simulate with a tool-based approach
    const response = await this.generateResponse(messages);
    
    const assistantMsg: CopilotMessage = {
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
      timestamp: Date.now(),
    };
    this.addMessage(assistantMsg);

    return assistantMsg;
  }

  private async generateResponse(messages: any[]): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    // This is where the actual LLM call would happen
    // For now, we'll use a simple keyword-based routing to tools
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    
    // Simple keyword routing for demo
    if (lastMessage.includes('price') || lastMessage.includes('quote')) {
      // Extract token from message (simplified)
      const tokenMatch = lastMessage.match(/\b(SOL|USDC|BONK|WIF|JUP|JTO|RAY|ORCA)\b/i);
      if (tokenMatch) {
        const tokenMint = this.symbolToMint(tokenMatch[1]);
        const toolCall: ToolCall = {
          id: `call_${Date.now()}`,
          name: 'get_token_info',
          arguments: { tokenMint, chain: 'solana' },
        };
        return {
          content: `I'll get the latest info for ${tokenMatch[1]}...`,
          toolCalls: [toolCall],
        };
      }
    }

    if (lastMessage.includes('portfolio') || lastMessage.includes('pnl') || lastMessage.includes('holdings')) {
      const toolCall: ToolCall = {
        id: `call_${Date.now()}`,
        name: 'get_portfolio_metrics',
        arguments: { userAddress: this.context.userAddress || '' },
      };
      return {
        content: 'Let me check your portfolio metrics...',
        toolCalls: [toolCall],
      };
    }

    if (lastMessage.includes('smart money') || lastMessage.includes('whale') || lastMessage.includes('whales')) {
      const toolCall: ToolCall = {
        id: `call_${Date.now()}`,
        name: 'get_smart_money_flow',
        arguments: { tokenMint: '', chain: 'solana', limit: 20 },
      };
      return {
        content: 'Fetching smart money activity...',
        toolCalls: [toolCall],
      };
    }

    if (lastMessage.includes('narrative') || lastMessage.includes('trend') || lastMessage.includes('emerging')) {
      const toolCall: ToolCall = {
        id: `call_${Date.now()}`,
        name: 'get_narrative_clusters',
        arguments: { limit: 10 },
      };
      return {
        content: 'Analyzing emerging narratives...',
        toolCalls: [toolCall],
      };
    }

    if (lastMessage.includes('trade') || lastMessage.includes('swap') || lastMessage.includes('buy') || lastMessage.includes('sell')) {
      return {
        content: 'I can help you trade! Please specify:\n1. Token to buy/sell\n2. Amount (in USD or tokens)\n3. Slippage tolerance\n\nI\'ll get a quote from Jupiter Ultra API with MEV protection.',
      };
    }

    // Default response
    return {
      content: `I'm Moby AI, your crypto trading assistant. I can help you with:

📊 **Token Analysis** - Price, liquidity, holders, smart money metrics
💰 **Portfolio** - PnL, risk metrics, tax reports
🐋 **Smart Money** - Whale tracking, KOL flows, institutional signals
📈 **Narratives** - Emerging trends, sector rotation
⚡ **Trading** - Jupiter Ultra swaps, MEV protection, limit orders
🔔 **Alerts** - Price, smart money, whale accumulation

What would you like to do?`,
    };
  }

  private symbolToMint(symbol: string): string {
    const mints: Record<string, string> = {
      SOL: 'So11111111111111111111111111111111111111112',
      USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pgPNw',
      WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbHedv8mX5qQK',
      JTO: 'jtojtomepa8beP8AuQc6baXW3BHW4fomxFhNt2kkoRJ',
      RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeAU1kektH',
    };
    return mints[symbol.toUpperCase()] || symbol;
  }

  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);
    if (!tool) {
      return {
        toolCallId: toolCall.id,
        result: null,
        error: `Tool ${toolCall.name} not found`,
      };
    }

    try {
      const result = await tool.execute(toolCall.arguments);
      return {
        toolCallId: toolCall.id,
        result,
      };
    } catch (error: any) {
      return {
        toolCallId: toolCall.id,
        result: null,
        error: error.message,
      };
    }
  }
}

// Singleton
let copilotInstance: AICopilot | null = null;

export function getAICopilot(): AICopilot {
  if (!copilotInstance) {
    copilotInstance = new AICopilot();
  }
  return copilotInstance;
}

// React hook
export function useAICopilot() {
  const copilot = getAICopilot();
  const [messages, setMessages] = React.useState<CopilotMessage[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const sendMessage = React.useCallback(async (content: string) => {
    setIsProcessing(true);
    
    const userMessage: CopilotMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await copilot.processMessage(content);
      setMessages(prev => [...prev, response]);

      // Handle tool calls
      if (response.toolCalls) {
        for (const toolCall of response.toolCalls) {
          const result = await copilot.executeToolCall(toolCall);
          
          const toolMsg: CopilotMessage = {
            role: 'tool',
            content: JSON.stringify(result.result),
            toolResults: [result],
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, toolMsg]);
        }
        
        // Get final response after tool execution
        const finalResponse = await copilot.processMessage('Continue with the tool results above.');
        setMessages(prev => [...prev, finalResponse]);
      }
    } catch (error) {
      console.error('[Copilot] Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [copilot]);

  const clearHistory = React.useCallback(() => {
    copilot.clearHistory();
    setMessages([]);
  }, [copilot]);

  const setContext = React.useCallback((context: Partial<CopilotContext>) => {
    copilot.setContext(context);
  }, [copilot]);

  return {
    messages,
    isProcessing,
    sendMessage,
    clearHistory,
    setContext,
    context: copilot.getContext(),
  };
}

// Need React import
import React from 'react';

export type { CopilotTool, CopilotMessage, CopilotContext, ToolCall, ToolResult };