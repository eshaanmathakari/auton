'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AutonProgram } from '@/lib/anchor/auton_program';
import IDL from '@/lib/anchor/auton_program.json';
import { DashboardNav, type DashboardTab } from '@/components/DashboardNav';
import { DashboardMetrics } from '@/components/DashboardMetrics';
import { PublishedDropsList } from '@/components/PublishedDropsList';
import { CreateDropModal, type FormState } from '@/components/CreateDropModal';
import { GallerySection } from '@/components/GallerySection';
import type { ContentItem, CreatorAccountData } from '@/types/content';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;

if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set in environment variables.');
}

const programId = new PublicKey(AUTON_PROGRAM_ID);

const defaultFormState: FormState = {
  title: '',
  description: '',
  price: '0.02',
};

const bytesToMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

export default function CreatorWorkspace() {
  const { publicKey, connected, sendTransaction } = useWallet();
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

  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);
  
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
      if (provider && programId) {
        // Ensure IDL is properly typed as an Idl
        const idl = IDL as anchor.Idl;
        return new anchor.Program(idl, provider) as anchor.Program<AutonProgram>;
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
    if (!publicKey) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), publicKey.toBuffer()],
      programId
    );
    return pda;
  }, [publicKey]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (publicKey && connected && mounted) {
      setCreatorId(publicKey.toBase58());
      fetchCreatorContent();
    } else {
      setCreatorId('');
      setCreatorAccountData(null);
    }
  }, [publicKey, connected, mounted, creatorAccountPDA]);

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
    } catch (err: any) {
      console.error('Failed to fetch creator account:', err);
      setCreatorAccountData(null);
    } finally {
      setFetchingContent(false);
    }
  };

  const handleCreateContent = async () => {
    if (!publicKey || !connected || !program) {
      setStatus({ type: 'error', message: 'Connect your wallet to create content.' });
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

    try {
      setLoading(true);
      setStatus({ type: null, message: '' });

      const formData = new FormData();
      formData.append('file', primaryFile);
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload file to IPFS.');
      }
      const { encryptedCid }: { encryptedCid: string } = await uploadResponse.json();

      let currentCreatorAccount = creatorAccountData;
      if (!currentCreatorAccount) {
        setStatus({ type: 'success', message: 'Initializing creator account...' });
        const initTx = new Transaction().add(
          await program.methods
            .initializeCreator()
            .accounts({
              creatorAccount: creatorAccountPDA,
              creator: publicKey,
              systemProgram: SystemProgram.programId,
            })
            .instruction()
        );
        const { blockhash } = await connection.getLatestBlockhash();
        initTx.recentBlockhash = blockhash;
        initTx.feePayer = publicKey;

        const initSignature = await sendTransaction(initTx, connection);
        await connection.confirmTransaction(initSignature, 'confirmed');
        
        // Add a delay to allow the RPC node to see the new account
        await new Promise(resolve => setTimeout(resolve, 2000)); 

        currentCreatorAccount = await program.account.creatorAccount.fetch(creatorAccountPDA);
        setCreatorAccountData(currentCreatorAccount);
        setStatus({ type: 'success', message: 'Creator account initialized. Adding content...' });
      }

      // 3. Build and send addContent transaction
      const priceBN = new anchor.BN(parseFloat(form.price) * anchor.web3.LAMPORTS_PER_SOL);
      const encryptedCidBuffer = Buffer.from(encryptedCid, 'hex');

      const addContentTx = new Transaction().add(
        await program.methods
          .addContent(form.title, priceBN, encryptedCidBuffer)
          .accounts({
            creatorAccount: creatorAccountPDA,
            creator: publicKey,
          })
          .instruction()
      );

      const { blockhash: addContentBlockhash } = await connection.getLatestBlockhash();
      addContentTx.recentBlockhash = addContentBlockhash;
      addContentTx.feePayer = publicKey;

      const addContentSignature = await sendTransaction(addContentTx, connection);
      await connection.confirmTransaction(addContentSignature, 'confirmed');

      setStatus({
        type: 'success',
        message: `Content "${form.title}" published on-chain!`,
      });
      resetForm();
      fetchCreatorContent();
    } catch (error: any) {
      console.error('Failed to create content:', error);
      setStatus({ type: 'error', message: error.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = () => {
    // removed - drag state handled in modal
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // removed - drag state handled in modal
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <DashboardNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCreateClick={() => setIsCreateModalOpen(true)}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-7xl">

        {/* Status Messages */}
        {status.type && (
          <div
            className={`mb-8 rounded-xl border-2 px-6 py-4 text-sm font-medium shadow-lg backdrop-blur-sm transition-all ${
              status.type === 'success'
                ? 'border-green-400 bg-green-50/90 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'border-red-400 bg-red-50/90 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}
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

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Metrics */}
            <DashboardMetrics content={creatorAccountData?.content || []} loading={fetchingContent} creatorId={creatorId} program={program} connection={connection} />

            {/* Published Drops Section */}
            <section className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your Published Drops</h2>
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

        {/* Gallery Tab */}
        {activeTab === 'gallery' && <GallerySection />}
      </div>

      {/* Create Drop Modal */}
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
    </div>
  );
}