'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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
import { cn } from '@/lib/utils';
import { useMoby } from '@/lib/moby-store';

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
  
  if (connected && publicKey) {
    const shortAddress = `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`;
    
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="flex items-center gap-1 px-2 py-1 text-sm bg-green-500/20 text-green-400 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {wallet?.adapter.name}
        </span>
        <span className="font-mono text-xs px-2 py-1 bg-muted rounded">{shortAddress}</span>
        <button
          onClick={disconnect}
          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }
  
  return (
    <WalletMultiButton
      className={cn('text-sm', className)}
      {...props}
    />
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