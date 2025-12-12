"use client";

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ContentItem } from '@/types/content';
import { useCreatorReceipts } from './hooks/useCreatorReceipts';
import * as anchor from '@coral-xyz/anchor';
import { Download } from 'lucide-react';

interface PublishedDropsListProps {
  content: ContentItem[];
  loading: boolean;
  creatorId: string;
  connected: boolean;
  program?: anchor.Program<any> | null;
}

export function PublishedDropsList({
  content,
  loading,
  creatorId,
  connected,
  program = null,
}: PublishedDropsListProps) {
  const { publicKey } = useWallet();
  const [contentData, setContentData] = useState<Map<string, { cid: string }>>(new Map());

  // Use receipts hook to obtain sold counts & total collected (so we can show per-drop counts)
  const { soldCounts } = useCreatorReceipts({ program, creatorId, content });
  console.debug('PublishedDropsList: soldCounts', soldCounts);

  // Preload IPFS CIDs for displayed content so previews can render inline
  useEffect(() => {
    if (!content || content.length === 0) return;

    (async () => {
      const entries = await Promise.all(
        content.map(async (item) => {
          const key = `${creatorId}-${item.id.toNumber()}`;
          if (contentData.has(key)) return [key, contentData.get(key) as { cid: string }];

          try {
            const res = await fetch(
              `/api/content/${creatorId}/${item.id.toNumber()}/access?buyerPubkey=${publicKey?.toBase58?.()}`
            );
            if (res.ok) {
              const json = await res.json();
              return [key, { cid: json.ipfsCid }];
            }
          } catch (err) {
            console.debug(`Failed to preload content ${key}:`, err);
          }
          return [key, undefined];
        })
      );

      setContentData((prev) => {
        const next = new Map(prev);
        for (const [k, v] of entries) {
          if (v) next.set(k as string, v as { cid: string });
        }
        return next;
      });
    })();
  }, [content, creatorId, publicKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Loading your drops...</p>
        </div>
      </div>
    );
  }

  if (!content || content.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          {connected ? 'You have not published any drops yet.' : 'Connect your wallet to see your drops.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Debug: show soldCounts summary */}
      <div className="col-span-full text-xs text-gray-400">
        Debug soldCounts: {JSON.stringify(soldCounts)}
      </div>
      {content.map((item) => {
        const key = `${creatorId}-${item.id.toNumber()}`;
        const cid = contentData.get(key)?.cid;
        const url = cid ? `https://ipfs.io/ipfs/${cid}` : null;

        return (
          <div
            key={item.id.toNumber()}
            className="group rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-0 overflow-hidden hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
          >
            <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 flex items-center justify-center overflow-hidden">
              {url ? (
                <img src={url} alt={item.title} className="w-full h-full object-cover" onError={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
              ) : (
                <div className="text-center p-6">
                  <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-gray-500 mt-2">Preview unavailable</p>
                </div>
              )}
            </div>

            <div className="p-5">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{item.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">ID: {item.id.toNumber()}</p>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mb-4 justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ◎ {(item.price.toNumber() / anchor.web3.LAMPORTS_PER_SOL).toFixed(3)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">SOL</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{soldCounts[item.id.toNumber()] || 0} sold</div>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/creators/${creatorId}`}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>View</span>
                </Link>
                {url && (
                  <a href={url} target="_blank" rel="noreferrer" className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Open
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
