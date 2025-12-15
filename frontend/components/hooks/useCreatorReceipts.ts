import { useEffect, useState } from 'react';
import * as anchor from '@coral-xyz/anchor';
import type { AutonProgram } from '@/lib/anchor/auton_program';
import bs58 from 'bs58';

interface UseCreatorReceiptsArgs {
  program: anchor.Program<AutonProgram> | null;
  creatorId: string;
  content: any[]; // ContentItem[] - avoid importing to keep file local
  dateFilter?: 'all' | 'today' | '7days' | '30days';
}

export function useCreatorReceipts({ program, creatorId, content, dateFilter = 'all' }: UseCreatorReceiptsArgs) {
  const [soldCounts, setSoldCounts] = useState<Record<number, number>>({});
  const [totalCollected, setTotalCollected] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!creatorId) return;
    setLoading(true);
    (async () => {
      try {
        const url = `/api/creator_receipts?creator=${creatorId}&dateFilter=${dateFilter}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch creator receipts');
        const json = await res.json();
        setSoldCounts(json.soldCounts || {});
        setTotalCollected(json.totalCollected || 0);
      } catch (err) {
        console.error('useCreatorReceipts fetch failed', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [creatorId, dateFilter, content]);

  return { soldCounts, totalCollected, loading };}
