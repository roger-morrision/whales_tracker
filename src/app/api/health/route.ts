import { NextResponse } from 'next/server';
import { createApiLogger } from '@/lib/logger';

const logger = createApiLogger('/api/health');

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  latency?: number;
  message?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Prisma client would be imported here
    // For now, return pass as we don't have a real DB connection in this mock
    return {
      name: 'database',
      status: 'pass',
      latency: Date.now() - start,
      message: 'Database connection healthy (mock)',
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'fail',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkSolanaRpc(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
      signal: AbortSignal.timeout(5000),
    });
    
    const data = await response.json();
    const healthy = data.result === 'ok';
    
    return {
      name: 'solana-rpc',
      status: healthy ? 'pass' : 'warn',
      latency: Date.now() - start,
      message: healthy ? 'Solana RPC healthy' : 'Solana RPC degraded',
    };
  } catch (error) {
    return {
      name: 'solana-rpc',
      status: 'fail',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Solana RPC unreachable',
    };
  }
}

async function checkDexScreener(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112', {
      signal: AbortSignal.timeout(5000),
    });
    
    const healthy = response.ok;
    
    return {
      name: 'dexscreener',
      status: healthy ? 'pass' : 'warn',
      latency: Date.now() - start,
      message: healthy ? 'DexScreener API healthy' : 'DexScreener API degraded',
    };
  } catch (error) {
    return {
      name: 'dexscreener',
      status: 'fail',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'DexScreener unreachable',
    };
  }
}

async function checkJupiter(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const response = await fetch('https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm&amount=1000000000&slippageBps=100', {
      signal: AbortSignal.timeout(5000),
    });
    
    const healthy = response.ok;
    
    return {
      name: 'jupiter',
      status: healthy ? 'pass' : 'warn',
      latency: Date.now() - start,
      message: healthy ? 'Jupiter API healthy' : 'Jupiter API degraded',
    };
  } catch (error) {
    return {
      name: 'jupiter',
      status: 'fail',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Jupiter unreachable',
    };
  }
}

async function checkGmgnCli(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Check if gmgn-cli is available
    // This is a simplified check - in production you'd run the actual CLI
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    
    try {
      await execFileAsync('gmgn-cli', ['config', '--check'], { timeout: 5000 });
      return {
        name: 'gmgn-cli',
        status: 'pass',
        latency: Date.now() - start,
        message: 'gmgn-cli available and configured',
      };
    } catch {
      return {
        name: 'gmgn-cli',
        status: 'warn',
        latency: Date.now() - start,
        message: 'gmgn-cli not configured (using DexScreener fallback)',
      };
    }
  } catch (error) {
    return {
      name: 'gmgn-cli',
      status: 'fail',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'gmgn-cli check failed',
    };
  }
}

async function checkMemory(): Promise<HealthCheck> {
  const start = Date.now();
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const usagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  
  let status: 'pass' | 'warn' | 'fail' = 'pass';
  if (usagePercent > 90) status = 'fail';
  else if (usagePercent > 75) status = 'warn';
  
  return {
    name: 'memory',
    status,
    latency: Date.now() - start,
    message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`,
  };
}

export async function GET() {
  const startTime = Date.now();
  
  // Run all health checks in parallel
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkSolanaRpc(),
    checkDexScreener(),
    checkJupiter(),
    checkGmgnCli(),
    checkMemory(),
  ]);
  
  const healthChecks: HealthCheck[] = checks.map((result, index) => {
    const checkNames = ['database', 'solana-rpc', 'dexscreener', 'jupiter', 'gmgn-cli', 'memory'];
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        name: checkNames[index],
        status: 'fail' as const,
        latency: Date.now() - startTime,
        message: result.reason?.message || 'Check failed',
      };
    }
  });
  
  // Determine overall status
  const hasFail = healthChecks.some(c => c.status === 'fail');
  const hasWarn = healthChecks.some(c => c.status === 'warn');
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasFail) overallStatus = 'unhealthy';
  else if (hasWarn) overallStatus = 'degraded';
  else overallStatus = 'healthy';
  
  const response = {
    status: overallStatus,
    checks: healthChecks,
    timestamp: Date.now(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.2.1',
    environment: process.env.NODE_ENV || 'development',
  };
  
  logger.info({ 
    status: overallStatus, 
    checksCount: healthChecks.length,
    duration: Date.now() - startTime,
  }, 'Health check completed');
  
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  
  return NextResponse.json(response, { status: statusCode });
}