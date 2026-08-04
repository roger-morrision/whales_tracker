import { NextRequest, NextResponse } from 'next/server';
import { getOrderBookAggregator } from '@/lib/order-book';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const chain = searchParams.get('chain') || 'solana';
  const quoteMint = searchParams.get('quoteMint') || 'So11111111111111111111111111111111111111112';

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: address' },
      { status: 400 }
    );
  }

  try {
    const aggregator = getOrderBookAggregator();
    const snapshot = await aggregator.getOrderBook(address, quoteMint);

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: 'No liquidity found for this token' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('[OrderBook API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order book' },
      { status: 500 }
    );
  }
}