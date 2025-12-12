'use client';

import { ContentItem } from '@/types/content';
import * as anchor from '@coral-xyz/anchor';
import { useCreatorReceipts } from './hooks/useCreatorReceipts';
import { useEffect, useState, useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import type { AutonProgram } from '@/lib/anchor/auton_program';

interface DashboardMetricsProps {
  content: ContentItem[];
  loading: boolean;
  creatorId: string; // base58
  program: anchor.Program<AutonProgram> | null;
  connection: Connection;
}

export function DashboardMetrics({ content, loading, creatorId, program, connection }: DashboardMetricsProps) {
  // Local filter state
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Receipt derived stats (read from shared hook)
  const { soldCounts, totalCollected, loading: receiptsLoading } = useCreatorReceipts({ program, creatorId, content, dateFilter });
  console.debug('DashboardMetrics: soldCounts', soldCounts, 'totalCollected', totalCollected, 'receiptsLoading', receiptsLoading);

  // Map content id -> price in SOL for quick lookup
  const priceMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const c of content) {
      map[c.id.toNumber()] = c.price.toNumber() / anchor.web3.LAMPORTS_PER_SOL;
    }
    return map;
  }, [content]);

  const calculateMetrics = () => {
    const totalDrops = content.length;
    const totalValueSOL = content.reduce((sum, item) => {
      return sum + item.price.toNumber() / anchor.web3.LAMPORTS_PER_SOL;
    }, 0);
    const avgPrice = totalDrops === 0 ? 0 : totalValueSOL / totalDrops;

    return {
      totalDrops,
      totalValue: totalValueSOL.toFixed(3),
      avgPrice: avgPrice.toFixed(3),
    };
  };

  const metrics = calculateMetrics();

  // receipts computed via shared hook

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Units Sold</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{Object.values(soldCounts).reduce((a, b) => a + b, 0)}</p>
          </div>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Collected</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">◎ {totalCollected.toFixed(3)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="rounded-lg border px-3 py-2 bg-white dark:bg-gray-800">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {content.map((c) => {
          const id = c.id.toNumber();
          const sold = soldCounts[id] || 0;
          const total = sold * (priceMap[id] || 0);
          return (
            <div key={id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">{c.title}</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{sold} sold</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">◎ {total.toFixed(3)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
