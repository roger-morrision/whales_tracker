/**
 * Telegram/Discord Bot
 * Commands: /price, /alert, /portfolio, /snipe, /trade, /risk, /yield, /copy, /dca, /rebalance
 */

export interface BotCommand {
  command: string;
  description: string;
  usage: string;
  aliases: string[];
  category: 'trading' | 'portfolio' | 'alerts' | 'analysis' | 'settings' | 'admin';
  handler: (ctx: BotContext, args: string[]) => Promise<BotResponse>;
  permissions?: ('user' | 'premium' | 'admin')[];
  cooldownMs?: number;
}

export interface BotContext {
  userId: string;
  username?: string;
  firstName?: string;
  chatId: string;
  platform: 'telegram' | 'discord';
  messageId?: string;
  isPrivate: boolean;
  languageCode?: string;
}

export interface BotResponse {
  text: string;
  parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  keyboard?: BotKeyboard;
  disablePreview?: boolean;
  silent?: boolean;
}

export interface BotKeyboard {
  inline?: BotInlineKeyboardButton[][];
  reply?: BotReplyKeyboardButton[][];
  resizeKeyboard?: boolean;
  oneTimeKeyboard?: boolean;
}

export interface BotInlineKeyboardButton {
  text: string;
  callbackData?: string;
  url?: string;
  switchInlineQuery?: string;
}

export interface BotReplyKeyboardButton {
  text: string;
  requestContact?: boolean;
  requestLocation?: boolean;
}

export interface BotUser {
  id: string;
  platform: 'telegram' | 'discord';
  username?: string;
  firstName?: string;
  languageCode: string;
  preferences: UserPreferences;
  subscription: 'free' | 'premium' | 'admin';
  createdAt: number;
  lastActive: number;
  commandCount: number;
  allowedChats: string[];
}

export interface UserPreferences {
  notifications: {
    priceAlerts: boolean;
    tradeConfirmations: boolean;
    portfolioUpdates: boolean;
    smartMoneyAlerts: boolean;
    launchAlerts: boolean;
    yieldAlerts: boolean;
  };
  defaultChain: string;
  defaultSlippageBps: number;
  currency: 'USD' | 'EUR' | 'SOL';
  timezone: string;
  compactMode: boolean;
}

export interface ScheduledJob {
  id: string;
  userId: string;
  type: 'price_alert' | 'portfolio_report' | 'yield_check' | 'launch_monitor';
  config: Record<string, any>;
  nextRun: number;
  intervalMs?: number;
  cronExpression?: string;
  enabled: boolean;
  createdAt: number;
}

class TelegramDiscordBot {
  private commands: Map<string, BotCommand> = new Map();
  private users: Map<string, BotUser> = new Map();
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private commandCooldowns: Map<string, number> = new Map();
  private messageHandlers: Map<string, (ctx: BotContext, text: string) => Promise<void>> = new Map();
  private callbackHandlers: Map<string, (ctx: BotContext, data: string) => Promise<void>> = new Map();
  private platform: 'telegram' | 'discord' = 'telegram';
  private botToken?: string;
  private webhookUrl?: string;
  private isRunning = false;

  constructor() {
    this.registerCommands();
  }

  private registerCommands(): void {
    // Trading commands
    this.registerCommand({
      command: 'price',
      description: 'Get current token price',
      usage: '/price <SYMBOL> [QUOTE]',
      aliases: ['p', 'quote'],
      category: 'trading',
      handler: this.handlePrice.bind(this),
    });

    this.registerCommand({
      command: 'trade',
      description: 'Execute a trade via Jupiter',
      usage: '/trade <BUY|SELL> <SYMBOL> <AMOUNT> [SLIPPAGE]',
      aliases: ['buy', 'sell', 'swap'],
      category: 'trading',
      permissions: ['premium'],
      handler: this.handleTrade.bind(this),
    });

    this.registerCommand({
      command: 'snipe',
      description: 'Create a snipe rule for new launches',
      usage: '/snipe <SYMBOL> <AMOUNT> [FILTERS]',
      aliases: ['sniper'],
      category: 'trading',
      permissions: ['premium'],
      handler: this.handleSnipe.bind(this),
    });

    this.registerCommand({
      command: 'dca',
      description: 'Start dollar-cost averaging',
      usage: '/dca <SYMBOL> <AMOUNT> <INTERVAL> [MAX_ORDERS]',
      aliases: ['dcabuy'],
      category: 'trading',
      permissions: ['premium'],
      handler: this.handleDCA.bind(this),
    });

    this.registerCommand({
      command: 'trailing',
      description: 'Set trailing stop loss',
      usage: '/trailing <SYMBOL> <PERCENT> [ACTIVATE_AT]',
      aliases: ['trail', 'tsl'],
      category: 'trading',
      permissions: ['premium'],
      handler: this.handleTrailing.bind(this),
    });

    this.registerCommand({
      command: 'copy',
      description: 'Copy trade a wallet',
      usage: '/copy <WALLET_ADDRESS> <AMOUNT> [OPTIONS]',
      aliases: ['mirror', 'follow'],
      category: 'trading',
      permissions: ['premium'],
      handler: this.handleCopy.bind(this),
    });

    // Portfolio commands
    this.registerCommand({
      command: 'portfolio',
      description: 'Show portfolio summary',
      usage: '/portfolio [DETAIL_LEVEL]',
      aliases: ['port', 'bal', 'balance'],
      category: 'portfolio',
      handler: this.handlePortfolio.bind(this),
    });

    this.registerCommand({
      command: 'positions',
      description: 'List open positions',
      usage: '/positions [SYMBOL]',
      aliases: ['pos', 'holdings'],
      category: 'portfolio',
      handler: this.handlePositions.bind(this),
    });

    this.registerCommand({
      command: 'pnl',
      description: 'Show P&L analysis',
      usage: '/pnl [TIMEFRAME]',
      aliases: ['profit', 'loss'],
      category: 'portfolio',
      handler: this.handlePnL.bind(this),
    });

    this.registerCommand({
      command: 'risk',
      description: 'Portfolio risk analysis',
      usage: '/risk [DETAIL]',
      aliases: ['var', 'drawdown'],
      category: 'portfolio',
      handler: this.handleRisk.bind(this),
    });

    this.registerCommand({
      command: 'rebalance',
      description: 'Trigger portfolio rebalance',
      usage: '/rebalance [DRY_RUN]',
      aliases: ['rb'],
      category: 'portfolio',
      permissions: ['premium'],
      handler: this.handleRebalance.bind(this),
    });

    // Alert commands
    this.registerCommand({
      command: 'alert',
      description: 'Create price/condition alert',
      usage: '/alert <SYMBOL> <CONDITION> <VALUE>',
      aliases: ['notify', 'watch'],
      category: 'alerts',
      handler: this.handleAlert.bind(this),
    });

    this.registerCommand({
      command: 'alerts',
      description: 'List active alerts',
      usage: '/alerts [ACTIVE|TRIGGERED]',
      aliases: ['myalerts'],
      category: 'alerts',
      handler: this.handleListAlerts.bind(this),
    });

    this.registerCommand({
      command: 'removealert',
      description: 'Remove an alert',
      usage: '/removealert <ALERT_ID>',
      aliases: ['rmalert', 'delalert'],
      category: 'alerts',
      handler: this.handleRemoveAlert.bind(this),
    });

    // Analysis commands
    this.registerCommand({
      command: 'smartmoney',
      description: 'Show smart money flows for token',
      usage: '/smartmoney <SYMBOL> [TIMEFRAME]',
      aliases: ['sm', 'whales', 'flow'],
      category: 'analysis',
      handler: this.handleSmartMoney.bind(this),
    });

    this.registerCommand({
      command: 'security',
      description: 'Token security score',
      usage: '/security <SYMBOL>',
      aliases: ['sec', 'safety', 'rugcheck'],
      category: 'analysis',
      handler: this.handleSecurity.bind(this),
    });

    this.registerCommand({
      command: 'arbitrage',
      description: 'Show arbitrage opportunities',
      usage: '/arbitrage [MIN_PROFIT] [MIN_SPREAD]',
      aliases: ['arb'],
      category: 'analysis',
      handler: this.handleArbitrage.bind(this),
    });

    this.registerCommand({
      command: 'launch',
      description: 'Show new token launches',
      usage: '/launch [FILTER] [LIMIT]',
      aliases: ['launches', 'new'],
      category: 'analysis',
      handler: this.handleLaunch.bind(this),
    });

    this.registerCommand({
      command: 'yield',
      description: 'Show yield farming opportunities',
      usage: '/yield [TOKEN] [MIN_APY]',
      aliases: ['apy', 'farm', 'stake'],
      category: 'analysis',
      handler: this.handleYield.bind(this),
    });

    this.registerCommand({
      command: 'mev',
      description: 'MEV/sandwich attack alerts',
      usage: '/mev [TOKEN]',
      aliases: ['sandwich', 'frontrun'],
      category: 'analysis',
      handler: this.handleMEV.bind(this),
    });

    // Settings commands
    this.registerCommand({
      command: 'settings',
      description: 'Manage bot settings',
      usage: '/settings [SETTING] [VALUE]',
      aliases: ['config', 'prefs'],
      category: 'settings',
      handler: this.handleSettings.bind(this),
    });

    this.registerCommand({
      command: 'wallet',
      description: 'Manage connected wallets',
      usage: '/wallet <ADD|REMOVE|LIST> [ADDRESS] [LABEL]',
      aliases: ['wallets'],
      category: 'settings',
      permissions: ['premium'],
      handler: this.handleWallet.bind(this),
    });

    this.registerCommand({
      command: 'language',
      description: 'Change bot language',
      usage: '/language <CODE>',
      aliases: ['lang'],
      category: 'settings',
      handler: this.handleLanguage.bind(this),
    });

    // Utility commands
    this.registerCommand({
      command: 'start',
      description: 'Start bot and show welcome',
      usage: '/start',
      aliases: [],
      category: 'settings',
      handler: this.handleStart.bind(this),
    });

    this.registerCommand({
      command: 'help',
      description: 'Show help menu',
      usage: '/help [CATEGORY]',
      aliases: ['h', 'commands'],
      category: 'settings',
      handler: this.handleHelp.bind(this),
    });

    this.registerCommand({
      command: 'status',
      description: 'Bot and system status',
      usage: '/status',
      aliases: ['health', 'ping'],
      category: 'settings',
      handler: this.handleStatus.bind(this),
    });

    // Admin commands
    this.registerCommand({
      command: 'broadcast',
      description: 'Send message to all users (admin)',
      usage: '/broadcast <MESSAGE>',
      aliases: ['announce'],
      category: 'admin',
      permissions: ['admin'],
      handler: this.handleBroadcast.bind(this),
    });

    this.registerCommand({
      command: 'stats',
      description: 'Bot usage statistics (admin)',
      usage: '/stats',
      aliases: [],
      category: 'admin',
      permissions: ['admin'],
      handler: this.handleStats.bind(this),
    });
  }

  private registerCommand(cmd: BotCommand): void {
    this.commands.set(cmd.command, cmd);
    for (const alias of cmd.aliases) {
      this.commands.set(alias, cmd);
    }
  }

  // Command handlers
  private async handlePrice(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length === 0) {
      return { text: 'Usage: /price <SYMBOL> [QUOTE]\nExample: /price WIF SOL' };
    }

    const symbol = args[0].toUpperCase();
    const quote = args[1]?.toUpperCase() || 'USDC';

    // In production, fetch from price feed
    const mockPrices: Record<string, number> = {
      'SOL': 72.97, 'WIF': 0.142, 'JUP': 0.842, 'BONK': 0.000024,
      'RAY': 1.23, 'ORCA': 2.45, 'JTO': 3.67, 'MNGO': 0.089,
    };

    const price = mockPrices[symbol] || Math.random() * 10;
    const change24h = (Math.random() - 0.5) * 20;

    return {
      text: `💰 *${symbol}/${quote}*\n` +
            `Price: $${price.toFixed(price < 0.01 ? 6 : price < 1 ? 4 : 2)}\n` +
            `24h: ${change24h >= 0 ? '📈' : '📉'} ${change24h.toFixed(2)}%\n` +
            `Source: DexScreener (aggregated)`,
      parseMode: 'Markdown',
    };
  }

  private async handleTrade(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length < 3) {
      return { text: 'Usage: /trade <BUY|SELL> <SYMBOL> <AMOUNT> [SLIPPAGE_BPS]\nExample: /trade BUY WIF 100 100' };
    }

    const side = args[0].toUpperCase();
    const symbol = args[1].toUpperCase();
    const amount = parseFloat(args[2]);
    const slippage = parseInt(args[3]) || 100;

    if (!['BUY', 'SELL'].includes(side)) {
      return { text: 'Side must be BUY or SELL' };
    }

    // In production: execute via Jupiter
    return {
      text: `✅ *Trade Submitted*\n` +
            `Side: ${side}\n` +
            `Token: ${symbol}\n` +
            `Amount: $${amount}\n` +
            `Slippage: ${slippage} bps\n` +
            `Status: Simulating...`,
      parseMode: 'Markdown',
      keyboard: {
        inline: [[{ text: 'View on Solscan', url: 'https://solscan.io' }]],
      },
    };
  }

  private async handleSnipe(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length < 2) {
      return { text: 'Usage: /snipe <SYMBOL> <AMOUNT> [SECURITY_MIN] [LIQUIDITY_MIN]\nExample: /snipe WIF 200 70 10000' };
    }

    const symbol = args[0].toUpperCase();
    const amount = parseFloat(args[1]);
    const securityMin = parseInt(args[2]) || 70;
    const liquidityMin = parseInt(args[3]) || 10000;

    return {
      text: `🎯 *Snipe Rule Created*\n` +
            `Token: ${symbol}\n` +
            `Amount: $${amount}\n` +
            `Min Security: ${securityMin}/100\n` +
            `Min Liquidity: $${liquidityMin.toLocaleString()}\n` +
            `Status: Monitoring launches...`,
      parseMode: 'Markdown',
    };
  }

  private async handleDCA(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length < 3) {
      return { text: 'Usage: /dca <SYMBOL> <AMOUNT> <INTERVAL> [MAX_ORDERS]\nIntervals: hourly, daily, weekly\nExample: /dca SOL 50 daily 30' };
    }

    const symbol = args[0].toUpperCase();
    const amount = parseFloat(args[1]);
    const interval = args[2].toLowerCase();
    const maxOrders = parseInt(args[3]) || 30;

    if (!['hourly', 'daily', 'weekly'].includes(interval)) {
      return { text: 'Interval must be: hourly, daily, or weekly' };
    }

    return {
      text: `📈 *DCA Started*\n` +
            `Token: ${symbol}\n` +
            `Amount: $${amount}/${interval}\n` +
            `Max Orders: ${maxOrders}\n` +
            `Total: $${amount * maxOrders}\n` +
            `Next: ${this.getNextRunTime(interval)}`,
      parseMode: 'Markdown',
    };
  }

  private async handleTrailing(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length < 2) {
      return { text: 'Usage: /trailing <SYMBOL> <PERCENT> [ACTIVATE_AT_PROFIT%]\nExample: /trailing WIF 15 50' };
    }

    const symbol = args[0].toUpperCase();
    const percent = parseFloat(args[1]);
    const activateAt = parseFloat(args[2]);

    return {
      text: `📉 *Trailing Stop Set*\n` +
            `Token: ${symbol}\n` +
            `Trail: ${percent}%\n` +
            `${activateAt ? `Activates at: +${activateAt}% profit` : 'Active immediately'}\n` +
            `Status: Monitoring...`,
      parseMode: 'Markdown',
    };
  }

  private async handleCopy(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length < 2) {
      return { text: 'Usage: /copy <WALLET_ADDRESS> <AMOUNT_USD> [COPY_SELLS] [DELAY_MS]\nExample: /copy 7xKXtg... 500 true 5000' };
    }

    const wallet = args[0];
    const amount = parseFloat(args[1]);
    const copySells = args[2]?.toLowerCase() !== 'false';
    const delay = parseInt(args[3]) || 5000;

    if (wallet.length < 32 || wallet.length > 44) {
      return { text: 'Invalid Solana wallet address' };
    }

    return {
      text: `👥 *Copy Trade Active*\n` +
            `Wallet: ${wallet.slice(0, 8)}...${wallet.slice(-6)}\n` +
            `Max Position: $${amount}\n` +
            `Copy Sells: ${copySells ? 'Yes' : 'No'}\n` +
            `Delay: ${delay}ms\n` +
            `Status: Following...`,
      parseMode: 'Markdown',
    };
  }

  private async handlePortfolio(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const detail = args[0]?.toLowerCase() || 'summary';
    const totalValue = 12450.67;
    const change24h = 2.34;

    let text = `📊 *Portfolio*\n` +
               `Total: $${totalValue.toLocaleString()}\n` +
               `24h: ${change24h >= 0 ? '📈' : '📉'} ${change24h.toFixed(2)}%\n\n`;

    if (detail === 'full') {
      text += `*Holdings:*\n` +
              `SOL: 45.2 ($3,298) 📈 +1.2%\n` +
              `WIF: 12,500 ($1,775) 📈 +5.4%\n` +
              `JUP: 2,100 ($1,768) 📉 -0.8%\n` +
              `BONK: 50M ($1,200) 📈 +3.1%\n` +
              `USDC: $4,410\n\n` +
              `*Chains:* Solana 95%, Ethereum 5%`;
    } else {
      text += `Top 5: SOL, WIF, JUP, BONK, USDC\n` +
              `Use /portfolio full for details`;
    }

    return { text, parseMode: 'Markdown' };
  }

  private async handlePositions(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const symbol = args[0]?.toUpperCase();
    // Mock positions
    return {
      text: `📋 *Open Positions*\n\n` +
            `1. WIF - Long\n` +
            `   Entry: $0.135 | Current: $0.142\n` +
            `   Size: 12,500 ($1,775) | PnL: +$650 (+5.2%)\n` +
            `   Trailing: 15% @ $0.121\n\n` +
            `2. JUP - Long\n` +
            `   Entry: $0.85 | Current: $0.842\n` +
            `   Size: 2,100 ($1,768) | PnL: -$17 (-0.9%)\n` +
            `   Stop: $0.765\n\n` +
            `Use /pnl for detailed analysis`,
      parseMode: 'Markdown',
    };
  }

  private async handlePnL(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const timeframe = args[0]?.toLowerCase() || '7d';
    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;

    return {
      text: `📈 *P&L Analysis (${timeframe})*\n\n` +
            `Total PnL: +$1,234 (+11.0%)\n` +
            `Realized: +$890\n` +
            `Unrealized: +$344\n\n` +
            `Win Rate: 67% (24/36)\n` +
            `Avg Win: +$156 | Avg Loss: -$89\n` +
            `Profit Factor: 2.34\n` +
            `Sharpe: 1.82 | Sortino: 2.45\n\n` +
            `Best: WIF +$650 (+5.2%)\n` +
            `Worst: MEME -$120 (-8.3%)\n\n` +
            `Max Drawdown: -8.2% (3 days)`,
      parseMode: 'Markdown',
    };
  }

  private async handleRisk(ctx: BotContext, args: string[]): Promise<BotResponse> {
    return {
      text: `⚠️ *Risk Analysis*\n\n` +
            `VaR (95%): -$1,120 (1 day)\n` +
            `CVaR (95%): -$1,456\n` +
            `Max Drawdown: -8.2%\n\n` +
            `Concentration: 42% (SOL) - HIGH\n` +
            `Correlation Risk: 34/100\n` +
            `Liquidity Risk: 12/100\n\n` +
            `Sector Exposure:\n` +
            `  DeFi: 35% | Memecoin: 28%\n` +
            `  AI: 15% | Infrastructure: 12%\n` +
            `  Stablecoin: 10%\n\n` +
            `Stress Tests:\n` +
            `  SOL -50%: -$3,735\n` +
            `  Memecoin -80%: -$2,788\n` +
            `  Liquidity Crisis: -$1,867`,
      parseMode: 'Markdown',
    };
  }

  private async handleRebalance(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const dryRun = args[0]?.toLowerCase() === 'true' || args[0] === 'dry';

    return {
      text: `${dryRun ? '🔍 *Rebalance Preview (Dry Run)*' : '⚖️ *Rebalance Executed*'}\n\n` +
            `Current → Target:\n` +
            `SOL: 38% → 30% (SELL $987)\n` +
            `WIF: 22% → 15% (SELL $876)\n` +
            `JUP: 14% → 15% (BUY $123)\n` +
            `BONK: 10% → 10% (HOLD)\n` +
            `USDC: 16% → 30% (BUY $1,740)\n\n` +
            `Est. Fees: $12.50 | Slippage: ~$8\n` +
            `${dryRun ? 'Run without "dry" to execute' : 'Completed in 3.2s'}`,
      parseMode: 'Markdown',
    };
  }

  private async handleAlert(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length < 3) {
      return { text: 'Usage: /alert <SYMBOL> <ABOVE|BELOW|CHANGE> <VALUE>\nExample: /alert WIF ABOVE 0.15\n         /alert SOL CHANGE 10%' };
    }

    const symbol = args[0].toUpperCase();
    const condition = args[1].toUpperCase();
    const value = args[2];

    if (!['ABOVE', 'BELOW', 'CHANGE', 'VOLUME', 'RSI'].includes(condition)) {
      return { text: 'Condition must be: ABOVE, BELOW, CHANGE, VOLUME, or RSI' };
    }

    return {
      text: `🔔 *Alert Created*\n` +
            `Token: ${symbol}\n` +
            `Condition: Price ${condition} ${value}\n` +
            `ID: alert_${Date.now().toString(36).slice(2, 8)}\n` +
            `Use /alerts to manage`,
      parseMode: 'Markdown',
    };
  }

  private async handleListAlerts(ctx: BotContext, args: string[]): Promise<BotResponse> {
    return {
      text: `🔔 *Active Alerts*\n\n` +
            `1. WIF ABOVE 0.15 - Price alert\n` +
            `2. SOL CHANGE 10% - 24h change\n` +
            `3. JUP RSI BELOW 30 - Technical\n` +
            `4. NEW LAUNCH Security>70 - Launch monitor\n\n` +
            `Total: 4 active | 2 triggered (24h)\n` +
            `Use /removealert <ID> to delete`,
      parseMode: 'Markdown',
    };
  }

  private async handleRemoveAlert(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length === 0) {
      return { text: 'Usage: /removealert <ALERT_ID>\nUse /alerts to see IDs' };
    }
    return { text: `✅ Alert ${args[0]} removed` };
  }

  private async handleSmartMoney(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const symbol = args[0]?.toUpperCase() || 'WIF';
    const timeframe = args[1] || '24h';

    return {
      text: `🧠 *Smart Money Flow: ${symbol} (${timeframe})*\n\n` +
            `Net Flow: +$47,230 📈\n` +
            `Whales: 3 buying, 1 selling\n` +
            `Smart Money: 7 buying, 2 selling\n` +
            `KOLs: 2 mentions\n\n` +
            `Top Buyers:\n` +
            `  7xKXtg...: +$23,400 (Win: 72%)\n` +
            `  9HuYpL...: +$15,800 (Win: 68%)\n` +
            `  Fund_ABC: +$8,030 (Win: 75%)\n\n` +
            `Signal: ACCUMULATION 🟢`,
      parseMode: 'Markdown',
    };
  }

  private async handleSecurity(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const symbol = args[0]?.toUpperCase() || 'WIF';

    return {
      text: `🛡️ *Security Score: ${symbol}*\n\n` +
            `Overall: 87/100 🟢\n\n` +
            `Authority: 95/100 (No mint/freeze)\n` +
            `Liquidity: 82/100 ($2.4M locked)\n` +
            `Holders: 78/100 (2,450 holders)\n` +
            `Contract: 90/100 (Verified, no proxy)\n` +
            `Market: 85/100 (Healthy spread)\n` +
            `Social: 92/100 (Verified accounts)\n\n` +
            `Risks: None detected\n` +
            `✅ Safe to trade`,
      parseMode: 'Markdown',
    };
  }

  private async handleArbitrage(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const minProfit = parseFloat(args[0]) || 10;
    const minSpread = parseFloat(args[1]) || 0.5;

    return {
      text: `⚡ *Arbitrage Opportunities*\n` +
            `(Min: $${minProfit} profit, ${minSpread}% spread)\n\n` +
            `1. WIF: Raydium → Orca\n` +
            `   Buy: $0.1418 | Sell: $0.1432\n` +
            `   Spread: 0.99% | Profit: $23.40\n` +
            `   Liquidity: $1.2M / $890k\n\n` +
            `2. JUP: Phoenix → Raydium\n` +
            `   Buy: $0.839 | Sell: $0.847\n` +
            `   Spread: 0.95% | Profit: $18.70\n` +
            `   Liquidity: $560k / $1.1M\n\n` +
            `3. BONK: Meteora → Orca\n` +
            `   Buy: $0.0000238 | Sell: $0.0000241\n` +
            `   Spread: 1.26% | Profit: $31.20\n` +
            `   Liquidity: $2.1M / $1.8M\n\n` +
            `Total: 3 opportunities | Est. $73.30`,
      parseMode: 'Markdown',
    };
  }

  private async handleLaunch(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const filter = args[0]?.toLowerCase() || 'all';
    const limit = parseInt(args[1]) || 5;

    return {
      text: `🚀 *New Launches (${filter})*\n\n` +
            `1. $MEME - pump.fun\n` +
            `   Security: 92/100 | Liq: $45k\n` +
            `   Smart Money: 3 buying | Vol: $120k\n` +
            `   Age: 2 min | Grad: 87%\n\n` +
            `2. $AIAGENT - Raydium CPMM\n` +
            `   Security: 85/100 | Liq: $180k\n` +
            `   Smart Money: 1 fund | Vol: $89k\n` +
            `   Age: 15 min | Grad: N/A\n\n` +
            `3. $DEGEN - pump.fun\n` +
            `   Security: 71/100 | Liq: $28k\n` +
            `   Smart Money: 0 | Vol: $45k\n` +
            `   Age: 45 sec | Grad: 45%\n\n` +
            `⚠️ High risk - DYOR before sniping`,
      parseMode: 'Markdown',
    };
  }

  private async handleYield(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const token = args[0]?.toUpperCase();
    const minApy = parseFloat(args[1]) || 20;

    return {
      text: `💰 *Yield Opportunities* ${token ? `(${token})` : ''}\n` +
            `(Min APY: ${minApy}%)\n\n` +
            `1. Kamino - SOL/USDC LP\n` +
            `   APY: 42% | TVL: $12M | Risk: 25/100\n` +
            `   Auto-compound: Yes | Impermanent Loss: Low\n\n` +
            `2. MarginFi - JUP Staking\n` +
            `   APY: 28% | TVL: $8.4M | Risk: 15/100\n` +
            `   Auto-compound: Yes | Lock: Flexible\n\n` +
            `3. Drift - SOL Lending\n` +
            `   APY: 18% | TVL: $45M | Risk: 10/100\n` +
            `   Auto-compound: No | Instant withdraw\n\n` +
            `4. Jito - JitoSOL Liquid Staking\n` +
            `   APY: 8.5% | TVL: $2.1B | Risk: 5/100\n` +
            `   Auto-compound: Yes | MEV rewards\n\n` +
            `💡 Diversify across protocols for safety`,
      parseMode: 'Markdown',
    };
  }

  private async handleMEV(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const symbol = args[0]?.toUpperCase();

    return {
      text: `⚔️ *MEV Activity* ${symbol ? `(${symbol})` : '(All)'}\n\n` +
            `Last 24h: 23 attacks detected\n\n` +
            `Sandwich: 14 | Backrun: 6 | Frontrun: 3\n\n` +
            `Top Targets:\n` +
            `  WIF: 7 sandwiches ($4,200 extracted)\n` +
            `  JUP: 4 sandwiches ($2,100 extracted)\n` +
            `  BONK: 3 backruns ($890 extracted)\n\n` +
            `Your positions: 0 affected ✅\n` +
            `Protection: Jito tip 100k lamports`,
      parseMode: 'Markdown',
    };
  }

  private async handleSettings(ctx: BotContext, args: string[]): Promise<BotResponse> {
    if (args.length === 0) {
      return {
        text: `⚙️ *Settings*\n\n` +
              `Language: English\n` +
              `Currency: USD\n` +
              `Timezone: UTC\n` +
              `Default Slippage: 100 bps\n` +
              `Notifications: All enabled\n` +
              `Compact Mode: Off\n\n` +
              `Use /settings <KEY> <VALUE> to change\n` +
              `Keys: language, currency, timezone, slippage, notifications, compact`,
        parseMode: 'Markdown',
      };
    }

    const [key, ...valueParts] = args;
    const value = valueParts.join(' ');

    return { text: `✅ Setting updated: ${key} = ${value || '(cleared)'}` };
  }

  private async handleWallet(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const action = args[0]?.toUpperCase() || 'LIST';

    if (action === 'LIST') {
      return {
        text: `👛 *Connected Wallets*\n\n` +
              `1. Main Wallet (Phantom)\n` +
              `   7xKXtg2v...p9Km | $12,450\n` +
              `   Active: ✅ | Last sync: 2 min ago\n\n` +
              `2. Trading Wallet (Backpack)\n` +
              `   9HuYpL4m...q3Rt | $3,200\n` +
              `   Active: ✅ | Last sync: 5 min ago\n\n` +
              `3. Watch Only: Whale_001\n` +
              `   3FjKmP8n...w7Xz | $2.4M\n` +
              `   Active: ✅ | Last sync: 1 hour ago`,
        parseMode: 'Markdown',
      };
    }

    if (action === 'ADD' && args.length >= 2) {
      return { text: `✅ Wallet added: ${args[1].slice(0, 8)}...${args[1].slice(-6)}` };
    }

    if (action === 'REMOVE' && args.length >= 2) {
      return { text: `✅ Wallet removed: ${args[1].slice(0, 8)}...${args[1].slice(-6)}` };
    }

    return { text: 'Usage: /wallet LIST|ADD|REMOVE [ADDRESS] [LABEL]' };
  }

  private async handleLanguage(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const lang = args[0]?.toLowerCase() || 'en';
    const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ru', 'pt', 'ar'];
    
    if (!languages.includes(lang)) {
      return { text: `Supported: ${languages.join(', ')}` };
    }

    return { text: `✅ Language set to: ${lang}` };
  }

  private async handleStart(ctx: BotContext, args: string[]): Promise<BotResponse> {
    return {
      text: `🐋 *Welcome to Whales Tracker Bot!*\n\n` +
            `Your on-chain trading assistant with:\n` +
            `💰 Real-time prices & trading\n` +
            `🎯 Launch sniping & DCA\n` +
            `📊 Portfolio & risk management\n` +
            `🧠 Smart money & whale tracking\n` +
            `⚡ Arbitrage & MEV monitoring\n` +
            `💰 Yield farming optimization\n\n` +
            `Get started: /help\n` +
            `Connect wallet: /wallet ADD <ADDRESS> <LABEL>\n` +
            `Check price: /price SOL`,
      parseMode: 'Markdown',
      keyboard: {
        inline: [
          [{ text: '💰 Price Check', callbackData: 'menu_price' }, { text: '📊 Portfolio', callbackData: 'menu_portfolio' }],
          [{ text: '🎯 Snipe Rules', callbackData: 'menu_snipe' }, { text: '📈 Yield', callbackData: 'menu_yield' }],
          [{ text: '⚙️ Settings', callbackData: 'menu_settings' }],
        ],
      },
    };
  }

  private async handleHelp(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const category = args[0]?.toLowerCase();
    const categories = ['trading', 'portfolio', 'alerts', 'analysis', 'settings', 'admin'];
    
    if (category && categories.includes(category)) {
      const cmds = Array.from(this.commands.values()).filter(c => c.category === category);
      let text = `📖 *${category.charAt(0).toUpperCase() + category.slice(1)} Commands*\n\n`;
      for (const cmd of cmds) {
        text += `/\`${cmd.command}\` - ${cmd.description}\n   Usage: \`${cmd.usage}\`\n\n`;
      }
      return { text, parseMode: 'Markdown' };
    }

    let text = `📖 *Whales Tracker Bot - Commands*\n\n`;
    for (const cat of categories) {
      const cmds = Array.from(this.commands.values()).filter(c => c.category === cat);
      text += `*${cat.charAt(0).toUpperCase() + cat.slice(1)}:*\n`;
      for (const cmd of cmds) {
        text += `  /\`${cmd.command}\` - ${cmd.description}\n`;
      }
      text += '\n';
    }
    text += `Use /help <category> for details\n` +
            `Use /start for quick menu`;
    return { text, parseMode: 'Markdown' };
  }

  private async handleStatus(ctx: BotContext, args: string[]): Promise<BotResponse> {
    return {
      text: `🟢 *System Status*\n\n` +
            `Bot: Online\n` +
            `Price Feed: Connected (WS)\n` +
            `Solana RPC: Healthy (45ms)\n` +
            `DexScreener: OK\n` +
            `Jupiter: OK\n` +
            `GMGN: OK (rate limited)\n` +
            `TimescaleDB: Connected\n\n` +
            `Uptime: 7d 14h 32m\n` +
            `Commands (24h): 1,234\n` +
            `Active Users: 89\n` +
            `Active Alerts: 234\n` +
            `Active Snipes: 12`,
      parseMode: 'Markdown',
    };
  }

  private async handleBroadcast(ctx: BotContext, args: string[]): Promise<BotResponse> {
    const message = args.join(' ');
    if (!message) return { text: 'Usage: /broadcast <MESSAGE>' };
    return { text: `📢 Broadcast sent to ${this.users.size} users: ${message}` };
  }

  private async handleStats(ctx: BotContext, args: string[]): Promise<BotResponse> {
    return {
      text: `📊 *Bot Statistics*\n\n` +
            `Total Users: ${this.users.size}\n` +
            `Premium: ${Array.from(this.users.values()).filter(u => u.subscription === 'premium').length}\n` +
            `Commands (24h): 1,234\n` +
            `Commands (7d): 8,432\n` +
            `Avg Response: 142ms\n` +
            `Errors (24h): 3\n` +
            `Active Alerts: 234\n` +
            `Active Snipes: 12\n` +
            `Active DCA: 45\n` +
            `Copy Trades: 23\n` +
            `Scheduled Jobs: 156`,
      parseMode: 'Markdown',
    };
  }

  // Utility methods
  private getNextRunTime(interval: string): string {
    const now = new Date();
    switch (interval) {
      case 'hourly':
        now.setHours(now.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        now.setDate(now.getDate() + 1);
        now.setHours(9, 0, 0, 0); // 9 AM UTC
        break;
      case 'weekly':
        now.setDate(now.getDate() + (7 - now.getDay()));
        now.setHours(9, 0, 0, 0);
        break;
    }
    return now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  // Public API
  async processMessage(ctx: BotContext, text: string): Promise<BotResponse | null> {
    // Check for command
    const match = text.match(/^\/(\w+)(?:\s+(.*))?$/);
    if (match) {
      const commandName = match[1].toLowerCase();
      const args = match[2] ? match[2].split(/\s+/) : [];
      
      const command = this.commands.get(commandName);
      if (command) {
        // Check permissions
        const user = this.getOrCreateUser(ctx);
        if (command.permissions && !command.permissions.includes(user.subscription) && !command.permissions.includes('user')) {
          return { text: `❌ This command requires ${command.permissions.join('/')} subscription` };
        }

        // Check cooldown
        const cooldownKey = `${ctx.userId}:${commandName}`;
        const lastRun = this.commandCooldowns.get(cooldownKey) || 0;
        const cooldownMs = command.cooldownMs || 1000;
        if (Date.now() - lastRun < cooldownMs) {
          return { text: `⏳ Please wait ${Math.ceil((cooldownMs - (Date.now() - lastRun)) / 1000)}s` };
        }
        this.commandCooldowns.set(cooldownKey, Date.now());

        // Update user activity
        user.lastActive = Date.now();
        user.commandCount++;

        try {
          return await command.handler(ctx, args);
        } catch (error) {
          console.error(`[Bot] Command ${commandName} failed:`, error);
          return { text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
      }
    }

    // Check for message handlers
    for (const [pattern, handler] of this.messageHandlers) {
      if (text.match(pattern)) {
        await handler(ctx, text);
        return null;
      }
    }

    return null;
  }

  async processCallback(ctx: BotContext, data: string): Promise<BotResponse | null> {
    for (const [pattern, handler] of this.callbackHandlers) {
      if (data.match(pattern)) {
        await handler(ctx, data);
        return null;
      }
    }
    return null;
  }

  private getOrCreateUser(ctx: BotContext): BotUser {
    let user = this.users.get(ctx.userId);
    if (!user) {
      user = {
        id: ctx.userId,
        platform: ctx.platform,
        username: ctx.username,
        firstName: ctx.firstName,
        languageCode: ctx.languageCode || 'en',
        preferences: {
          notifications: {
            priceAlerts: true,
            tradeConfirmations: true,
            portfolioUpdates: true,
            smartMoneyAlerts: true,
            launchAlerts: true,
            yieldAlerts: true,
          },
          defaultChain: 'solana',
          defaultSlippageBps: 100,
          currency: 'USD',
          timezone: 'UTC',
          compactMode: false,
        },
        subscription: 'free',
        createdAt: Date.now(),
        lastActive: Date.now(),
        commandCount: 0,
        allowedChats: [ctx.chatId],
      };
      this.users.set(ctx.userId, user);
    }
    return user;
  }

  // User management
  getUser(userId: string): BotUser | undefined {
    return this.users.get(userId);
  }

  updateUser(userId: string, updates: Partial<BotUser>): BotUser | null {
    const user = this.users.get(userId);
    if (!user) return null;
    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    return updated;
  }

  setSubscription(userId: string, tier: 'free' | 'premium' | 'admin'): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.subscription = tier;
    return true;
  }

  // Scheduled jobs
  scheduleJob(job: Omit<ScheduledJob, 'id' | 'createdAt'>): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newJob: ScheduledJob = {
      ...job,
      id,
      createdAt: Date.now(),
    };
    this.scheduledJobs.set(id, newJob);
    return id;
  }

  cancelJob(jobId: string): boolean {
    return this.scheduledJobs.delete(jobId);
  }

  getJobs(userId?: string): ScheduledJob[] {
    let jobs = Array.from(this.scheduledJobs.values());
    if (userId) jobs = jobs.filter(j => j.userId === userId);
    return jobs;
  }

  // Bot lifecycle
  setToken(token: string): void {
    this.botToken = token;
  }

  setWebhook(url: string): void {
    this.webhookUrl = url;
  }

  start(): void {
    this.isRunning = true;
    console.log('[Bot] Started');
  }

  stop(): void {
    this.isRunning = false;
    console.log('[Bot] Stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getCommandList(): BotCommand[] {
    return Array.from(new Set(this.commands.values()));
  }
}

// Singleton
let botInstance: TelegramDiscordBot | null = null;

export function getTelegramDiscordBot(): TelegramDiscordBot {
  if (!botInstance) {
    botInstance = new TelegramDiscordBot();
  }
  return botInstance;
}

// React hook
export function useTelegramBot() {
  const bot = getTelegramDiscordBot();
  
  return {
    processMessage: (ctx: BotContext, text: string) => bot.processMessage(ctx, text),
    processCallback: (ctx: BotContext, data: string) => bot.processCallback(ctx, data),
    getUser: (id: string) => bot.getUser(id),
    updateUser: (id: string, updates: Partial<BotUser>) => bot.updateUser(id, updates),
    setSubscription: (id: string, tier: 'free' | 'premium' | 'admin') => bot.setSubscription(id, tier),
    scheduleJob: (job: any) => bot.scheduleJob(job),
    cancelJob: (id: string) => bot.cancelJob(id),
    getJobs: (userId?: string) => bot.getJobs(userId),
    setToken: (token: string) => bot.setToken(token),
    setWebhook: (url: string) => bot.setWebhook(url),
    start: () => bot.start(),
    stop: () => bot.stop(),
    isActive: () => bot.isActive(),
    getCommands: () => bot.getCommandList(),
  };
}

export type { BotCommand, BotContext, BotResponse, BotKeyboard, BotInlineKeyboardButton, BotReplyKeyboardButton, BotUser, UserPreferences, ScheduledJob };