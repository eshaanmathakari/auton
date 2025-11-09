
import { NextRequest, NextResponse } from 'next/server';
import database from '../../../../lib/database';
import { generatePaymentRequest, verifyPayment, calculateAmounts } from '../../../../lib/utils/payment';

// NOTE: This in-memory store is not suitable for production in a serverless environment.
// Each API route invocation is stateless. This should be replaced with a persistent
// store like Redis, or a database, to track pending payments across requests.
const pendingPayments = new Map();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const { creatorId } = await params;
    const amount = parseFloat(req.nextUrl.searchParams.get('amount') || '0.1');
    const assetType = req.nextUrl.searchParams.get('assetType') || 'SOL';

    let creator = database.getCreator(creatorId);
    
    if (!creator) {
      const walletAddress = req.nextUrl.searchParams.get('walletAddress');
      if (!walletAddress) {
        return NextResponse.json({ 
          error: 'Creator not found. Please provide walletAddress query parameter.' 
        }, { status: 400 });
      }
      creator = database.createCreator(creatorId, walletAddress);
    }

    const paymentSignature = req.headers.get('x-payment');
    
    if (paymentSignature) {
      const paymentRequest = pendingPayments.get(paymentSignature);
      
      if (!paymentRequest) {
        return NextResponse.json({ error: 'Invalid payment signature or payment request expired' }, { status: 400 });
      }

      const verification = await verifyPayment(
        paymentSignature,
        paymentRequest.amount,
        paymentRequest.creatorWalletAddress,
        paymentRequest.assetType
      );

      if (!verification.valid) {
        return NextResponse.json({ 
          error: 'Payment verification failed',
          details: verification.error 
        }, { status: 402 });
      }

      const amounts = calculateAmounts(paymentRequest.amount);
      const tip = database.addTip(creatorId, {
        amount: paymentRequest.amount,
        assetType: paymentRequest.assetType,
        signature: paymentSignature,
        creatorAmount: amounts.creatorAmount,
        platformFee: amounts.platformFee,
        from: paymentRequest.fromAddress || 'unknown',
      });

      pendingPayments.delete(paymentSignature);

      return NextResponse.json({
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

    const paymentRequest = generatePaymentRequest(
      creator.walletAddress,
      amount,
      assetType
    );

    const paymentId = paymentRequest.paymentId;
    pendingPayments.set(paymentId, {
      paymentId,
      amount,
      assetType,
      creatorWalletAddress: creator.walletAddress,
      timestamp: Date.now(),
    });

    const headers = {
      'X-Payment-Required': 'true',
      'X-Payment-Id': paymentId,
      'X-Max-Amount': paymentRequest.maxAmountRequired.toString(),
      'X-Asset-Type': paymentRequest.assetType,
      'X-Asset-Address': paymentRequest.assetAddress || '',
      'X-Payment-Address': paymentRequest.paymentAddress,
      'X-Platform-Fee': paymentRequest.platformFee.toString(),
      'X-Creator-Amount': paymentRequest.creatorAmount.toString(),
      'X-Network': paymentRequest.network,
      'X-Nonce': paymentRequest.nonce,
    };

    return NextResponse.json({
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
    }, { status: 402, headers });
  } catch (error: any) {
    console.error('Error in /api/tip/[creatorId] GET:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const { creatorId } = await params;
    const { signature, paymentId, fromAddress } = await req.json();

    if (!signature) {
      return NextResponse.json({ error: 'Transaction signature required' }, { status: 400 });
    }

    const creator = database.getCreator(creatorId);
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    const paymentRequest = pendingPayments.get(paymentId);
    if (!paymentRequest) {
      return NextResponse.json({ error: 'Invalid or expired payment request' }, { status: 400 });
    }

    const verification = await verifyPayment(
      signature,
      paymentRequest.amount,
      paymentRequest.creatorWalletAddress,
      paymentRequest.assetType
    );

    if (!verification.valid) {
      return NextResponse.json({ 
        error: 'Payment verification failed',
        details: verification.error 
      }, { status: 402 });
    }

    const amounts = calculateAmounts(paymentRequest.amount);
    const tip = database.addTip(creatorId, {
      amount: paymentRequest.amount,
      assetType: paymentRequest.assetType,
      signature,
      creatorAmount: amounts.creatorAmount,
      platformFee: amounts.platformFee,
      from: fromAddress || 'unknown',
    });

    pendingPayments.delete(paymentId);

    return NextResponse.json({
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
  } catch (error: any) {
    console.error('Error in /api/tip/[creatorId] POST:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
