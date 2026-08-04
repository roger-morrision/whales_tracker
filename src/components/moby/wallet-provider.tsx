'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useWallet as useWalletAdapter } from '@solana/wallet-adapter-react';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { useMoby } from '@/lib/moby-store';

interface WalletProviderContextType {
  connection: Connection;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  wallet: any;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  sendTransaction: (transaction: Transaction | VersionedTransaction, options?: any) => Promise<string>;
  select: (walletName: string) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  wallets: any[];
  readyState: any;
}

const WalletProviderContext = createContext<WalletProviderContextType | null>(null);

export function useWalletProvider(): WalletProviderContextType {
  const context = useContext(WalletProviderContext);
  if (!context) {
    throw new Error('useWalletProvider must be used within WalletProviderComponent');
  }
  return context;
}

interface WalletProviderComponentProps {
  children: ReactNode;
}

export function WalletProviderComponent({ children }: WalletProviderComponentProps) {
  const [wallets] = useState<any[]>([]); // Will be populated by the adapter
  const { 
    connection, 
    publicKey, 
    connected, 
    connecting, 
    wallet, 
    signTransaction, 
    signAllTransactions, 
    signMessage, 
    sendTransaction, 
    select, 
    connect, 
    disconnect, 
    readyState 
  } = useWalletAdapter();
  
  const { wallet: storeWallet, connectWallet, disconnectWallet } = useMoby();

  // Sync with store
  useEffect(() => {
    if (connected && publicKey && !storeWallet?.connected) {
      connectWallet(wallet?.adapter?.name || 'Unknown', publicKey.toString());
    } else if (!connected && storeWallet?.connected) {
      disconnectWallet();
    }
  }, [connected, publicKey, wallet, storeWallet, connectWallet, disconnectWallet]);

  const value = {
    connection,
    publicKey,
    connected,
    connecting,
    wallet,
    signTransaction,
    signAllTransactions,
    signMessage,
    sendTransaction,
    select,
    connect,
    disconnect,
    wallets,
    readyState,
  };

  return (
    <WalletProviderContext.Provider value={value}>
      {children}
    </WalletProviderContext.Provider>
  );
}