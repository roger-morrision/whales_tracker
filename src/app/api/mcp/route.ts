import { fetchTokenInfo, fetchSecurity } from '@/lib/gmgn';
import { getJupiterExecutor } from '@/lib/jupiter-executor';
import { getPriorityFeeOracle } from '@/lib/priority-fee-oracle';
import { getBundleChecker } from '@/lib/bundle-checker';
import { getPulseEngine } from '@/lib/pulse-engine';
import { getDefiPositionResolver } from '@/lib/defi-position-resolver';
import { TOKENS_BY_ID } from '@/lib/moby-data';

// Define the available tools
const tools = [
  {
    name: 'get_token_info',
    description: 'Get information about a token by its mint address',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'The token mint address' }
      },
      required: ['mint']
    }
  },
  {
    name: 'get_token_security',
    description: 'Get security score and audit information for a token',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'The token mint address' }
      },
      required: ['mint']
    }
  },
  {
    name: 'get_priority_fees',
    description: 'Get current priority fee recommendations for Solana transactions',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'check_token_bundle',
    description: 'Check if a token launch shows signs of bundling or insider activity',
    inputSchema: {
      type: 'object',
      properties: {
        mint: { type: 'string', description: 'The token mint address to check' }
      },
      required: ['mint']
    }
  },
  {
    name: 'get_recent_launches',
    description: 'Get recent token launches from the pulse feed',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of results to return (default: 10)', default: 10 }
      }
    }
  },
  {
    name: 'get_wallet_defi_positions',
    description: 'Get DeFi positions for a wallet address',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The wallet address to check' }
      },
      required: ['address']
    }
  }
];

export async function POST(request: Request) {
  try {
    const { name, arguments: args } = await request.json();

    let result;

    switch (name) {
      case 'get_token_info': {
        const { mint } = args as { mint: string };
        const tokenInfo = await fetchTokenInfo(mint);
        result = tokenInfo;
        break;
      }
      case 'get_token_security': {
        const { mint } = args as { mint: string };
        const securityInfo = await fetchSecurity(mint);
        result = securityInfo;
        break;
      }
      case 'get_priority_fees': {
        const oracle = getPriorityFeeOracle();
        const fees = await oracle.getPriorityFees();
        result = fees;
        break;
      }
      case 'check_token_bundle': {
        const { mint } = args as { mint: string };
        const checker = getBundleChecker();
        const report = await checker.analyzeToken(mint);
        result = {
          isBundled: report.bundleAnalysis.isBundled,
          confidence: report.bundleAnalysis.confidence,
          bundleSize: report.bundleAnalysis.bundleSize,
          riskScore: report.bundleAnalysis.riskScore,
          recommendation: report.bundleAnalysis.recommendation
        };
        break;
      }
      case 'get_recent_launches': {
        const { limit = 10 } = args as { limit?: number };
        const pulseEngine = getPulseEngine();
        const launches = pulseEngine.getRecentLaunches().slice(0, limit);
        result = launches;
        break;
      }
      case 'get_wallet_defi_positions': {
        const { address } = args as { address: string };
        const resolver = getDefiPositionResolver();
        if (!resolver) {
          throw new Error('DeFi position resolver not initialized');
        }
        const positions = await resolver.getPositionsForWallet(address);
        result = positions;
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unknown tool: ${name}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      result
    });
  } catch (error: any) {
    console.error('MCP error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    tools
  });
}