import { NextRequest, NextResponse } from 'next/server';
import { getMevDetector } from '@/lib/mev-detector';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeRangeHours = parseInt(searchParams.get('timeRangeHours') || '24');

  try {
    const detector = getMevDetector();
    const stats = await detector.getMevStats(timeRangeHours);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[MEV Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch MEV stats' },
      { status: 500 }
    );
  }
}