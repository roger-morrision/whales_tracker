/**
 * Multi-Chain Expansion
 * Base, Ethereum, Arbitrum, BSC via unified interface
 */

export interface ChainConfig {
  id: string;
  name: string;
  displayName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
    address: string; // Wrapped native token
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  chainId: number;
  testnetChainId?: number;
  isTestnet: boolean;
  features: ChainFeature[];
  contracts: ChainContracts;
  gasPrice?: {
    slow: number;
    standard: number;
    fast: number;
  };
}

export type ChainFeature = 
  | 'evm' 
  | 'solana' 
  | 'cosmos' 
  | 'substrate' 
  | 'eip1559' 
  | 'eip4844' 
  | 'account_abstraction' 
  | 'zk_rollup' 
  | 'optimistic_rollup';

export interface ChainContracts {
  // DEX routers
  uniswapV2Router?: string;
  uniswapV3Router?: string;
  sushiswapRouter?: string;
  pancakeswapRouter?: string;
  // Aggregators
  jupiter?: string;
  oneinch?: string;
  paraswap?: string;
  // Lending
  aaveV3Pool?: string;
  compoundV3Comptroller?: string;
  // Staking
  lidoStEth?: string;
  rocketPoolEth?: string;
  // Bridges
  wormholeBridge?: string;
  layerZeroEndpoint?: string;
  // Oracle
  chainlinkEthUsd?: string;
}

export interface WalletAdapter {
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  getAddress(): string | null;
  getChainId(): number;
  signMessage(message: string): Promise<string>;
  signTransaction(tx: any): Promise<any>;
  sendTransaction(tx: any): Promise<string>;
  switchChain(chainId: number): Promise<void>;
  onAccountsChanged(callback: (accounts: string[]) => void): () => void;
  onChainChanged(callback: (chainId: number) => void): () => void;
}

export interface WalletConnection {
  address: string;
  chainId: number;
  balance: string; // in wei/lamports
  ensName?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  chainId: number;
  priceUsd?: number;
  isNative: boolean;
  isVerified: boolean;
  tags: string[];
}

export interface PriceQuote {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  fee: string;
  route: string[];
  gasEstimate: string;
  validFor: number; // seconds
}

export interface TransactionRequest {
  from: string;
  to: string;
  value: string;
  data: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  chainId: number;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  timestamp: number;
}

export interface BridgeQuote {
  fromChain: string;
  toChain: string;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  amount: string;
  estimatedOutput: string;
  fee: string;
  duration: number; // seconds
  route: BridgeStep[];
}

export interface BridgeStep {
  protocol: string;
  fromChain: string;
  toChain: string;
  action: 'swap' | 'bridge' | 'claim';
  estimatedTime: number;
}

class MultiChainManager {
  private chains: Map<string, ChainConfig> = new Map();
  private adapters: Map<string, WalletAdapter> = new Map();
  private currentChainId: number = 1; // Ethereum mainnet
  private tokenCache: Map<string, TokenInfo[]> = new Map();
  private priceCache: Map<string, PriceQuote> = new Map();
  private subscribers: Set<(chainId: number) => void> = new Set();
  private balanceSubscribers: Map<string, Set<(balance: string) => void>> = new Map();

  constructor() {
    this.registerChains();
  }

  private registerChains(): void {
    // Solana
    this.chains.set('solana', {
      id: 'solana',
      name: 'Solana',
      displayName: 'Solana',
      nativeCurrency: {
        name: 'SOL',
        symbol: 'SOL',
        decimals: 9,
        address: 'So11111111111111111111111111111111111111112',
      },
      rpcUrls: [
        'https://api.mainnet-beta.solana.com',
        'https://solana-mainnet.g.alchemy.com/v2/${API_KEY}',
        'https://rpc.ankr.com/solana',
      ],
      blockExplorerUrls: ['https://solscan.io', 'https://explorer.solana.com'],
      chainId: 101, // Custom ID for Solana
      isTestnet: false,
      features: ['solana'],
      contracts: {
        jupiter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      },
    });

    // Ethereum Mainnet
    this.chains.set('ethereum', {
      id: 'ethereum',
      name: 'Ethereum',
      displayName: 'Ethereum',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      },
      rpcUrls: [
        'https://eth-mainnet.g.alchemy.com/v2/${API_KEY}',
        'https://mainnet.infura.io/v3/${API_KEY}',
        'https://eth.llamarpc.com',
      ],
      blockExplorerUrls: ['https://etherscan.io'],
      chainId: 1,
      isTestnet: false,
      features: ['evm', 'eip1559', 'eip4844', 'account_abstraction'],
      contracts: {
        uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        sushiswapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        oneinch: '0x1111111254EEB25477B68fb85Ed929f73A960582',
        paraswap: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
        aaveV3Pool: '0x87870B93F3b5C6c43c5D8f0f142502C8C6f14f5',
        compoundV3Comptroller: '0xc3d688B66703497DAA19211Ecef4B0028F5c3e94',
        lidoStEth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        wormholeBridge: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
        layerZeroEndpoint: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675',
        chainlinkEthUsd: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
      },
    });

    // Base
    this.chains.set('base', {
      id: 'base',
      name: 'Base',
      displayName: 'Base',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
        address: '0x4200000000000000000000000000000000000006', // WETH on Base
      },
      rpcUrls: [
        'https://mainnet.base.org',
        'https://base-mainnet.g.alchemy.com/v2/${API_KEY}',
        'https://base.rpc.blxrbdn.com',
      ],
      blockExplorerUrls: ['https://basescan.org'],
      chainId: 8453,
      isTestnet: false,
      features: ['evm', 'eip1559', 'optimistic_rollup'],
      contracts: {
        uniswapV3Router: '0x2626664c2603336E57B271c5C0b26F421741e481',
        sushiswapRouter: '0x6BDED42c6DA8FBf0d19a8C5d639E6a1D1C1BdD02',
        aaveV3Pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
        chainlinkEthUsd: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
      },
    });

    // Arbitrum
    this.chains.set('arbitrum', {
      id: 'arbitrum',
      name: 'Arbitrum One',
      displayName: 'Arbitrum',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
        address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
      },
      rpcUrls: [
        'https://arb1.arbitrum.io/rpc',
        'https://arb-mainnet.g.alchemy.com/v2/${API_KEY}',
        'https://arbitrum.llamarpc.com',
      ],
      blockExplorerUrls: ['https://arbiscan.io'],
      chainId: 42161,
      isTestnet: false,
      features: ['evm', 'eip1559', 'optimistic_rollup'],
      contracts: {
        uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        aaveV3Pool: '0x794a61358D6845594F94a1DB0742583c8C0cD28c',
        chainlinkEthUsd: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
      },
    });

    // BSC
    this.chains.set('bsc', {
      id: 'bsc',
      name: 'BNB Smart Chain',
      displayName: 'BSC',
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18,
        address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
      },
      rpcUrls: [
        'https://bsc-dataseed1.binance.org',
        'https://bsc-mainnet.g.alchemy.com/v2/${API_KEY}',
        'https://bsc.rpc.blxrbdn.com',
      ],
      blockExplorerUrls: ['https://bscscan.com'],
      chainId: 56,
      isTestnet: false,
      features: ['evm', 'eip1559'],
      contracts: {
        pancakeswapRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        uniswapV2Router: '0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52',
        aaveV3Pool: '0x6D9871444E3D68f3d6E81BfE2e5E6E873a46C9A8',
        chainlinkEthUsd: '0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526',
      },
    });

    // Polygon
    this.chains.set('polygon', {
      id: 'polygon',
      name: 'Polygon',
      displayName: 'Polygon',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18,
        address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
      },
      rpcUrls: [
        'https://polygon-rpc.com',
        'https://polygon-mainnet.g.alchemy.com/v2/${API_KEY}',
        'https://polygon.llamarpc.com',
      ],
      blockExplorerUrls: ['https://polygonscan.com'],
      chainId: 137,
      isTestnet: false,
      features: ['evm', 'eip1559'],
      contracts: {
        uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        aaveV3Pool: '0x794a61358D6845594F94a1DB0742583c8C0cD28c',
        chainlinkEthUsd: '0xF9680D99D6C9585426707E4F4C8D7A4C2F9E3E7C',
      },
    });

    // Optimism
    this.chains.set('optimism', {
      id: 'optimism',
      name: 'Optimism',
      displayName: 'Optimism',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
        address: '0x4200000000000000000000000000000000000006',
      },
      rpcUrls: [
        'https://mainnet.optimism.io',
        'https://opt-mainnet.g.alchemy.com/v2/${API_KEY}',
        'https://optimism.llamarpc.com',
      ],
      blockExplorerUrls: ['https://optimistic.etherscan.io'],
      chainId: 10,
      isTestnet: false,
      features: ['evm', 'eip1559', 'optimistic_rollup'],
      contracts: {
        uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        aaveV3Pool: '0x794a61358D6845594F94a1DB0742583c8C0cD28c',
        chainlinkEthUsd: '0x13e3Ee699D1909E989722E0914103aD35399c3A7',
      },
    });
  }

  // Chain management
  getChain(chainId: string | number): ChainConfig | undefined {
    if (typeof chainId === 'number') {
      return Array.from(this.chains.values()).find(c => c.chainId === chainId);
    }
    return this.chains.get(chainId);
  }

  getAllChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  getSupportedChains(): ChainConfig[] {
    return Array.from(this.chains.values()).filter(c => !c.isTestnet);
  }

  setCurrentChain(chainId: number): boolean {
    const chain = this.getChain(chainId);
    if (!chain) return false;
    
    this.currentChainId = chainId;
    this.notifySubscribers(chainId);
    return true;
  }

  getCurrentChain(): ChainConfig | undefined {
    return this.getChain(this.currentChainId);
  }

  getCurrentChainId(): number {
    return this.currentChainId;
  }

  // Wallet adapter registration
  registerAdapter(chainId: string, adapter: WalletAdapter): void {
    this.adapters.set(chainId, adapter);
  }

  getAdapter(chainId: string): WalletAdapter | undefined {
    return this.adapters.get(chainId);
  }

  async connectWallet(chainId?: number): Promise<WalletConnection | null> {
    const targetChainId = chainId || this.currentChainId;
    const chain = this.getChain(targetChainId);
    if (!chain) return null;

    const adapter = this.adapters.get(chain.id);
    if (!adapter) {
      console.warn(`No wallet adapter for chain: ${chain.id}`);
      return null;
    }

    try {
      return await adapter.connect();
    } catch (error) {
      console.error('Wallet connection failed:', error);
      return null;
    }
  }

  async disconnectWallet(chainId?: number): Promise<void> {
    const targetChainId = chainId || this.currentChainId;
    const chain = this.getChain(targetChainId);
    if (!chain) return;

    const adapter = this.adapters.get(chain.id);
    if (adapter) {
      await adapter.disconnect();
    }
  }

  // Token management
  async getTokens(chainId: number): Promise<TokenInfo[]> {
    const cached = this.tokenCache.get(chainId.toString());
    if (cached) return cached;

    // In production, fetch from token list API
    const chain = this.getChain(chainId);
    if (!chain) return [];

    const tokens: TokenInfo[] = [
      {
        address: chain.nativeCurrency.address,
        symbol: chain.nativeCurrency.symbol,
        name: chain.nativeCurrency.name,
        decimals: chain.nativeCurrency.decimals,
        chainId,
        isNative: true,
        isVerified: true,
        tags: ['native'],
      },
    ];

    // Add common tokens for this chain
    const commonTokens = this.getCommonTokens(chainId);
    tokens.push(...commonTokens);

    this.tokenCache.set(chainId.toString(), tokens);
    return tokens;
  }

  private getCommonTokens(chainId: number): TokenInfo[] {
    const common: Record<number, TokenInfo[]> = {
      1: [ // Ethereum
        { address: '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8C8', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 1, isNative: false, isVerified: true, tags: ['stablecoin'] },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 1, isNative: false, isVerified: true, tags: ['stablecoin'] },
        { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 1, isNative: false, isVerified: true, tags: ['wrapped'] },
      ],
      8453: [ // Base
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 8453, isNative: false, isVerified: true, tags: ['stablecoin'] },
      ],
      42161: [ // Arbitrum
        { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 42161, isNative: false, isVerified: true, tags: ['stablecoin'] },
      ],
      56: [ // BSC
        { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', name: 'USD Coin', decimals: 18, chainId: 56, isNative: false, isVerified: true, tags: ['stablecoin'] },
        { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18, chainId: 56, isNative: false, isVerified: true, tags: ['stablecoin'] },
      ],
      137: [ // Polygon
        { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 137, isNative: false, isVerified: true, tags: ['stablecoin'] },
        { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 137, isNative: false, isVerified: true, tags: ['stablecoin'] },
      ],
      10: [ // Optimism
        { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 10, isNative: false, isVerified: true, tags: ['stablecoin'] },
      ],
    };

    return common[chainId] || [];
  }

  async getTokenInfo(chainId: number, address: string): Promise<TokenInfo | null> {
    const tokens = await this.getTokens(chainId);
    return tokens.find(t => t.address.toLowerCase() === address.toLowerCase()) || null;
  }

  // Price quotes
  async getQuote(
    inputToken: string,
    outputToken: string,
    amount: string,
    chainId: number
  ): Promise<PriceQuote | null> {
    const cacheKey = `${chainId}:${inputToken}:${outputToken}:${amount}`;
    const cached = this.priceCache.get(cacheKey);
    if (cached && Date.now() < cached.validFor * 1000) return cached;

    // In production, call aggregator API (1inch, Paraswap, Jupiter, etc.)
    const chain = this.getChain(chainId);
    if (!chain) return null;

    // Mock quote
    const quote: PriceQuote = {
      inputToken: { address: inputToken, symbol: 'IN', name: '', decimals: 18, chainId, isNative: false, isVerified: true, tags: [] },
      outputToken: { address: outputToken, symbol: 'OUT', name: '', decimals: 18, chainId, isNative: false, isVerified: true, tags: [] },
      inputAmount: amount,
      outputAmount: (parseFloat(amount) * 0.99).toFixed(0),
      priceImpact: 0.1,
      fee: '1000000000000000',
      route: ['Uniswap V3'],
      gasEstimate: '150000',
      validFor: 30,
    };

    this.priceCache.set(cacheKey, quote);
    return quote;
  }

  // Cross-chain bridges
  async getBridgeQuote(
    fromChain: number,
    toChain: number,
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<BridgeQuote | null> {
    // In production, call bridge aggregator (LiFi, Socket, Wormhole, LayerZero)
    const fromChainConfig = this.getChain(fromChain);
    const toChainConfig = this.getChain(toChain);
    if (!fromChainConfig || !toChainConfig) return null;

    return {
      fromChain: fromChainConfig.id,
      toChain: toChainConfig.id,
      fromToken: { address: fromToken, symbol: 'FROM', name: '', decimals: 18, chainId: fromChain, isNative: false, isVerified: true, tags: [] },
      toToken: { address: toToken, symbol: 'TO', name: '', decimals: 18, chainId: toChain, isNative: false, isVerified: true, tags: [] },
      amount,
      estimatedOutput: (parseFloat(amount) * 0.98).toFixed(0),
      fee: '5000000000000000',
      duration: 300,
      route: [
        { protocol: 'Wormhole', fromChain: fromChainConfig.id, toChain: toChainConfig.id, action: 'bridge', estimatedTime: 300 },
      ],
    };
  }

  // Transaction building
  async buildTransaction(request: TransactionRequest): Promise<TransactionRequest> {
    // In production, estimate gas, get nonce, etc.
    return request;
  }

  async sendTransaction(request: TransactionRequest): Promise<TransactionResult> {
    const chain = this.getChain(request.chainId);
    if (!chain) throw new Error('Chain not supported');

    const adapter = this.adapters.get(chain.id);
    if (!adapter) throw new Error('No wallet adapter for chain');

    const txHash = await adapter.sendTransaction(request);
    
    return {
      hash: txHash,
      status: 'pending',
      timestamp: Date.now(),
    };
  }

  async waitForTransaction(hash: string, chainId: number): Promise<TransactionResult> {
    // In production, poll for confirmation
    return {
      hash,
      status: 'confirmed',
      blockNumber: 12345678,
      gasUsed: '150000',
      effectiveGasPrice: '20000000000',
      timestamp: Date.now(),
    };
  }

  // Balance tracking
  async getBalance(address: string, chainId: number): Promise<string> {
    const chain = this.getChain(chainId);
    if (!chain) return '0';

    const adapter = this.adapters.get(chain.id);
    if (adapter && adapter.getAddress() === address) {
      // Would call actual RPC
    }
    return '0'; // Mock
  }

  subscribeToBalance(address: string, chainId: number, callback: (balance: string) => void): () => void {
    const key = `${chainId}:${address.toLowerCase()}`;
    if (!this.balanceSubscribers.has(key)) {
      this.balanceSubscribers.set(key, new Set());
    }
    this.balanceSubscribers.get(key)!.add(callback);
    return () => this.balanceSubscribers.get(key)?.delete(callback);
  }

  // Subscriptions
  onChainChange(callback: (chainId: number) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(chainId: number): void {
    for (const sub of this.subscribers) {
      try { sub(chainId); } catch (e) { console.error('[MultiChain] Subscriber error:', e); }
    }
  }
}

// Singleton
let multiChainManagerInstance: MultiChainManager | null = null;

export function getMultiChainManager(): MultiChainManager {
  if (!multiChainManagerInstance) {
    multiChainManagerInstance = new MultiChainManager();
  }
  return multiChainManagerInstance;
}

// React hook
export function useMultiChain() {
  const manager = getMultiChainManager();
  
  return {
    getChain: (id: string | number) => manager.getChain(id),
    getAllChains: () => manager.getAllChains(),
    getSupportedChains: () => manager.getSupportedChains(),
    setCurrentChain: (chainId: number) => manager.setCurrentChain(chainId),
    getCurrentChain: () => manager.getCurrentChain(),
    getCurrentChainId: () => manager.getCurrentChainId(),
    connectWallet: (chainId?: number) => manager.connectWallet(chainId),
    disconnectWallet: (chainId?: number) => manager.disconnectWallet(chainId),
    getTokens: (chainId: number) => manager.getTokens(chainId),
    getTokenInfo: (chainId: number, address: string) => manager.getTokenInfo(chainId, address),
    getQuote: (inputToken: string, outputToken: string, amount: string, chainId: number) => 
      manager.getQuote(inputToken, outputToken, amount, chainId),
    getBridgeQuote: (fromChain: number, toChain: number, fromToken: string, toToken: string, amount: string) =>
      manager.getBridgeQuote(fromChain, toChain, fromToken, toToken, amount),
    buildTransaction: (request: TransactionRequest) => manager.buildTransaction(request),
    sendTransaction: (request: TransactionRequest) => manager.sendTransaction(request),
    waitForTransaction: (hash: string, chainId: number) => manager.waitForTransaction(hash, chainId),
    getBalance: (address: string, chainId: number) => manager.getBalance(address, chainId),
    subscribeToBalance: (address: string, chainId: number, callback: (balance: string) => void) =>
      manager.subscribeToBalance(address, chainId, callback),
    onChainChange: (callback: (chainId: number) => void) => manager.onChainChange(callback),
  };
}

export type { ChainConfig, ChainFeature, ChainContracts, WalletAdapter, WalletConnection, TokenInfo, PriceQuote, TransactionRequest, TransactionResult, BridgeQuote, BridgeStep };