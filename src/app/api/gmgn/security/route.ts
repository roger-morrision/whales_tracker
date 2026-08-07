import { NextRequest, NextResponse } from "next/server";
import { fetchSecurity } from "@/lib/gmgn";

/**
 * GET /api/gmgn/security?address=<mint>
 *
 * Returns token security audit from GMGN.
 */

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
    security: null,
    source: "error",
    address,
    timestamp: Date.now(),
    note: "Live GMGN security data is currently unavailable.",
  }, { status: 503 });
}
