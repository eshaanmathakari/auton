'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AutonProgram } from '@/lib/anchor/auton_program';
import IDL from '@/lib/anchor/auton_program.json';
import { User, Save, X, Link as LinkIcon, Loader2, Camera, Plus, Trash2 } from 'lucide-react';
import { getUserFriendlyErrorMessage, logWalletError } from '@/lib/transaction-utils';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;

if (!AUTON_PROGRAM_ID) {
  throw new Error('AUTON_PROGRAM_ID is not set in environment variables.');
}

const programId = new PublicKey(AUTON_PROGRAM_ID);

interface CreatorProfileProps {
  onClose: () => void;
  onUpdate: (profile: ProfileData) => void;
  initialProfile?: ProfileData | null;
}

interface ProfileData {
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks: Record<string, string>;
}

const SOCIAL_PLATFORMS = [
  { key: 'twitter', label: 'Twitter/X', placeholder: 'https://twitter.com/username' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
  { key: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' },
];

export default function CreatorProfile({ onClose, onUpdate, initialProfile }: CreatorProfileProps) {
  const { publicKey, sendTransaction } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [displayName, setDisplayName] = useState(initialProfile?.displayName || '');
  const [bio, setBio] = useState(initialProfile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatarUrl || '');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(
    initialProfile?.socialLinks || {}
  );
  const [activeSocialInputs, setActiveSocialInputs] = useState<string[]>(
    Object.keys(initialProfile?.socialLinks || {})
  );

  useEffect(() => {
    if (initialProfile) {
      setDisplayName(initialProfile.displayName || '');
      setBio(initialProfile.bio || '');
      setAvatarUrl(initialProfile.avatarUrl || '');
      setSocialLinks(initialProfile.socialLinks || {});
      setActiveSocialInputs(Object.keys(initialProfile.socialLinks || {}));
    }
  }, [initialProfile]);

  const connection = useMemo(() => new Connection(SOLANA_RPC_URL, 'confirmed'), []);

  const program = useMemo(() => {
    const provider = new anchor.AnchorProvider(connection, {
      publicKey: PublicKey.default,
      signAllTransactions: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(txs: T[]): Promise<T[]> => txs,
      signTransaction: async <T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(tx: T): Promise<T> => tx,
    }, { commitment: 'confirmed' });
    const idl = IDL as anchor.Idl;
    return new anchor.Program(idl, provider) as anchor.Program<AutonProgram>;
  }, [connection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey) {
      setError('Please connect your wallet');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Filter out empty social links
      const filteredSocialLinks: Record<string, string> = {};
      for (const [key, value] of Object.entries(socialLinks)) {
        if (value && value.trim()) {
          filteredSocialLinks[key] = value.trim();
        }
      }

      const profileData = {
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        socialLinks: filteredSocialLinks,
      };

      // 1. Upload Profile Data to IPFS (Public)
      const profileBlob = new Blob([JSON.stringify(profileData)], { type: 'application/json' });
      const formData = new FormData();
      formData.append('file', profileBlob, 'profile.json');

      const uploadResponse = await fetch('/api/upload?public=true', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload profile data to IPFS');
      }

      const { cid } = await uploadResponse.json();
      console.log('Profile uploaded to IPFS:', cid);

      // 2. Call Smart Contract to update profile CID
      const [creatorAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("creator"), publicKey.toBuffer()],
        programId
      );

      // Check if creator account exists
      try {
        await program.account.creatorAccount.fetch(creatorAccountPDA);
      } catch (e) {
        throw new Error("You must initialize your creator account (publish first drop) before setting a profile.");
      }

      const ix = await program.methods
        .updateProfile(cid)
        .accounts({
          creatorAccount: creatorAccountPDA,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const transaction = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      setSuccess('Profile updated successfully!');
      onUpdate(profileData);
      
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(getUserFriendlyErrorMessage(err) || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSocialLink = (platform: string) => {
    if (!activeSocialInputs.includes(platform)) {
      setActiveSocialInputs([...activeSocialInputs, platform]);
    }
  };

  const removeSocialLink = (platform: string) => {
    setActiveSocialInputs(activeSocialInputs.filter(p => p !== platform));
    const newLinks = { ...socialLinks };
    delete newLinks[platform];
    setSocialLinks(newLinks);
  };

  const availablePlatforms = SOCIAL_PLATFORMS.filter(
    p => !activeSocialInputs.includes(p.key)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
              <User className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar URL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Profile Picture URL
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-200 dark:border-purple-700"
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="flex-1 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm"
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              maxLength={100}
              className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">{displayName.length}/100 characters</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your audience about yourself..."
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">{bio.length}/500 characters</p>
          </div>

          {/* Social Links */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Social Links
            </label>
            
            <div className="space-y-3">
              {activeSocialInputs.map((platformKey) => {
                const platform = SOCIAL_PLATFORMS.find(p => p.key === platformKey);
                if (!platform) return null;
                
                return (
                  <div key={platform.key} className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-24">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {platform.label}
                      </span>
                    </div>
                    <input
                      type="url"
                      value={socialLinks[platform.key] || ''}
                      onChange={(e) => setSocialLinks({ ...socialLinks, [platform.key]: e.target.value })}
                      placeholder={platform.placeholder}
                      className="flex-1 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeSocialLink(platform.key)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Social Link */}
            {availablePlatforms.length > 0 && (
              <div className="mt-3">
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addSocialLink(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-600 dark:text-gray-400 cursor-pointer hover:border-blue-400 transition-colors outline-none appearance-none text-sm"
                  >
                    <option value="">+ Add social link...</option>
                    {availablePlatforms.map((platform) => (
                      <option key={platform.key} value={platform.key}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                  <Plus className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
              <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

