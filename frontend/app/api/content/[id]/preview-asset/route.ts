
import { NextRequest, NextResponse } from 'next/server';
import database from '../../../../../lib/database';
import { readObject } from '../../../../../lib/storage/storageProvider';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contentId } = await params;
    const content = database.getContent(contentId);
    if (!content || !content.preview?.previewStorageKey) {
      return NextResponse.json({ error: 'Preview asset not available' }, { status: 404 });
    }

    const previewBuffer = await readObject(content.preview.previewStorageKey);
    
    const headers = {
      'Content-Type': content.preview.previewContentType || 'application/octet-stream',
    };

    return new NextResponse(previewBuffer, { status: 200, headers });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to stream preview', details: error.message }, { status: 500 });
  }
}
