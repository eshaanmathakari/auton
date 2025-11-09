
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import database from '../../../lib/database';
import { encryptBuffer, buildTextPreview } from '../../../lib/utils/encryption';
import { saveObject } from '../../../lib/storage/storageProvider';

const API_BASE_URL = process.env.PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const NON_REFUNDABLE_MESSAGE =
  'All purchases settle on-chain and are final. Please review previews before unlocking.';

function sanitizeContent(content: any) {
  if (!content) return null;
  const {
    encryption,
    storageKey,
    previewStorageKey,
    preview = {},
    creatorWalletAddress,
    ...rest
  } = content;

  return {
    ...rest,
    creatorWalletAddress,
    preview: {
      mode: preview.mode,
      enabled: preview.enabled,
      snippet: preview.snippet || null,
      previewType: preview.previewType || null,
      previewContentType: preview.previewContentType || null,
      previewUrl: preview.previewStorageKey
        ? `${API_BASE_URL}/api/content/${content.id}/preview-asset`
        : null,
    },
  };
}

function ensureCreator(creatorId: string, walletAddress: string) {
  if (!creatorId) {
    throw new Error('creatorId is required');
  }
  const existing = database.getCreator(creatorId);
  if (existing) {
    if (walletAddress && existing.walletAddress !== walletAddress) {
      existing.walletAddress = walletAddress;
      database.save();
    }
    return existing;
  }
  if (!walletAddress) {
    throw new Error('walletAddress is required to bootstrap a creator');
  }
  return database.createCreator(creatorId, walletAddress);
}

function normalizeFileName(name = '') {
  return name.replace(/[^\w.\-]/g, '_');
}

async function buildPreview({
  previewMode,
  previewText,
  previewFileData,
  previewFileName,
  previewFileType,
  fileBuffer,
  fileType,
  creatorId,
  contentId,
}: any) {
  const preview: any = {
    enabled: previewMode !== 'off',
    mode: previewMode,
    snippet: null,
    previewStorageKey: null,
    previewType: null,
    previewContentType: null,
  };

  if (!preview.enabled) {
    return preview;
  }

  if (previewMode === 'auto') {
    if (fileType?.startsWith('text/')) {
      preview.snippet = buildTextPreview(fileBuffer);
      preview.previewType = 'text';
      return preview;
    }
    preview.enabled = false;
    return preview;
  }

  if (previewMode === 'custom') {
    if (previewText) {
      preview.snippet = previewText.slice(0, 500);
      preview.previewType = 'text';
      return preview;
    }
    if (previewFileData) {
      const previewBuffer = Buffer.from(previewFileData, 'base64');
      if (previewBuffer.length) {
        const previewKey = `content/${creatorId}/${contentId}/preview/${normalizeFileName(
          previewFileName || 'preview'
        )}`;
        await saveObject({
          key: previewKey,
          buffer: previewBuffer,
          contentType: previewFileType || 'application/octet-stream',
        });
        preview.previewStorageKey = previewKey;
        preview.previewContentType = previewFileType || 'application/octet-stream';
        preview.previewType = 'file';
        return preview;
      }
    }
  }

  return preview;
}

export async function POST(req: NextRequest) {
  try {
    const {
      creatorId,
      walletAddress,
      title,
      description,
      price,
      assetType = 'SOL',
      previewMode = 'auto',
      previewText,
      fileName,
      fileType,
      fileData,
      previewFileData,
      previewFileName,
      previewFileType,
      categories = [],
      contentKind = 'file',
      allowDownload = true,
    } = await req.json();

    if (!creatorId || !walletAddress || !title || !fileName || !fileType || !fileData) {
      return NextResponse.json({ error: 'creatorId, walletAddress, title, file metadata are required' }, { status: 400 });
    }

    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      return NextResponse.json({ error: 'price must be greater than 0' }, { status: 400 });
    }

    const creator = ensureCreator(creatorId, walletAddress);
    const fileBuffer = Buffer.from(fileData, 'base64');
    if (!fileBuffer.length) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
    }

    const contentId = crypto.randomUUID();
    const encrypted = encryptBuffer(fileBuffer);
    const storageKey = `content/${creatorId}/${contentId}/${normalizeFileName(fileName)}.enc`;
    await saveObject({ key: storageKey, buffer: encrypted.ciphertext, contentType: 'application/octet-stream' });

    const preview = await buildPreview({
      previewMode,
      previewText,
      previewFileData,
      previewFileName,
      previewFileType,
      fileBuffer,
      fileType,
      creatorId,
      contentId,
    });

    const record = database.createContent(creatorId, {
      id: contentId,
      title,
      description: description || '',
      price: numericPrice,
      assetType,
      categories,
      contentKind,
      allowDownload,
      creatorWalletAddress: creator.walletAddress,
      storageKey,
      originalFileName: fileName,
      contentType: fileType,
      fileSize: fileBuffer.length,
      encryption: {
        key: encrypted.key,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },
      preview,
      status: 'active',
      disclaimers: {
        refunds: NON_REFUNDABLE_MESSAGE,
      },
      contentHash: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
    });

    return NextResponse.json({
      message: 'Content saved and encrypted',
      content: sanitizeContent(record),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating content', error);
    return NextResponse.json({ error: 'Failed to create content', details: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const creatorId = req.nextUrl.searchParams.get('creatorId');
    const contentList = database.listContent(creatorId ? { creatorId } : undefined).map(sanitizeContent);
    return NextResponse.json({ content: contentList });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to list content', details: error.message }, { status: 500 });
  }
}
