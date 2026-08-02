import { NextRequest, NextResponse } from "next/server";
import { fetchSecurity, type GmgnSecurity } from "@/lib/gmgn";

/**
 * GET /api/gmgn/security?address=<mint>
 *
 * Returns token security audit from GMGN:
 *  - mint_authority_revoked (cannot mint more)
 *  - freeze_authority_revoked (cannot freeze accounts)
 *  - is_honeypot (cannot sell)
 *  - top10_holder_rate
 *  - dev_holder_rate
 *  - lp_locked_ratio
 *  - buy/sell tax
 *  - risks[] (list of identified risk factors)
 */

function fallbackSecurity(address: string): GmgnSecurity {
  let seed = 0;
  for (let i = 0; i < address.length; i++) seed = (seed * 31 + address.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const mintRevoked = rng() > 0.2;
  const freezeRevoked = rng() > 0.3;
  const top10 = Number((15 + rng() * 35).toFixed(2));
  const dev = Number((rng() * 15).toFixed(2));
  const lpLocked = rng() > 0.4;
  const risks: string[] = [];
  if (!mintRevoked) risks.push("Mint authority not revoked");
  if (!freezeRevoked) risks.push("Freeze authority not revoked");
  if (top10 > 35) risks.push("High top-10 holder concentration");
  if (dev > 10) risks.push("High dev holdings");
  if (!lpLocked) risks.push("Liquidity not locked");

  return {
    address,
    is_mint_authority_revoked: mintRevoked,
    is_freeze_authority_revoked: freezeRevoked,
    is_token_mintable: !mintRevoked,
    is_honeypot: false,
    is_open_source: true,
    is_proxy: false,
    is_canonical: true,
    top10_holder_rate: top10,
    dev_holder_rate: dev,
    lp_holder_rate: Number((5 + rng() * 15).toFixed(2)),
    liquidity_locked: lpLocked,
    lp_locked_ratio: lpLocked ? Number((0.7 + rng() * 0.3).toFixed(2)) : 0,
    dev_buy_tax_rate: 0,
    dev_sell_tax_rate: 0,
    risks,
  };
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing 'address' parameter" }, { status: 400 });
  }

  try {
    const sec = await fetchSecurity(address);
    if (sec) {
      return NextResponse.json({
        security: sec,
        source: "gmgn",
        address,
        timestamp: Date.now(),
      });
    }
  } catch {
    // fall through
  }

  return NextResponse.json({
    security: fallbackSecurity(address),
    source: "simulated",
    address,
    timestamp: Date.now(),
    note: "GMGN API unavailable — showing simulated security audit.",
  });
}
