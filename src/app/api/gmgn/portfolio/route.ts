import { NextRequest, NextResponse } from "next/server";
import { fetchWalletHoldings, fetchWalletStats } from "@/lib/gmgn";

/**
 * GET /api/gmgn/portfolio?wallet=<address>&chain=sol
 *
 * Returns wallet holdings + trading stats from gmgn-cli portfolio.
 * Used by wallet-modal, trader-detail-sheet, copy-trade-modal.
 */

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const chain = req.nextUrl.searchParams.get("chain") || "sol";
  if (!wallet) {
    return NextResponse.json({ error: "Missing 'wallet' parameter" }, { status: 400 });
  }

  try {
    const [holdings, stats] = await Promise.all([
      fetchWalletHoldings(wallet, chain),
      fetchWalletStats(wallet, chain),
    ]);

    if (holdings || stats) {
      return NextResponse.json({
        holdings: holdings ?? [],
        stats,
        totalValue: stats?.total_value ?? 0,
        totalPnl: (stats?.realized_profit ?? 0) + (stats?.unrealized_profit ?? 0),
        winrate: stats?.winrate ?? 0,
        source: "gmgn",
        wallet,
        chain,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  // Fallback to existing /api/wallet route
  return NextResponse.json({
    holdings: [],
    stats: null,
    totalValue: 0,
    totalPnl: 0,
    winrate: 0,
    source: "unavailable",
    wallet,
    chain,
    timestamp: Date.now(),
    note: "GMGN CLI unavailable or API key not configured. Run `gmgn-cli config` to set up.",
  });
}
