/**
 * DeFi Position Resolver
 * Resolves and values DeFi positions for a given wallet address across known protocols.
 * Currently supports liquid staking tokens and notable LP tokens via known mints.
 */

import { Connection, PublicKey } from '@solana/web3.js';

// Known DeFi protocol mints on Solana (mainnet-beta)
// Format: mintAddress => { name, protocol, type, decimals }
// Note: This is a non-exhaustive list for demonstration. In production, this would be more comprehensive.
const DEFI_MINTS: Record<string, { name: string; protocol: string; type: 'lp' | 'lst' | 'lending' | 'yield'; decimals: number }> = {
  // Liquid Staking Tokens (LST)
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { name: 'mSOL', protocol: 'Marinade', type: 'lst', decimals: 9 }, // Marinade
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { name: 'stSOL', protocol: 'Lido', type: 'lst', decimals: 9 }, // Lido
  'BsC6H9vciAh4QEubpDHCKvaEhQsmcALiFoHuwB2veAuR': { name: 'bSOL', protocol: 'Binance', type: 'lst', decimals: 9 }, // Binance
  // Note: stBNB is on BSC, not Solana, so we omit it for Solana-specific list

  // Example LP tokens (these are pool-specific, so we show a few prominent ones)
  // RAY-USDC Raydium LP
  '5quBtfQqykdY9pNQjtEHcPFTkuYwFQYFfGHTr1gQkArP': { name: 'RAY-USDC LP', protocol: 'Raydium', type: 'lp', decimals: 5 },
  // SOL-USDC Raydium LP
  '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2': { name: 'SOL-USDC LP', protocol: 'Raydium', type: 'lp', decimals: 5 },
  // ETH-USDC Raydium LP
  '2wTvYW89cVT1XbZvKCXkp1R1C3buDx3pqAQtaa7tCECL': { name: 'ETH-USDC LP', protocol: 'Raydium', type: 'lp', decimals: 5 },

  // Wrapped SOL (not strictly DeFi, but often used in DeFi)
  'So11111111111111111111111111111111111111112': { name: 'wSOL', protocol: 'Wrapper', type: 'lending', decimals: 9 },
};

// Inverse mapping for quick lookup
const DEFI_MINTS_SET = new Set(Object.keys(DEFI_MINTS));

interface DeFiPosition {
  mint: string;
  tokenAccount: string;
  balance: number; // in token units
  decimals: number;
  symbol: string;
  protocol: string;
  type: 'lp' | 'lst' | 'lending' | 'yield';
  usdValue: number;
  priceUsd: number;
}

interface DefiPositionResolverConfig {
  connection: Connection;
  // Optional: custom price fetching function
  // If not provided, we'll fetch from /api/price
  priceFetcher?: (mint: string) => Promise<number>;
}

class DefiPositionResolver {
  private connection: Connection;
  private priceFetcher: (mint: string) => Promise<number>;

  constructor(config: DefiPositionResolverConfig) {
    this.connection = config.connection;
    this.priceFetcher = config.priceFetcher ?? this.defaultPriceFetcher.bind(this);
  }

  /**
   * Default price fetcher using the app's /api/price endpoint
   */
  private async defaultPriceFetcher(mint: string): Promise<number> {
    try {
      const response = await fetch(`/api/price?mint=${mint}`);
      if (!response.ok) {
        throw new Error(`Price fetch failed for ${mint}: ${response.status}`);
      }
      const data = await response.json();
      // Assuming the response format is { price: number } or just a number
      return typeof data === 'number' ? data : data.price ?? 0;
    } catch (error) {
      console.warn(`[DefiPositionResolver] Failed to fetch price for ${mint}:`, error);
      return 0;
    }
  }

  /**
   * Get all DeFi positions for a wallet
   * @param walletAddress - Base58 encoded public key
   * @returns Promise of array of DeFi positions
   */
  async getPositionsForWallet(walletAddress: string): Promise<DeFiPosition[]> {
    try {
      const publicKey = new PublicKey(walletAddress);

      // Get all token accounts for this wallet
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKXuXCwpjXad1XyxMjZ9Ncc') } // Token Program ID
      );

      const positions: DeFiPosition[] = [];

      // Process each token account
      for (const { pubkey, account } of tokenAccounts.value) {
        try {
          const tokenInfo = await this.getTokenInfo(account.data);
          if (!tokenInfo) continue;

          const { mint, amount, decimals } = tokenInfo;
          const mintStr = mint.toBase58();

          // Check if this mint is a known DeFi mint
          const defiInfo = DEFI_MINTS[mintStr];
          if (!defiInfo) continue;

          // Get price for this mint
          const priceUsd = await this.priceFetcher(mintStr);
          const balance = Number(amount) / Math.pow(10, decimals);
          const usdValue = balance * priceUsd;

          positions.push({
            mint: mintStr,
            tokenAccount: pubkey.toBase58(),
            balance,
            decimals,
            symbol: defiInfo.name,
            protocol: defiInfo.protocol,
            type: defiInfo.type,
            usdValue,
            priceUsd
          });
        } catch (accountError) {
          console.warn(`[DefiPositionResolver] Error processing token account ${pubkey.toBase58()}:`, accountError);
          // Continue with other accounts
        }
      }

      return positions;
    } catch (error) {
      console.error(`[DefiPositionResolver] Failed to get DeFi positions for ${walletAddress}:`, error);
      return [];
    }
  }

  /**
   * Parse token account data to get mint, amount, and decimals
   * This is a simplified parser for the standard token account format
   */
  private async getTokenInfo(accountInfo: Buffer): Promise<{ mint: PublicKey; amount: bigint; decimals: number } | null> {
    try {
      // The layout of a token account is:
      //   mint: pubkey (32 bytes)
      //   owner: pubkey (32 bytes)
      //   amount: uint64 (8 bytes, little endian)
      //   delegate: pubkey or null (32 bytes)
      //   state: uint8 (0=uninitialized, 1=initialized, 2=frozen)
      //   isNative: uint8 (0 or 1) - for native SOL wrappers
      //   delegatedAmount: uint64 (if delegate is set)
      //   closeAuthority: pubkey or null
      //   ... (more fields for newer versions)

      // We'll use a simple approach: assume it's a standard token account
      // and read the mint at offset 0 and amount at offset 32+32=64

      if (accountInfo.length < 72) {
        // Minimum length for a basic token account
        return null;
      }

      const mint = new PublicKey(accountInfo.slice(0, 32));
      // Amount is a uint64 little endian at offset 64
      const amount = accountInfo.readBigUInt64LE(64);

      // We need to get the decimals from the mint account
      // For simplicity, we'll get it from our DEFI_MINTS map if known
      const mintStr = mint.toBase58();
      const dec = DEFI_MINTS[mintStr]?.decimals;
      if (dec === undefined) {
        // If we don't know the decimals, we'd need to fetch the mint account
        // For now, we'll skip if not in our known list (though we already filtered)
        // This shouldn't happen because we filter by DEFI_MINTS above
        return null;
      }

      return { mint, amount, decimals: dec };
    } catch (error) {
      console.warn(`[DefiPositionResolver] Failed to parse token account data:`, error);
      return null;
    }
  }

  /**
   * Get summary statistics for a wallet's DeFi positions
   */
  async getDefiSummary(walletAddress: string): Promise<{
    totalValueUsd: number;
    positionCount: number;
    byProtocol: Record<string, { count: number; valueUsd: number }>;
    byType: Record<string, { count: number; valueUsd: number }>;
  }> {
    const positions = await this.getPositionsForWallet(walletAddress);

    let totalValueUsd = 0;
    const byProtocol: Record<string, { count: number; valueUsd: number }> = {};
    const byType: Record<string, { count: number; valueUsd: number }> = {};

    for (const pos of positions) {
      totalValueUsd += pos.usdValue;

      // By protocol
      if (!byProtocol[`${pos.protocol}`]) {
        byProtocol[`${pos.protocol}`] = { count: 0, valueUsd: 0 };
      }
      byProtocol[`${pos.protocol}`].count++;
      byProtocol[`${pos.protocol}`].valueUsd += pos.usdValue;

      // By type
      if (!byType[`${pos.type}`]) {
        byType[`${pos.type}`] = { count: 0, valueUsd: 0 };
      }
      byType[`${pos.type}`].count++;
      byType[`${pos.type}`].valueUsd += pos.usdValue;
    }

    return {
      totalValueUsd,
      positionCount: positions.length,
      byProtocol,
      byType
    };
  }
}

// Singleton instance (in practice, you might want multiple instances for different connections)
// But for simplicity, we'll assume one connection per app
let defiPositionResolverInstance: DefiPositionResolver | null = null;

/**
 * Initialize or get the DeFi position resolver
 * @param config - Configuration (requires connection)
 * @returns DeFiPositionResolver instance
 */
export function initDefiPositionResolver(config: DefiPositionResolverConfig): DefiPositionResolver {
  if (!defiPositionResolverInstance) {
    defiPositionResolverInstance = new DefiPositionResolver(config);
  }
  return defiPositionResolverInstance;
}

/**
 * Get the existing DeFi position resolver instance
 */
export function getDefiPositionResolver(): DefiPositionResolver | null {
  return defiPositionResolverInstance;
}

// Export types
export type { DeFiPosition, DefiPositionResolverConfig };