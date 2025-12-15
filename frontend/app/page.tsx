'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AutonProgram } from '@/lib/anchor/auton_program';
import IDL from '@/lib/anchor/auton_program.json';
import { DashboardNav, type DashboardTab } from '@/components/DashboardNav';
import { DashboardMetrics } from '@/components/DashboardMetrics';
import { PublishedDropsList } from '@/components/PublishedDropsList';
import { CreateDropModal, type FormState } from '@/components/CreateDropModal';
import { GallerySection } from '@/components/GallerySection';
import type { ContentItem, CreatorAccountData } from '@/types/content';
import UsernameSetup from '@/components/UsernameSetup';
import CreatorProfile from '@/components/CreatorProfile';
import { SocialLogin } from '@/components/SocialLogin';
import { usePrivy } from '@privy-io/react-auth';
import { usePrivySolanaWallet, usePrivySendTransaction } from '@/lib/privy-solana-adapter';
import { User, CheckCircle, Zap, Settings, Shield, Globe, Coins, Play } from 'lucide-react';

const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;
const RELAYER_PUBKEY_STR = process.env.NEXT_PUBLIC_RELAYER_PUBKEY;
const IPFS_GATEWAY_URL = 'https://ipfs.io/ipfs/';

if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set in environment variables.');
}

const relayerPubkey = RELAYER_PUBKEY_STR ? new PublicKey(RELAYER_PUBKEY_STR) : null;

// Re-defining types to ensure self-containment if imports fail
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
  
  const publicKey = walletPublicKey || privySolanaWallet?.publicKey || null;
  const isConnected = connected || (privyAuthenticated && !!privySolanaWallet?.publicKey);
  
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
  
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [localProfile, setLocalProfile] = useState<any | null>(null);
  const [showSponsorModal, setShowSponsorModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const provider = useMemo(() => {
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
    }
    return null;
  }, [provider]);

  const creatorAccountPDA = useMemo(() => {
    const activePublicKey = walletPublicKey || privySolanaWallet?.publicKey;
    if (!activePublicKey || !program) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), activePublicKey.toBuffer()],
      program.programId
    );
    return pda;
  }, [walletPublicKey, privySolanaWallet?.publicKey, program]);

  const fetchUsername = useCallback(async () => {
    if (!program || !publicKey) return;
    try {
        const accounts = await program.account.usernameAccount.all([
            {
                memcmp: {
                    offset: 8,
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

  const handleProfileUpdate = (profile: any) => {
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
    setIsCreateModalOpen(false);
  };

  const fetchCreatorContent = async () => {
    if (!creatorAccountPDA || !program) return;

    setFetchingContent(true);
    try {
      const account = await program.account.creatorAccount.fetch(creatorAccountPDA);
      setCreatorAccountData(account);
      
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
      const errorMessage = err?.message || err?.toString() || '';
      if (errorMessage.includes('Account does not exist') || 
          errorMessage.includes('AccountNotInitialized')) {
        setCreatorAccountData(null);
      } else {
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
        setStatus({ type: 'error', message: 'Your wallet does not support partial signing.' });
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

        setStatus({ type: 'success', message: 'Sending to Relayer...' });
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
        await connection.confirmTransaction(signature, 'confirmed');

        setStatus({ type: 'success', message: `Content "${form.title}" published!` });
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
    if (!publicKey || !isConnected || !program) {
      setStatus({ type: 'error', message: 'Wallet connection not ready.' });
      return;
    }
    if (!privySendTx && !sendTransaction) return;
    if (!form.title.trim() || !primaryFile) {
      setStatus({ type: 'error', message: 'Please complete the form.' });
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

      setStatus({ type: 'success', message: 'Uploading to IPFS...' });
      const formData = new FormData();
      formData.append('file', primaryFile);
      
      const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadResponse.ok) throw new Error('Failed to upload.');
      const { encryptedCid } = await uploadResponse.json();

      let currentCreatorAccount = creatorAccountData;
      if (!currentCreatorAccount) {
        setStatus({ type: 'success', message: 'Initializing account...' });
        try {
          await program.account.creatorAccount.fetch(creatorAccountPDA);
        } catch (e) {
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
            const { value: { blockhash, lastValidBlockHeight } } = await connection.getLatestBlockhashAndContext('confirmed');
            initTx.recentBlockhash = blockhash;
            initTx.feePayer = publicKey;

            let initSignature: string;
            if (usePrivyTx && sendSolanaTransaction) initSignature = await sendSolanaTransaction(initTx);
            else {
                if (!sendTransaction) throw new Error('Wallet not available');
                initSignature = await sendTransaction(initTx, connection);
            }
            await connection.confirmTransaction({ signature: initSignature, blockhash, lastValidBlockHeight }, 'confirmed');
            await new Promise(resolve => setTimeout(resolve, 2000)); 
        }
      }

      setStatus({ type: 'success', message: 'Publishing...' });
      const priceBN = new anchor.BN(parseFloat(form.price) * anchor.web3.LAMPORTS_PER_SOL);
      const encryptedCidBuffer = Buffer.from(encryptedCid, 'hex');

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

      const { value: { blockhash, lastValidBlockHeight } } = await connection.getLatestBlockhashAndContext('confirmed');
      addContentTx.recentBlockhash = blockhash;
      addContentTx.feePayer = publicKey;

      let addContentSignature: string;
      if (usePrivyTx && sendSolanaTransaction) addContentSignature = await sendSolanaTransaction(addContentTx);
      else {
          if (!sendTransaction) throw new Error('Wallet not available');
          addContentSignature = await sendTransaction(addContentTx, connection);
      }
      
      await connection.confirmTransaction({ signature: addContentSignature, blockhash, lastValidBlockHeight }, 'confirmed');

      setStatus({ type: 'success', message: `Content published!` });
      resetForm();
      fetchCreatorContent();
    } catch (error: any) {
      console.error('Failed to create content:', error);
      setStatus({ type: 'error', message: error.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  // ------------------------------------------------------------------
  // 1. HERO VIEW (Unauthenticated)
  // ------------------------------------------------------------------
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
        {/* Background Grid/Effect */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-70" 
             style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 text-center space-y-12">
          
          {/* Main Title - Glitch Effect Potential */}
          <div className="space-y-4">
            <h1 className="font-pixel text-[8rem] md:text-[10rem] leading-none text-transparent bg-clip-text bg-gradient-to-br from-neon-green to-neon-blue drop-shadow-[0_0_15px_rgba(87,242,135,0.5)]">
              AUTON
            </h1>
            <p className="font-mono text-zinc-400 text-lg md:text-2xl tracking-widest uppercase">
              Decentralized . Encrypted . Forever
            </p>
          </div>

          {/* Connect Button */}
          <div className="w-full max-w-md">
             <div className="retro-card !border-neon-green bg-black/50 backdrop-blur-sm p-8 flex flex-col gap-6 items-center">
                <div className="flex items-center gap-2 text-neon-green font-pixel text-xl animate-pulse">
                   <Play className="w-6 h-6 fill-current" />
                   <span>READY TO START?</span>
                </div>
                
                <div className="flex w-full items-center justify-center gap-4">
                  <div className="flex-1">
                    <WalletMultiButton className="!w-full !justify-center !font-pixel !text-sm !h-14 !bg-neon-green !text-black !border-none hover:!bg-white hover:!scale-105 transition-all !uppercase" />
                  </div>

                  {/* Custom Vertical Divider */}
                  <div className="flex flex-col items-center justify-center h-14">
                    <div className="w-px h-full bg-zinc-700"></div>
                  </div>

                  <div className="flex-1 ml-5">
                    <SocialLogin 
                      onSuccess={(walletAddress) => {
                        console.log('Wallet created:', walletAddress);
                        window.location.reload();
                      }}
                      onError={(error) => {
                        setStatus({ type: 'error', message: error.message });
                      }}
                    />
                  </div>
                </div>

                <div className="text-zinc-500 font-mono text-xs mt-4">
                   <p>POWERED BY SOLANA • X402 PROTOCOL</p>
                </div>
             </div>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full text-left">
             {[
               { icon: Shield, title: "ENCRYPTED", desc: "AES-256-GCM encryption on IPFS. Only payers get the key." },
               { icon: Coins, title: "DIRECT PAY", desc: "0% Middleman fees on tips. 99.25% on unlocks." },
               { icon: Globe, title: "DECENTRALIZED", desc: "Unstoppable content. You own your keys and data." }
             ].map((feature, idx) => (
               <div key={idx} className="retro-card group hover:bg-zinc-900">
                  <feature.icon className="w-8 h-8 text-neon-pink mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="font-pixel text-2xl text-white mb-2">{feature.title}</h3>
                  <p className="font-mono text-sm text-zinc-400">{feature.desc}</p>
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 2. DASHBOARD VIEW (Authenticated)
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCreateClick={() => setIsCreateModalOpen(true)}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* User Profile Bar */}
        <div className="retro-card mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-zinc-800 border-2 border-neon-yellow flex items-center justify-center overflow-hidden">
                 {localProfile?.avatarUrl ? (
                    <img src={localProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                    <User className="w-10 h-10 text-neon-yellow" />
                 )}
              </div>
              <div>
                 <h2 className="font-pixel text-4xl text-white">
                    {localProfile?.displayName || username || 'UNNAMED'}
                 </h2>
                 <div className="flex items-center gap-2 text-zinc-400 font-mono text-sm">
                    <span>{publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}</span>
                    {!username && (
                       <button onClick={() => setShowUsernameSetup(true)} className="text-neon-blue hover:underline">
                          [SET USERNAME]
                       </button>
                    )}
                 </div>
              </div>
           </div>
           
           <div className="flex gap-4">
              <button 
                onClick={() => setShowProfileEditor(true)}
                className="retro-btn text-sm px-4 py-2"
              >
                 EDIT PROFILE
              </button>
              <button 
                onClick={copyShareLink}
                className="retro-btn text-sm px-4 py-2 border-neon-blue text-neon-blue hover:bg-neon-blue hover:text-white"
              >
                 {copiedLink ? 'COPIED!' : 'SHARE LINK'}
              </button>
           </div>
        </div>

        {/* Status Messages */}
        {status.type && (
          <div className={`mb-8 p-4 border font-mono text-sm ${
            status.type === 'success' 
              ? 'border-neon-green bg-neon-green/10 text-neon-green' 
              : 'border-neon-pink bg-neon-pink/10 text-neon-pink'
          }`}>
            <p className="flex items-center gap-2">
               {status.type === 'success' ? <CheckCircle className="w-4 h-4"/> : <Zap className="w-4 h-4"/>}
               {status.message}
            </p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <DashboardMetrics 
               content={creatorAccountData?.content || []} 
               loading={fetchingContent} 
               creatorId={creatorId} 
               program={program} 
               connection={connection} 
            />

            <section>
              <h3 className="font-pixel text-3xl text-white mb-6 flex items-center gap-2">
                 <span className="text-neon-green">#</span> PUBLISHED DROPS
              </h3>
              <PublishedDropsList
                content={creatorAccountData?.content || []}
                loading={fetchingContent}
                creatorId={creatorId}
                connected={connected}
                program={program}
              />
            </section>
          </div>
        )}

        {activeTab === 'gallery' && <GallerySection />}
      </div>

      {/* Modals */}
      <CreateDropModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateContent}
        form={form}
        onFormChange={handleInputChange}
        primaryFile={primaryFile}
        onFileChange={setPrimaryFile}
        loading={loading}
        connected={connected}
      />

      {showUsernameSetup && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <UsernameSetup
            onUsernameSet={handleUsernameSet}
            onSkip={handleSkipUsername}
            existingUsername={username}
          />
        </div>
      )}

      {showProfileEditor && (
        <CreatorProfile
          onClose={() => setShowProfileEditor(false)}
          onUpdate={handleProfileUpdate}
          initialProfile={localProfile}
        />
      )}

      {showSponsorModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="retro-card max-w-md w-full text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neon-yellow/20 rounded-full border border-neon-yellow">
                    <Zap className="w-8 h-8 text-neon-yellow" />
                </div>
                <h2 className="font-pixel text-2xl text-white">
                    INSUFFICIENT GAS
                </h2>
                <p className="font-mono text-zinc-400 text-sm">
                    You don't have enough SOL for the network fee.
                    <br />
                    <span className="text-white">We can sponsor this transaction for you!</span>
                </p>
                <div className="flex gap-4 pt-2">
                    <button
                        onClick={() => setShowSponsorModal(false)}
                        className="retro-btn flex-1"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleSponsoredContentCreation}
                        className="retro-btn-primary flex-1"
                    >
                        ACCEPT SPONSOR
                    </button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
}