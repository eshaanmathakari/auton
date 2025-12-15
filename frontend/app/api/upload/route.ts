import { NextRequest, NextResponse } from 'next/server';
import PinataClient from '@pinata/sdk';
import { createCipheriv, randomBytes, createDecipheriv } from 'crypto';

// Lazy initialization - validate and create clients only when needed
function getPinataClient(): PinataClient {
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
  
  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    throw new Error('Pinata API keys are not set in environment variables.');
  }
  
  return new PinataClient(PINATA_API_KEY, PINATA_API_SECRET);
}

function getEncryptionKey(): Buffer {
  const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
  
  if (!ENCRYPTION_SECRET_KEY || ENCRYPTION_SECRET_KEY.length !== 64) { // 32 bytes = 64 hex chars
    throw new Error('ENCRYPTION_SECRET_KEY is not set or is not 32 bytes (64 hex characters).');
  }
  
  return Buffer.from(ENCRYPTION_SECRET_KEY, 'hex');
}

// Encryption function (matches test implementation)
function encryptCID(cid: string, encryptionKey: Buffer): string {
  const nonce = randomBytes(12); // 96-bit nonce for ChaCha20-Poly1305
  const cipher = createCipheriv('chacha20-poly1305', encryptionKey, nonce, {
    authTagLength: 16,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(cid, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Return: nonce(12) + encrypted(variable) + authTag(16) as hex string
  return Buffer.concat([nonce, encrypted, authTag]).toString('hex');
}

export async function POST(req: NextRequest) {
  try {
    // Validate configuration at request time (not module load time)
    let pinata: PinataClient;
    let encryptionKey: Buffer;
    
    try {
      pinata = getPinataClient();
      encryptionKey = getEncryptionKey();
    } catch (configError: any) {
      console.error('Configuration error:', configError);
      return NextResponse.json({ 
        error: 'Server configuration error', 
        message: configError.message 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert File to Node.js Readable Stream
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const readableStreamForFile = new (require('stream').Readable)();
    readableStreamForFile.push(fileBuffer);
    readableStreamForFile.push(null);

    const options = {
      pinataMetadata: {
        name: file.name,
      },
      pinataOptions: {
        cidVersion: 0 as 0, // Explicitly set as literal type 0
      },
    };

    const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
    const ipfsCid = result.IpfsHash;

    if (!ipfsCid) {
      throw new Error('Failed to get IPFS CID from Pinata.');
    }

    // Check if public upload is requested
    const isPublic = req.nextUrl.searchParams.get('public') === 'true';

    if (isPublic) {
      return NextResponse.json({ cid: ipfsCid });
    }

    const encryptedCid = encryptCID(ipfsCid, encryptionKey);

    return NextResponse.json({ encryptedCid });
  } catch (error: any) {
    console.error('IPFS upload or encryption failed:', error);
    return NextResponse.json({ 
      error: 'Failed to upload file or encrypt CID', 
      message: error.message 
    }, { status: 500 });
  }
}
