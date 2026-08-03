import { NextRequest, NextResponse } from "next/server";
import { fetchTrending, fetchHotSearches } from "@/lib/gmgn";

/**
 * POST /api/chat
 * Body: { messages: [{ role, content }] }
 *
 * AI copilot chat endpoint.
 * Uses z-ai-web-dev-sdk (server-side only) for real LLM responses.
 * Falls back to heuristic responses if the LLM is unavailable.
 * Enhanced with live GMGN trending + hot-search data for real-time context.
 */

// Note: LLM is dynamically imported inside POST handler to avoid bundling issues.

async function buildLiveContext(): Promise<string> {
  // Fetch real prices from our own /api/prices endpoint
  let priceLine = "Available tokens (real prices from DexScreener):";
  try {
    const priceRes = await fetch("http://localhost:3000/api/prices?symbols=SOL,WIF,JUP,BONK,JTO,PYTH,DRIFT,IO,RNDR,POPCAT,HNT,MNGO,ETH,BTC,NEON,RAY");
    const priceData = await priceRes.json();
    if (priceData?.prices) {
      const parts: string[] = [];
      for (const [sym, info] of Object.entries(priceData.prices)) {
        const p = info as any;
        const change = p.change24h ? `, ${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(1)}%` : "";
        parts.push(`${sym} ($${p.price.toFixed(p.price < 0.01 ? 8 : p.price < 1 ? 4 : 2)}${change})`);
      }
      priceLine = `Available tokens (live DexScreener prices): ${parts.join(", ")}.`;
    }
  } catch {
    priceLine = "Available tokens: SOL ($73), WIF ($0.14), JUP ($0.84), BONK ($0.0000284), POPCAT ($0.044), RAY ($0.61), DRIFT ($1.84), IO ($2.94).";
  }

  let ctx = `You are Moby, an AI crypto trading copilot built on Solana. You help users:
- Analyze tokens (price, smart money flow, security, predictions)
- Validate trade ideas with on-chain data
- Track portfolio performance
- Discover trending narratives

${priceLine}

Current narratives: AI Agents (+12%), Meme Season (+28%), DePIN (+5%), Cat Coins (+64%), Solana DeFi (+6%).

Smart money signals: MNGO cluster buy (7 wallets, $1.24M), WIF whale accumulation ($4.22M), 
IO smart money entry (5 wallets, $980K).`;

  // Fetch live GMGN trending tokens
  try {
    const trending = await fetchTrending("1h", "volume", 5);
    if (trending && trending.length > 0) {
      const trendingStr = trending
        .map((t, i) => `${i + 1}. ${t.symbol} — $${t.price?.toFixed(6) || "?"} (${t.price_change_24h >= 0 ? "+" : ""}${t.price_change_24h?.toFixed(1) || "?"}%) MC $${(t.market_cap / 1e6).toFixed(1)}M Vol $${(t.volume_24h / 1e3).toFixed(0)}K${t.smart_money_holders ? ` ${t.smart_money_holders} smart` : ""}`)
        .join("\n");
      ctx += `\n\nLive GMGN trending (top 5 by volume):\n${trendingStr}`;
    }
  } catch {
    // GMGN unavailable — use static context only
  }

  // Fetch hot searches
  try {
    const hot = await fetchHotSearches(["sol"], "1h", 3);
    if (hot && hot.length > 0) {
      const hotStr = hot.map((h, i) => `${i + 1}. ${h.symbol} (${h.search_count_24h.toLocaleString()} searches)`).join(", ");
      ctx += `\n\nHot searches: ${hotStr}`;
    }
  } catch {
    // skip
  }

  ctx += `

Keep responses concise (2-4 sentences max). Use token symbols with $ prefix. Be direct and actionable.
If asked about non-crypto topics, redirect to crypto trading.
When referencing trending tokens, mention they're from GMGN live data.`;

  return ctx;
}

const HEURISTIC_RESPONSES: { keywords: string[]; response: string }[] = [
  {
    keywords: ["portfolio", "my holdings", "my position"],
    response: "Your portfolio is up 4.2% in 24h, led by WIF (+14.3%) and BONK (+22.1%). Your largest concentration is SOL at 32% — consider trimming if you want to reduce L1 beta. You have 3 untracked smart-money alerts waiting in your Signals tab.",
  },
  {
    keywords: ["smart money", "whale", "what are they buying"],
    response: "Over the last hour, smart money has been accumulating WIF, MNGO, and IO. The strongest signal is on MNGO — 7 wallets clustered in within 60 minutes for $1.24M inflow at 92% confidence. Want me to open the MNGO detail?",
  },
  {
    keywords: ["trend", "narrative", "what's hot"],
    response: "Top narrative today is Cat Coins (+64%), driven by MOON launching 18h ago. Meme Season (+28%) and AI Agents (+12%) are also strong. DePIN is flat. The strongest smart money flow is into AI tokens (IO, RNDR).",
  },
  {
    keywords: ["tax", "realized", "loss harvest"],
    response: "Based on your realized activity this year, you have ~$18.4K in short-term gains and $4.2K in long-term gains. You could harvest $1,240 in losses from HNT to save ~$397 in taxes. Want me to open the tax calculator?",
  },
  {
    keywords: ["safe", "rug", "scam", "honeypot", "legit"],
    response: "Always check the security audit before buying any token. Moby's audit checks: contract verification, mint authority, liquidity lock, honeypot simulation, dev holding %, and top holder concentration. Tokens with >10% dev holdings or unlocked liquidity are high risk.",
  },
];

function heuristicReply(userText: string): string {
  const lower = userText.toLowerCase();

  const tokenMap: Record<string, string> = {
    "sol": "SOL is trading at $72.97, up 6.42% in 24h. Smart money has net accumulated $12.4M across 412 tracked wallets. Liquidity: $1.24B. Strong L1 fundamentals with growing DeFi TVL.",
    "wif": "WIF is at $0.142, up 14.27% in 24h. Smart money net accumulated $4.22M from 184 wallets — that's a healthy concentration. Liquidity: $84M. Volume 24h: $412M.",
    "jup": "JUP is at $0.842, up 3.18% in 24h. Smart money inflow: $1.82M from 221 wallets. Liquidity: $48M. Solid DeFi infrastructure play.",
    "bonk": "BONK at $0.0000284, up 22.14%. Smart money inflow: $3.12M from 168 wallets. High volatility meme — position size accordingly.",
    "mngo": "MNGO at $0.042, up 38.12% — strongest mover today. 7 smart wallets clustered in within 60 minutes for $1.24M inflow at 92% confidence. This is a high-conviction smart money signal.",
    "io": "IO at $2.94, up 9.18%. Smart money inflow: $980K from 102 wallets. AI infrastructure narrative with real utility. Liquidity: $12.4M.",
    "moon": "MOON at $0.00042, up 142.8% — just launched 18h ago! 3 smart wallets bought within 12 minutes of launch. Extremely high risk/high reward. Only invest what you can afford to lose.",
  };

  for (const [sym, reply] of Object.entries(tokenMap)) {
    if (lower.includes(`$${sym}`) || lower.includes(` ${sym} `) || lower === sym) {
      return reply;
    }
  }

  for (const { keywords, response } of HEURISTIC_RESPONSES) {
    if (keywords.some((k) => lower.includes(k))) {
      return response;
    }
  }

  return "I can analyze tokens, summarize smart money flow, validate trade ideas, check your portfolio, or estimate taxes. Try asking about a specific token like $WIF or $JUP, or ask 'what's smart money doing?'";
}

function extractTokenSymbols(text: string): string[] {
  const matches = text.match(/\$([A-Z]{2,10})/g) || [];
  const symbolToId: Record<string, string> = {
    SOL: "sol", WIF: "wif", JUP: "jup", BONK: "bonk", JTO: "jto",
    PYTH: "pyth", DRIFT: "drift", IO: "io", RNDR: "rndr", POPCAT: "popcat",
    HNT: "hnt", TNSR: "tensor", MNGO: "mngo", MOON: "moon", ETH: "eth",
    BTC: "btc", NEON: "neon", RAY: "ray",
  };
  return [...new Set(matches.map((m) => m.slice(1)).map((s) => symbolToId[s]).filter(Boolean))];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Try real LLM via z-ai-web-dev-sdk (dynamic import to avoid bundling issues)
    // Build live context with GMGN trending + hot searches
    const TOKEN_CONTEXT = await buildLiveContext();

    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "system", content: TOKEN_CONTEXT },
          ...messages.map((m: any) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
        ],
        thinking: { type: "disabled" },
      });

      const reply = completion.choices[0]?.message?.content;
      if (reply && reply.length > 10) {
        return NextResponse.json({
          content: reply,
          source: "llm",
          suggestedTokens: extractTokenSymbols(reply),
        });
      }
    } catch {
      // Fall through to heuristic
    }

    // Fallback: Heuristic response
    const reply = heuristicReply(lastMessage);
    return NextResponse.json({
      content: reply,
      source: "heuristic",
      suggestedTokens: extractTokenSymbols(reply),
    });
  } catch {
    return NextResponse.json({
      content: "I'm having trouble responding right now. Please try again.",
      source: "error",
      suggestedTokens: [],
    });
  }
}

// GET handler for health checks (frontend pings this for connectivity)
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/chat",
    method: "POST",
    description: "AI copilot chat endpoint",
  });
}
