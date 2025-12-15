import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AutonProgram } from '@/lib/anchor/auton_program'; // Adjust path as needed
import IDL from '@/lib/anchor/auton_program.json'; // Adjust path as needed
import { createDecipheriv } from 'crypto';

const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;

if (!ENCRYPTION_SECRET_KEY || ENCRYPTION_SECRET_KEY.length !== 64) {
  throw new Error('ENCRYPTION_SECRET_KEY is not set or is not 32 bytes (64 hex characters).');
}
if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set.');
}

const encryptionKeyBuffer = Buffer.from(ENCRYPTION_SECRET_KEY, 'hex');
const programId = new PublicKey(AUTON_PROGRAM_ID);

// Decryption function (matches test implementation)
function decryptCID(encryptedDataHex: string): string {
  const encryptedData = Buffer.from(encryptedDataHex, 'hex');
  const nonce = encryptedData.subarray(0, 12);
  const authTag = encryptedData.subarray(encryptedData.length - 16);
  const encrypted = encryptedData.subarray(12, encryptedData.length - 16);
  
  const decipher = createDecipheriv('chacha20-poly1305', encryptionKeyBuffer, nonce, {
    authTagLength: 16,
  });
  decipher.setAuthTag(authTag);
  
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string; contentId: string }> }
) {
  try {
    // Await params since it's a Promise in Next.js 15
    const { creatorId, contentId } = await params;
    const buyerPubkeyStr = req.nextUrl.searchParams.get('buyerPubkey');

    if (!buyerPubkeyStr) {
      return NextResponse.json({ error: 'buyerPubkey is required' }, { status: 400 });
    }

    const buyerPubkey = new PublicKey(buyerPubkeyStr);
    const contentIdNum = new anchor.BN(contentId).toNumber();

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const provider = new anchor.AnchorProvider(connection, {
      publicKey: Keypair.generate().publicKey,
      signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
      signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => tx,
    }, {
      commitment: 'confirmed',
    });
    // Explicitly pass programId to ensure it matches environment variable
    const program = new anchor.Program<AutonProgram>(IDL as AutonProgram, provider);

    // Resolve creatorId (Wallet or Username)
    let creatorPubkey: PublicKey;
    try {
      creatorPubkey = new PublicKey(creatorId);
    } catch {
      // It's a username, look up the wallet
      const [usernamePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("username"), Buffer.from(creatorId)],
        programId
      );
      try {
        const usernameAccount = await program.account.usernameAccount.fetch(usernamePDA);
        creatorPubkey = usernameAccount.authority;
      } catch (e) {
        return NextResponse.json({ error: `Creator username @${creatorId} not found` }, { status: 404 });
      }
    }

    // 1. Check for PaidAccessAccount (receipt)
    const [paidAccessPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("access"),
        buyerPubkey.toBuffer(),
        new anchor.BN(contentIdNum).toArrayLike(Buffer, "le", 8),
      ],
      programId
    );

    let hasAccess = false;
    try {
      await program.account.paidAccessAccount.fetch(paidAccessPDA);
      hasAccess = true;
    } catch (e) {
      // Account not found, means no access
      hasAccess = false;
    }

    // 2. Fetch CreatorAccount to get content details (price, encrypted CID)
    const [creatorAccountPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("creator"),
        creatorPubkey.toBuffer()
      ],
      programId
    );
    const creatorAccount = await program.account.creatorAccount.fetch(creatorAccountPDA);
    const contentItem = creatorAccount.content.find(item => item.id.toNumber() === contentIdNum);

    if (!contentItem) {
      return NextResponse.json({ error: 'Content not found for this creator' }, { status: 404 });
    }

    if (hasAccess) {
      // User has paid, decrypt and return the IPFS CID
      const decryptedCid = decryptCID(Buffer.from(contentItem.encryptedCid).toString('hex'));
      return NextResponse.json({ ipfsCid: decryptedCid });
    } else {
      // User has not paid, return 402 Payment Required
      const headers = {
        'X-Payment-Required': 'true',
        'X-Content-Price': contentItem.price.toString(),
        'X-Creator-Wallet': creatorAccount.creatorWallet.toBase58(),
        'X-Content-Id': contentItem.id.toString(),
      };

      return NextResponse.json(
        {
          error: 'Payment Required',
          paymentDetails: {
            price: contentItem.price.toNumber(),
            assetType: 'SOL', // Assuming SOL for now
            creatorWalletAddress: creatorAccount.creatorWallet.toBase58(),
            contentId: contentItem.id.toNumber(),
          },
        },
        { status: 402, headers }
      );
    }
  } catch (error: any) {
    console.error('Error in /api/content/[creatorId]/[contentId]/access:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}