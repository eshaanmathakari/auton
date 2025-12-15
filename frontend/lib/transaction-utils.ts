/**
 * Transaction Utilities
 * 
 * Helper functions for Solana transaction handling and error extraction
 */

import { Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Extract error message from wallet adapter errors
 * Wallet adapter errors can have messages in various locations
 */
export function extractWalletErrorMessage(error: any): string {
  // Check error name/type first
  const errorName = error?.name || error?.constructor?.name || '';

  // Get all properties (including non-enumerable)
  const allProps = Object.getOwnPropertyNames(error || {});
  const prototypeProps = error ? Object.getOwnPropertyNames(Object.getPrototypeOf(error)) : [];

  // Try various error message locations with more thorough checking
  const errorMessage =
    error?.error?.message ||
    error?.error?.toString() ||
    error?.message ||
    error?.cause?.message ||
    error?.cause?.toString() ||
    error?.logs?.join('\n') ||
    (allProps.includes('message') ? error.message : null) ||
    (allProps.includes('error') && error.error ? String(error.error) : null) ||
    error?.toString() ||
    String(error) ||
    (errorName ? `${errorName}: Unknown transaction error` : 'Unknown transaction error');

  return errorMessage;
}

/**
 * Get user-friendly error message from wallet adapter error
 */
export function getUserFriendlyErrorMessage(error: any): string {
  const errorMessage = extractWalletErrorMessage(error);
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('user rejected') || lowerMessage.includes('rejected')) {
    return 'Transaction was rejected. Please approve the transaction in your wallet.';
  }

  if (lowerMessage.includes('insufficient funds') || lowerMessage.includes('insufficient')) {
    return 'Insufficient funds. Please add SOL to your wallet.';
  }

  if (lowerMessage.includes('blockhash') || lowerMessage.includes('blockhash not found')) {
    return 'Transaction expired. Please try again.';
  }

  if (lowerMessage.includes('signature') && lowerMessage.includes('verification')) {
    return 'Transaction signature verification failed. Please try again.';
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('rpc')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (lowerMessage.includes('instruction 0') && lowerMessage.includes('program')) {
    return 'Program error. Check the program ID and instruction accounts.';
  }

  if (lowerMessage.includes('account in use') || lowerMessage.includes('already in use')) {
    return 'Account already exists or is in use. Please retry with a fresh account.';
  }

  if (lowerMessage.includes('too large') || lowerMessage.includes('tx too large')) {
    return 'Transaction size is too large. Try reducing instructions or accounts.';
  }

  return `Transaction failed: ${errorMessage}`;
}

/**
 * Log full error details for debugging
 */
export function logWalletError(error: any, context?: string): void {
  const errorName = error?.name || error?.constructor?.name || 'UnknownError';
  const allProps = Object.getOwnPropertyNames(error || {});
  const prototypeProps = error ? Object.getOwnPropertyNames(Object.getPrototypeOf(error)) : [];

  // Create a serializable error object
  const errorDetails: any = {
    name: errorName,
    message: error?.message,
    stack: error?.stack,
    enumerableKeys: Object.keys(error || {}),
    allPropertyNames: allProps,
    prototypeProperties: prototypeProps,
  };

  // Try to extract nested error
  if (error?.error) {
    errorDetails.nestedError = {
      name: error.error?.name || error.error?.constructor?.name,
      message: error.error?.message,
      toString: String(error.error),
    };
  }

  // Try to get error string representation
  try {
    errorDetails.errorString = String(error);
    errorDetails.errorJSON = JSON.stringify(
      error,
      (key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }
        return value;
      },
      2
    );
  } catch (e) {
    errorDetails.errorString = 'Could not stringify error';
  }

  console.error(`${context || 'Wallet'} error details:`, errorDetails);
  console.error('Raw error object:', error);
}

/**
 * Validate transaction before sending
 */
export function validateTransaction(transaction: Transaction | VersionedTransaction): {
  valid: boolean;
  error?: string;
} {
  if (!transaction) {
    return { valid: false, error: 'Transaction is null or undefined' };
  }

  // Check if transaction is a Transaction (legacy) or VersionedTransaction
  if (transaction instanceof Transaction) {
    if (!transaction.recentBlockhash) {
      return { valid: false, error: 'Transaction missing recentBlockhash' };
    }

    if (!transaction.feePayer) {
      return { valid: false, error: 'Transaction missing feePayer' };
    }

    if (transaction.instructions.length === 0) {
      return { valid: false, error: 'Transaction has no instructions' };
    }
  } else if (transaction instanceof VersionedTransaction) {
    // VersionedTransaction validation
    if (!transaction.message.recentBlockhash) {
      return { valid: false, error: 'VersionedTransaction missing recentBlockhash' };
    }

    if (transaction.message.staticAccountKeys.length === 0) {
      return { valid: false, error: 'VersionedTransaction has no accounts' };
    }
  }

  return { valid: true };
}

/**
 * Check if connection endpoint is accessible
 */
export async function verifyConnectionEndpoint(connection: any): Promise<{
  accessible: boolean;
  endpoint?: string;
  error?: string;
}> {
  try {
    const endpoint = (connection as any).rpcEndpoint || 'unknown';
    const version = await connection.getVersion();
    return {
      accessible: true,
      endpoint,
    };
  } catch (error: any) {
    return {
      accessible: false,
      error: error?.message || 'Connection verification failed',
    };
  }
}

