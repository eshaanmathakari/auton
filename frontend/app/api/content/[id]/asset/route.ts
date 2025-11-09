
import { NextRequest, NextResponse } from 'next/server';
import database from '../../../../../lib/database';
import { verifyAccessToken } from '../../../../../lib/utils/accessToken';
import { readObject } from '../../../../../lib/storage/storageProvider';
import { decryptBuffer } from '../../../../../lib/utils/encryption';

function normalizeFileName(name = '') {
  return name.replace(/[^\w.\-]/g, '_');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contentId } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid || verification.payload.contentId !== contentId) {
      return NextResponse.json({ error: verification.error || 'Invalid token' }, { status: 401 });
    }

    const grant = database.getAccessGrant(verification.payload.tokenId);
    if (
      !grant ||
      grant.contentId !== contentId ||
      grant.buyerPubkey !== verification.payload.buyerPubkey
    ) {
      return NextResponse.json({ error: 'Grant not found for token' }, { status: 401 });
    }

    if (new Date(grant.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Access token expired' }, { status: 401 });
    }

    const content = database.getContent(contentId);
    if (!content) {
      return NextResponse.json({ error: 'Content missing' }, { status: 404 });
    }

    const encryptedBuffer = await readObject(content.storageKey);
    const decrypted = decryptBuffer({
      ciphertext: encryptedBuffer,
      key: content.encryption.key,
      iv: content.encryption.iv,
      authTag: content.encryption.authTag,
    });

    const headers = {
      'Content-Type': content.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${normalizeFileName(content.originalFileName)}"`,
    };

    return new NextResponse(decrypted, { status: 200, headers });
  } catch (error: any) {
    console.error('Error streaming protected content', error);
    return NextResponse.json({ error: 'Failed to stream content', details: error.message }, { status: 500 });
  }
}
