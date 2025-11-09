
import { NextRequest, NextResponse } from 'next/server';
import database from '../../../../../lib/database';

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
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const { creatorId } = await params;
    const contentList = database.listContent({ creatorId }).map(sanitizeContent);
    return NextResponse.json({ content: contentList });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to list creator content', details: error.message }, { status: 500 });
  }
}
