import { NextRequest, NextResponse } from 'next/server';
import { getMevDetector } from '@/lib/mev-detector';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const limit = parseInt(searchParams.get('limit') || '50');
  const timeRangeHours = parseInt(searchParams.get('timeRangeHours') || '24');

  try {
    const detector = getMevDetector();
    const attacks = await detector.getRecentAttacks(
      address ?? undefined,
      limit,
      timeRangeHours
    );

    return NextResponse.json({
      success: true,
      data: attacks,
    });
  } catch (error) {
    console.error('[MEV Alerts API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch MEV alerts' },
      { status: 500 }
    );
  }
}