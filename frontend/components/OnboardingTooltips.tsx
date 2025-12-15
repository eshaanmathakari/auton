'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { TOOLTIPS } from '@/lib/copy';

interface TooltipProps {
  topic: 'wallet' | 'gasFees' | 'x402' | 'solana';
  children?: React.ReactNode;
}

export function Tooltip({ topic, children }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const content = TOOLTIPS[topic];

  if (!content) return <>{children}</>;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        aria-label={`Learn about ${topic}`}
      >
        {children || <HelpCircle className="w-4 h-4" />}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 w-64 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {content.title}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {content.description}
            </p>
            {content.embeddedWallet && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {content.embeddedWallet}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function WalletTooltip() {
  return <Tooltip topic="wallet" />;
}

export function GasFeesTooltip() {
  return <Tooltip topic="gasFees" />;
}

