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
            <div className="bg-neon-blue/20 border-b-2 border-neon-blue px-4 py-2 flex items-center justify-between mb-6">
              <h2 className="font-pixel text-neon-blue text-lg uppercase tracking-wider">
                CONFIRM_TRANSACTION
              </h2>
              <button
                onClick={handleClose}
                className="hover:text-white text-neon-blue transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Info */}
            <div className="mb-6 space-y-4">
              <div className="border border-dashed border-zinc-700 p-4">
                <h3 className="font-pixel text-xl text-white mb-1">
                  {contentTitle}
                </h3>
                <p className="font-mono text-xs text-zinc-500 uppercase">
                  CREATOR: {creatorUsername ? `@${creatorUsername}` : `${creatorWallet.slice(0, 8)}...`}
                </p>
              </div>

              {/* Price Display */}
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4">
                 <span className="font-mono text-zinc-400 text-sm">TOTAL COST</span>
                 <div className="text-right">
                    <span className="font-pixel text-3xl text-neon-yellow">◎ {priceInSol.toFixed(3)}</span>
                 </div>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="mb-6 opacity-70 hover:opacity-100 transition-opacity">
              <FeeBreakdown priceInSol={priceInSol} variant="detailed" />
            </div>

            {/* No-Refund Warning */}
            <div className="bg-neon-pink/10 border border-neon-pink/50 p-4 mb-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-neon-pink flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-pixel text-neon-pink text-sm mb-1 uppercase">
                  WARNING: IRREVERSIBLE
                </h4>
                <p className="font-mono text-[10px] text-neon-pink/80">
                  {TOOLTIPS.noRefunds.description}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="retro-btn flex-1 bg-black border-zinc-700 text-zinc-400 hover:text-white"
              >
                {BUTTONS.cancel.toUpperCase()}
              </button>
              <button
                onClick={handleConfirm}
                className="retro-btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                UNLOCK
              </button>
            </div>
          </>
        );

      case 'processing':
        return (
          <div className="py-12 text-center flex flex-col items-center">
            <div className="relative mb-6">
               <div className="absolute inset-0 bg-neon-blue blur-xl opacity-20"></div>
               <Loader2 className="w-16 h-16 text-neon-blue animate-spin relative z-10" />
            </div>
            <h2 className="font-pixel text-2xl text-white mb-2 blink">
              PROCESSING...
            </h2>
            <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
              WAITING FOR SIGNATURE
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-neon-green/20 rounded-full border-2 border-neon-green flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-neon-green" />
            </div>
            <h2 className="font-pixel text-2xl text-white mb-2">
              ACCESS GRANTED
            </h2>
            <p className="font-mono text-xs text-zinc-500 mb-8 max-w-xs mx-auto">
              FUNDS TRANSFERRED. DECRYPTION KEY RECEIVED.
            </p>
            
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="retro-btn text-xs px-4 py-2 mb-6 inline-flex items-center gap-2"
              >
                VIEW ON EXPLORER
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <button
              onClick={handleClose}
              className="retro-btn-primary w-full"
            >
              OPEN CONTENT
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-neon-pink/20 rounded-full border-2 border-neon-pink flex items-center justify-center mb-6">
              <X className="w-10 h-10 text-neon-pink" />
            </div>
            <h2 className="font-pixel text-2xl text-white mb-2">
              TRANSACTION FAILED
            </h2>
            <p className="font-mono text-xs text-neon-pink mb-8 px-4 border border-neon-pink/30 py-2 bg-black">
              ERROR: {error}
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleClose}
                className="retro-btn flex-1 bg-black border-zinc-700"
              >
                CLOSE
              </button>
              <button
                onClick={() => {
                  setState('confirm');
                  setError(null);
                }}
                className="retro-btn flex-1 border-neon-pink text-neon-pink hover:bg-neon-pink hover:text-black"
              >
                RETRY
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-black border-2 border-zinc-700 shadow-[0_0_50px_rgba(88,101,242,0.15)] relative">
        {renderContent()}
      </div>
    </div>
  );
}

