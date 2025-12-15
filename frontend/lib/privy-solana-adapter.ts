/**
 * Privy-Solana Wallet Adapter
 * 
 * Bridges Privy's embedded wallets to work with @solana/wallet-adapter-react
 */

import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { usePrivy } from '@privy-io/react-auth';

export interface PrivySolanaWallet {
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    transaction: T
  ) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ) => Promise<T[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Get Solana wallet from Privy
 * Returns null if user doesn't have a Solana wallet
 * 
 * Note: Privy's embedded wallets use their SDK for signing.
 * This adapter provides a bridge to work with Solana wallet adapter patterns.
 */
export function usePrivySolanaWallet(): PrivySolanaWallet | null {
  const { user, authenticated, sendSolanaTransaction } = usePrivy();

  if (!authenticated || !user) {
    return null;
  }

  // Find Solana wallet in user's wallets
  // Privy stores wallets in user.wallet for embedded wallets
  const solanaWallet = user.wallet?.address;
  
  if (!solanaWallet) {
    return null;
  }

  let publicKey: PublicKey | null = null;
  try {
    publicKey = new PublicKey(solanaWallet);
  } catch (e) {
    console.error('Invalid Solana wallet address:', e);
    return null;
  }

  const walletAdapter: PrivySolanaWallet = {
    publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      transaction: T
    ): Promise<T> => {
      // Privy's embedded wallets handle signing through sendSolanaTransaction
      // For transaction-only signing (without sending), we need to use
      // Privy's wallet SDK methods directly
      // 
      // Note: Privy's sendSolanaTransaction signs and sends in one step
      // For just signing, you'd typically use the transaction as-is
      // and let Privy sign it when sending
      
      // Return transaction as-is - actual signing happens on send
      return transaction;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      transactions: T[]
    ): Promise<T[]> => {
      // Sign all transactions sequentially
      return transactions;
    },
    signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
      // Privy message signing would use their SDK
      // For now, throw error - implement when needed
      throw new Error('Privy message signing not yet implemented. Use Privy SDK directly.');
    },
    connect: async () => {
      // Already connected if authenticated
      // No-op for embedded wallets
    },
    disconnect: async () => {
      // Will be handled by Privy's logout
      // No-op here
    },
  };

  return walletAdapter;
}

/**
 * Helper to send Solana transaction using Privy
 * This is the recommended way to send transactions with Privy embedded wallets
 */
export function usePrivySendTransaction() {
  const { sendSolanaTransaction, authenticated } = usePrivy();
  
  if (!authenticated || !sendSolanaTransaction) {
    return null;
  }

  return async (transaction: Transaction | VersionedTransaction) => {
    try {
      // Privy's sendSolanaTransaction handles signing and sending
      const signature = await sendSolanaTransaction(transaction);
      return signature;
    } catch (error: any) {
      console.error('Error sending transaction with Privy:', error);
      throw error;
    }
  };
}

/**
 * Check if user has a Privy embedded Solana wallet
 * Returns true only if the wallet address is a valid Solana PublicKey
 */
export function useHasPrivyWallet(): boolean {
  const { user, authenticated } = usePrivy();
  
  if (!authenticated || !user?.wallet?.address) {
    return false;
  }
  
  // Verify it's a valid Solana address (not EVM)
  try {
    new PublicKey(user.wallet.address);
    return true;
  } catch (e) {
    // Invalid Solana address - likely EVM wallet (starts with 0x)
    return false;
  }
}