'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AutonProgram } from '@/lib/anchor/auton_program';
import IDL from '@/lib/anchor/auton_program.json';
import { CheckCircle, XCircle, Loader2, AtSign, Sparkles, Zap } from 'lucide-react';
import { getUserFriendlyErrorMessage, logWalletError, validateTransaction } from '@/lib/transaction-utils';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;
const RELAYER_PUBKEY_STR = process.env.NEXT_PUBLIC_RELAYER_PUBKEY;

if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set in environment variables.');
}

const programId = new PublicKey(AUTON_PROGRAM_ID);
const relayerPubkey = RELAYER_PUBKEY_STR ? new PublicKey(RELAYER_PUBKEY_STR) : null;

interface UsernameSetupProps {
  onUsernameSet: (username: string) => void;
  onSkip?: () => void;
  existingUsername?: string | null;
}

export default function UsernameSetup({ onUsernameSet, onSkip, existingUsername }: UsernameSetupProps) {
  const { publicKey, sendTransaction, signTransaction, connected } = useWallet();
  const [username, setUsername] = useState(existingUsername || '');
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  
  const [availability, setAvailability] = useState<{
    available: boolean;
    valid: boolean;
    error?: string;
  } | null>(null);
  const [error, setError] = useState('');

  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);

  // Initialize Anchor Program (Read-only)
  const program = useMemo(() => {
    const provider = new anchor.AnchorProvider(connection, {
      publicKey: PublicKey.default,
      signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
      signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => tx,
    }, { commitment: 'confirmed' });
    const idl = IDL as anchor.Idl;
    return new anchor.Program(idl, provider) as anchor.Program<AutonProgram>;
  }, [connection]);

  // Debounced username availability check
  const checkAvailability = useCallback(async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setAvailability({ available: false, valid: false, error: 'Username must be at least 3 characters' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(usernameToCheck)) {
        setAvailability({ available: false, valid: false, error: 'Only alphanumeric characters and underscores allowed' });
        return;
    }

    setIsChecking(true);
    try {
        // Derive PDA for username
        const [usernamePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("username"), Buffer.from(usernameToCheck)],
            programId
        );

        // Check if account exists
        const accountInfo = await connection.getAccountInfo(usernamePDA);
        
        if (accountInfo) {
            setAvailability({ available: false, valid: true, error: 'Username is already taken' });
        } else {
            setAvailability({ available: true, valid: true });
        }
    } catch (err) {
      console.error('Error checking username:', err);
      setAvailability({ available: false, valid: false, error: 'Failed to check availability' });
    } finally {
      setIsChecking(false);
    }
  }, [connection]);

  // Debounce the availability check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (username && username !== existingUsername) {
        checkAvailability(username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, checkAvailability, existingUsername]);

  const handleSponsoredRegistration = async () => {
    if (!publicKey || !username || !signTransaction) return;
    
    // Check if relayer is configured
    if (!relayerPubkey) {
        setError('Sponsorship unavailable: Relayer not configured.');
        setShowSponsorModal(false);
        return;
    }

    try {
        setIsSubmitting(true);
        setShowSponsorModal(false);
        setError('');

        const [usernamePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("username"), Buffer.from(username)],
            programId
        );

        // 1. Build Transaction
        const ix = await program.methods
            .registerUsername(username)
            .accounts({
                usernameAccount: usernamePDA,
                creator: publicKey,
                payer: relayerPubkey, // RELAYER PAYS RENT
            })
            .instruction();

        const transaction = new Transaction().add(ix);
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = relayerPubkey; // RELAYER PAYS FEE

        // 2. User Signs (Partial)
        const signedTx = await signTransaction(transaction);
        
        // 3. Serialize & Send to Relayer
        const serializedTx = signedTx.serialize({ requireAllSignatures: false });
        const txBase64 = serializedTx.toString('base64');

        const relayResponse = await fetch('/api/sponsor/relay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction: txBase64 }),
        });

        if (!relayResponse.ok) {
            const errData = await relayResponse.json();
            throw new Error(errData.error || 'Sponsorship failed');
        }

        const { signature } = await relayResponse.json();
        console.log('Sponsored Registration Signature:', signature);
        
        await connection.confirmTransaction(signature, 'confirmed');
        
        onUsernameSet(username);

    } catch (err: any) {
        console.error('Sponsored registration failed:', err);
        setError(err.message || 'Sponsorship failed');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey || !username) {
      setError('Please connect your wallet and enter a username');
      return;
    }

    if (!availability?.available || !availability?.valid) {
      setError('Please choose an available username');
      return;
    }

    // Check Balance
    const balance = await connection.getBalance(publicKey);
    const MIN_SOL_REQUIRED = 0.002 * anchor.web3.LAMPORTS_PER_SOL; // ~0.002 SOL for rent + fee

    if (balance < MIN_SOL_REQUIRED) {
        setShowSponsorModal(true);
        return;
    }

    setIsSubmitting(true);
    setError('');

    try {
        // 1. Build the Transaction
        const [usernamePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("username"), Buffer.from(username)],
            programId
        );

        const ix = await program.methods
            .registerUsername(username)
            .accounts({
                usernameAccount: usernamePDA,
                creator: publicKey,
                payer: publicKey, // USER PAYS RENT
            })
            .instruction();

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey; 
        
        transaction.add(ix);

        // 2. Send (User Pays)
        const sig = await sendTransaction(transaction, connection);
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

        onUsernameSet(username);
    } catch (err: any) {
      console.error('Error setting username:', err);
      setError(getUserFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = () => {
    if (isChecking) {
      return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
    }
    if (!availability) {
      return null;
    }
    if (availability.available && availability.valid) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getStatusMessage = () => {
    if (isChecking) {
      return <span className="text-gray-500">Checking availability...</span>;
    }
    if (!availability) {
      return null;
    }
    if (availability.available && availability.valid) {
      return <span className="text-green-600 dark:text-green-400">Username is available!</span>;
    }
    if (!availability.valid) {
      return <span className="text-red-600 dark:text-red-400">{availability.error}</span>;
    }
    return <span className="text-red-600 dark:text-red-400">Username is already taken</span>;
  };

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
          <AtSign className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Choose Your Username
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          This will be your public profile URL:
          <br />
          <code className="text-blue-600 dark:text-blue-400 text-sm bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded mt-1 inline-block">
            /creators/{username || 'your_username'}
          </code>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ''));
                setAvailability(null);
              }}
              placeholder="your_username"
              className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-10 pr-12 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
              minLength={3}
              maxLength={32}
              required
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {getStatusIcon()}
            </div>
          </div>
          <div className="mt-2 text-sm min-h-[20px]">
            {getStatusMessage()}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Your username hides your wallet address from public URLs for privacy.
          </p>
        </div>

        <div className="flex gap-3">
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              Skip for now
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !availability?.available || !availability?.valid}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Setting username...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>

        {/* Sponsorship Modal (Overlay) */}
        {showSponsorModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200 dark:border-purple-700/50 p-6 max-w-md w-full text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <Zap className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Not enough SOL for gas?
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Registering a username costs a small network fee. 
                    <br />
                    <strong>We can sponsor this transaction for you!</strong>
                </p>
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => setShowSponsorModal(false)}
                        className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSponsoredRegistration}
                        className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
                    >
                        Accept Sponsorship
                    </button>
                </div>
            </div>
          </div>
        )}
    </div>
  );
}

