"use client"

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AutonProgram } from '@/lib/anchor/auton_program';
import IDL from '@/lib/anchor/auton_program.json';
import { ArrowLeft, Lock, CheckCircle, AlertCircle, Info, Zap, Image as ImageIcon, Video, Download } from 'lucide-react';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;
const IPFS_GATEWAY_URL = 'https://ipfs.io/ipfs/';

if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set in environment variables.');
}

const programId = new PublicKey(AUTON_PROGRAM_ID);

type ContentItem = {
  id: anchor.BN;
  title: string;
  price: anchor.BN;
  encryptedCid: number[];
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
  const { publicKey, connected, sendTransaction } = useWallet();
  const [creatorAccount, setCreatorAccount] = useState<CreatorAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [decryptedCids, setDecryptedCids] = useState<Map<number, string>>(new Map());
  const [contentTypes, setContentTypes] = useState<Map<number, string>>(new Map());
  const [paymentProcessing, setPaymentProcessing] = useState<Map<number, boolean>>(new Map());

  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);
  const provider = useMemo(() => {
    // Create a dummy wallet for read-only operations
    const dummyWallet = {
      publicKey: anchor.web3.Keypair.generate().publicKey,
      signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
      signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => tx,
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

  if (!creatorPubkey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Invalid creator id.</p>
      </div>
    );
  }

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

  // If the page is opened with ?focus=<contentId>, auto-attempt unlock/display
  const searchParams = useSearchParams();
  const [autoFocused, setAutoFocused] = useState<number | null>(null);

  useEffect(() => {
    const focus = searchParams?.get('focus');
    if (!focus) return;
    const id = Number(focus);
    if (!id || !creatorAccount) return;

    // Prevent repeated attempts
    if (autoFocused === id) return;

    const item = creatorAccount.content.find((c) => (c.id as anchor.BN).toNumber() === id);
    if (item) {
      // Try to unlock the item (this will handle payments if needed)
      // Delay slightly to ensure UI is ready
      setTimeout(() => handleUnlockContent(item), 300);
      setAutoFocused(id);
    }
  }, [searchParams, creatorAccount, autoFocused]);

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

  const fetchContentType = async (item: ContentItem, cid: string) => {
    try {
      const response = await fetch(`${IPFS_GATEWAY_URL}${cid}`, { method: 'HEAD' });
      if (response.ok) {
        const contentType = response.headers.get('Content-Type');
        if (contentType) {
          setContentTypes(prev => new Map(prev).set(item.id.toNumber(), contentType));
        }
      }
    } catch (err) {
      console.error('Failed to fetch content type:', err);
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
        const accessResponse = await fetch(
          `/api/content/${creatorPubkey.toBase58()}/${contentItem.id.toNumber()}/access?buyerPubkey=${publicKey?.toBase58?.()}`
        );

      if (accessResponse.status === 402) {
        const { paymentDetails }: { paymentDetails: PaymentDetails } = await accessResponse.json();

        if (!creatorAccountPDA) throw new Error('Creator account PDA not found');

        const [paidAccessPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("access"),
            publicKey.toBuffer(),
            new anchor.BN(contentItem.id.toNumber()).toArrayLike(Buffer, "le", 8),
          ],
          program.programId
        );

        const ix = await program.methods
          .processPayment(new anchor.BN(contentItem.id.toNumber()))
          .accounts({
            paidAccessAccount: paidAccessPDA,
            creatorAccount: creatorAccountPDA,
            creatorWallet: new PublicKey(paymentDetails.creatorWalletAddress),
            buyer: publicKey,
            systemProgram: SystemProgram.programId,
          } as any)
          .instruction();
        
        const transaction = new Transaction().add(ix);

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, 'confirmed');

        setSuccess('Payment confirmed! Retrieving content...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await handleUnlockContent(contentItem);
      } else if (accessResponse.ok) {
        const { ipfsCid }: { ipfsCid: string } = await accessResponse.json();
        setDecryptedCids(prev => new Map(prev).set(contentItem.id.toNumber(), ipfsCid));
        setSuccess('Content unlocked! Determining content type...');
        await fetchContentType(contentItem, ipfsCid);
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

  const renderUnlockedContent = (item: ContentItem) => {
    const cid = decryptedCids.get(item.id.toNumber());
    const contentType = contentTypes.get(item.id.toNumber());
    const url = `${IPFS_GATEWAY_URL}${cid}`;

    if (!cid) return null;

    if (!contentType) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      );
    }

    if (contentType.startsWith('image/')) {
      return (
        <div className="relative group">
          <img
            src={url}
            alt={item.title}
            className="w-full h-64 object-cover rounded-lg"
          />
          <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Unlocked
          </div>
        </div>
      );
    }

    if (contentType.startsWith('video/')) {
      return (
        <div className="relative">
          <video
            controls
            src={url}
            className="w-full h-64 object-cover rounded-lg"
          />
          <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Unlocked
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <Download className="w-12 h-12 text-purple-600" />
        <a
          href={url}
          download
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
        >
          <Download className="w-4 h-4" />
          Download File
        </a>
        <p className="text-xs text-gray-500 dark:text-gray-400">({contentType})</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">Loading creator content...</p>
        </div>
      </div>
    );
  }

  if (error && !creatorAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          <Link href="/" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Creator Hub
          </Link>
        </div>
      </div>
    );
  }

  if (!creatorAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="text-center space-y-4">
          <Info className="w-16 h-16 text-gray-400 mx-auto" />
          <p className="text-gray-600 dark:text-gray-300">No content found for this creator.</p>
          <Link href="/" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Creator Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Creator Hub
          </Link>
          <WalletMultiButton />
        </div>

        {/* Creator Info Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 mb-8 border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-4xl font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                Creator: 
                <code className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg font-mono text-2xl">
                  {creatorPubkey.toBase58().slice(0, 8)}...{creatorPubkey.toBase58().slice(-8)}
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 px-4 py-2 rounded-full">
              <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                {creatorAccount.content.length} items available
              </span>
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        {success && (
          <div className="mb-6 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-6 py-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700 dark:text-green-300 font-medium">{success}</p>
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-6 py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-amber-50 dark:bg-amber-900/20 backdrop-blur-sm rounded-xl border border-amber-200 dark:border-amber-800 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">No-Refund Policy</h3>
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                  Blockchain payments are final and cannot be reversed. Please review content details carefully before unlocking.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 backdrop-blur-sm rounded-xl border border-blue-200 dark:border-blue-800 p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">How It Works</h3>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 leading-relaxed">
                  <li>1. Connect your Solana wallet</li>
                  <li>2. Click "Unlock" on desired content</li>
                  <li>3. Approve the transaction</li>
                  <li>4. Access your content instantly</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creatorAccount.content.map((item) => {
            const isUnlocked = decryptedCids.has(item.id.toNumber());
            const isProcessing = paymentProcessing.get(item.id.toNumber());

            return (
              <div
                key={item.id.toNumber()}
                className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200/50 dark:border-gray-700/50"
              >
                {/* Content Preview/Display */}
                <div className="relative h-64 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30">
                  {isUnlocked ? (
                    renderUnlockedContent(item)
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center space-y-3">
                        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-4 rounded-full mx-auto w-fit">
                          <Lock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Locked Content</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content Info */}
                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                    {item.title}
                  </h2>

                  {/* Price and Creator */}
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white bg-clip-text text-transparent">
                        {item.price.toNumber() / anchor.web3.LAMPORTS_PER_SOL}
                      </span>
                      <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">SOL</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>Direct to creator</span>
                      <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">
                        {creatorAccount.creatorWallet.toBase58().slice(0, 4)}...
                        {creatorAccount.creatorWallet.toBase58().slice(-4)}
                      </code>
                    </div>
                  </div>

                  {/* Action Button */}
                  {!isUnlocked && (
                    <button
                      onClick={() => handleUnlockContent(item)}
                      disabled={!connected || isProcessing}
                      className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 text-white font-semibold hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      {!connected ? (
                        <>
                          <Lock className="w-4 h-4" />
                          Connect Wallet to Unlock
                        </>
                      ) : isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Unlock for {item.price.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
