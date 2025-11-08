'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type PreviewInfo = {
  mode: string;
  enabled: boolean;
  snippet?: string | null;
  previewUrl?: string | null;
  previewType?: string | null;
  previewContentType?: string | null;
};

type ContentSummary = {
  id: string;
  title: string;
  description: string;
  price: number;
  assetType: string;
  contentKind: string;
  allowDownload: boolean;
  creatorWalletAddress: string;
  preview?: PreviewInfo;
  categories?: string[];
  status: string;
  disclaimers?: {
    refunds?: string;
  };
  createdAt?: string;
};

const previewModes = [
  { label: 'Auto demo (first snippet for text)', value: 'auto' },
  { label: 'Custom teaser (text or file)', value: 'custom' },
  { label: 'No preview / fully gated', value: 'off' },
];

const contentKinds = [
  { label: 'Video', value: 'video' },
  { label: 'Audio', value: 'audio' },
  { label: 'Downloadable file', value: 'file' },
  { label: 'Text drop', value: 'text' },
];

type FormState = {
  title: string;
  description: string;
  price: string;
  assetType: 'SOL' | 'USDC';
  previewMode: 'auto' | 'custom' | 'off';
  previewText: string;
  categoriesInput: string;
  contentKind: string;
  allowDownload: boolean;
};

const defaultFormState: FormState = {
  title: '',
  description: '',
  price: '0.5',
  assetType: 'SOL',
  previewMode: 'auto',
  previewText: '',
  categoriesInput: '',
  contentKind: 'file',
  allowDownload: true,
};

const bytesToMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const [, base64] = result.split(',');
        resolve(base64 || '');
      } else {
        reject(new Error('Unsupported file format'));
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

export default function CreatorWorkspace() {
  const { publicKey, connected } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [creatorId, setCreatorId] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: 'error' | 'success' | null; message: string }>({
    type: null,
    message: '',
  });
  const [creatorContent, setCreatorContent] = useState<ContentSummary[]>([]);
  const [exploreContent, setExploreContent] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'creator' | 'explore'>('creator');
  const [shareBase, setShareBase] = useState('/content');

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareBase(`${window.location.origin}/content`);
    }
  }, []);

  useEffect(() => {
    if (publicKey && connected && mounted) {
      const wallet = publicKey.toString();
      setWalletAddress(wallet);
      setCreatorId((prev) => prev || wallet.slice(0, 8));
    }
  }, [publicKey, connected, mounted]);

  useEffect(() => {
    if (creatorId) {
      fetchCreatorContent();
    }
  }, [creatorId]);

  useEffect(() => {
    if (activeTab === 'explore') {
      fetchExploreContent();
    }
  }, [activeTab]);

  const handleInputChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(defaultFormState);
    setPrimaryFile(null);
    setPreviewFile(null);
  };

  const fetchCreatorContent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/creator/${creatorId}/content`);
      if (response.ok) {
        const data = await response.json();
        setCreatorContent(data.content || []);
      }
    } catch (error) {
      console.error('Failed to load creator content', error);
    }
  };

  const fetchExploreContent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/content`);
      if (response.ok) {
        const data = await response.json();
        setExploreContent(data.content || []);
      }
    } catch (error) {
      console.error('Failed to load explore content', error);
    }
  };

  const handleCreateContent = async () => {
    if (!creatorId || !walletAddress) {
      setStatus({ type: 'error', message: 'Connect your wallet or provide a payout address' });
      return;
    }

    if (!primaryFile) {
      setStatus({ type: 'error', message: 'Attach a file or media to gate' });
      return;
    }

    try {
      setLoading(true);
      setStatus({ type: null, message: '' });

      const fileData = await toBase64(primaryFile);
      const previewFileData = previewFile ? await toBase64(previewFile) : undefined;
      const categories = form.categoriesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch(`${API_BASE_URL}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          walletAddress,
          title: form.title,
          description: form.description,
          price: form.price,
          assetType: form.assetType,
          previewMode: form.previewMode,
          previewText: form.previewText,
          fileName: primaryFile.name,
          fileType: primaryFile.type,
          fileData,
          previewFileData,
          previewFileName: previewFile?.name,
          previewFileType: previewFile?.type,
          categories,
          contentKind: form.contentKind,
          allowDownload: form.allowDownload,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create content');
      }

      const data = await response.json();
      setStatus({
        type: 'success',
        message: `Encrypted drop published: ${data.content.title}`,
      });
      resetForm();
      fetchCreatorContent();
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const renderPreviewSnippet = (preview?: PreviewInfo) => {
    if (!preview?.enabled) {
      return <p className="text-sm text-gray-500">Preview disabled. Fully gated.</p>;
    }

    if (preview.previewType === 'text' && preview.snippet) {
      return (
        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
          {preview.snippet}
        </p>
      );
    }

    if (preview.previewType === 'file' && preview.previewUrl) {
      if (preview.previewContentType?.startsWith('video/')) {
        return (
          <video controls className="w-full rounded-lg">
            <source src={preview.previewUrl} type={preview.previewContentType} />
          </video>
        );
      }
      if (preview.previewContentType?.startsWith('audio/')) {
        return (
          <audio controls className="w-full">
            <source src={preview.previewUrl} type={preview.previewContentType} />
          </audio>
        );
      }
      if (preview.previewContentType?.startsWith('image/')) {
        return <img src={preview.previewUrl} alt="Preview" className="w-full rounded-lg" />;
      }
      return (
        <a
          href={preview.previewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-purple-600 underline"
        >
          View preview file
        </a>
      );
    }

    return <p className="text-sm text-gray-500">Preview processing...</p>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <header className="mb-8 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-purple-500">x402 Pay-to-Access</p>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mt-2">
              Drop encrypted content, unlock with SOL
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-3xl">
              Upload any premium file, decide whether to surface a spoiler, and let fans unlock it
              instantly. Funds route directly to your wallet—no custody, no refunds, no waiting.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('creator')}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                activeTab === 'creator'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-white/70 text-purple-600'
              }`}
            >
              Creator workspace
            </button>
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                activeTab === 'explore'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-white/70 text-purple-600'
              }`}
            >
              Explore gated drops
            </button>
          </div>
        </header>

        <div className="mb-6">
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
        </div>

        {status.type && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            {status.message}
          </div>
        )}

        {activeTab === 'creator' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Creator ID
                </label>
                <input
                  type="text"
                  value={creatorId}
                  onChange={(e) => setCreatorId(e.target.value)}
                  placeholder="e.g. wallet prefix or custom handle"
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>

              {!connected && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Payout wallet address
                  </label>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="Provide a Solana address to receive unlocks"
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drop title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Name of your gated content"
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  placeholder="Short pitch. Mention format, runtime, or what buyers will receive."
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Price ({form.assetType})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={form.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Asset
                  </label>
                  <select
                    value={form.assetType}
                    onChange={(e) => handleInputChange('assetType', e.target.value as FormState['assetType'])}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                  >
                    <option value="SOL">SOL</option>
                    <option value="USDC" disabled>
                      USDC (soon)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Content type
                  </label>
                  <select
                    value={form.contentKind}
                    onChange={(e) => handleInputChange('contentKind', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                  >
                    {contentKinds.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview / spoiler
                </p>
                <div className="space-y-3">
                  {previewModes.map((mode) => (
                    <label
                      key={mode.value}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <input
                        type="radio"
                        name="preview-mode"
                        value={mode.value}
                        checked={form.previewMode === mode.value}
                        onChange={(e) =>
                          handleInputChange('previewMode', e.target.value as FormState['previewMode'])
                        }
                      />
                      <span>{mode.label}</span>
                    </label>
                  ))}
                  {form.previewMode === 'custom' && (
                    <div className="space-y-3 rounded-lg border border-dashed border-purple-200 dark:border-purple-800 p-3">
                      <textarea
                        value={form.previewText}
                        onChange={(e) => handleInputChange('previewText', e.target.value)}
                        rows={2}
                        placeholder="Optional teaser text (max ~500 chars)"
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                      />
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          Optional teaser file
                        </label>
                        <input
                          type="file"
                          onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                          className="mt-1 w-full text-sm text-gray-600 dark:text-gray-300"
                        />
                        {previewFile && (
                          <p className="text-xs text-gray-500 mt-1">
                            {previewFile.name} ({bytesToMb(previewFile.size)} MB)
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Categories / tags
                  </label>
                  <input
                    type="text"
                    value={form.categoriesInput}
                    onChange={(e) => handleInputChange('categoriesInput', e.target.value)}
                    placeholder="music, behind-the-scenes, code drop"
                    className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.allowDownload}
                    onChange={(e) => handleInputChange('allowDownload', e.target.checked)}
                  />
                  Allow download after unlock (otherwise just stream inside app)
                </label>
              </div>

              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Upload gated file
                </label>
                <input
                  type="file"
                  onChange={(e) => setPrimaryFile(e.target.files?.[0] || null)}
                  className="mt-2 w-full text-sm text-gray-600 dark:text-gray-300"
                />
                {primaryFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    {primaryFile.name} ({bytesToMb(primaryFile.size)} MB)
                  </p>
                )}
              </div>

              <button
                onClick={handleCreateContent}
                disabled={loading}
                className="w-full rounded-lg bg-purple-600 py-3 text-white font-semibold shadow hover:bg-purple-700 disabled:bg-gray-400"
              >
                {loading ? 'Encrypting...' : 'Encrypt & publish to paywall'}
              </button>

              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
                ⚠️ On-chain purchases are final. We display a “no refunds” disclaimer to fans right
                before they unlock.
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Your encrypted drops
                  </h2>
                  <p className="text-sm text-gray-500">
                    Share <code className="font-mono text-xs">{shareBase}/[contentId]</code> with
                    fans.
                  </p>
                </div>
              </div>
              {creatorContent.length === 0 && (
                <p className="text-sm text-gray-500">
                  Upload your first gated file to see it here.
                </p>
              )}
              <div className="space-y-4">
                {creatorContent.map((content) => (
                  <div
                    key={content.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {content.title}
                        </h3>
                        <p className="text-sm text-gray-500">{content.contentKind}</p>
                      </div>
                      <Link
                        href={`/content/${content.id}`}
                        className="text-sm text-purple-600 hover:underline"
                      >
                        View paywall →
                      </Link>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{content.description}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <span className="rounded-full bg-purple-50 dark:bg-purple-900/30 px-3 py-1 text-purple-700 dark:text-purple-200 font-medium">
                        {content.price} {content.assetType}
                      </span>
                      <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1">
                        Preview: {content.preview?.enabled ? content.preview.mode : 'hidden'}
                      </span>
                      {content.allowDownload ? (
                        <span className="rounded-full bg-green-100 text-green-800 px-3 py-1">
                          Download enabled
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 text-yellow-800 px-3 py-1">
                          Stream only
                        </span>
                      )}
                    </div>
                    {renderPreviewSnippet(content.preview)}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'explore' && (
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-5">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Pay-to-access catalog
            </h2>
            <p className="text-sm text-gray-500">
              Discover demo snippets. Unlock full files instantly with SOL on devnet.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {exploreContent.map((content) => (
                <div
                  key={content.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{content.title}</h3>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {content.contentKind}
                      </p>
                    </div>
                    <span className="text-purple-600 font-semibold">
                      {content.price} {content.assetType}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {content.description}
                  </p>
                  {renderPreviewSnippet(content.preview)}
                  <Link
                    href={`/content/${content.id}`}
                    className="inline-flex items-center text-sm text-purple-600 hover:underline font-medium"
                  >
                    Unlock →
                  </Link>
                </div>
              ))}
              {exploreContent.length === 0 && (
                <p className="text-sm text-gray-500">No drops published yet. Check back soon.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
