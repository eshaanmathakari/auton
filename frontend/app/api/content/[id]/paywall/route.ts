
import { NextRequest, NextResponse } from 'next/server';
import database from '../../../../../lib/database';
import { generatePaymentRequest, verifyPayment } from '../../../../../lib/utils/payment';
import { createAccessToken } from '../../../../../lib/utils/accessToken';

const PAYMENT_TTL_MINUTES = parseInt(process.env.PAYMENT_TTL_MINUTES || '10', 10);
const ACCESS_TOKEN_TTL_SECONDS = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '300', 10);
const API_BASE_URL = process.env.PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contentId } = await params;
    const buyerPubkey = req.nextUrl.searchParams.get('buyerPubkey');

    const content = database.getContent(contentId);
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    if (!buyerPubkey) {
      return NextResponse.json({ error: 'buyerPubkey is required to start a payment intent' }, { status: 400 });
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

    const headers = {
        'X-Payment-Required': 'true',
        'X-Payment-Id': paymentRequest.paymentId,
        'X-Asset-Type': content.assetType,
        'X-Payment-Address': content.creatorWalletAddress,
        'X-Preview-Mode': content.preview?.mode || 'auto',
        'X-Expires-At': expiresAt,
    };

    return NextResponse.json({
      error: 'Payment Required',
      paymentRequest: {
        ...paymentRequest,
        expiresAt,
        contentId,
        disclaimers: content.disclaimers,
      },
      content: sanitizeContent(content),
    }, { status: 402, headers });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create payment intent', details: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contentId } = await params;
    const { paymentId, signature, buyerPubkey } = await req.json();

    if (!paymentId || !signature || !buyerPubkey) {
      return NextResponse.json({ error: 'paymentId, signature, and buyerPubkey are required' }, { status: 400 });
    }

    const content = database.getContent(contentId);
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    const intent = database.getPaymentIntent(paymentId);
    if (!intent || intent.contentId !== contentId) {
      return NextResponse.json({ error: 'Payment intent not found for this content' }, { status: 400 });
    }

    if (intent.buyerPubkey !== buyerPubkey) {
      return NextResponse.json({ error: 'Buyer mismatch for this intent' }, { status: 403 });
    }

    if (intent.status === 'confirmed') {
      return NextResponse.json({
        message: 'Payment already confirmed',
        downloadUrl: intent.downloadUrl,
      });
    }

    if (new Date(intent.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Payment intent expired. Please refresh the paywall.' }, { status: 400 });
    }

    const verification = await verifyPayment(
      signature,
      intent.amount,
      intent.creatorWalletAddress,
      intent.assetType
    );

    if (!verification.valid) {
      return NextResponse.json({ error: 'Payment verification failed', details: verification.error }, { status: 402 });
    }

    const { token, tokenId, exp } = createAccessToken(
      { contentId, buyerPubkey },
      ACCESS_TOKEN_TTL_SECONDS
    );

    const downloadUrl = `${API_BASE_URL}/api/content/${contentId}/asset?token=${encodeURIComponent(token)}`;

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
      expiresAt: new Date(exp * 1000).toISOString(),
    });

    return NextResponse.json({
      success: true,
      accessToken: token,
      downloadUrl,
      expiresAt: new Date(exp * 1000).toISOString(),
      signatureUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      disclaimers: content.disclaimers,
    });
  } catch (error: any) {
    console.error('Error verifying payment', error);
    return NextResponse.json({ error: 'Failed to verify payment', details: error.message }, { status: 500 });
  }
}
