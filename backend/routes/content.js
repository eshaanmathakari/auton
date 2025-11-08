import express from 'express';
import crypto from 'crypto';
import database from '../database.js';
import { encryptBuffer, decryptBuffer, buildTextPreview } from '../utils/encryption.js';
import { generatePaymentRequest, verifyPayment } from '../utils/payment.js';
import { createAccessToken, verifyAccessToken } from '../utils/accessToken.js';
import { saveObject, readObject } from '../storage/storageProvider.js';

const router = express.Router();

const PAYMENT_TTL_MINUTES = parseInt(process.env.PAYMENT_TTL_MINUTES || '10', 10);
const ACCESS_TOKEN_TTL_SECONDS = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '300', 10);
const NON_REFUNDABLE_MESSAGE =
  'All purchases settle on-chain and are final. Please review previews before unlocking.';
const API_BASE_URL = process.env.PUBLIC_API_BASE || 'http://localhost:3001';

function sanitizeContent(content) {
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
        ? `${API_BASE_URL}/content/${content.id}/preview-asset`
        : null,
    },
  };
}

function ensureCreator(creatorId, walletAddress) {
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
}) {
  const preview = {
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

router.post('/content', async (req, res) => {
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
    } = req.body;

    if (!creatorId || !walletAddress || !title || !fileName || !fileType || !fileData) {
      return res.status(400).json({ error: 'creatorId, walletAddress, title, file metadata are required' });
    }

    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      return res.status(400).json({ error: 'price must be greater than 0' });
    }

    const creator = ensureCreator(creatorId, walletAddress);
    const fileBuffer = Buffer.from(fileData, 'base64');
    if (!fileBuffer.length) {
      return res.status(400).json({ error: 'Uploaded file is empty' });
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

    res.status(201).json({
      message: 'Content saved and encrypted',
      content: sanitizeContent(record),
    });
  } catch (error) {
    console.error('Error creating content', error);
    res.status(500).json({ error: 'Failed to create content', details: error.message });
  }
});

router.get('/content', (req, res) => {
  try {
    const { creatorId } = req.query;
    const contentList = database.listContent(creatorId ? { creatorId } : undefined).map(sanitizeContent);
    res.json({ content: contentList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list content', details: error.message });
  }
});

router.get('/creator/:creatorId/content', (req, res) => {
  try {
    const { creatorId } = req.params;
    const contentList = database.listContent({ creatorId }).map(sanitizeContent);
    res.json({ content: contentList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list creator content', details: error.message });
  }
});

router.get('/content/:contentId', (req, res) => {
  const { contentId } = req.params;
  const record = database.getContent(contentId);
  if (!record) {
    return res.status(404).json({ error: 'Content not found' });
  }
  res.json({
    content: sanitizeContent(record),
  });
});

router.get('/content/:contentId/paywall', (req, res) => {
  const { contentId } = req.params;
  const { buyerPubkey } = req.query;

  const content = database.getContent(contentId);
  if (!content) {
    return res.status(404).json({ error: 'Content not found' });
  }

  if (!buyerPubkey) {
    return res.status(400).json({ error: 'buyerPubkey is required to start a payment intent' });
  }

  const expiresAt = new Date(Date.now() + PAYMENT_TTL_MINUTES * 60 * 1000).toISOString();
  const paymentRequest = generatePaymentRequest(content.creatorWalletAddress, content.price, content.assetType);

  database.createPaymentIntent({
    id: paymentRequest.paymentId,
    contentId,
    buyerPubkey,
    amount: content.price,
    assetType: content.assetType,
    creatorWalletAddress: content.creatorWalletAddress,
    expiresAt,
  });

  res
    .status(402)
    .set({
      'X-Payment-Required': 'true',
      'X-Payment-Id': paymentRequest.paymentId,
      'X-Asset-Type': content.assetType,
      'X-Payment-Address': content.creatorWalletAddress,
      'X-Preview-Mode': content.preview?.mode || 'auto',
      'X-Expires-At': expiresAt,
    })
    .json({
      error: 'Payment Required',
      paymentRequest: {
        ...paymentRequest,
        expiresAt,
        contentId,
        disclaimers: content.disclaimers,
      },
      content: sanitizeContent(content),
    });
});

router.post('/content/:contentId/paywall', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { paymentId, signature, buyerPubkey } = req.body;

    if (!paymentId || !signature || !buyerPubkey) {
      return res.status(400).json({ error: 'paymentId, signature, and buyerPubkey are required' });
    }

    const content = database.getContent(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const intent = database.getPaymentIntent(paymentId);
    if (!intent || intent.contentId !== contentId) {
      return res.status(400).json({ error: 'Payment intent not found for this content' });
    }

    if (intent.buyerPubkey !== buyerPubkey) {
      return res.status(403).json({ error: 'Buyer mismatch for this intent' });
    }

    if (intent.status === 'confirmed') {
      return res.status(200).json({
        message: 'Payment already confirmed',
        downloadUrl: intent.downloadUrl,
      });
    }

    if (new Date(intent.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Payment intent expired. Please refresh the paywall.' });
    }

    const verification = await verifyPayment(
      signature,
      intent.amount,
      intent.creatorWalletAddress,
      intent.assetType
    );

    if (!verification.valid) {
      return res.status(402).json({ error: 'Payment verification failed', details: verification.error });
    }

    const { token, tokenId, exp } = createAccessToken(
      { contentId, buyerPubkey },
      ACCESS_TOKEN_TTL_SECONDS
    );

    const downloadUrl = `${API_BASE_URL}/content/${contentId}/asset?token=${encodeURIComponent(token)}`;

    database.updatePaymentIntent(paymentId, {
      status: 'confirmed',
      signature,
      downloadUrl,
    });

    database.addAccessGrant({
      tokenId,
      contentId,
      buyerPubkey,
      signature,
      paymentId,
      expiresAt: new Date(exp).toISOString(),
    });

    res.json({
      success: true,
      accessToken: token,
      downloadUrl,
      expiresAt: new Date(exp).toISOString(),
      signatureUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      disclaimers: content.disclaimers,
    });
  } catch (error) {
    console.error('Error verifying payment', error);
    res.status(500).json({ error: 'Failed to verify payment', details: error.message });
  }
});

router.get('/content/:contentId/asset', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid || verification.payload.contentId !== contentId) {
      return res.status(401).json({ error: verification.error || 'Invalid token' });
    }

    const grant = database.getAccessGrant(verification.payload.tokenId);
    if (
      !grant ||
      grant.contentId !== contentId ||
      grant.buyerPubkey !== verification.payload.buyerPubkey
    ) {
      return res.status(401).json({ error: 'Grant not found for token' });
    }

    if (new Date(grant.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Access token expired' });
    }

    const content = database.getContent(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content missing' });
    }

    const encryptedBuffer = await readObject(content.storageKey);
    const decrypted = decryptBuffer({
      ciphertext: encryptedBuffer,
      key: content.encryption.key,
      iv: content.encryption.iv,
      authTag: content.encryption.authTag,
    });

    res.setHeader('Content-Type', content.contentType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${normalizeFileName(content.originalFileName)}"`
    );
    res.send(decrypted);
  } catch (error) {
    console.error('Error streaming protected content', error);
    res.status(500).json({ error: 'Failed to stream content', details: error.message });
  }
});

router.get('/content/:contentId/preview-asset', async (req, res) => {
  try {
    const { contentId } = req.params;
    const content = database.getContent(contentId);
    if (!content || !content.preview?.previewStorageKey) {
      return res.status(404).json({ error: 'Preview asset not available' });
    }

    const previewBuffer = await readObject(content.preview.previewStorageKey);
    res.setHeader('Content-Type', content.preview.previewContentType || 'application/octet-stream');
    res.send(previewBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stream preview', details: error.message });
  }
});

export default router;
