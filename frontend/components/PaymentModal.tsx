'use client';

import { useState } from 'react';
import { X, AlertTriangle, Zap, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import FeeBreakdown from './FeeBreakdown';
import { TOOLTIPS, BUTTONS, ERRORS, SUCCESS } from '@/lib/copy';
import { getUserFriendlyErrorMessage, logWalletError } from '@/lib/transaction-utils';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  contentTitle: string;
  priceInSol: number;
  creatorUsername?: string | null;
  creatorWallet: string;
}

type PaymentState = 'confirm' | 'processing' | 'success' | 'error';

export default function PaymentModal({
  isOpen,
  onClose,
  onConfirm,
  contentTitle,
  priceInSol,
  creatorUsername,
  creatorWallet,
}: PaymentModalProps) {
  const [state, setState] = useState<PaymentState>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setState('processing');
    setError(null);
    
    try {
      await onConfirm();
      setState('success');
    } catch (err: any) {
      console.error('Payment error:', err);
      // Use enhanced error extraction for better error messages
      logWalletError(err, 'PaymentModal');
      const errorMessage = err?.message || getUserFriendlyErrorMessage(err) || ERRORS.paymentFailed;
      setError(errorMessage);
      setState('error');
    }
  };

  const handleClose = () => {
    if (state === 'processing') return; // Don't allow closing during processing
    setState('confirm');
    setError(null);
    setTxSignature(null);
    onClose();
  };

  const renderContent = () => {
    switch (state) {
      case 'confirm':
        return (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Unlock Content
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content Info */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {contentTitle}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {creatorUsername ? `by @${creatorUsername}` : `by ${creatorWallet.slice(0, 8)}...`}
              </p>
            </div>

            {/* Fee Breakdown */}
            <div className="mb-6">
              <FeeBreakdown priceInSol={priceInSol} variant="detailed" />
            </div>

            {/* No-Refund Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm mb-1">
                    {TOOLTIPS.noRefunds.title}
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {TOOLTIPS.noRefunds.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                {BUTTONS.cancel}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Unlock for ◎ {priceInSol.toFixed(3)}
              </button>
            </div>
          </>
        );

      case 'processing':
        return (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
              <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {BUTTONS.processing}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Please approve the transaction in your wallet...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {SUCCESS.contentUnlocked}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              {creatorUsername 
                ? `Funds sent directly to @${creatorUsername}`
                : 'Funds sent directly to creator'}
            </p>
            
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6"
              >
                View transaction
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={handleClose}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 transition-all"
            >
              Continue
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <X className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Failed
            </h2>
            <p className="text-red-600 dark:text-red-400 text-sm mb-6">
              {error}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                {BUTTONS.cancel}
              </button>
              <button
                onClick={() => {
                  setState('confirm');
                  setError(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                {BUTTONS.tryAgain}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 max-w-md w-full">
        {renderContent()}
      </div>
    </div>
  );
}

