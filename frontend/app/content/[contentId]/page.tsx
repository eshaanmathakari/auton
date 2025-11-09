'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

const API_BASE_URL = '/api';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

type PreviewInfo = {
  mode: string;
  enabled: boolean;
  snippet?: string | null;
  previewUrl?: string | null;
  previewType?: string | null;
  previewContentType?: string | null;
};

type ContentPayload = {
  id: string;
  title: string;
  description: string;
  price: number;
  assetType: 'SOL' | 'USDC';
  contentKind: string;
  allowDownload: boolean;
  preview?: PreviewInfo;
  creatorWalletAddress: string;
  disclaimers?: {
    refunds?: string;
  };
};

type PaymentRequest = {
  paymentId: string;
  paymentAddress: string;
  assetType: string;
  maxAmountRequired: string;
  creatorAmount: string;
  expiresAt: string;
  contentId: string;
  disclaimers?: {
    refunds?: string;
  };
};

export default function ContentPaywall({
  params,
}: {
  params: { contentId: string };
}) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [content, setContent] = useState<ContentPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [accessUrl, setAccessUrl] = useState('');

  useEffect(() => {
    fetchContent();
  }, [params.contentId]);

  const fetchContent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/content/${params.contentId}`);
      if (!response.ok) {
        throw new Error('Content not found');
      }
      const data = await response.json();
      setContent(data.content);
    } catch (err: any) {
      setError(err.message || 'Failed to load content');
    }
  };

  const requestPayment = async () => {
    if (!publicKey) {
      setError('Connect your wallet to request the paywall details');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const response = await fetch(
        `${API_BASE_URL}/content/${params.contentId}/paywall?buyerPubkey=${publicKey.toString()}`
      );

      if (response.status === 402) {
        const data = await response.json();
        setPaymentRequest(data.paymentRequest);
        setSuccess('Payment request ready. Review the amount and sign in Phantom.');
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Unable to create payment request');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request payment details');
    }
  };

  const unlockContent = async () => {
    if (!content || !paymentRequest) {
      setError('Request a payment link first');
      return;
    }

    if (!publicKey || !connected) {
      setError('Connect your wallet before unlocking');
      return;
    }

    if (content.assetType !== 'SOL') {
      setError('This demo currently supports SOL payments only.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const recipient = new PublicKey(paymentRequest.paymentAddress);
      const lamports = Math.round(Number(content.price) * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipient,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      const verifyResponse = await fetch(`${API_BASE_URL}/content/${params.contentId}/paywall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentRequest.paymentId,
          signature,
          buyerPubkey: publicKey.toString(),
        }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        throw new Error(data.error || 'Payment verification failed');
      }

      const data = await verifyResponse.json();
      setAccessUrl(data.downloadUrl);
      setSuccess('Payment confirmed! Your download link is ready below.');
    } catch (err: any) {
      console.error('Failed to unlock content', err);
      setError(err.message || 'Failed to unlock content');
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (!content?.preview || !content.preview.enabled) {
      return (
        <p className="text-sm text-gray-500">
          This creator chose to keep the drop fully gated. Paywall shows price + disclaimer only.
        </p>
      );
    }

    if (content.preview.previewType === 'text' && content.preview.snippet) {
      return (
        <p className="rounded-lg bg-white dark:bg-gray-800 border border-[#E0E0E0] dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {content.preview.snippet}
        </p>
      );
    }

    if (content.preview.previewType === 'file' && content.preview.previewUrl) {
      if (content.preview.previewContentType?.startsWith('video/')) {
        return (
          <video controls className="w-full rounded-lg">
            <source src={content.preview.previewUrl} type={content.preview.previewContentType} />
          </video>
        );
      }
      if (content.preview.previewContentType?.startsWith('audio/')) {
        return (
          <audio controls className="w-full">
            <source src={content.preview.previewUrl} type={content.preview.previewContentType} />
          </audio>
        );
      }
      if (content.preview.previewContentType?.startsWith('image/')) {
        return <img src={content.preview.previewUrl} alt="Preview" className="w-full rounded-lg" />;
      }
      return (
        <a
          href={content.preview.previewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-gray-900 dark:text-blue-400 font-medium hover:underline"
        >
          View preview asset →
        </a>
      );
    }

    return <p className="text-sm text-gray-500">Preview processing...</p>;
  };

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">{error || 'Loading content...'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Link href="/" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1">
          ← Back to creator hub
        </Link>
        <div className="bg-white dark:bg-[#2a2a2a] rounded-xl border border-[#E0E0E0] dark:border-gray-700 shadow-sm p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Locked drop</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2 mb-1">{content.title}</h1>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">{content.contentKind}</p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{content.description}</p>
          </div>

          <div className="rounded-lg border border-dashed border-[#E0E0E0] dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Preview / spoiler</p>
            {renderPreview()}
          </div>

          <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-[#E0E0E0] dark:border-gray-700">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{content.price}</span>
              <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">{content.assetType}</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Paid directly to{' '}
              <span className="font-mono text-gray-700 dark:text-gray-300">
                {content.creatorWalletAddress.slice(0, 4)}...
                {content.creatorWalletAddress.slice(-4)}
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <WalletMultiButton className="!rounded-lg !h-auto !py-2.5 !px-4" />
          </div>

          <div className="space-y-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">No-refund policy</p>
            <p className="leading-relaxed">
              {content.disclaimers?.refunds ||
                'Blockchain payments are final. Double-check previews before unlocking.'}
            </p>
          </div>

          <div className="rounded-lg border border-[#E0E0E0] dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 space-y-4">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Unlock steps</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              <li>Connect a Solana wallet (Phantom, Solflare).</li>
              <li>Request the paywall so we can attach a unique reference.</li>
              <li>Approve the SOL payment, then grab the short-lived download link.</li>
            </ol>
            <div className="flex gap-3 flex-wrap pt-2">
              <button
                onClick={requestPayment}
                className="rounded-lg border border-[#E0E0E0] dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                1. Get payment request
              </button>
              <button
                onClick={unlockContent}
                disabled={!paymentRequest || loading}
                className="rounded-lg bg-gradient-to-r from-blue-900 via-blue-600 to-blue-400 dark:from-blue-800 dark:via-blue-500 dark:to-blue-300 px-5 py-2.5 text-sm font-semibold text-white hover:from-blue-800 hover:via-blue-500 hover:to-blue-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Confirming...' : '2. Unlock now'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-300 space-y-3">
              <p>{success}</p>
              {accessUrl && (
                <button
                  onClick={() => window.open(accessUrl, '_blank')}
                  className="rounded-lg bg-green-600 dark:bg-green-500 px-5 py-2.5 text-white font-semibold hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                >
                  Open download
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
