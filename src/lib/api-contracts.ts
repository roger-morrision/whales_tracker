import { z } from 'zod';

// ============================================
// Base Schemas
// ============================================

export const PriceSchema = z.object({
  price: z.number(),
  change24h: z.number().optional(),
  change1h: z.number().optional(),
  volume24h: z.number().optional(),
  marketCap: z.number().optional(),
  liquidity: z.number().optional(),
  source: z.enum(['dexscreener', 'fallback', 'gmgn']).optional(),
});

export const TokenSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  chain: z.string(),
  category: z.string(),
  price: z.number(),
  change24h: z.number(),
  change1h: z.number().optional(),
  marketCap: z.number(),
  liquidity: z.number(),
  volume24h: z.number(),
  holders: z.number().optional(),
  ageHours: z.number().optional(),
  smartMoneyHolders: z.number().optional(),
  smartMoneyInflow24h: z.number().optional(),
  sparkline: z.array(z.number()).optional(),
  logoColor: z.string().optional(),
  logoGlyph: z.string().optional(),
  verified: z.boolean().optional(),
  description: z.string().optional(),
  rank: z.number().optional(),
  mint: z.string().optional(),
});

export const QuoteSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  inAmount: z.string(),
  outAmount: z.string(),
  priceImpactPct: z.number().optional(),
  routePlan: z.array(z.any()).optional(),
  slippageBps: z.number().optional(),
  source: z.enum(['jupiter', 'simulated']).optional(),
});

export const WalletBalanceSchema = z.object({
  address: z.string(),
  solBalance: z.number(),
  tokenBalances: z.array(z.object({
    mint: z.string(),
    symbol: z.string(),
    name: z.string(),
    amount: z.number(),
    decimals: z.number(),
    priceUsd: z.number().optional(),
    valueUsd: z.number().optional(),
  })).optional(),
  totalUsd: z.number(),
  source: z.enum(['solana-rpc', 'gmgn', 'fallback']).optional(),
});

export const GmgnTokenInfoSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  price: z.number(),
  price_change_1h: z.number().optional(),
  price_change_24h: z.number().optional(),
  price_change_6h: z.number().optional(),
  volume_24h: z.number(),
  market_cap: z.number(),
  fdv: z.number().optional(),
  liquidity: z.number(),
  holders: z.number(),
  total_supply: z.number(),
  top_10_holder_rate: z.number().optional(),
  dev_holder_rate: z.number().optional(),
  create_timestamp: z.number().optional(),
  last_trade_timestamp: z.number().optional(),
  tx_24h_buy: z.number().optional(),
  tx_24h_sell: z.number().optional(),
  is_alive: z.boolean().optional(),
  twitter: z.string().optional(),
  website: z.string().optional(),
  telegram: z.string().optional(),
  image_uri: z.string().optional(),
  header_image_uri: z.string().optional(),
  websites: z.array(z.object({ url: z.string(), label: z.string().optional() })).optional(),
  socials: z.array(z.object({ type: z.string(), url: z.string() })).optional(),
  boosts_active: z.number().optional(),
  smart_degen_count: z.number().optional(),
  renowned_count: z.number().optional(),
  sniper_count: z.number().optional(),
  bundler_rate: z.number().optional(),
  rat_trader_amount_rate: z.number().optional(),
  rug_ratio: z.number().optional(),
  is_honeypot: z.boolean().optional(),
  renounced_mint: z.boolean().optional(),
  renounced_freeze_account: z.boolean().optional(),
  is_on_curve: z.boolean().optional(),
  cto_flag: z.number().optional(),
  source: z.enum(['gmgn', 'dexscreener', 'simulated']).optional(),
});

export const GmgnSecuritySchema = z.object({
  address: z.string(),
  is_mint_authority_revoked: z.boolean(),
  is_freeze_authority_revoked: z.boolean(),
  is_token_mintable: z.boolean(),
  is_honeypot: z.boolean(),
  is_open_source: z.boolean(),
  is_proxy: z.boolean(),
  is_canonical: z.boolean(),
  personal_holder_rate: z.number().optional(),
  top10_holder_rate: z.number(),
  top10_holder_value_usd: z.number().optional(),
  dev_holder_rate: z.number(),
  dev_buy_tax_rate: z.number().optional(),
  dev_sell_tax_rate: z.number().optional(),
  lp_holder_rate: z.number().optional(),
  liquidity_locked: z.boolean().optional(),
  lp_locked_ratio: z.number().optional(),
  risks: z.array(z.string()),
  source: z.enum(['gmgn', 'simulated']).optional(),
});

export const GmgnHolderSchema = z.object({
  address: z.string(),
  balance: z.number(),
  value_usd: z.number(),
  holder_rate: z.number(),
  is_dev: z.boolean().optional(),
  is_top10: z.boolean().optional(),
  is_smart_money: z.boolean().optional(),
  is_kol: z.boolean().optional(),
  is_celebrity: z.boolean().optional(),
  is_fund: z.boolean().optional(),
  is_sniper: z.boolean().optional(),
  is_bundler: z.boolean().optional(),
  is_rat_trader: z.boolean().optional(),
  is_fresh_wallet: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(['gmgn', 'simulated']).optional(),
});

export const GmgnTraderSchema = z.object({
  address: z.string(),
  pnl: z.number(),
  pnl_rate: z.number().optional(),
  buy_usd: z.number(),
  sell_usd: z.number(),
  tx_count: z.number().optional(),
  is_smart_money: z.boolean().optional(),
  is_kol: z.boolean().optional(),
  is_sniper: z.boolean().optional(),
  is_bundler: z.boolean().optional(),
  first_buy_time: z.number().optional(),
  last_active_time: z.number().optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(['gmgn', 'simulated']).optional(),
});

export const GmgnTrendingTokenSchema = GmgnTokenInfoSchema.extend({
  rank: z.number(),
  chain: z.string(),
  launched_at: z.number().optional(),
  swaps_24h: z.number().optional(),
  buyers_24h: z.number().optional(),
  sellers_24h: z.number().optional(),
  smart_money_holders: z.number().optional(),
  smart_money_inflow_24h: z.number().optional(),
  hot_level: z.number().optional(),
});

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.number().optional(),
});

// ============================================
// Endpoint Response Schemas
// ============================================

// GET /api/prices
export const PricesResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    prices: z.record(z.string(), PriceSchema),
  }).optional(),
});

// GET /api/quote
export const QuoteResponseSchema = ApiResponseSchema.extend({
  data: QuoteSchema.optional(),
});

// GET /api/wallet
export const WalletResponseSchema = ApiResponseSchema.extend({
  data: WalletBalanceSchema.optional(),
});

// GET /api/gmgn/token
export const GmgnTokenResponseSchema = ApiResponseSchema.extend({
  data: GmgnTokenInfoSchema.optional(),
});

// GET /api/gmgn/security
export const GmgnSecurityResponseSchema = ApiResponseSchema.extend({
  data: GmgnSecuritySchema.optional(),
});

// GET /api/gmgn/holders
export const GmgnHoldersResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    holders: z.array(GmgnHolderSchema),
    total: z.number().optional(),
  }).optional(),
});

// GET /api/gmgn/traders
export const GmgnTradersResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    traders: z.array(GmgnTraderSchema),
    total: z.number().optional(),
  }).optional(),
});

// GET /api/gmgn/trending
export const GmgnTrendingResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(GmgnTrendingTokenSchema),
    timeframe: z.string().optional(),
    source: z.enum(['gmgn', 'dexscreener', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/new-pairs
export const GmgnNewPairsResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(GmgnTrendingTokenSchema),
    type: z.string().optional(),
    source: z.enum(['gmgn', 'dexscreener', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/search
export const GmgnSearchResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(GmgnTrendingTokenSchema),
    query: z.string().optional(),
    source: z.enum(['gmgn', 'dexscreener', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/chart
export const GmgnChartResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    candles: z.array(z.object({
      t: z.number(),
      o: z.number(),
      h: z.number(),
      l: z.number(),
      c: z.number(),
      v: z.number(),
    })),
    resolution: z.string().optional(),
    source: z.enum(['gmgn', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/portfolio
export const GmgnPortfolioResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    wallet: z.string(),
    holdings: z.array(z.object({
      mint: z.string(),
      symbol: z.string(),
      name: z.string(),
      amount: z.number(),
      value_usd: z.number(),
      price_usd: z.number(),
      pnl_usd: z.number().optional(),
      pnl_pct: z.number().optional(),
    })),
    totalValue: z.number(),
    realizedPnl: z.number().optional(),
    unrealizedPnl: z.number().optional(),
    winRate: z.number().optional(),
    trades30d: z.number().optional(),
    source: z.enum(['gmgn', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/wallet-activity
export const GmgnWalletActivityResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    activity: z.array(z.object({
      hash: z.string(),
      type: z.enum(['buy', 'sell', 'transfer']),
      token_address: z.string(),
      token_symbol: z.string(),
      amount_token: z.number(),
      amount_usd: z.number(),
      price_usd: z.number(),
      timestamp: z.number(),
      from_address: z.string().optional(),
      to_address: z.string().optional(),
    })),
    source: z.enum(['gmgn', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/signals
export const GmgnSignalsResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    signals: z.array(z.object({
      type: z.string(),
      token_address: z.string(),
      token_symbol: z.string(),
      token_name: z.string(),
      amount_usd: z.number(),
      smart_wallets_count: z.number(),
      timestamp: z.number(),
      chain: z.string(),
    })),
    source: z.enum(['gmgn', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/hot-searches
export const GmgnHotSearchesResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(GmgnTrendingTokenSchema.extend({
      search_count_24h: z.number().optional(),
      search_count_change: z.number().optional(),
    })),
    interval: z.string().optional(),
    source: z.enum(['gmgn', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/smart-money-feed
export const GmgnSmartMoneyFeedResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    trades: z.array(z.object({
      wallet_address: z.string(),
      wallet_tag: z.string().optional(),
      wallet_label: z.string().optional(),
      token_address: z.string(),
      token_symbol: z.string(),
      type: z.enum(['buy', 'sell']),
      amount_usd: z.number(),
      amount_token: z.number(),
      price_usd: z.number(),
      ts: z.number(),
      pnl_30d_usd: z.number().optional(),
    })),
    source: z.enum(['gmgn', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/kol-feed
export const GmgnKolFeedResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    trades: z.array(z.object({
      wallet_address: z.string(),
      twitter_handle: z.string(),
      twitter_name: z.string(),
      followers: z.number(),
      token_address: z.string(),
      token_symbol: z.string(),
      type: z.enum(['buy', 'sell']),
      amount_usd: z.number(),
      amount_token: z.number(),
      price_usd: z.number(),
      ts: z.number(),
      pnl_usd: z.number().optional(),
    })),
    source: z.enum(['gmgn', 'simulated']).optional(),
  }).optional(),
});

// GET /api/gmgn/status
export const GmgnStatusResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    installed: z.boolean(),
    apiKeyConfigured: z.boolean(),
    binPath: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

// GET /api/dexscreener/pairs
export const DexScreenerPairsResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    pairs: z.array(z.object({
      chainId: z.string(),
      dexId: z.string(),
      url: z.string(),
      pairAddress: z.string(),
      baseToken: z.object({
        address: z.string(),
        name: z.string(),
        symbol: z.string(),
      }),
      quoteToken: z.object({
        address: z.string(),
        name: z.string(),
        symbol: z.string(),
      }),
      priceNative: z.string(),
      priceUsd: z.string(),
      txns: z.object({
        m5: z.object({ buys: z.number(), sells: z.number() }).optional(),
        h1: z.object({ buys: z.number(), sells: z.number() }).optional(),
        h6: z.object({ buys: z.number(), sells: z.number() }).optional(),
        h24: z.object({ buys: z.number(), sells: z.number() }).optional(),
      }).optional(),
      volume: z.object({
        m5: z.number().optional(),
        h1: z.number().optional(),
        h6: z.number().optional(),
        h24: z.number().optional(),
      }).optional(),
      priceChange: z.object({
        m5: z.number().optional(),
        h1: z.number().optional(),
        h6: z.number().optional(),
        h24: z.number().optional(),
      }).optional(),
      liquidity: z.object({
        usd: z.number().optional(),
        base: z.number().optional(),
        quote: z.number().optional(),
      }).optional(),
      fdv: z.number().optional(),
      marketCap: z.number().optional(),
      pairCreatedAt: z.number().optional(),
      info: z.object({
        imageUrl: z.string().optional(),
        header: z.string().optional(),
        websites: z.array(z.object({ url: z.string(), label: z.string().optional() })).optional(),
        socials: z.array(z.object({ type: z.string(), url: z.string() })).optional(),
      }).optional(),
      boosts: z.object({
        active: z.number().optional(),
      }).optional(),
    })),
  }).optional(),
});

// GET /api/dexscreener/orders
export const DexScreenerOrdersResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    orders: z.array(z.object({
      type: z.string(),
      tokenAddress: z.string(),
      chainId: z.string(),
      amountUsd: z.number(),
      timestamp: z.number(),
      status: z.string(),
    })).optional(),
    boosts: z.array(z.object({
      tokenAddress: z.string(),
      chainId: z.string(),
      amountUsd: z.number(),
      timestamp: z.number(),
    })).optional(),
    totalBoostsUsd: z.number().optional(),
  }).optional(),
});

// GET /api/dexscreener/top-boosts
export const DexScreenerTopBoostsResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(z.object({
      address: z.string(),
      symbol: z.string(),
      name: z.string(),
      boostAmount: z.number(),
      priceUsd: z.number(),
      change24h: z.number(),
      marketCap: z.number(),
      volume24h: z.number(),
      imageUrl: z.string().optional(),
    })),
  }).optional(),
});

// GET /api/solana/trending
export const SolanaTrendingResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(z.object({
      symbol: z.string(),
      name: z.string(),
      price: z.number(),
      change_1h: z.number().optional(),
      change_6h: z.number().optional(),
      change_24h: z.number().optional(),
      volume_24h: z.number(),
      market_cap: z.number(),
      liquidity: z.number(),
      txns_24h_buys: z.number().optional(),
      txns_24h_sells: z.number().optional(),
      dex: z.string().optional(),
      pair_url: z.string().optional(),
      image_uri: z.string().optional(),
      created_at: z.number().optional(),
    })),
    sortBy: z.string().optional(),
    source: z.enum(['dexscreener']).optional(),
  }).optional(),
});

// GET /api/solana/gainers
export const SolanaGainersResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(z.object({
      symbol: z.string(),
      name: z.string(),
      price: z.number(),
      change_1h: z.number().optional(),
      change_6h: z.number().optional(),
      change_24h: z.number().optional(),
      volume_24h: z.number(),
      market_cap: z.number(),
      liquidity: z.number(),
      txns_24h_buys: z.number().optional(),
      txns_24h_sells: z.number().optional(),
      dex: z.string().optional(),
      pair_url: z.string().optional(),
      image_uri: z.string().optional(),
      created_at: z.number().optional(),
    })),
    timeframe: z.string().optional(),
    source: z.enum(['dexscreener']).optional(),
  }).optional(),
});

// GET /api/solana/new
export const SolanaNewResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(z.object({
      symbol: z.string(),
      name: z.string(),
      price: z.number(),
      change_1h: z.number().optional(),
      change_6h: z.number().optional(),
      change_24h: z.number().optional(),
      volume_24h: z.number(),
      market_cap: z.number(),
      liquidity: z.number(),
      txns_24h_buys: z.number().optional(),
      txns_24h_sells: z.number().optional(),
      dex: z.string().optional(),
      pair_url: z.string().optional(),
      image_uri: z.string().optional(),
      created_at: z.number().optional(),
    })),
    source: z.enum(['dexscreener']).optional(),
  }).optional(),
});

// GET /api/pumpfun
export const PumpfunResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    tokens: z.array(z.object({
      address: z.string(),
      symbol: z.string(),
      name: z.string(),
      price: z.number(),
      market_cap: z.number(),
      volume_24h: z.number(),
      liquidity: z.number(),
      holders: z.number(),
      age_hours: z.number(),
      dev_holding_pct: z.number().optional(),
      smart_money_holders: z.number().optional(),
      is_on_curve: z.boolean().optional(),
      cto_flag: z.number().optional(),
      image_uri: z.string().optional(),
    })),
    source: z.enum(['pumpfun', 'simulated']).optional(),
  }).optional(),
});

// GET /api/chat
export const ChatResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    content: z.string(),
    suggestedTokens: z.array(z.string()).optional(),
    source: z.enum(['llm', 'heuristic']).optional(),
  }).optional(),
});

// GET /api/health
export const HealthResponseSchema = ApiResponseSchema.extend({
  data: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    checks: z.array(z.object({
      name: z.string(),
      status: z.enum(['pass', 'fail', 'warn']),
      latency: z.number().optional(),
      message: z.string().optional(),
    })),
    timestamp: z.number(),
    uptime: z.number(),
    version: z.string().optional(),
  }).optional(),
});

// ============================================
// Schema Registry
// ============================================

export const ENDPOINT_SCHEMAS: Record<string, z.ZodSchema> = {
  '/api/prices': PricesResponseSchema,
  '/api/quote': QuoteResponseSchema,
  '/api/wallet': WalletResponseSchema,
  '/api/gmgn/token': GmgnTokenResponseSchema,
  '/api/gmgn/security': GmgnSecurityResponseSchema,
  '/api/gmgn/holders': GmgnHoldersResponseSchema,
  '/api/gmgn/traders': GmgnTradersResponseSchema,
  '/api/gmgn/trending': GmgnTrendingResponseSchema,
  '/api/gmgn/new-pairs': GmgnNewPairsResponseSchema,
  '/api/gmgn/search': GmgnSearchResponseSchema,
  '/api/gmgn/chart': GmgnChartResponseSchema,
  '/api/gmgn/portfolio': GmgnPortfolioResponseSchema,
  '/api/gmgn/wallet-activity': GmgnWalletActivityResponseSchema,
  '/api/gmgn/signals': GmgnSignalsResponseSchema,
  '/api/gmgn/hot-searches': GmgnHotSearchesResponseSchema,
  '/api/gmgn/smart-money-feed': GmgnSmartMoneyFeedResponseSchema,
  '/api/gmgn/kol-feed': GmgnKolFeedResponseSchema,
  '/api/gmgn/status': GmgnStatusResponseSchema,
  '/api/dexscreener/pairs': DexScreenerPairsResponseSchema,
  '/api/dexscreener/orders': DexScreenerOrdersResponseSchema,
  '/api/dexscreener/top-boosts': DexScreenerTopBoostsResponseSchema,
  '/api/solana/trending': SolanaTrendingResponseSchema,
  '/api/solana/gainers': SolanaGainersResponseSchema,
  '/api/solana/new': SolanaNewResponseSchema,
  '/api/pumpfun': PumpfunResponseSchema,
  '/api/chat': ChatResponseSchema,
  '/api/health': HealthResponseSchema,
};

export type EndpointPath = keyof typeof ENDPOINT_SCHEMAS;