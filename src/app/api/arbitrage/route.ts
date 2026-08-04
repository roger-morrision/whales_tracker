import { NextRequest, NextResponse } from 'next/server';
import { getArbitrageScanner } from '@/lib/arbitrage-scanner';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tokens = searchParams.get('tokens')?.split(',').filter(Boolean);
  const minSpreadPct = parseFloat(searchParams.get('minSpreadPct') || '0.5');
  const minProfitUsd = parseFloat(searchParams.get('minProfitUsd') || '10');

  try {
    const scanner = getArbitrageScanner();
    const opportunities = await scanner.getOpportunities(tokens, minSpreadPct, minProfitUsd);

    return NextResponse.json({
      success: true,
      data: opportunities,
    });
  } catch (error) {
    console.error('[Arbitrage API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch arbitrage opportunities' },
      { status: 500 }
    );
  }
}