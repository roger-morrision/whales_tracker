import { NextRequest, NextResponse } from 'next/server';
import { getSecurityScorer } from '@/lib/security-scorer';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: address' },
      { status: 400 }
    );
  }

  try {
    const scorer = getSecurityScorer();
    const score = await scorer.getSecurityScore(address);

    if (!score) {
      return NextResponse.json(
        { success: false, error: 'Failed to calculate security score' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: score,
    });
  } catch (error) {
    console.error('[Security Score API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security score' },
      { status: 500 }
    );
  }
}