import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { UploadContentParams, UploadContentResult } from '../types.js';

/**
 * Tool for uploading content to the Auton platform
 */
export const uploadContentTool: Tool = {
  name: 'upload_content',
  description: 'Upload new content to the Auton platform. Accepts file data (base64 encoded), title, description, price, and creator ID. Returns encrypted CID and upload metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'File data as base64 encoded string. The file will be uploaded to IPFS and encrypted.',
      },
      fileName: {
        type: 'string',
        description: 'Name of the file being uploaded (e.g., "document.pdf", "image.jpg")',
      },
      title: {
        type: 'string',
        description: 'Title of the content (required)',
      },
      description: {
        type: 'string',
        description: 'Description of the content (optional)',
      },
      price: {
        type: 'number',
        description: 'Price in SOL (required)',
      },
      creatorId: {
        type: 'string',
        description: 'Creator wallet address (required)',
      },
      apiBaseUrl: {
        type: 'string',
        description: 'API base URL (optional, defaults to http://localhost:3000/api)',
        default: 'http://localhost:3000/api',
      },
    },
    required: ['file', 'fileName', 'title', 'price', 'creatorId'],
  },
};

/**
 * Execute the upload content tool
 */
export async function executeUploadContent(
  params: UploadContentParams & { fileName: string }
): Promise<UploadContentResult> {
  try {
    const apiBaseUrl = params.apiBaseUrl || 'http://localhost:3000/api';
    const uploadUrl = `${apiBaseUrl}/upload`;

    // Convert base64 string to Buffer
    const base64Data = params.file;
    let fileBuffer: Buffer;
    
    // Handle base64 data (with or without data URL prefix)
    if (base64Data.startsWith('data:')) {
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64String = base64Data.split(',')[1];
      fileBuffer = Buffer.from(base64String, 'base64');
    } else {
      // Assume it's already base64 without prefix
      fileBuffer = Buffer.from(base64Data, 'base64');
    }

    // Create FormData for multipart/form-data upload (Node.js compatible)
    // Use Blob for Node.js 18+ compatibility
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    formData.append('file', blob, params.fileName);

    // Upload to the API
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: errorData.error || 'Upload failed',
        message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();

    return {
      success: true,
      encryptedCid: result.encryptedCid,
      cid: result.cid, // If public upload was used
      message: 'Content uploaded successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Upload error',
      message: error.message || 'Failed to upload content',
    };
  }
}

