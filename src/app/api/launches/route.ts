import { NextRequest, NextResponse } from 'next/server';
import { getLaunchTracker } from '@/lib/launch-tracker';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const minLiquidity = searchParams.get('minLiquidity') ? parseFloat(searchParams.get('minLiquidity')!) : undefined;
  const maxLiquidity = searchParams.get('maxLiquidity') ? parseFloat(searchParams.get('maxLiquidity')!) : undefined;
  const minMarketCap = searchParams.get('minMarketCap') ? parseFloat(searchParams.get('minMarketCap')!) : undefined;
  const maxMarketCap = searchParams.get('maxMarketCap') ? parseFloat(searchParams.get('maxMarketCap')!) : undefined;
  const maxAge = searchParams.get('maxAge') ? parseInt(searchParams.get('maxAge')!) : undefined;
  const minSmartMoney = searchParams.get('minSmartMoney') ? parseInt(searchParams.get('minSmartMoney')!) : undefined;
  const requireRenounced = searchParams.get('requireRenounced') === 'true';
  const requireFrozen = searchParams.get('requireFrozen') === 'true';
  const dexes = searchParams.get('dexes')?.split(',').filter(Boolean);
  const quotes = searchParams.get('quotes')?.split(',').filter(Boolean);

  try {
    const tracker = getLaunchTracker();
    const pairs = await tracker.getNewPairs(
      {
        minLiquidityUsd: minLiquidity,
        maxLiquidityUsd: maxLiquidity,
        minMarketCap,
        maxMarketCap,
        maxAgeSeconds: maxAge,
        minSmartMoneyBuyers: minSmartMoney,
        requireRenounced,
        requireFrozen,
        dexes,
        quoteSymbols: quotes,
      },
      limit
    );

    return NextResponse.json({
      success: true,
      data: pairs,
    });
  } catch (error) {
    console.error('[Launches API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch new launches' },
      { status: 500 }
    );
  }
}