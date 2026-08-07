/**
 * Multi-Wallet Manager
 * Allows managing multiple wallets (up to 10) for trading
 * Supports importing wallets via private key and signing transactions
 */

import { Connection, PublicKey, Keypair, Signer, Transaction, SystemMessage } from '@solana/web3.js';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';

// Maximum number of wallets allowed
const MAX_WALLETS = 10;

export interface MultiWallet {
  id: string; // unique identifier (e.g., timestamp or random)
  label: string; // user-defined label
  address: string; // base58 public key
  publicKey: PublicKey; // PublicKey object
  secretKey: Uint8Array; // secret key for signing (keep secure!)
  // We don't store the mnemonic or private key directly for security
  // In a real app, we would encrypt the secret key before storing
}

export interface MultiWalletConfig {
  storageKey?: string; // key for localStorage storage
  connection: Connection; // Solana connection
}

class MultiWalletManager {
  private wallets: MultiWallet[] = [];
  private selectedWalletId: string | null = null;
  private connection: Connection;
  private storageKey: string;

  constructor(config: MultiWalletConfig) {
    this.connection = config.connection;
    this.storageKey = config.storageKey ?? 'moby-multi-wallets';
    this.loadFromStorage();
  }

  /**
   * Add a wallet from a private key (base58 encoded secret key)
   * @param privateKeyBase58 - base58 encoded secret key (as returned by Keypair.generate().secretKey)
   * @param label - user-defined label for the wallet
   * @returns the added wallet or throws if max wallets reached
   */
  addWalletFromPrivateKey(privateKeyBase58: string, label: string): MultiWallet {
    if (this.wallets.length >= MAX_WALLETS) {
      throw new Error(`Maximum number of wallets (${MAX_WALLETS}) reached`);
    }

    // Decode the private key
    const secretKey = bs58.decode(privateKeyBase58);
    if (secretKey.length !== 64) {
      throw new Error('Invalid private key length');
    }

    const keypair = Keypair.fromSecretKey(secretKey);
    const publicKey = keypair.publicKey;
    const address = publicKey.toBase58();

    // Check if wallet already exists (by address)
    const existing = this.wallets.find(w => w.address === address);
    if (existing) {
      // If exists, update label and return existing
      existing.label = label;
      this.selectedWalletId = existing.id;
      this.saveToStorage();
      return existing;
    }

    const wallet: MultiWallet = {
      id: `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label,
      address,
      publicKey,
      secretKey,
    };

    this.wallets.push(wallet);
    // Select the newly added wallet by default
    this.selectedWalletId = wallet.id;
    this.saveToStorage();
    return wallet;
  }

  /**
   * Remove a wallet by id
   * @param id - wallet id
   * @returns true if removed, false if not found
   */
  removeWallet(id: string): boolean {
    const index = this.wallets.findIndex(w => w.id === id);
    if (index === -1) return false;

    const removed = this.wallets.splice(index, 1)[0];
    if (this.selectedWalletId === id) {
      // If we removed the selected wallet, select another if available
      this.selectedWalletId = this.wallets.length > 0 ? this.wallets[0].id : null;
    }
    this.saveToStorage();
    return true;
  }

  /**
   * Select a wallet by id
   * @param id - wallet id
   * @returns true if selected, false if not found
   */
  selectWallet(id: string): boolean {
    if (!this.wallets.some(w => w.id === id)) return false;
    this.selectedWalletId = id;
    this.saveToStorage();
    return true;
  }

  /**
   * Get the currently selected wallet
   */
  getSelectedWallet(): MultiWallet | null {
    if (!this.selectedWalletId) return null;
    return this.wallets.find(w => w.id === this.selectedWalletId) ?? null;
  }

  /**
   * Get all wallets
   */
  getWallets(): MultiWallet[] {
    return [...this.wallets];
  }

  /**
   * Sign a transaction with the selected wallet
   * @param transaction - transaction to sign
   * @returns signed transaction
   * @throws if no wallet selected
   */
  async signTransaction(transaction: Transaction): Promise<Transaction> {
    const wallet = this.getSelectedWallet();
    if (!wallet) {
      throw new Error('No wallet selected');
    }

    // In a real implementation, we would use the wallet's secret key to sign
    // For now, we'll create a signer from the secret key
    const signer = Keypair.fromSecretKey(wallet.secretKey);
    // The transaction.sign method expects a signer or an array of signers
    transaction.sign(signer);
    return transaction;
  }

  /**
   * Sign a message with the selected wallet
   * @param message - message to sign (as Uint8Array)
   * @returns signature
   * @throws if no wallet selected
   */
  signMessage(message: Uint8Array): Uint8Array {
    const wallet = this.getSelectedWallet();
    if (!wallet) {
      throw new Error('No wallet selected');
    }
    const signer = Keypair.fromSecretKey(wallet.secretKey);
    return signer.sign(message);
  }

  /**
   * Get the balance of the selected wallet in SOL
   * @returns balance in SOL (as number)
   */
  async getBalance(): Promise<number> {
    const wallet = this.getSelectedWallet();
    if (!wallet) {
      throw new Error('No wallet selected');
    }
    const balance = await this.connection.getBalance(wallet.publicKey);
    return balance / 1e9; // convert lamports to SOL
  }

  /**
   * Load wallets from localStorage
   * Note: For security, we should encrypt the secret keys before storing.
   * This is a simplified version for demonstration.
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert stored data back to MultiWallet objects
        // We need to reconstruct the PublicKey and secretKey Uint8Array
        this.wallets = parsed.map((w: any) => ({
          ...w,
          publicKey: new PublicKey(w.address),
          secretKey: Uint8Array.from(w.secretKey), // assuming we stored as array of numbers
        }));
        // If no selected wallet, select the first one
        if (!this.selectedWalletId && this.wallets.length > 0) {
          this.selectedWalletId = this.wallets[0].id;
        }
      }
    } catch (e) {
      console.warn('Failed to load multi-wallets from storage', e);
      // If corrupted, start fresh
      this.wallets = [];
      this.selectedWalletId = null;
    }
  }

  /**
   * Save wallets to localStorage
   * Note: For security, we should encrypt the secret keys before storing.
   */
  private saveToStorage(): void {
    try {
      // We need to convert PublicKey to string and secretKey to array for JSON serialization
      const toStore = this.wallets.map(w => ({
        id: w.id,
        label: w.label,
        address: w.address,
        publicKey: w.publicKey.toBase58(),
        secretKey: Array.from(w.secretKey), // convert Uint8Array to array of numbers
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(toStore));
    } catch (e) {
      console.warn('Failed to save multi-wallets to storage', e);
    }
  }

  /**
   * Clear all wallets (for logout or reset)
   */
  clear(): void {
    this.wallets = [];
    this.selectedWalletId = null;
    localStorage.removeItem(this.storageKey);
  }
}

// Singleton instance
let multiWalletManagerInstance: MultiWalletManager | null = null;

/**
 * Initialize or get the multi-wallet manager
 * @param config - configuration (requires connection)
 * @returns MultiWalletManager instance
 */
export function initMultiWalletManager(config: MultiWalletConfig): MultiWalletManager {
  if (!multiWalletManagerInstance) {
    multiWalletManagerInstance = new MultiWalletManager(config);
  }
  return multiWalletManagerInstance;
}

/**
 * Get the existing multi-wallet manager instance
 * @returns MultiWalletManager instance or null if not initialized
 */
export function getMultiWalletManager(): MultiWalletManager | null {
  return multiWalletManagerInstance;
}

export type { MultiWallet, MultiWalletConfig };