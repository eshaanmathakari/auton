'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { QRCodeSVG } from 'qrcode.react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Tip {
  id: string;
  amount: string;
  assetType: string;
  creatorAmount: string;
  platformFee: string;
  signature: string;
  from: string;
  timestamp: string;
  transactionUrl: string;
}

export default function CreatorDashboard() {
  const { publicKey, connected } = useWallet();
  const [creatorId, setCreatorId] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [tipLink, setTipLink] = useState('');
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (publicKey && connected && mounted) {
      setWalletAddress(publicKey.toString());
      // Generate creator ID from wallet address (first 8 chars)
      const id = publicKey.toString().substring(0, 8);
      setCreatorId(id);
      if (typeof window !== 'undefined') {
        setTipLink(`${window.location.origin}/tip/${id}`);
      }
    }
  }, [publicKey, connected, mounted]);

  useEffect(() => {
    if (creatorId) {
      fetchTips();
    }
  }, [creatorId]);

  const fetchTips = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tips/${creatorId}`);
      if (response.ok) {
        const data = await response.json();
        setTips(data.tips || []);
      }
    } catch (err) {
      console.error('Error fetching tips:', err);
    }
  };

  const handleGenerateLink = () => {
    if (!walletAddress && !connected) {
      setError('Please connect your wallet or enter a wallet address');
      return;
    }

    if (!creatorId) {
      setError('Please enter a creator ID');
      return;
    }

    if (typeof window !== 'undefined') {
      setTipLink(`${window.location.origin}/tip/${creatorId}`);
    }
    setError('');
  };

  const totals = tips.reduce((acc, tip) => {
    if (tip.assetType === 'SOL') {
      acc.totalSOL = (acc.totalSOL || 0) + parseFloat(tip.amount);
      acc.totalCreatorAmountSOL = (acc.totalCreatorAmountSOL || 0) + parseFloat(tip.creatorAmount);
    } else if (tip.assetType === 'USDC') {
      acc.totalUSDC = (acc.totalUSDC || 0) + parseFloat(tip.amount);
      acc.totalCreatorAmountUSDC = (acc.totalCreatorAmountUSDC || 0) + parseFloat(tip.creatorAmount);
    }
    return acc;
  }, {} as any);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Auton Creator Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Generate your tipping link and track your earnings
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-6">
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
          </div>

          {mounted && connected && publicKey && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">
                ✓ Wallet Connected: {publicKey.toString().substring(0, 8)}...
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Creator ID (or leave empty to auto-generate)
              </label>
              <input
                type="text"
                value={creatorId}
                onChange={(e) => setCreatorId(e.target.value)}
                placeholder={mounted && connected && publicKey ? publicKey.toString().substring(0, 8) : 'Enter creator ID'}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {mounted && !connected && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Enter your Solana wallet address"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            )}

            <button
              onClick={handleGenerateLink}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Generate Tipping Link
            </button>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {tipLink && (
              <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Your Tipping Link
                </h3>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={tipLink}
                      readOnly
                      className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono"
                    />
                    <button
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(tipLink);
                          alert('Link copied to clipboard!');
                        }
                      }}
                      className="mt-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Copy Link
                    </button>
                  </div>
                  <div className="flex-shrink-0">
                    <QRCodeSVG value={tipLink} size={128} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tips History */}
        {tips.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Tip History
            </h2>

            {/* Totals */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {totals.totalSOL && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total SOL Received</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {totals.totalSOL.toFixed(4)} SOL
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Creator: {totals.totalCreatorAmountSOL?.toFixed(4)} SOL
                  </p>
                </div>
              )}
              {totals.totalUSDC && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total USDC Received</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {totals.totalUSDC.toFixed(2)} USDC
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Creator: {totals.totalCreatorAmountUSDC?.toFixed(2)} USDC
                  </p>
                </div>
              )}
            </div>

            {/* Tips List */}
            <div className="space-y-3">
              {tips.map((tip) => (
                <div
                  key={tip.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {tip.amount} {tip.assetType}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        From: {tip.from.substring(0, 8)}...
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(tip.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <a
                      href={tip.transactionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 dark:text-purple-400 hover:underline text-sm"
                    >
                      View Transaction →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
