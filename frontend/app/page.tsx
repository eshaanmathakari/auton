'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AutonProgram } from '@/lib/anchor/auton_program';
import IDL from '@/lib/anchor/auton_program.json';
import UsernameSetup from '@/components/UsernameSetup';
import CreatorProfile from '@/components/CreatorProfile';
import { SocialLogin } from '@/components/SocialLogin';
import { usePrivy } from '@privy-io/react-auth';
import { usePrivySolanaWallet, usePrivySendTransaction } from '@/lib/privy-solana-adapter';
import { getUserFriendlyErrorMessage, logWalletError, validateTransaction } from '@/lib/transaction-utils';
import { Copy, CheckCircle, User, Zap, Settings } from 'lucide-react';

const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;
// Relayer Public Key for Gasless Transactions
const RELAYER_PUBKEY_STR = process.env.NEXT_PUBLIC_RELAYER_PUBKEY;
const IPFS_GATEWAY_URL = 'https://ipfs.io/ipfs/';

if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set in environment variables.');
}

const relayerPubkey = RELAYER_PUBKEY_STR ? new PublicKey(RELAYER_PUBKEY_STR) : null;

type ContentItem = {
  id: anchor.BN;
  title: string;
  description: string;
  price: anchor.BN;
  assetType: 'SOL' | 'USDC';
  contentKind: string;
  allowDownload: boolean;
  creatorWalletAddress: PublicKey;
  preview?: {
    enabled: boolean;
    mode: string;
    snippet?: string | null;
    previewUrl?: string | null;
    previewType?: string | null;
    previewContentType?: string | null;
  };
};

type CreatorAccountData = {
  creatorWallet: PublicKey;
  lastContentId: anchor.BN;
  content: ContentItem[];
  profileCid?: string;
};

type ProfileData = {
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: Record<string, string>;
};

type FormState = {
  title: string;
  description: string;
  price: string;
};

const defaultFormState: FormState = {
  title: '',
  description: '',
  price: '0.02',
};

const bytesToMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

export default function CreatorWorkspace() {
  const { publicKey: walletPublicKey, connected, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { authenticated: privyAuthenticated, sendSolanaTransaction } = usePrivy();
  const privySolanaWallet = usePrivySolanaWallet();
  const privySendTx = usePrivySendTransaction();
  
  // Use Privy wallet if available, otherwise use wallet adapter
  const publicKey = walletPublicKey || privySolanaWallet?.publicKey || null;
  const isConnected = connected || (privyAuthenticated && !!privySolanaWallet?.publicKey);
  
  const [mounted, setMounted] = useState(false);
  const [creatorId, setCreatorId] = useState('');
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: 'error' | 'success' | null; message: string }>({
    type: null,
    message: '',
  });
  const [creatorAccountData, setCreatorAccountData] = useState<CreatorAccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingContent, setFetchingContent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Username & Profile state
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [localProfile, setLocalProfile] = useState<ProfileData | null>(null);

  // Sponsorship state
  const [showSponsorModal, setShowSponsorModal] = useState(false);

  // Log connection endpoint for debugging
  useEffect(() => {
    if (connection) {
      console.log('Using connection endpoint:', (connection as any).rpcEndpoint || 'default');
    }
  }, [connection]);
  
  const provider = useMemo(() => {
    // Create a dummy wallet for read-only operations
    const dummyWallet = {
      publicKey: anchor.web3.Keypair.generate().publicKey,
      signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
      signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => tx,
    };
    return new anchor.AnchorProvider(connection, dummyWallet, {
      commitment: 'confirmed',
    });
  }, [connection]);
  
  const program = useMemo(() => {
    try {
      if (provider) {
        const idl = IDL as anchor.Idl;
        const prog = new anchor.Program(idl, provider) as anchor.Program<AutonProgram>;
        return prog;
      }
    } catch (error) {
      console.error('Failed to initialize program:', error);
      setStatus({ 
        type: 'error', 
        message: 'Failed to initialize program. Check IDL file and program ID.' 
      });
    }
    return null;
  }, [provider]);

  const creatorAccountPDA = useMemo(() => {
    // Use either wallet adapter or Privy wallet
    const activePublicKey = walletPublicKey || privySolanaWallet?.publicKey;
    if (!activePublicKey || !program) return null;
    // Use program.programId instead of the constant to ensure it matches the deployed program
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), activePublicKey.toBuffer()],
      program.programId
    );
    return pda;
  }, [walletPublicKey, privySolanaWallet?.publicKey, program]);

  useEffect(() => setMounted(true), []);

  // Reverse lookup to find my username
  const fetchUsername = useCallback(async () => {
    if (!program || !publicKey) return;
    try {
        const accounts = await program.account.usernameAccount.all([
            {
                memcmp: {
                    offset: 8, // After discriminator
                    bytes: publicKey.toBase58(),
                },
            },
        ]);
        
        if (accounts.length > 0) {
            setUsername(accounts[0].account.username);
        } else {
            setUsername(null);
        }
    } catch (err) {
        console.error("Failed to fetch username:", err);
    }
  }, [program, publicKey]);

  useEffect(() => {
    if (publicKey && isConnected && mounted) {
      setCreatorId(publicKey.toBase58());
      fetchCreatorContent();
      fetchUsername();
    } else {
      setCreatorId('');
      setCreatorAccountData(null);
      setUsername(null);
      setShowUsernameSetup(false);
      setLocalProfile(null);
    }
  }, [publicKey, isConnected, mounted, creatorAccountPDA, fetchUsername]); 

  const handleUsernameSet = (newUsername: string) => {
    setShowUsernameSetup(false);
    setUsername(newUsername);
    setStatus({ type: 'success', message: `Username @${newUsername} set successfully!` });
  };

  const handleSkipUsername = () => {
    setShowUsernameSetup(false);
  };

  const handleProfileUpdate = (profile: ProfileData) => {
    setLocalProfile(profile);
    setStatus({ type: 'success', message: 'Profile updated!' });
  };

  const getShareUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://auton.vercel.app';
    if (username) {
      return `${baseUrl}/creators/${username}`;
    }
    return `${baseUrl}/creators/${creatorId}`;
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleInputChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(defaultFormState);
    setPrimaryFile(null);
  };

  const fetchCreatorContent = async () => {
    if (!creatorAccountPDA || !program) return;

    setFetchingContent(true);
    try {
      const account = await program.account.creatorAccount.fetch(creatorAccountPDA);
      console.log("Fetched Creator Account:", account);
      setCreatorAccountData(account);
      
      // Fetch Profile Metadata if CID exists
      if (account.profileCid) {
        try {
          const response = await fetch(`${IPFS_GATEWAY_URL}${account.profileCid}`);
          if (response.ok) {
            const profileData = await response.json();
            setLocalProfile(profileData);
          }
        } catch (e) {
          console.error("Failed to load profile metadata:", e);
        }
      }
    } catch (err: any) {
      // Check if error is "Account does not exist" (standard Anchor error for missing accounts)
      const errorMessage = err?.message || err?.toString() || '';
      if (errorMessage.includes('Account does not exist') || 
          errorMessage.includes('AccountNotInitialized') ||
          errorMessage.includes('InvalidAccountData')) {
        // This is expected for new creators - not an error
        console.log('Creator account not initialized yet (new user).');
        setCreatorAccountData(null);
      } else {
        // Log other errors but don't show alarming messages to user
        console.error('Failed to fetch creator account:', err);
        setCreatorAccountData(null);
      }
    } finally {
      setFetchingContent(false);
    }
  };

  const handleSponsoredContentCreation = async () => {
    if (!publicKey || !program || !creatorAccountPDA) return;
    
    if (!relayerPubkey) {
        setStatus({ type: 'error', message: 'Sponsorship unavailable: Relayer not configured.' });
        setShowSponsorModal(false);
        return;
    }

    if (!signTransaction) {
        setStatus({ type: 'error', message: 'Your wallet does not support partial signing required for sponsorship.' });
        setShowSponsorModal(false);
        return;
    }

    try {
        setLoading(true);
        setStatus({ type: null, message: '' });
        setShowSponsorModal(false);

        setStatus({ type: 'success', message: 'Uploading file to IPFS...' });
        const formData = new FormData();
        formData.append('file', primaryFile!);
        
        const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!uploadResponse.ok) throw new Error('Failed to upload file.');
        const { encryptedCid } = await uploadResponse.json();
        
        const priceBN = new anchor.BN(parseFloat(form.price) * anchor.web3.LAMPORTS_PER_SOL);
        const encryptedCidBuffer = Buffer.from(encryptedCid, 'hex');
        
        const transaction = new Transaction();
        
        let needsInit = false;
        try {
            await program.account.creatorAccount.fetch(creatorAccountPDA);
        } catch (e) { needsInit = true; }

        if (needsInit) {
            transaction.add(
                await program.methods
                    .initializeCreator()
                    .accounts({
                        creatorAccount: creatorAccountPDA,
                        creator: publicKey,
                        payer: relayerPubkey, 
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction()
            );
        }

        transaction.add(
            await program.methods
                .addContent(form.title, priceBN, encryptedCidBuffer)
                .accounts({
                    creatorAccount: creatorAccountPDA,
                    creator: publicKey,
                    payer: relayerPubkey,
                })
                .instruction()
        );

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = relayerPubkey; 

        const signedTx = await signTransaction(transaction);
        const serializedTx = signedTx.serialize({ requireAllSignatures: false });
        const txBase64 = serializedTx.toString('base64');

        setStatus({ type: 'success', message: 'Sending to Relayer for sponsorship...' });
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
        console.log('Sponsored Transaction Signature:', signature);
        
        setStatus({ type: 'success', message: 'Transaction Sponsored! Waiting for confirmation...' });
        await connection.confirmTransaction(signature, 'confirmed');

        setStatus({ type: 'success', message: `Content "${form.title}" published (Gas Sponsored)!` });
        resetForm();
        fetchCreatorContent();

    } catch (error: any) {
        console.error('Sponsored transaction failed:', error);
        setStatus({ type: 'error', message: error.message || 'Sponsorship failed' });
    } finally {
        setLoading(false);
    }
  };

  const handleCreateContent = async () => {
    if (!publicKey) {
      setStatus({ type: 'error', message: 'Wallet not connected. Please connect your wallet or sign in with Privy.' });
      return;
    }

    if (!isConnected) {
      setStatus({ type: 'error', message: 'Wallet connection not ready. Please wait a moment and try again.' });
      return;
    }

    if (!program) {
      setStatus({ type: 'error', message: 'Program not initialized. Please refresh the page.' });
      return;
    }

    // Verify we have a way to send transactions
    if (!privySendTx && !sendTransaction) {
      setStatus({ type: 'error', message: 'No transaction sender available. Please connect a wallet.' });
      return;
    }

    if (!form.title.trim()) {
      setStatus({ type: 'error', message: 'Please enter a title for your content.' });
      return;
    }

    if (!primaryFile) {
      setStatus({ type: 'error', message: 'Attach a file or media to gate' });
      return;
    }

    const balance = await connection.getBalance(publicKey);
    const MIN_SOL_REQUIRED = 0.005 * anchor.web3.LAMPORTS_PER_SOL;

    if (balance < MIN_SOL_REQUIRED) {
        setShowSponsorModal(true);
        return;
    }

    const usePrivyTx = !!privySendTx;

    try {
      setLoading(true);
      setStatus({ type: null, message: '' });

      // Step 1: Upload file to IPFS
      setStatus({ type: 'success', message: 'Uploading file to IPFS...' });
      const formData = new FormData();
      formData.append('file', primaryFile);
      
      let uploadResponse: Response;
      try {
        uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
      } catch (fetchError: any) {
        throw new Error(`Network error during upload: ${fetchError.message}`);
      }

      if (!uploadResponse.ok) {
        // Try to parse JSON error, but handle HTML error pages
        let errorMessage = 'Failed to upload file to IPFS.';
        try {
          const errorData = await uploadResponse.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = `Upload failed with status ${uploadResponse.status}.`;
        }
        throw new Error(errorMessage);
      }

      let uploadData: { encryptedCid: string };
      try {
        uploadData = await uploadResponse.json();
      } catch (parseError) {
        const text = await uploadResponse.text();
        console.error('Failed to parse upload response:', text.substring(0, 200));
        throw new Error('Invalid response from upload service. Please try again.');
      }

      if (!uploadData.encryptedCid) {
        throw new Error('Upload succeeded but no encrypted CID returned.');
      }

      const { encryptedCid } = uploadData;

      // Step 2: Initialize creator account if needed
      let currentCreatorAccount = creatorAccountData;
      if (!currentCreatorAccount) {
        setStatus({ type: 'success', message: 'Initializing creator account...' });
        try {
          // Verify wallet is connected
          if (!publicKey) {
            throw new Error('Wallet not connected. Please connect your wallet first.');
          }

          if (!creatorAccountPDA) {
            throw new Error('Failed to derive creator account address.');
          }

          // Check if account already exists before trying to initialize
          let accountExists = false;
          try {
            await program.account.creatorAccount.fetch(creatorAccountPDA);
            accountExists = true;
            currentCreatorAccount = await program.account.creatorAccount.fetch(creatorAccountPDA);
            setCreatorAccountData(currentCreatorAccount);
          } catch (fetchError: any) {
            // Account doesn't exist, proceed with initialization
          }

          if (accountExists) {
            // Account already exists, skip initialization
            setStatus({ type: 'success', message: 'Creator account found. Adding content...' });
          } else {
            const initTx = new Transaction().add(
              await program.methods
                .initializeCreator()
                .accounts({
                  creatorAccount: creatorAccountPDA,
                  creator: publicKey,
                  payer: publicKey,
                  systemProgram: SystemProgram.programId,
                })
                .instruction()
            );
          
            // Use getLatestBlockhashAndContext for better blockhash management
            const {
              value: { blockhash, lastValidBlockHeight }
            } = await connection.getLatestBlockhashAndContext('confirmed');
            
            initTx.recentBlockhash = blockhash;
            initTx.feePayer = publicKey;

            let initSignature: string;
            if (usePrivyTx && sendSolanaTransaction) {
              initSignature = await sendSolanaTransaction(initTx);
            } else {
              if (!sendTransaction) throw new Error('Wallet not available');
              initSignature = await sendTransaction(initTx, connection);
            }
            
            await connection.confirmTransaction({
              signature: initSignature,
              blockhash,
              lastValidBlockHeight
            }, 'confirmed');
            console.log('Transaction confirmed');
            
            // Add a delay to allow the RPC node to see the new account
            await new Promise(resolve => setTimeout(resolve, 2000)); 

            currentCreatorAccount = await program.account.creatorAccount.fetch(creatorAccountPDA);
            setCreatorAccountData(currentCreatorAccount);
            setStatus({ type: 'success', message: 'Creator account initialized. Adding content...' });
          }
        } catch (initError: any) {
          throw new Error(`Failed to initialize creator account: ${initError.message || 'Unknown error'}`);
        }
      }

      // Step 3: Build and send addContent transaction
      setStatus({ type: 'success', message: 'Publishing content on-chain...' });
      const priceBN = new anchor.BN(parseFloat(form.price) * anchor.web3.LAMPORTS_PER_SOL);
      const encryptedCidBuffer = Buffer.from(encryptedCid, 'hex');

      try {
        if (!publicKey || !creatorAccountPDA) {
          throw new Error('Wallet or creator account not available.');
        }

        const addContentTx = new Transaction().add(
          await program.methods
            .addContent(form.title, priceBN, encryptedCidBuffer)
            .accounts({
              creatorAccount: creatorAccountPDA,
              creator: publicKey,
              payer: publicKey, 
            })
            .instruction()
        );

        // Use getLatestBlockhashAndContext for better blockhash management
        const {
          value: { blockhash, lastValidBlockHeight }
        } = await connection.getLatestBlockhashAndContext('confirmed');
        
        addContentTx.recentBlockhash = blockhash;
        addContentTx.feePayer = publicKey;

        let addContentSignature: string;
        if (usePrivyTx && sendSolanaTransaction) {
          addContentSignature = await sendSolanaTransaction(addContentTx);
        } else {
          if (!sendTransaction) throw new Error('Wallet not available');
          addContentSignature = await sendTransaction(addContentTx, connection);
        }
        
        await connection.confirmTransaction({
          signature: addContentSignature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
      } catch (addContentError: any) {
        throw new Error(`Failed to publish content: ${addContentError.message || 'Unknown error'}`);
      }

      setStatus({
        type: 'success',
        message: `Content "${form.title}" published on-chain!`,
      });
      resetForm();
      fetchCreatorContent();
    } catch (error: any) {
      console.error('Failed to create content:', error);
      const errorMessage = error?.message || error?.toString() || 'Something went wrong';
      setStatus({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setPrimaryFile(files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Hero Header */}
        <div className="mb-12 text-center">
          <div className="inline-block mb-4">
            <span className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
              x402 Pay-to-Access Protocol
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white bg-clip-text text-transparent mb-4">
            Creator Hub
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Upload premium content, set your price, and earn directly.
            <br></br><span className="font-semibold text-blue-600 dark:text-blue-400"> Encrypted. Instant. On-chain.</span>
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {!isConnected && (
            <div className="w-full max-w-md mb-4">
              <SocialLogin 
                onSuccess={(walletAddress) => {
                  console.log('Wallet created:', walletAddress);
                  // Refresh page or update state
                  window.location.reload();
                }}
                onError={(error) => {
                  setStatus({ type: 'error', message: error.message });
                }}
              />
            </div>
          )}
          
          {!isConnected && (
            <div className="relative w-full max-w-md my-4">
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 text-gray-500 dark:text-gray-400">
                  or connect existing wallet
                </span>
              </div>
            </div>
          )}
          
          <WalletMultiButton className="!bg-gradient-to-r !from-blue-600 !to-purple-600 hover:!from-blue-700 hover:!to-purple-700 !rounded-xl !shadow-lg hover:!shadow-xl !transition-all !duration-200" />
          
          {/* Profile Badge */}
          {isConnected && (
            <div className="flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-full px-4 py-2 shadow-md border border-gray-200/50 dark:border-gray-700/50">
              {localProfile?.avatarUrl ? (
                <img 
                  src={localProfile.avatarUrl} 
                  alt="Avatar" 
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-purple-600" />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {localProfile?.displayName || username || (publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : 'Creator')}
              </span>
              <div className="flex items-center gap-1">
                {!username && (
                  <button
                    onClick={() => setShowUsernameSetup(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Set username
                  </button>
                )}
                <button
                  onClick={() => setShowProfileEditor(true)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit profile"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Username Setup Modal */}
        {showUsernameSetup && isConnected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <UsernameSetup
              onUsernameSet={handleUsernameSet}
              onSkip={handleSkipUsername}
              existingUsername={username}
            />
          </div>
        )}

        {/* Profile Editor Modal */}
        {showProfileEditor && isConnected && (
          <CreatorProfile
            onClose={() => setShowProfileEditor(false)}
            onUpdate={handleProfileUpdate}
            initialProfile={localProfile}
          />
        )}

        {/* Sponsorship Modal */}
        {showSponsorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200 dark:border-purple-700/50 p-6 max-w-md w-full text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <Zap className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Not enough SOL for gas?
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                    We noticed you don't have enough SOL to pay for the network fees. 
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
                        onClick={handleSponsoredContentCreation}
                        className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
                    >
                        Accept Sponsorship
                    </button>
                </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {status.type && (
          <div
            className={`mb-8 rounded-xl border-2 px-6 py-4 text-sm font-medium shadow-lg backdrop-blur-sm transition-all ${status.type === 'success'
                ? 'border-green-400 bg-green-50/90 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'border-red-400 bg-red-50/90 dark:bg-red-900/20 text-red-800 dark:text-red-300'}`}
          >
            <div className="flex items-center gap-3">
              {status.type === 'success' ? (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span>{status.message}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Content Form */}
          <section className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 space-y-6 hover:shadow-2xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Drop</h2>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Exclusive Track Preview"
                className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                placeholder="Tell your audience what makes this content special..."
                className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none resize-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Price (SOL) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">◎</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-10 pr-4 py-3 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none" />
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-6 transition-all ${isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`}
            >
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Upload Gated File <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col items-center justify-center py-6">
                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-center">
                  Drag & drop your file here, or click to browse
                </p>
                <input
                  type="file"
                  accept="image/*,.json,application/json,text/json,.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.txt,.md"
                  onChange={(e) => setPrimaryFile(e.target.files?.[0] || null)}
                  className="items-center justify-center mt-2 w-full text-sm text-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-900/20 file:text-blue-700 dark:file:text-blue-400 file:font-medium hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30 file:cursor-pointer" />
              </div>
              {primaryFile && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{primaryFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{bytesToMb(primaryFile.size)} MB</p>
                  </div>
                  <button
                    onClick={() => setPrimaryFile(null)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleCreateContent}
              disabled={loading || !isConnected}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-4 text-white font-bold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 text-lg"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Encrypt & Publish Drop</span>
                </>
              )}
            </button>
          </section>

          {/* Published Content */}
          <section className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8 space-y-6 hover:shadow-2xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Published Drops</h2>
                {creatorId && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Share:</span>
                    <Link 
                      href={username ? `/creators/${username}` : `/creators/${creatorId}`} 
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm"
                    >
                      {username 
                        ? `/creators/${username}` 
                        : `/creators/${creatorId.slice(0, 8)}...`}
                    </Link>
                    <button
                      onClick={copyShareLink}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Copy link"
                    >
                      {copiedLink ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    {!username && (
                      <button
                        onClick={() => setShowUsernameSetup(true)}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline ml-2"
                      >
                        Set username
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {fetchingContent ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Loading your content...</p>
                </div>
              </div>
            ) : creatorAccountData && creatorAccountData.content.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {creatorAccountData.content.map((content) => (
                  <div
                    key={content.id.toNumber()}
                    className="group rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                            {content.title}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          ID: {content.id.toNumber()}
                        </p>
                      </div>
                      <Link
                        href={`/creators/${creatorId}`}
                        className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 group-hover:shadow-md"
                      >
                        <span>View</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ◎ {(content.price.toNumber() / anchor.web3.LAMPORTS_PER_SOL).toFixed(3)}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">SOL</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {isConnected ? 'You have not published any drops yet.' : 'Connect your wallet to see your drops.'}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}