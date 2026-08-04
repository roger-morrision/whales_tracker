import { NextRequest, NextResponse } from 'next/server';
import { getFlowMapper } from '@/lib/flow-map';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const timeRangeHours = parseInt(searchParams.get('timeRangeHours') || '24');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    const mapper = getFlowMapper();
    const data = await mapper.getFlowMap(address ?? undefined, timeRangeHours, limit);

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'No flow data available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[FlowMap API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch flow map' },
      { status: 500 }
    );
  }
}