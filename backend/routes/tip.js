import express from 'express';
import database from '../database.js';
import { generatePaymentRequest, verifyPayment, calculateAmounts } from '../utils/payment.js';

const router = express.Router();

// Store pending payment requests (in production, use Redis or similar)
const pendingPayments = new Map();

// GET /tip/:creatorId - Returns 402 Payment Required with payment parameters
router.get('/tip/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const amount = parseFloat(req.query.amount || '0.1'); // Default 0.1 SOL
    const assetType = req.query.assetType || 'SOL'; // SOL or USDC

    // Get or create creator
    let creator = database.getCreator(creatorId);
    
    if (!creator) {
      const walletAddress = req.query.walletAddress;
      if (!walletAddress) {
        return res.status(400).json({ 
          error: 'Creator not found. Please provide walletAddress query parameter.' 
        });
      }
      creator = database.createCreator(creatorId, walletAddress);
    }

    // Check if payment is already provided
    const paymentSignature = req.headers['x-payment'];
    
    if (paymentSignature) {
      // Verify the payment
      const paymentRequest = pendingPayments.get(paymentSignature);
      
      if (!paymentRequest) {
        return res.status(400).json({ error: 'Invalid payment signature or payment request expired' });
      }

      const verification = await verifyPayment(
        paymentSignature,
        paymentRequest.amount,
        paymentRequest.creatorWalletAddress,
        paymentRequest.assetType
      );

      if (!verification.valid) {
        return res.status(402).json({ 
          error: 'Payment verification failed',
          details: verification.error 
        });
      }

      // Payment verified - record the tip
      const amounts = calculateAmounts(paymentRequest.amount);
      const tip = database.addTip(creatorId, {
        amount: paymentRequest.amount,
        assetType: paymentRequest.assetType,
        signature: paymentSignature,
        creatorAmount: amounts.creatorAmount,
        platformFee: amounts.platformFee,
        from: paymentRequest.fromAddress || 'unknown',
      });

      // Clean up pending payment
      pendingPayments.delete(paymentSignature);

      return res.json({
        success: true,
        message: 'Payment verified and tip recorded',
        tip: {
          id: tip.id,
          amount: tip.amount,
          assetType: tip.assetType,
          signature: tip.signature,
          timestamp: tip.timestamp,
        },
        transactionUrl: `https://explorer.solana.com/tx/${paymentSignature}?cluster=devnet`,
      });
    }

    // Generate payment request
    const paymentRequest = generatePaymentRequest(
      creator.walletAddress,
      amount,
      assetType
    );

    // Store payment request temporarily (expires in 10 minutes)
    const paymentId = paymentRequest.paymentId;
    pendingPayments.set(paymentId, {
      paymentId,
      amount,
      assetType,
      creatorWalletAddress: creator.walletAddress,
      timestamp: Date.now(),
    });

    // Return 402 Payment Required with payment parameters
    res.status(402)
      .set({
        'X-Payment-Required': 'true',
        'X-Payment-Id': paymentId,
        'X-Max-Amount': paymentRequest.maxAmountRequired,
        'X-Asset-Type': paymentRequest.assetType,
        'X-Asset-Address': paymentRequest.assetAddress || '',
        'X-Payment-Address': paymentRequest.paymentAddress,
        'X-Platform-Fee': paymentRequest.platformFee,
        'X-Creator-Amount': paymentRequest.creatorAmount,
        'X-Network': paymentRequest.network,
        'X-Nonce': paymentRequest.nonce,
      })
      .json({
        error: 'Payment Required',
        paymentRequest: {
          maxAmountRequired: paymentRequest.maxAmountRequired,
          assetType: paymentRequest.assetType,
          assetAddress: paymentRequest.assetAddress,
          paymentAddress: paymentRequest.paymentAddress,
          platformFee: paymentRequest.platformFee,
          creatorAmount: paymentRequest.creatorAmount,
          network: paymentRequest.network,
          nonce: paymentRequest.nonce,
          paymentId: paymentRequest.paymentId,
        },
        message: 'Please submit payment with X-Payment header containing transaction signature',
      });
  } catch (error) {
    console.error('Error in /tip endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /tip/:creatorId - Alternative endpoint for payment submission
router.post('/tip/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { signature, paymentId, fromAddress } = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Transaction signature required' });
    }

    // Get creator
    const creator = database.getCreator(creatorId);
    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Get payment request
    const paymentRequest = pendingPayments.get(paymentId);
    if (!paymentRequest) {
      return res.status(400).json({ error: 'Invalid or expired payment request' });
    }

    // Verify payment
    const verification = await verifyPayment(
      signature,
      paymentRequest.amount,
      paymentRequest.creatorWalletAddress,
      paymentRequest.assetType
    );

    if (!verification.valid) {
      return res.status(402).json({ 
        error: 'Payment verification failed',
        details: verification.error 
      });
    }

    // Payment verified - record the tip
    const amounts = calculateAmounts(paymentRequest.amount);
    const tip = database.addTip(creatorId, {
      amount: paymentRequest.amount,
      assetType: paymentRequest.assetType,
      signature,
      creatorAmount: amounts.creatorAmount,
      platformFee: amounts.platformFee,
      from: fromAddress || 'unknown',
    });

    // Clean up pending payment
    pendingPayments.delete(paymentId);

    return res.json({
      success: true,
      message: 'Payment verified and tip recorded',
      tip: {
        id: tip.id,
        amount: tip.amount,
        assetType: tip.assetType,
        signature: tip.signature,
        timestamp: tip.timestamp,
      },
      transactionUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
  } catch (error) {
    console.error('Error in POST /tip endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;

