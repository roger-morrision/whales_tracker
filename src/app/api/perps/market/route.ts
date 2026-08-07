import { NextRequest, NextResponse } from 'next/server';
import { getPerpsEngine } from '@/lib/perps-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    const perpsEngine = getPerpsEngine();
    const markets = await perpsEngine.getMarkets();

    if (symbol) {
      const market = markets[symbol.toUpperCase()];
      if (!market) {
        return NextResponse.json(
          { error: `Market not found: ${symbol}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ market });
    }

    return NextResponse.json({ markets });
  } catch (error: any) {
    console.error('Error fetching perps markets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}