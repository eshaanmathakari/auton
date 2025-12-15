'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { Mail, Twitter, Chrome } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useHasPrivyWallet } from '@/lib/privy-solana-adapter';

interface SocialLoginProps {
  onSuccess?: (walletAddress: string) => void;
  onError?: (error: Error) => void;
}

export function SocialLogin({ onSuccess, onError }: SocialLoginProps) {
  const { login, authenticated, user, ready } = usePrivy();
  const hasSolanaWallet = useHasPrivyWallet();
  const [loading, setLoading] = useState<string | null>(null);

  // Check for Solana wallet after authentication
  useEffect(() => {
    if (authenticated && user) {
      // Wait a bit for wallet to be created/loaded
      const checkWallet = setTimeout(() => {
        if (hasSolanaWallet && user?.wallet?.address) {
          // Verify it's a valid Solana address (not EVM)
          try {
            const pubkey = new PublicKey(user.wallet.address);
            if (onSuccess) {
              onSuccess(user.wallet.address);
            }
          } catch (e) {
            // Invalid Solana address - likely EVM wallet
            const error = new Error('Only Solana wallets are supported. Please configure Privy to use Solana as the default chain.');
            console.error('Invalid wallet type:', error);
            if (onError) {
              onError(error);
            }
          }
        } else if (authenticated && !hasSolanaWallet) {
          // User authenticated but no Solana wallet
          const error = new Error('Solana wallet not found. Please ensure Solana is configured as the default chain in Privy Dashboard.');
          console.error('Solana wallet missing:', error);
          if (onError) {
            onError(error);
          }
        }
      }, 2000);
      return () => clearTimeout(checkWallet);
    }
  }, [authenticated, user, hasSolanaWallet, onSuccess, onError]);

  const handleLogin = async (method: 'email' | 'google' | 'twitter') => {
    try {
      setLoading(method);
      
      // All methods use the same login() - Privy handles the OAuth flow
      await login();
      
      // The useEffect will handle wallet verification
    } catch (error: any) {
      console.error(`Login error (${method}):`, error);
      const errorMessage = error?.message || `Failed to login with ${method}`;
      if (onError) {
        onError(new Error(errorMessage));
      }
      setLoading(null);
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (authenticated && hasSolanaWallet && user?.wallet?.address) {
    // Verify it's a valid Solana address
    try {
      const pubkey = new PublicKey(user.wallet.address);
      return (
        <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-green-800 dark:text-green-200 font-medium">
            ✓ Solana wallet connected: {user.wallet.address.slice(0, 8)}...{user.wallet.address.slice(-6)}
          </p>
        </div>
      );
    } catch (e) {
      // Invalid Solana address
      return (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200 font-medium">
            ⚠ Invalid wallet type. Please configure Privy Dashboard to use Solana.
          </p>
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Get Started with Auton
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Sign up with your email or social account. We'll create a secure wallet for you automatically.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => handleLogin('email')}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {loading === 'email' ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <Mail className="w-5 h-5" />
              <span>Continue with Email</span>
            </>
          )}
        </button>

        <button
          onClick={() => handleLogin('google')}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg"
        >
          {loading === 'google' ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
          ) : (
            <>
              <Chrome className="w-5 h-5" />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <button
          onClick={() => handleLogin('twitter')}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-black dark:bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
        >
          {loading === 'twitter' ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <Twitter className="w-5 h-5" />
              <span>Continue with X (Twitter)</span>
            </>
          )}
        </button>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
            or
          </span>
        </div>
      </div>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        By continuing, you agree to Auton's Terms of Service and Privacy Policy.
        <br />
        Your wallet will be created automatically and securely.
      </p>
    </div>
  );
}

