'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useRouter } from 'next/navigation';

const API_BASE_URL = '/api';
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';

interface PaymentRequest {
  maxAmountRequired: string;
  assetType: string;
  assetAddress: string;
  paymentAddress: string;
  platformFee: string;
  creatorAmount: string;
  network: string;
  nonce: string;
  paymentId: string;
}

export default function TipPage({ params }: { params: Promise<{ creatorId: string }> }) {
  const router = useRouter();
  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();
  const [creatorId, setCreatorId] = useState('');
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [amount, setAmount] = useState('0.1');
  const [assetType, setAssetType] = useState<'SOL' | 'USDC'>('SOL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      params.then(({ creatorId: id }) => {
        setCreatorId(id);
        fetchPaymentRequest(id);
      });
    }
  }, [params, mounted]);

  const fetchPaymentRequest = async (id: string) => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_BASE_URL}/tip/${id}?amount=${amount}&assetType=${assetType}`);
      
      if (response.status === 402) {
        const data = await response.json();
        setPaymentRequest(data.paymentRequest);
      } else if (response.ok) {
        const data = await response.json();
        setSuccess('Payment already verified!');
        router.push(`/?creator=${id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch payment request');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payment request');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (newAmount: string) => {
    setAmount(newAmount);
    if (creatorId) {
      fetchPaymentRequest(creatorId);
    }
  };

  const handleSendTip = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (!paymentRequest) {
      setError('Payment request not loaded');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const recipientPubkey = new PublicKey(paymentRequest.paymentAddress);
      const amountLamports = parseFloat(amount) * LAMPORTS_PER_SOL;

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports: amountLamports,
        })
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Submit payment to backend
      const verifyResponse = await fetch(`${API_BASE_URL}/tip/${creatorId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          paymentId: paymentRequest.paymentId,
          fromAddress: publicKey.toString(),
        }),
      });

      if (verifyResponse.ok) {
        const data = await verifyResponse.json();
        setSuccess(`Tip sent successfully! Transaction: ${signature.substring(0, 8)}...`);
        setPaymentRequest(null);
        
        // Redirect after 3 seconds
        setTimeout(() => {
          router.push(`/?creator=${creatorId}`);
        }, 3000);
      } else {
        const errorData = await verifyResponse.json();
        setError(errorData.error || 'Payment verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send tip');
      console.error('Error sending tip:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!paymentRequest && !loading && !error && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white dark:bg-[#2a2a2a] rounded-xl border border-[#E0E0E0] dark:border-gray-700 shadow-sm p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Send a Tip
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Support this creator with an instant payment on Solana
            </p>
          </div>

          {mounted && !connected && (
            <div className="mb-6">
              <div className="flex justify-center">
                <WalletMultiButton className="!rounded-lg !h-auto !py-2.5 !px-4" />
              </div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                Connect your wallet to send a tip
              </p>
            </div>
          )}

          {mounted && connected && publicKey && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ Wallet Connected: {publicKey.toString().substring(0, 8)}...
              </p>
            </div>
          )}

          {paymentRequest && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Amount ({assetType})
                </label>
                <div className="flex gap-2 mb-3">
                  {['0.1', '0.5', '1', '5'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleAmountChange(preset)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        amount === preset
                          ? 'bg-gradient-to-r from-blue-900 via-blue-600 to-blue-400 dark:from-blue-800 dark:via-blue-500 dark:to-blue-300 text-white border-transparent'
                          : 'bg-white dark:bg-gray-800 border-[#E0E0E0] dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {preset} {assetType}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  step="0.1"
                  min="0.01"
                  className="w-full px-4 py-2.5 border border-[#E0E0E0] dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Asset Type
                </label>
                <select
                  value={assetType}
                  onChange={(e) => {
                    setAssetType(e.target.value as 'SOL' | 'USDC');
                    fetchPaymentRequest(creatorId);
                  }}
                  className="w-full px-4 py-2.5 border border-[#E0E0E0] dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
                >
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>

              <div className="p-5 bg-gray-50 dark:bg-gray-800/50 border border-[#E0E0E0] dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Payment Breakdown
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {amount} {assetType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Platform Fee (4%):</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {paymentRequest.platformFee} {assetType}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#E0E0E0] dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Creator Receives:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {paymentRequest.creatorAmount} {assetType}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-[#E0E0E0] dark:border-gray-700 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Recipient Address:
                </p>
                <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                  {paymentRequest.paymentAddress}
                </p>
              </div>

              <button
                onClick={handleSendTip}
                disabled={loading || !connected}
                className="w-full bg-gradient-to-r from-blue-900 via-blue-600 to-blue-400 dark:from-blue-800 dark:via-blue-500 dark:to-blue-300 hover:from-blue-800 hover:via-blue-500 hover:to-blue-300 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-lg transition-colors"
              >
                {loading ? 'Processing...' : `Send ${amount} ${assetType}`}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

