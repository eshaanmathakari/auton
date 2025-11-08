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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
        <p className="rounded-lg bg-gray-100 dark:bg-gray-800 p-4 text-sm text-gray-700 dark:text-gray-200">
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
          className="text-sm text-purple-600 underline"
        >
          View preview asset
        </a>
      );
    }

    return <p className="text-sm text-gray-500">Preview processing...</p>;
  };

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300">{error || 'Loading content...'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <Link href="/" className="text-sm text-purple-600 hover:underline">
          ← Back to creator hub
        </Link>
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Locked drop</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{content.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{content.contentKind}</p>
            <p className="mt-4 text-gray-700 dark:text-gray-300">{content.description}</p>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <p className="text-xs font-semibold uppercase text-gray-500">Preview / spoiler</p>
            {renderPreview()}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-purple-600">{content.price}</span>
              <span className="text-lg font-semibold text-gray-500">{content.assetType}</span>
            </div>
            <div className="text-sm text-gray-500">
              Paid directly to{' '}
              <span className="font-mono">
                {content.creatorWalletAddress.slice(0, 4)}...
                {content.creatorWalletAddress.slice(-4)}
              </span>
            </div>
          </div>

          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />

          <div className="space-y-3 rounded-2xl bg-gray-50 dark:bg-gray-800 p-5 text-sm text-gray-600 dark:text-gray-300">
            <p className="font-semibold text-gray-800 dark:text-gray-100">No-refund policy</p>
            <p>
              {content.disclaimers?.refunds ||
                'Blockchain payments are final. Double-check previews before unlocking.'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <p className="font-semibold text-gray-900 dark:text-white">Unlock steps</p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>Connect a Solana wallet (Phantom, Solflare).</li>
              <li>Request the paywall so we can attach a unique reference.</li>
              <li>Approve the SOL payment, then grab the short-lived download link.</li>
            </ol>
            <div className="flex gap-4 flex-wrap">
              <button
                onClick={requestPayment}
                className="rounded-xl border border-purple-300 px-4 py-2 text-purple-600 hover:bg-purple-50"
              >
                1. Get payment request
              </button>
              <button
                onClick={unlockContent}
                disabled={!paymentRequest || loading}
                className="rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white disabled:bg-gray-400"
              >
                {loading ? 'Confirming...' : '2. Unlock now'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 space-y-2">
              <p>{success}</p>
              {accessUrl && (
                <button
                  onClick={() => window.open(accessUrl, '_blank')}
                  className="rounded-lg bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700"
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
