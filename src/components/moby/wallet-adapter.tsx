'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  clusterApiUrl,
  WalletReadyState,
} from '@solana/web3.js';
import {
  WalletAdapterNetwork,
  WalletContextState,
  useWallet as useWalletAdapter,
} from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
} from '@solana/wallet-adapter-phantom';
import {
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-solflare';
import {
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-backpack';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  cn 
} from '@/lib/utils';
import { useMoby } from '@/lib/moby-store';
import {
  X,
  Check,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Wallet,
  DollarSign,
  ArrowLeftRight,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  GitBranch,
  Share2,
  LogOut,
} from 'lucide-react';

// Wallet context for our app
interface WalletContextType extends WalletContextState {
  connectWithLabel: (label: string) => Promise<void>;
  getBalance: () => Promise<number>;
  getTokenAccounts: () => Promise<any[]>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

// Wallet configuration
const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  new BackpackWalletAdapter(),
];

const network = WalletAdapterNetwork.Mainnet;
const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('mainnet-beta');

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProviderComponent({ children }: WalletProviderProps) {
  const [conn] = useState(() => new Connection(endpoint, 'confirmed'));
  const walletAdapter = useWalletAdapter();
  const { connectWallet, disconnectWallet, wallet } = useMoby();

  // Sync wallet adapter state with our store
  useEffect(() => {
    if (walletAdapter.connected && walletAdapter.publicKey) {
      connectWallet(
        walletAdapter.wallet?.adapter.name || 'Unknown',
        walletAdapter.publicKey.toString()
      );
    } else if (!walletAdapter.connected && wallet) {
      disconnectWallet();
    }
  }, [walletAdapter.connected, walletAdapter.publicKey, walletAdapter.wallet, connectWallet, disconnectWallet, wallet]);

  // Handle wallet selection
  const handleSelect = useCallback(async (walletName: string) => {
    const selectedWallet = wallets.find(w => w.name === walletName);
    if (selectedWallet && !walletAdapter.connected) {
      try {
        await selectedWallet.connect();
      } catch (error) {
        console.error('Wallet connection failed:', error);
      }
    }
  }, [walletAdapter.connected]);

  const value: WalletContextType = {
    ...walletAdapter,
    connection: conn,
    readyState: walletAdapter.readyState,
    wallets,
    select: handleSelect,
    connectWithLabel: async (label: string) => {
      // This is handled by the wallet adapter automatically
      // The label is for our internal tracking
    },
    getBalance: async () => {
      if (!walletAdapter.publicKey) return 0;
      try {
        const balance = await conn.getBalance(walletAdapter.publicKey);
        return balance / 1e9; // Convert lamports to SOL
      } catch {
        return 0;
      }
    },
    getTokenAccounts: async () => {
      if (!walletAdapter.publicKey) return [];
      try {
        const accounts = await conn.getTokenAccountsByOwner(walletAdapter.publicKey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        });
        return accounts.value.map(({ pubkey, account }) => ({
          pubkey,
          mint: account.data.slice(0, 32),
          amount: account.data.slice(64, 72),
          decimals: account.data.slice(72, 73),
        }));
      } catch {
        return [];
      }
    },
  };

  return (
    <WalletContext.Provider value={value}>
      <WalletProvider endpoint={endpoint} wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </WalletContext.Provider>
  );
}

// Custom wallet button component
export function WalletButton({ className, ...props }: { className?: string } & React.ComponentProps<'button'>) {
  const { connected, connecting, publicKey, wallet, connect, disconnect } = useWallet();
  const { wallet: mobyWallet, prices } = useMoby();
  
  // Compute SOL balance for display
  const solPrice = prices.sol?.price ?? 0;
  const balanceSol = mobyWallet?.connected ? (mobyWallet.balanceSol ?? 0) : 0;
  const balanceUsd = balanceSol * solPrice;

  if (connected && publicKey) {
    const shortAddress = `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`;
    const fullAddress = publicKey.toString();
    
    return (
      <WalletBalancePopover 
        fullAddress={fullAddress}
        shortAddress={shortAddress}
        balanceSol={balanceSol}
        balanceUsd={balanceUsd}
        walletName={wallet?.adapter.name}
        className={className}
      />
    );
  }
  
  return (
    <WalletMultiButton
      className={cn('text-sm', className)}
      {...props}
    />
  );
}

// Enhanced wallet balance popover component
function WalletBalancePopover({ 
  fullAddress, 
  shortAddress, 
  balanceSol, 
  balanceUsd, 
  walletName,
  className 
}: { 
  fullAddress: string;
  shortAddress: string;
  balanceSol: number;
  balanceUsd: number;
  walletName?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [isOpen]);
  
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Wallet button - shows balance when connected */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface/50 border border-border hover:border-bull/30 hover:bg-surface transition-all"
        aria-label="Wallet details"
        {...props}
      >
        {/* SOL Logo with balance */}
        <div className="flex items-center gap-2">
          <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-[#14F195] via-[#22D3EE] to-[#9945FF] grid place-items-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-background" fill="currentColor">
              <path d="M12 2.97l3.89 8.26L23 9.25l-5.38.76L15 13.3l1.13 4.13L12 16.5l-1.13-4.13L3 12.56l5.38-.76L9 9.25z" />
              <circle cx="8" cy="11" r="1.2" />
            </svg>
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-[11px] text-muted-foreground">SOL Balance</div>
            <div className="flex items-baseline gap-1 font-semibold text-foreground">
              <span className="text-sm">{balanceSol.toFixed(2)}</span>
              <span className="text-[11px] text-muted-foreground">SOL</span>
            </div>
          </div>
        </div>
        
        {/* USD value and arrow */}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm font-mono text-foreground">${balanceUsd.toFixed(2)}</span>
          <span className="text-xs font-medium text-bull">
            <span className="inline-block transition-transform duration-200" style={{ transform: 'rotate(0deg)' }}>
              ▲
            </span>
          </span>
        </div>
        
        {/* Chevron to indicate popover */}
        <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
      </button>
      
      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#14F195] via-[#22D3EE] to-[#9945FF] grid place-items-center">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-background" fill="currentColor">
                  <path d="M12 2.97l3.89 8.26L23 9.25l-5.38.76L15 13.3l1.13 4.13L12 16.5l-1.13-4.13L3 12.56l5.38-.76L9 9.25z" />
                  <circle cx="8" cy="11" r="1.2" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-foreground">SOL Balance</div>
                <div className="text-xs text-muted-foreground font-mono">UID: ******</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 grid place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Balance */}
          <div className="px-4 py-4">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold text-foreground tabular-nums">{balanceSol.toFixed(2)}</span>
              <span className="text-muted-foreground self-end pb-1">SOL</span>
            </div>
            <div className="text-sm text-muted-foreground">${balanceUsd.toFixed(2)}</div>
          </div>
          
          {/* Wallet Address */}
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Wallet Address</span>
              <button
                onClick={() => copyToClipboard(fullAddress)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-bull" />
                ) : (
                  <>
                    <span>Copy</span>
                    <ExternalLink className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border font-mono text-xs">
              <span className="text-foreground font-mono">{shortAddress}</span>
              <button
                onClick={() => copyToClipboard(fullAddress)}
                className="ml-auto p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="px-4 pb-2 grid grid-cols-4 gap-2">
            {[
              { label: 'Deposit', icon: <ArrowDownToLine className="h-4 w-4" /> },
              { label: 'Buy', icon: <DollarSign className="h-4 w-4" /> },
              { label: 'Withdraw', icon: <ArrowUpFromLine className="h-4 w-4" /> },
              { label: 'Consolidate', icon: <GitBranch className="h-4 w-4" /> },
              { label: 'Distribute', icon: <Share2 className="h-4 w-4" /> },
              { label: 'Transfer', icon: <ArrowLeftRight className="h-4 w-4" /> },
              { label: 'Convert', icon: <RefreshCw className="h-4 w-4" /> },
            ].map((action, i) => (
              <button
                key={action.label}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border hover:border-bull/30 hover:bg-surface transition-all text-xs text-foreground"
              >
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#14F195]/20 to-[#22D3EE]/20 grid place-items-center text-bull">
                  {action.icon}
                </div>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
          
          {/* Menu Items */}
          <div className="border-t border-border">
            {[
              { label: 'Portfolio', icon: <Wallet className="h-4 w-4" />, onClick: () => {} },
              { label: 'Security', icon: <ShieldCheck className="h-4 w-4" />, onClick: () => {} },
              { label: 'Referral', icon: <DollarSign className="h-4 w-4" />, onClick: () => {} },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-surface transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-surface border border-border grid place-items-center">
                  {item.icon}
                </div>
                <span>{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
              </button>
            ))}
          </div>
          
          {/* Footer */}
          <div className="border-t border-border p-4">
            <button
              onClick={() => {
                disconnect();
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-bear/30 text-bear hover:bg-bear/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Wallet modal trigger for our custom UI
export function WalletConnectTrigger({ onConnect }: { onConnect?: (address: string) => void }) {
  const { wallets, connected, publicKey, select, connectWithLabel } = useWallet();
  
  if (connected) return null;
  
  return (
    <div className="space-y-2" role="dialog" aria-label="Connect Wallet">
      <p className="text-sm text-muted-foreground">Choose a wallet to connect</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {wallets.map((wallet) => (
          <button
            key={wallet.name}
            onClick={() => select(wallet.name)}
            disabled={connected}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-all',
              'hover:border-primary/50 hover:bg-accent',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <img 
              src={wallet.icon} 
              alt={wallet.name} 
              className="w-6 h-6" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="font-medium">{wallet.name}</span>
            {wallet.readyState === WalletReadyState.Installed 
              ? <span className="ml-auto text-xs text-green-400">Installed</span>
              : <span className="ml-auto text-xs text-muted-foreground">Not installed</span>
            }
          </button>
        ))}
      </div>
    </div>
  );
}
