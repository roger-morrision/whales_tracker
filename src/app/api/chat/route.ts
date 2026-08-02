import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/chat
 * Body: { messages: [{ role, content }] }
 *
 * AI copilot chat endpoint.
 * Uses z-ai-web-dev-sdk (server-side only) for real LLM responses.
 * Falls back to heuristic responses if the LLM is unavailable.
 */

// Note: LLM is dynamically imported inside POST handler to avoid bundling issues.

const TOKEN_CONTEXT = `
You are Moby, an AI crypto trading copilot built on Solana. You help users:
- Analyze tokens (price, smart money flow, security, predictions)
- Validate trade ideas with on-chain data
- Track portfolio performance
- Discover trending narratives

Available tokens: SOL ($184), WIF ($2.84, +14%), JUP ($0.84), BONK ($0.0000284, +22%), 
JTO ($3.12), PYTH ($0.38), DRIFT ($1.84), IO ($2.94), RNDR ($8.42), POPCAT ($0.84, +18%),
HNT ($7.42), TNSR ($0.52), MNGO ($0.042, +38%), MOON ($0.00042, +142%), BTC ($64,280), ETH ($3,420).

Current narratives: AI Agents (+12%), Meme Season (+28%), DePIN (+5%), Cat Coins (+64%), Solana DeFi (+6%).

Smart money signals: MNGO cluster buy (7 wallets, $1.24M), WIF whale accumulation ($4.22M), 
IO smart money entry (5 wallets, $980K).

Keep responses concise (2-4 sentences max). Use token symbols with $ prefix. Be direct and actionable.
If asked about non-crypto topics, redirect to crypto trading.
`;

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
    "sol": "SOL is trading at $184.32, up 6.42% in 24h. Smart money has net accumulated $12.4M across 412 tracked wallets. Liquidity: $1.24B. Strong L1 fundamentals with growing DeFi TVL.",
    "wif": "WIF is at $2.84, up 14.27% in 24h. Smart money net accumulated $4.22M from 184 wallets — that's a healthy concentration. Liquidity: $84M. Volume 24h: $412M.",
    "jup": "JUP is at $0.842, up 3.18% in 24h. Smart money inflow: $1.82M from 221 wallets. Liquidity: $48M. Solid DeFi infrastructure play.",
    "bonk": "BONK at $0.0000284, up 22.14%. Smart money inflow: $3.12M from 168 wallets. High volatility meme — position size accordingly.",
    "mngo": "MNGO at $0.0421, up 38.12% — strongest mover today. 7 smart wallets clustered in within 60 minutes for $1.24M inflow at 92% confidence. This is a high-conviction smart money signal.",
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
