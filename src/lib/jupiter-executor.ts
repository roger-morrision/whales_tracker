/**
 * Jupiter Trading Executor
 * Real on-chain swap execution via Jupiter API v6
 * Integrates with wallet adapters for transaction signing
 */

import { Connection, PublicKey, Transaction, VersionedTransaction, Keypair } from '@solana/web3.js';

// Jupiter API v6 endpoints
const JUPITER_API = 'https://quote-api.jup.ag/v6';
const JUPITER_SWAP_API = 'https://api.jup.ag/swap/v1';

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number; // Raw amount (lamports for SOL, smallest unit for tokens)
  slippageBps: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  platformFeeBps?: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: any;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
  destinationTokenAccount?: string;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface SwapResult {
  signature: string;
  quote: JupiterQuoteResponse;
  status: 'confirmed' | 'failed';
  error?: string;
  fee: number;
  timestamp: number;
}

export interface PriorityFeeEstimate {
  min: number;
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
  recommended: number;
}

class JupiterExecutor {
  private connection: Connection;
  private rpcEndpoint: string;

  constructor(rpcEndpoint?: string) {
    this.rpcEndpoint = rpcEndpoint || process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(this.rpcEndpoint, 'confirmed');
  }

  /**
   * Get a swap quote from Jupiter
   */
  async getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse | null> {
    try {
      const searchParams = new URLSearchParams({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps: params.slippageBps.toString(),
        swapMode: params.swapMode || 'ExactIn',
        onlyDirectRoutes: (params.onlyDirectRoutes || false).toString(),
        asLegacyTransaction: (params.asLegacyTransaction || false).toString(),
      });

      if (params.platformFeeBps) {
        searchParams.append('platformFeeBps', params.platformFeeBps.toString());
      }

      const response = await fetch(`${JUPITER_API}/quote?${searchParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        console.error('[Jupiter] Quote failed:', response.status, await response.text());
        return null;
      }

      const data = await response.json();
      return data as JupiterQuoteResponse;
    } catch (error) {
      console.error('[Jupiter] Quote error:', error);
      return null;
    }
  }

  /**
   * Get swap transaction from Jupiter
   */
  async getSwapTransaction(request: JupiterSwapRequest): Promise<JupiterSwapResponse | null> {
    try {
      const response = await fetch(`${JUPITER_SWAP_API}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        console.error('[Jupiter] Swap failed:', response.status, await response.text());
        return null;
      }

      const data = await response.json();
      return data as JupiterSwapResponse;
    } catch (error) {
      console.error('[Jupiter] Swap error:', error);
      return null;
    }
  }

  /**
   * Estimate priority fees from recent blocks
   */
  async estimatePriorityFees(): Promise<PriorityFeeEstimate> {
    try {
      // Use Jupiter's priority fee endpoint
      const response = await fetch('https://api.jup.ag/v6/price-fees', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          min: data.min || 0,
          low: data.low || 1000,
          medium: data.medium || 5000,
          high: data.high || 20000,
          veryHigh: data.veryHigh || 50000,
          recommended: data.recommended || data.medium || 5000,
        };
      }
    } catch (error) {
      console.warn('[Jupiter] Priority fee estimation failed, using defaults:', error);
    }

    // Default fallback values (in micro-lamports)
    return {
      min: 0,
      low: 1000,
      medium: 5000,
      high: 20000,
      veryHigh: 50000,
      recommended: 5000,
    };
  }

  /**
   * Execute a swap with wallet signing
   */
  async executeSwap(
    quote: JupiterQuoteResponse,
    userPublicKey: string,
    signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>,
    options: {
      priorityFee?: 'low' | 'medium' | 'high' | 'veryHigh' | number;
      maxRetries?: number;
      onStatusUpdate?: (status: string) => void;
    } = {}
  ): Promise<SwapResult> {
    const { priorityFee = 'medium', maxRetries = 3, onStatusUpdate } = options;

    // Estimate priority fees
    const feeEstimate = await this.estimatePriorityFees();
    let prioritizationFeeLamports: number;
    
    if (typeof priorityFee === 'number') {
      prioritizationFeeLamports = priorityFee;
    } else {
      prioritizationFeeLamports = feeEstimate[priorityFee] || feeEstimate.medium;
    }

    onStatusUpdate?.('Building swap transaction...');

    // Get swap transaction from Jupiter
    const swapRequest: JupiterSwapRequest = {
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      prioritizationFeeLamports,
      asLegacyTransaction: false,
    };

    const swapResponse = await this.getSwapTransaction(swapRequest);
    if (!swapResponse) {
      throw new Error('Failed to get swap transaction from Jupiter');
    }

    onStatusUpdate?.('Signing transaction...');

    // Deserialize transaction
    const transactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
    let transaction: Transaction | VersionedTransaction;
    
    try {
      transaction = VersionedTransaction.deserialize(transactionBuf);
    } catch {
      transaction = Transaction.from(transactionBuf);
    }

    // Sign transaction with wallet
    const signedTransaction = await signTransaction(transaction);

    onStatusUpdate?.('Submitting transaction...');

    // Send and confirm
    let signature: string;
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        if (signedTransaction instanceof VersionedTransaction) {
          signature = await this.connection.sendTransaction(signedTransaction, {
            maxRetries: 0,
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        } else {
          signature = await this.connection.sendTransaction(signedTransaction as Transaction, {
            maxRetries: 0,
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        }
        break;
      } catch (error: any) {
        retries++;
        if (retries > maxRetries) {
          throw new Error(`Transaction submission failed after ${maxRetries} retries: ${error.message}`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        
        // Refresh blockhash and re-sign for retries
        if (signedTransaction instanceof Transaction) {
          signedTransaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
        }
      }
    }

    onStatusUpdate?.('Confirming transaction...');

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction({
      signature: signature!,
      blockhash: (await this.connection.getLatestBlockhash()).blockhash,
      lastValidBlockHeight: swapResponse.lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    // Get transaction details for fee
    const txDetails = await this.connection.getTransaction(signature!, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    const fee = txDetails?.meta?.fee || 0;

    return {
      signature: signature!,
      quote,
      status: 'confirmed',
      fee: fee / 1e9, // Convert lamports to SOL
      timestamp: Date.now(),
    };
  }

  /**
   * Simulate a swap to check for errors without executing
   */
  async simulateSwap(
    quote: JupiterQuoteResponse,
    userPublicKey: string,
    prioritizationFeeLamports: number = 5000
  ): Promise<{ success: boolean; error?: string; logs?: string[] }> {
    try {
      const swapRequest: JupiterSwapRequest = {
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        prioritizationFeeLamports,
        asLegacyTransaction: false,
      };

      const swapResponse = await this.getSwapTransaction(swapRequest);
      if (!swapResponse) {
        return { success: false, error: 'Failed to get swap transaction' };
      }

      const transactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      // Simulate
      const result = await this.connection.simulateTransaction(transaction, {
        commitment: 'confirmed',
        replaceRecentBlockhash: true,
      });

      if (result.value.err) {
        return {
          success: false,
          error: JSON.stringify(result.value.err),
          logs: result.value.logs,
        };
      }

      return {
        success: true,
        logs: result.value.logs,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get token price from Jupiter price API
   */
  async getTokenPrices(mints: string[]): Promise<Record<string, number>> {
    try {
      const ids = mints.join(',');
      const response = await fetch(`https://api.jup.ag/v6/price?ids=${ids}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) return {};

      const data = await response.json();
      const prices: Record<string, number> = {};

      for (const [mint, info] of Object.entries(data.data || {})) {
        prices[mint] = (info as any).price || 0;
      }

      return prices;
    } catch (error) {
      console.error('[Jupiter] Price fetch error:', error);
      return {};
    }
  }
}

// Singleton instance
let jupiterExecutorInstance: JupiterExecutor | null = null;

export function getJupiterExecutor(rpcEndpoint?: string): JupiterExecutor {
  if (!jupiterExecutorInstance) {
    jupiterExecutorInstance = new JupiterExecutor(rpcEndpoint);
  }
  return jupiterExecutorInstance;
}

// React hook for trading
export function useJupiterExecutor() {
  const executor = getJupiterExecutor();

  return {
    getQuote: (params: JupiterQuoteParams) => executor.getQuote(params),
    getSwapTransaction: (request: JupiterSwapRequest) => executor.getSwapTransaction(request),
    executeSwap: (
      quote: JupiterQuoteResponse,
      userPublicKey: string,
      signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>,
      options?: { priorityFee?: 'low' | 'medium' | 'high' | 'veryHigh' | number }
    ) => executor.executeSwap(quote, userPublicKey, signTransaction, options),
    simulateSwap: (quote: JupiterQuoteResponse, userPublicKey: string, fee?: number) => 
      executor.simulateSwap(quote, userPublicKey, fee),
    estimatePriorityFees: () => executor.estimatePriorityFees(),
    getTokenPrices: (mints: string[]) => executor.getTokenPrices(mints),
  };
}

export type { JupiterQuoteResponse, JupiterSwapRequest, JupiterSwapResponse, SwapResult, PriorityFeeEstimate };