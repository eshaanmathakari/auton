'use client';

import { useEffect, useState, useMemo } from 'react';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import IDL from '@/lib/anchor/auton_program.json';
import { AutonProgram } from '@/lib/anchor/auton_program';
import { Download } from 'lucide-react';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;
const IPFS_GATEWAY_URL = 'https://ipfs.io/ipfs/';

if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set');
}

const programId = new PublicKey(AUTON_PROGRAM_ID);

type PurchaseItem = {
  creator: string;
  contentId: number;
  ipfsCid?: string;
  pda: string;
};

export function MyPurchases() {
  const { publicKey } = useWallet();
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentData, setContentData] = useState<Map<string, { cid: string }>>(new Map());
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());

  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);

  const provider = useMemo(() => {
    const dummyWallet = {
      publicKey: anchor.web3.Keypair.generate().publicKey,
      signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(
        txs: T[]
      ): Promise<T[]> => txs,
      signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => tx,
    };
    return new anchor.AnchorProvider(connection, dummyWallet, {
      commitment: 'confirmed',
    });
  }, [connection]);

  const program = useMemo(() => {
    try {
      if (provider && programId) {
        const idl = IDL as anchor.Idl;
        return new anchor.Program(idl, provider) as anchor.Program<AutonProgram>;
      }
    } catch (error) {
      console.error('Failed to initialize program:', error);
    }
    return null;
  }, [provider]);

  useEffect(() => {
    if (!publicKey || !program) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Query all PaidAccessAccount PDAs where the buyer matches
        const buyerFilter = [
          {
            memcmp: {
              offset: 8,
              bytes: publicKey.toBase58(),
            },
          },
        ];

        const receipts = await program.account.paidAccessAccount.all(buyerFilter);
        const resolved: PurchaseItem[] = [];

        // Fetch all CreatorAccount PDAs so we can map contentId -> creator and CID
        const creators = await program.account.creatorAccount.all();

        for (const receipt of receipts) {
          const contentId =
            receipt.account.contentId?.toNumber?.() ||
            Number((receipt.account as any).contentId);

          const buyerAddr = receipt.account.buyer?.toBase58?.() || String((receipt.account as any).buyer);

          if (!contentId) continue;

          // Try to find the creator account that contains this contentId
          let ipfsCid: string | undefined;
          let creatorAddr = '';

          try {
            for (const ca of creators) {
              const items = (ca.account as any).content || [];
              const match = items.find((it: any) => {
                const id = it.id?.toNumber?.() || Number(it.id);
                return id === contentId;
              });
              if (match) {
                // Creator wallet stored on the CreatorAccount struct
                const creatorWallet = (ca.account as any).creatorWallet || (ca.account as any).creator_wallet;
                creatorAddr = creatorWallet?.toBase58?.() || String(creatorWallet) || ca.publicKey.toBase58();

                const encrypted = match.encrypted_cid || match.encryptedCid || match.encryptedCid?.toString?.() || match.encrypted_cid?.toString?.();
                if (encrypted) {
                  // If it's bytes/Buffer, convert to utf8 string
                  try {
                    if (typeof encrypted === 'string') ipfsCid = encrypted;
                    else if (Buffer.isBuffer(encrypted)) ipfsCid = encrypted.toString('utf8');
                    else ipfsCid = String(encrypted);
                  } catch (e) {
                    ipfsCid = String(encrypted);
                  }
                }

                break;
              }
            }
          } catch (err) {
            console.debug(`Error searching creator accounts for contentId ${contentId}:`, err);
          }

          resolved.push({
            creator: creatorAddr || buyerAddr || receipt.publicKey.toBase58(),
            contentId,
            ipfsCid,
            pda: receipt.publicKey.toBase58(),
          });
        }

        setPurchases(resolved);
        
        // Auto-fetch content for all purchases
        for (const item of resolved) {
          const key = `${item.creator}-${item.contentId}`;
          if (!contentData.has(key)) {
            try {
              const res = await fetch(
                `/api/content/${item.creator}/${item.contentId}/access?buyerPubkey=${publicKey?.toBase58?.()}`
              );
              if (res.ok) {
                const { ipfsCid } = await res.json();
                setContentData(prev => new Map(prev).set(key, { cid: ipfsCid }));
              }
            } catch (err) {
              console.debug(`Failed to fetch content for ${key}:`, err);
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch purchases:', err);
        setError(err.message || 'Failed to load purchases');
      } finally {
        setLoading(false);
      }
    })();
  }, [publicKey, program]);

  const toggleExpandContent = (key: string) => {
    setExpandedContent(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!publicKey) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Connect your wallet to see your purchases</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Loading your purchases...</p>
        </div>
      </div>
    );
  }

  if (error && purchases.length === 0) {
    return (
      <div className="rounded-xl border-2 border-red-400 bg-red-50/90 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4">
        <p>Error loading purchases: {error}</p>
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-600 dark:text-gray-400 text-lg">You haven't purchased any drops yet</p>
        <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Explore creator galleries to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {purchases.map((item) => {
        const key = `${item.creator}-${item.contentId}`;
        const data = contentData.get(key);
        const cid = data?.cid;
        const isExpanded = expandedContent.has(key);
        const url = cid ? `${IPFS_GATEWAY_URL}${cid}` : null;

        return (
          <div
            key={key}
            className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 overflow-hidden hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
          >
            {/* Content Display */}
            <div className="relative h-48 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center overflow-hidden">
              {url ? (
                <img
                  src={url}
                  alt={`Drop #${item.contentId}`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center space-y-2">
                  <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Loading content...</p>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded">
                    <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Drop #{item.contentId}</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono ml-5">Creator: {item.creator.slice(0, 8)}...</p>
              </div>

              {url && (
                <button
                  onClick={() => toggleExpandContent(key)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg transition-all bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                >
                  {isExpanded ? 'Hide Details' : 'View Details'}
                </button>
              )}
            </div>

            {/* Expanded Details */}
            {isExpanded && url && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Open in IPFS Gateway
                </a>
                {cid && (
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-semibold">IPFS CID</p>
                    <code className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">{cid}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
