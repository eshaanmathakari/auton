'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const API_BASE_URL = '/api';

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
        <p className="text-sm text-gray-700 bg-gray-100 rounded-lg p-3 leading-relaxed">
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
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">x402 Pay-to-Access</p>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              Drop encrypted content, unlock with SOL
            </h1>
            <p className="text-gray-600 text-lg max-w-3xl leading-relaxed">
              Upload any premium file, decide whether to surface a spoiler, and let fans unlock it
              instantly. Funds route directly to your wallet—no custody, no refunds, no waiting.
            </p>
          </div>
          
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('creator')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'creator'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-[#E0E0E0] hover:bg-gray-50'
                }`}
              >
                Creator workspace
              </button>
              <button
                onClick={() => setActiveTab('explore')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'explore'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-[#E0E0E0] hover:bg-gray-50'
                }`}
              >
                Explore gated drops
              </button>
            </div>
            <WalletMultiButton className="!bg-gray-900 hover:!bg-gray-800 !rounded-lg !h-auto !py-2.5 !px-4" />
          </div>
        </div>

        {status.type && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {status.message}
          </div>
        )}

        {activeTab === 'creator' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-xl border border-[#E0E0E0] shadow-sm p-8 space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  Creator ID
                </label>
                <input
                  type="text"
                  value={creatorId}
                  onChange={(e) => setCreatorId(e.target.value)}
                  placeholder="e.g. wallet prefix or custom handle"
                  className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                />
              </div>

              {!connected && (
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">
                    Payout wallet address
                  </label>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="Provide a Solana address to receive unlocks"
                    className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  Drop title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Name of your gated content"
                  className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  placeholder="Short pitch. Mention format, runtime, or what buyers will receive."
                  className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">
                    Price ({form.assetType})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={form.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">
                    Asset
                  </label>
                  <select
                    value={form.assetType}
                    onChange={(e) => handleInputChange('assetType', e.target.value as FormState['assetType'])}
                    className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                  >
                    <option value="SOL">SOL</option>
                    <option value="USDC" disabled>
                      USDC (soon)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">
                    Content type
                  </label>
                  <select
                    value={form.contentKind}
                    onChange={(e) => handleInputChange('contentKind', e.target.value)}
                    className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
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
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Preview / spoiler
                </p>
                <div className="space-y-2">
                  {previewModes.map((mode) => (
                    <label
                      key={mode.value}
                      className="flex items-center gap-3 rounded-lg border border-[#E0E0E0] px-4 py-3 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="preview-mode"
                        value={mode.value}
                        checked={form.previewMode === mode.value}
                        onChange={(e) =>
                          handleInputChange('previewMode', e.target.value as FormState['previewMode'])
                        }
                        className="text-gray-900 focus:ring-gray-900"
                      />
                      <span>{mode.label}</span>
                    </label>
                  ))}
                  {form.previewMode === 'custom' && (
                    <div className="space-y-3 rounded-lg border border-dashed border-[#E0E0E0] bg-gray-50 p-4">
                      <textarea
                        value={form.previewText}
                        onChange={(e) => handleInputChange('previewText', e.target.value)}
                        rows={2}
                        placeholder="Optional teaser text (max ~500 chars)"
                        className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all resize-none"
                      />
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">
                          Optional teaser file
                        </label>
                        <input
                          type="file"
                          onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                          className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-gray-800 cursor-pointer"
                        />
                        {previewFile && (
                          <p className="text-xs text-gray-500 mt-2">
                            {previewFile.name} ({bytesToMb(previewFile.size)} MB)
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">
                    Categories / tags
                  </label>
                  <input
                    type="text"
                    value={form.categoriesInput}
                    onChange={(e) => handleInputChange('categoriesInput', e.target.value)}
                    placeholder="music, behind-the-scenes, code drop"
                    className="w-full rounded-lg border border-[#E0E0E0] bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                  />
                </div>
                <label className="inline-flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowDownload}
                    onChange={(e) => handleInputChange('allowDownload', e.target.checked)}
                    className="w-4 h-4 text-gray-900 border-[#E0E0E0] rounded focus:ring-gray-900"
                  />
                  Allow download after unlock (otherwise just stream inside app)
                </label>
              </div>

              <div className="rounded-lg border border-dashed border-[#E0E0E0] bg-gray-50 p-5">
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  Upload gated file
                </label>
                <input
                  type="file"
                  onChange={(e) => setPrimaryFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-gray-800 cursor-pointer"
                />
                {primaryFile && (
                  <p className="text-xs text-gray-500 mt-2">
                    {primaryFile.name} ({bytesToMb(primaryFile.size)} MB)
                  </p>
                )}
              </div>

              <button
                onClick={handleCreateContent}
                disabled={loading}
                className="w-full rounded-lg bg-gray-900 py-3.5 text-white font-semibold shadow-sm hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Encrypting...' : 'Encrypt & publish to paywall'}
              </button>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                ⚠️ On-chain purchases are final. We display a "no refunds" disclaimer to fans right
                before they unlock.
              </div>
            </section>

            <section className="bg-white rounded-xl border border-[#E0E0E0] shadow-sm p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">
                    Your encrypted drops
                  </h2>
                  <p className="text-sm text-gray-500">
                    Share <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{shareBase}/[contentId]</code> with
                    fans.
                  </p>
                </div>
              </div>
              {creatorContent.length === 0 && (
                <div className="text-center py-12 border border-dashed border-[#E0E0E0] rounded-lg">
                  <p className="text-sm text-gray-500">
                    Upload your first gated file to see it here.
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {creatorContent.map((content) => (
                  <div
                    key={content.id}
                    className="rounded-lg border border-[#E0E0E0] bg-gray-50 p-5 space-y-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {content.title}
                        </h3>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">{content.contentKind}</p>
                      </div>
                      <Link
                        href={`/content/${content.id}`}
                        className="text-sm text-gray-900 font-medium hover:underline flex items-center gap-1"
                      >
                        View paywall →
                      </Link>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{content.description}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-gray-900 px-3 py-1.5 text-white font-medium">
                        {content.price} {content.assetType}
                      </span>
                      <span className="rounded-full bg-gray-200 text-gray-700 px-3 py-1.5">
                        Preview: {content.preview?.enabled ? content.preview.mode : 'hidden'}
                      </span>
                      {content.allowDownload ? (
                        <span className="rounded-full bg-green-100 text-green-800 px-3 py-1.5">
                          Download enabled
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1.5">
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
          <section className="bg-white rounded-xl border border-[#E0E0E0] shadow-sm p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Pay-to-access catalog
              </h2>
              <p className="text-sm text-gray-600">
                Discover demo snippets. Unlock full files instantly with SOL on devnet.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {exploreContent.map((content) => (
                <div
                  key={content.id}
                  className="rounded-lg border border-[#E0E0E0] bg-gray-50 p-5 space-y-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{content.title}</h3>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">
                        {content.contentKind}
                      </p>
                    </div>
                    <span className="text-gray-900 font-semibold">
                      {content.price} {content.assetType}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {content.description}
                  </p>
                  {renderPreviewSnippet(content.preview)}
                  <Link
                    href={`/content/${content.id}`}
                    className="inline-flex items-center text-sm text-gray-900 hover:underline font-medium"
                  >
                    Unlock →
                  </Link>
                </div>
              ))}
              {exploreContent.length === 0 && (
                <div className="col-span-2 text-center py-12 border border-dashed border-[#E0E0E0] rounded-lg">
                  <p className="text-sm text-gray-500">No drops published yet. Check back soon.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
