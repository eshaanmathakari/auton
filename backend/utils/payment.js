import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '0');

const connection = new Connection(RPC_URL, 'confirmed');

// Generate payment request parameters for x402 protocol
export function generatePaymentRequest(creatorWalletAddress, amount, assetType = 'SOL') {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const paymentId = crypto.randomUUID();
  
  // Calculate platform fee (4%)
  const platformFee = (amount * PLATFORM_FEE_PERCENTAGE) / 100;
  const creatorAmount = amount - platformFee;

  // For SOL, assetAddress is empty. For USDC, it would be the USDC mint address
  const assetAddress = assetType === 'USDC' 
    ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC Devnet mint
    : '';

  return {
    maxAmountRequired: amount.toString(),
    assetType,
    assetAddress,
    paymentAddress: creatorWalletAddress,
    platformFeeAddress: process.env.PLATFORM_WALLET_ADDRESS || '',
    platformFee: platformFee.toString(),
    creatorAmount: creatorAmount.toString(),
    network: 'devnet',
    nonce,
    paymentId,
    timestamp: Date.now(),
  };
}

// Verify payment transaction signature
export async function verifyPayment(signature, expectedAmount, expectedRecipient, assetType = 'SOL') {
  try {
    // Get transaction details from Solana
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (!tx.meta) {
      return { valid: false, error: 'Transaction metadata not available' };
    }

    if (tx.meta.err) {
      return { valid: false, error: `Transaction failed: ${tx.meta.err}` };
    }

    // Verify the transaction was successful
    const recipientPubkey = new PublicKey(expectedRecipient);
    
    // Check balance changes to verify payment
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    const preTokenBalances = tx.meta.preTokenBalances || [];
    const postTokenBalances = tx.meta.postTokenBalances || [];

    if (assetType === 'SOL') {
      // Find the account index for the recipient
      const accountKeys = tx.transaction.message.accountKeys.map(key => 
        typeof key === 'object' ? key.pubkey.toString() : key.toString()
      );
      
      const recipientIndex = accountKeys.findIndex(key => key === expectedRecipient);
      
      if (recipientIndex === -1) {
        return { valid: false, error: 'Recipient not found in transaction' };
      }

      const balanceChange = postBalances[recipientIndex] - preBalances[recipientIndex];
      const expectedLamports = expectedAmount * 1e9; // Convert SOL to lamports

      // Allow some tolerance for fees
      if (balanceChange < expectedLamports * 0.95) {
        return { valid: false, error: `Insufficient payment. Expected ${expectedAmount} SOL, received ${balanceChange / 1e9} SOL` };
      }
    } else if (assetType === 'USDC') {
      // For token transfers, check token balance changes
      const recipientTokenBalance = postTokenBalances.find(
        balance => balance.owner === expectedRecipient
      );

      if (!recipientTokenBalance) {
        return { valid: false, error: 'Token transfer not found' };
      }

      const balanceChange = recipientTokenBalance.uiTokenAmount.uiAmount;
      const expectedAmountDecimal = parseFloat(expectedAmount);

      if (balanceChange < expectedAmountDecimal * 0.95) {
        return { valid: false, error: `Insufficient payment. Expected ${expectedAmount} USDC, received ${balanceChange} USDC` };
      }
    }

    return {
      valid: true,
      transaction: tx,
      signature,
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Calculate amounts with platform fee
export function calculateAmounts(totalAmount) {
  const platformFee = (totalAmount * PLATFORM_FEE_PERCENTAGE) / 100;
  const creatorAmount = totalAmount - platformFee;
  
  return {
    totalAmount,
    platformFee,
    creatorAmount,
    platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
  };
}
