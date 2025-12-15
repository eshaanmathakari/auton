import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { signAndSubmitSponsoredTransaction, validateSponsoredTransaction } from '@/lib/server/sponsor'; // Using sponsor.ts for actual logic
import { loadRelayerWallet, generateNewRelayerWallet } from '@/lib/server/vault'; // For loading the relayer wallet
import * as anchor from '@coral-xyz/anchor';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Optional: Use this to generate a new relayer wallet if needed
// const relayer = generateNewRelayerWallet();
// console.log("Relayer Public Key:", relayer.publicKey.toBase58());

export async function POST(req: NextRequest) {
  try {
    const { transaction: partiallySignedTxBase64 } = await req.json();

    if (!partiallySignedTxBase64) {
      return NextResponse.json({ error: 'Missing partiallySignedTxBase64 in request body.' }, { status: 400 });
    }

    // Attempt to load the relayer wallet to ensure it's configured
    // This will throw if RELAYER_WALLET_PRIVATE_KEY is not set
    try {
      loadRelayerWallet();
    } catch (e: any) {
      console.error('Relayer wallet not configured:', e.message);
      return NextResponse.json({ 
        error: 'Relayer service is not configured.', 
        details: 'RELAYER_WALLET_PRIVATE_KEY is missing or invalid.' 
      }, { status: 500 });
    }

    // Submit the transaction for sponsorship
    const signature = await signAndSubmitSponsoredTransaction(partiallySignedTxBase64, connection);

    return NextResponse.json({
      success: true,
      signature: signature,
      message: 'Transaction sponsored and submitted successfully.',
    });

  } catch (error: any) {
    console.error('Error in sponsor relay API:', error);
    // Customize error responses based on the type of error (e.g., validation failed)
    if (error.message.includes('Transaction content is not allowed')) {
        return NextResponse.json({ error: 'Transaction validation failed.', details: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to sponsor transaction.', details: error.message }, { status: 500 });
  }
}
