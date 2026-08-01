// Moby global client state — Zustand store
import { create } from "zustand";
import {
  TOKENS,
  TRADERS,
  SIGNALS,
  WHALE_FLOWS,
  type Token,
  type Trader,
  type SmartSignal,
  type WhaleFlow,
  nextPriceTick,
} from "./moby-data";

export type TabKey = "discover" | "whales" | "signals" | "portfolio" | "profile";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  pending?: boolean;
  suggestedTokens?: string[]; // token ids
}

export interface ToastLike {
  id: string;
  title: string;
  description?: string;
  type: "info" | "success" | "warn" | "alert";
}

interface MobyState {
  // navigation
  activeTab: TabKey;
  setActiveTab: (t: TabKey) => void;

  // live prices keyed by token id
  prices: Record<string, { price: number; prev: number; ts: number }>;
  tickPrices: () => void;
  setPrice: (id: string, price: number) => void;

  // selected token (opens detail sheet)
  selectedTokenId: string | null;
  openToken: (id: string | null) => void;

  // selected trader (opens trader sheet)
  selectedTraderId: string | null;
  openTrader: (id: string | null) => void;

  // watchlist (token ids)
  watchlist: string[];
  toggleWatch: (id: string) => void;

  // followed traders
  followedTraders: string[];
  toggleFollow: (id: string) => void;

  // signal dismissal / save
  savedSignals: string[];
  dismissedSignals: string[];
  toggleSaveSignal: (id: string) => void;
  dismissSignal: (id: string) => void;

  // AI copilot
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  chat: ChatMessage[];
  sendChat: (content: string) => void;
  clearChat: () => void;

  // search modal
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // notifications panel
  notifOpen: boolean;
  setNotifOpen: (open: boolean) => void;

  // toasts / live alerts feed
  alerts: ToastLike[];
  pushAlert: (a: Omit<ToastLike, "id">) => void;
  dismissAlert: (id: string) => void;

  // live data feeds
  signals: SmartSignal[];
  flows: WhaleFlow[];

  // refresh feeds (simulated)
  refreshFeeds: () => void;
}

const initialPrices: Record<string, { price: number; prev: number; ts: number }> = {};
TOKENS.forEach((t) => {
  initialPrices[t.id] = { price: t.price, prev: t.price, ts: 0 };
});

// Use a fixed timestamp for the initial chat message — avoids SSR/CSR hydration mismatch.
// Once the user interacts, ts is updated to Date.now() on the client only.
const initialChat: ChatMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content:
      "Hey — I'm Moby, your on-chain copilot. Ask me to analyze a token, validate a trade idea, or summarize what smart money is doing right now.",
    ts: 0,
    suggestedTokens: ["wif", "jup", "io"],
  },
];

let chatIdCounter = 0;
function nextChatId(): string {
  chatIdCounter += 1;
  return `c-${chatIdCounter}`;
}

// Very small heuristic "AI" response generator (client-side, deterministic-ish).
function generateAssistantReply(userText: string): { content: string; suggestedTokens?: string[] } {
  const lower = userText.toLowerCase();
  // Try to find a token mentioned in the user message.
  const matched = TOKENS.find(
    (t) =>
      lower.includes(`$${t.symbol.toLowerCase()}`) ||
      lower.includes(t.symbol.toLowerCase()) ||
      lower.includes(t.name.toLowerCase())
  );

  if (matched) {
    const bull = matched.change24h >= 0;
    const inflowAbs = Math.abs(matched.smartMoneyInflow24h);
    const inflowStr =
      inflowAbs >= 1_000_000
        ? `$${(inflowAbs / 1_000_000).toFixed(2)}M`
        : `$${(inflowAbs / 1000).toFixed(0)}K`;
    const smart =
      matched.smartMoneyInflow24h >= 0
        ? `Smart money has net ${bull ? "accumulated" : "distributed"} ${inflowStr} over the last 24h across ${matched.smartMoneyHolders} tracked wallets.`
        : `Smart money has net distributed ${inflowStr} over the last 24h.`;
    return {
      content: `${matched.name} (${matched.symbol}) is trading at $${matched.price.toFixed(
        matched.price < 1 ? 4 : 2
      )}, ${bull ? "up" : "down"} ${Math.abs(matched.change24h).toFixed(2)}% in 24h. ${smart} ${
        matched.smartMoneyHolders >= 100
          ? "That's a healthy concentration of smart money."
          : "Smart money concentration is low — proceed with caution."
      } Liquidity: $${(matched.liquidity / 1_000_000).toFixed(1)}M. Volume 24h: $${(
          matched.volume24h / 1_000_000
        ).toFixed(0)}M.`,
      suggestedTokens: [matched.id],
    };
  }

  if (lower.includes("portfolio")) {
    return {
      content:
        "Your portfolio is up 4.2% in the last 24h, led by WIF (+14.3%) and BONK (+22.1%). Your largest concentration is SOL at 32% — consider trimming if you want to reduce L1 beta. You have 3 untracked smart-money alerts waiting in your Signals tab.",
    };
  }
  if (lower.includes("smart money") || lower.includes("whale")) {
    return {
      content:
        "Over the last hour, smart money has been accumulating WIF, MNGO, and IO. The strongest signal is on MNGO — 7 wallets clustered in within 60 minutes for $1.24M inflow. Want me to open the MNGO detail?",
      suggestedTokens: ["mngo", "wif", "io"],
    };
  }
  if (lower.includes("trend") || lower.includes("narrative")) {
    return {
      content:
        "Top narrative today is Cat Coins (+64%), driven by MOON launching 18h ago. Meme Season (+28%) and AI Agents (+12%) are also strong. DePIN is flat.",
      suggestedTokens: ["moon", "popcat", "io"],
    };
  }
  if (lower.includes("tax")) {
    return {
      content:
        "I can help estimate your crypto taxes. Based on your realized activity this year, you have ~$18.4K in short-term gains and $4.2K in long-term gains. Want me to break it down by chain?",
    };
  }
  return {
    content:
      "I can analyze tokens, summarize smart money flow, validate trade ideas, check your portfolio, or estimate taxes. Try asking about a specific token like $WIF or $JUP, or just say \"what's smart money doing?\"",
    suggestedTokens: ["wif", "jup", "io"],
  };
}

export const useMoby = create<MobyState>((set, get) => ({
  activeTab: "discover",
  setActiveTab: (t) => set({ activeTab: t }),

  prices: initialPrices,
  tickPrices: () => {
    const cur = get().prices;
    const next: typeof cur = {};
    Object.keys(cur).forEach((id) => {
      const p = cur[id];
      const np = nextPriceTick(p.price, 0.003);
      next[id] = { price: np, prev: p.price, ts: Date.now() };
    });
    set({ prices: next });
  },
  setPrice: (id, price) =>
    set((s) => ({
      prices: {
        ...s.prices,
        [id]: { price, prev: s.prices[id]?.price ?? price, ts: Date.now() },
      },
    })),

  selectedTokenId: null,
  openToken: (id) => set({ selectedTokenId: id }),

  selectedTraderId: null,
  openTrader: (id) => set({ selectedTraderId: id }),

  watchlist: ["wif", "jup", "io", "mngo"],
  toggleWatch: (id) =>
    set((s) => ({
      watchlist: s.watchlist.includes(id)
        ? s.watchlist.filter((w) => w !== id)
        : [...s.watchlist, id],
    })),

  followedTraders: TRADERS.filter((t) => t.following).map((t) => t.id),
  toggleFollow: (id) =>
    set((s) => ({
      followedTraders: s.followedTraders.includes(id)
        ? s.followedTraders.filter((w) => w !== id)
        : [...s.followedTraders, id],
    })),

  savedSignals: [],
  dismissedSignals: [],
  toggleSaveSignal: (id) =>
    set((s) => ({
      savedSignals: s.savedSignals.includes(id)
        ? s.savedSignals.filter((x) => x !== id)
        : [...s.savedSignals, id],
    })),
  dismissSignal: (id) =>
    set((s) => ({ dismissedSignals: [...s.dismissedSignals, id] })),

  copilotOpen: false,
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  chat: initialChat,
  sendChat: (content) => {
    const userMsg: ChatMessage = {
      id: nextChatId(),
      role: "user",
      content,
      ts: typeof window === "undefined" ? 0 : Date.now(),
    };
    const pendingId = nextChatId();
    const pending: ChatMessage = {
      id: pendingId,
      role: "assistant",
      content: "",
      ts: typeof window === "undefined" ? 0 : Date.now(),
      pending: true,
    };
    set((s) => ({ chat: [...s.chat, userMsg, pending] }));

    // Simulate async assistant reply
    setTimeout(() => {
      const reply = generateAssistantReply(content);
      set((s) => ({
        chat: s.chat.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                content: reply.content,
                suggestedTokens: reply.suggestedTokens,
                ts: Date.now(),
              }
            : m
        ),
      }));
    }, 900 + Math.random() * 700);
  },
  clearChat: () => set({ chat: initialChat }),

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  notifOpen: false,
  setNotifOpen: (open) => set({ notifOpen: open }),

  alerts: [
    {
      id: "a1",
      title: "Smart money entered MNGO",
      description: "7 wallets accumulated $1.24M in the last hour",
      type: "alert",
    },
    {
      id: "a2",
      title: "WIF +14% in 24h",
      description: "Your position is up $11.2K",
      type: "success",
    },
    {
      id: "a3",
      title: "New token: MOON",
      description: "3 smart wallets bought within 12 minutes of launch",
      type: "alert",
    },
  ],
  pushAlert: (a) =>
    set((s) => ({
      alerts: [{ ...a, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...s.alerts],
    })),
  dismissAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((x) => x.id !== id) })),

  signals: SIGNALS,
  flows: WHALE_FLOWS,

  refreshFeeds: () => {
    // Shuffle flows and signals timestamps to simulate "new" live activity.
    const flows = [...get().flows].map((f, i) => ({
      ...f,
      id: `wf-${Date.now()}-${i}`,
      agoSeconds: Math.max(8, Math.floor(Math.random() * 60)),
    }));
    const sig = [...get().signals];
    // Move the first signal to the back and bump its timestamp.
    if (sig.length > 0) {
      const [first, ...rest] = sig;
      const bumped: SmartSignal = {
        ...first,
        id: `s-${Date.now()}`,
        agoSeconds: Math.max(5, Math.floor(Math.random() * 30)),
      };
      set({
        flows: [flows[0], ...get().flows.slice(0, 8)],
        signals: [...rest, bumped],
        alerts: [
          {
            id: `a-${Date.now()}`,
            title: `New ${bumped.type.replace(/_/g, " ").toLowerCase()} on ${bumped.tokenSymbol}`,
            description: `${bumped.smartWalletsCount} smart wallets · $${(
              bumped.usdInflow / 1000
            ).toFixed(0)}K inflow`,
            type: "alert",
          },
          ...get().alerts,
        ],
      });
    }
  },
}));

// Convenience hook selectors
export function useToken(id: string | null): Token | null {
  return useMoby((s) => (id ? TOKENS.find((t) => t.id === id) ?? null : null));
}

export function useTrader(id: string | null): Trader | null {
  return useMoby((s) => (id ? TRADERS.find((t) => t.id === id) ?? null : null));
}
