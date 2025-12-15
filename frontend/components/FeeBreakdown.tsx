'use client';

import { Info } from 'lucide-react';
import { FEES, formatPriceBreakdown } from '@/lib/copy';

interface FeeBreakdownProps {
  priceInSol: number;
  variant?: 'compact' | 'detailed';
  showTooltip?: boolean;
}

export default function FeeBreakdown({ 
  priceInSol, 
  variant = 'detailed',
  showTooltip = true 
}: FeeBreakdownProps) {
  const breakdown = formatPriceBreakdown(priceInSol);
  
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Creator receives {FEES.creatorKeepsDisplay}</span>
        {showTooltip && (
          <div className="group relative">
            <Info className="w-3.5 h-3.5 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
              <p>Auton fee: {FEES.platformFeeDisplay}</p>
              <p className="text-gray-400 mt-1">{FEES.disclaimer}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        {FEES.breakdown.title}
        {showTooltip && (
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-56 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
              <p className="font-medium mb-1">Why fees?</p>
              <p className="text-gray-300">{FEES.sustainability.description}</p>
            </div>
          </div>
        )}
      </h4>
      
      <div className="space-y-2 text-sm">
        {/* Content Price */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">{FEES.breakdown.price}</span>
          <span className="font-medium text-gray-900 dark:text-white">{breakdown.total}</span>
        </div>
        
        {/* Platform Fee */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">
            {FEES.breakdown.platformFee}
          </span>
          <span className="text-gray-500 dark:text-gray-400">{breakdown.platformFee}</span>
        </div>
        
        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
        
        {/* Creator Receives */}
        <div className="flex justify-between items-center">
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            {FEES.breakdown.creatorReceives}
          </span>
          <span className="font-bold text-green-600 dark:text-green-400">
            {breakdown.creatorReceives}
          </span>
        </div>
      </div>
      
      {/* Note */}
      <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
        {FEES.disclaimer}
      </p>
    </div>
  );
}

// Simple inline fee badge for content cards
export function FeeBadge() {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
      <span>{FEES.creatorKeepsDisplay} to creator</span>
    </div>
  );
}

// Tooltip for fees
export function FeeTooltip() {
  return (
    <div className="group relative inline-block">
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 cursor-help">
        <Info className="w-3.5 h-3.5" />
        <span>Fee info</span>
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-20">
        <p className="font-semibold mb-2">Auton Fee: {FEES.platformFeeDisplay}</p>
        <ul className="space-y-1 text-gray-300">
          <li>• Creators keep {FEES.creatorKeepsDisplay}</li>
          <li>• {FEES.comparison}</li>
          <li>• No custody of funds</li>
        </ul>
        <p className="text-gray-400 mt-2 pt-2 border-t border-gray-700">
          {FEES.disclaimer}
        </p>
      </div>
    </div>
  );
}

