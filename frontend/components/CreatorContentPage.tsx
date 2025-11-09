"use client"

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AutonProgram } from '@/lib/anchor/auton_program';
import IDL from '@/lib/anchor/auton_program.json';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;
const IPFS_GATEWAY_URL = 'https://ipfs.io/ipfs/'; // Or your preferred gateway

if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set in environment variables.');
}

const programId = new PublicKey(AUTON_PROGRAM_ID);

type ContentItem = {
  id: anchor.BN;
  title: string;
  price: anchor.BN;
  encryptedCid: number[]; // Stored as number[] from Anchor
};

type CreatorAccountData = {
  creatorWallet: PublicKey;
  lastContentId: anchor.BN;
  content: ContentItem[];
};

type PaymentDetails = {
  price: number;
  assetType: string;
  creatorWalletAddress: string;
  contentId: number;
};

type CreatorContentPageProps = {
    creatorId: string;
};

export default function CreatorContentPage({ creatorId }: CreatorContentPageProps) {
//   const params = useParams();
//   const creatorId = params.creatorId as string;

  const { publicKey, connected, sendTransaction } = useWallet();
  const [creatorAccount, setCreatorAccount] = useState<CreatorAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [decryptedCids, setDecryptedCids] = useState<Map<number, string>>(new Map());
  const [paymentProcessing, setPaymentProcessing] = useState<Map<number, boolean>>(new Map());

  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);
  const provider = useMemo(() => {
    // Create a dummy wallet for read-only operations
    const dummyWallet = {
      publicKey: anchor.web3.Keypair.generate().publicKey,
      signAllTransactions: async (txs: anchor.web3.Transaction[]) => txs,
      signTransaction: async (tx: anchor.web3.Transaction) => tx,
    };
    return new anchor.AnchorProvider(connection, dummyWallet, {
      commitment: 'confirmed',
    });
  }, [connection]);

  const program = useMemo(() => {
    if (provider && programId) {
      return new anchor.Program<AutonProgram>(IDL as AutonProgram, provider);
    }
    return null;
  }, [provider]);

  const creatorPubkey = useMemo(() => {
    if (!creatorId) return null;
    try {
      return new PublicKey(creatorId);
    } catch {
      return null;
    }
  }, [creatorId]);

  const creatorAccountPDA = useMemo(() => {
    if (!creatorPubkey || !programId) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), creatorPubkey.toBuffer()],
      programId
    );
    return pda;
  }, [creatorPubkey]);

  useEffect(() => {
    if (program && creatorAccountPDA) {
      fetchCreatorContent();
    }
  }, [program, creatorAccountPDA]);

  const fetchCreatorContent = async () => {
    if (!program || !creatorAccountPDA) return;
    setLoading(true);
    setError('');
    try {
      const account = await program.account.creatorAccount.fetch(creatorAccountPDA);
      setCreatorAccount(account);
    } catch (err: any) {
      console.error('Failed to fetch creator account:', err);
      setError('Creator account not found or failed to load content.');
      setCreatorAccount(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockContent = async (contentItem: ContentItem) => {
    if (!publicKey || !connected || !program) {
      setError('Connect your wallet to unlock content.');
      return;
    }
    if (paymentProcessing.get(contentItem.id.toNumber())) return;

    setPaymentProcessing(prev => new Map(prev).set(contentItem.id.toNumber(), true));
    setError('');
    setSuccess('');

    try {
      // 1. Request access from backend (x402-style)
      const accessResponse = await fetch(
        `/api/content/${creatorPubkey.toBase58()}/${contentItem.id.toNumber()}/access?buyerPubkey=${publicKey.toBase58()}`
      );

      if (accessResponse.status === 402) {
        // Payment Required - build and send Solana transaction
        const { paymentDetails }: { paymentDetails: PaymentDetails } = await accessResponse.json();

        // Derive PDA for PaidAccessAccount to include in transaction
        const [paidAccessPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("access"),
            publicKey.toBuffer(),
            new anchor.BN(contentItem.id.toNumber()).toArrayLike(Buffer, "le", 8),
          ],
          program.programId
        );

        // Build the Anchor instruction
        const ix = await program.methods
          .processPayment(new anchor.BN(contentItem.id.toNumber()))
          .accounts({
            paidAccessAccount: paidAccessPDA,
            creatorAccount: creatorAccountPDA,
            creatorWallet: new PublicKey(paymentDetails.creatorWalletAddress),
            buyer: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        
        const transaction = new Transaction().add(ix);

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, 'confirmed');

        setSuccess('Payment confirmed! Attempting to retrieve content...');
        // After successful payment, retry access request
        await new Promise(resolve => setTimeout(resolve, 2000)); // Give Solana time to propagate
        await handleUnlockContent(contentItem); // Recursive call to get CID
      } else if (accessResponse.ok) {
        // Access Granted - retrieve decrypted CID
        const { ipfsCid }: { ipfsCid: string } = await accessResponse.json();
        setDecryptedCids(prev => new Map(prev).set(contentItem.id.toNumber(), ipfsCid));
        setSuccess('Content unlocked!');
      } else {
        const errData = await accessResponse.json();
        throw new Error(errData.error || 'Failed to get access.');
      }
    } catch (err: any) {
      console.error('Unlock content error:', err);
      setError(err.message || 'Failed to unlock content.');
    } finally {
      setPaymentProcessing(prev => new Map(prev).set(contentItem.id.toNumber(), false));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300">Loading creator content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!creatorAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300">No content found for this creator.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <Link href="/" className="text-sm text-purple-600 hover:underline">
          ← Back to Creator Hub
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4">
          Content from {creatorPubkey.toBase58().slice(0, 8)}...
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Explore and unlock exclusive content.
        </p>

        <div className="mb-6 mt-4">
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
        </div>

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 space-y-2 mb-4">
            <p>{success}</p>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {creatorAccount.content.map((item) => (
            <div
              key={item.id.toNumber()}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-4"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{item.title}</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Price: {item.price.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL
              </p>

              {decryptedCids.has(item.id.toNumber()) ? (
                <div className="space-y-2">
                  <p className="text-green-600 dark:text-green-400 font-medium">Access Granted!</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 break-all">
                    IPFS CID: <a href={`${IPFS_GATEWAY_URL}${decryptedCids.get(item.id.toNumber())}`} target="_blank" rel="noopener noreferrer" className="underline text-blue-500">{decryptedCids.get(item.id.toNumber())}</a>
                  </p>
                  <button
                    onClick={() => window.open(`${IPFS_GATEWAY_URL}${decryptedCids.get(item.id.toNumber())}`, '_blank')}
                    className="w-full rounded-lg bg-blue-600 py-2 text-white font-semibold hover:bg-blue-700"
                  >
                    View Content
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleUnlockContent(item)}
                  disabled={!connected || paymentProcessing.get(item.id.toNumber())}
                  className="w-full rounded-lg bg-purple-600 py-2 text-white font-semibold hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {paymentProcessing.get(item.id.toNumber()) ? 'Processing...' : `Unlock for ${item.price.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL`}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
