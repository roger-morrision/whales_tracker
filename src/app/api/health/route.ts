import { NextRequest, NextResponse } from "next/server";
import { getHealthMetrics, checkGmgnCliStatus } from "@/lib/gmgn";
import { createHealthResponse } from "@/lib/api-rate-limiter";

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  // Check GMGN CLI status
  const gmgnStatus = await checkGmgnCliStatus();
  const gmgnLatency = Date.now() - startTime;
  
  // Get health metrics
  const metrics = getHealthMetrics();
  
  // Check DexScreener availability
  const dexStart = Date.now();
  let dexStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let dexLatency = 0;
  let dexError: string | undefined;
  
  try {
    const dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112', {
      signal: AbortSignal.timeout(5000),
    });
    dexLatency = Date.now() - dexStart;
    if (!dexRes.ok) {
      dexStatus = 'degraded';
      dexError = `HTTP ${dexRes.status}`;
    }
  } catch (err: any) {
    dexStatus = 'unhealthy';
    dexLatency = Date.now() - dexStart;
    dexError = err?.message;
  }
  
  const services = {
    gmgn: {
      status: gmgnStatus.installed && gmgnStatus.apiKeyConfigured ? 'healthy' : 
              gmgnStatus.installed ? 'degraded' : 'unhealthy',
      latencyMs: gmgnLatency,
      error: gmgnStatus.lastError,
      ...gmgnStatus,
    },
    dexScreener: {
      status: dexStatus,
      latencyMs: dexLatency,
      error: dexError,
      metrics: {
        totalRequests: metrics.dexScreener.totalRequests,
        successfulRequests: metrics.dexScreener.successfulRequests,
        failedRequests: metrics.dexScreener.failedRequests,
        avgLatencyMs: Math.round(metrics.dexScreener.avgLatencyMs),
      },
    },
    cache: {
      status: 'healthy',
      metrics: {
        size: metrics.cache.size,
        hitRate: Math.round(metrics.cache.hitRate * 100) / 100,
      },
    },
  };
  
  const response = createHealthResponse(services, '1.0.0');
  const httpStatus = response.status === 'healthy' ? 200 : 
                    response.status === 'degraded' ? 200 : 503;
  
  return NextResponse.json(response, { status: httpStatus });
}