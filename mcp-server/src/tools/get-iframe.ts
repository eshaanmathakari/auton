import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GetIframeParams, GetIframeResult } from '../types.js';

/**
 * Tool for generating iframe embed code for content viewer
 */
export const getIframeTool: Tool = {
  name: 'get_content_iframe',
  description: 'Generate iframe HTML code for embedding an Auton content viewer. Returns the complete iframe tag with proper attributes for embedding on external websites.',
  inputSchema: {
    type: 'object',
    properties: {
      creatorId: {
        type: 'string',
        description: 'Creator wallet address or username (required)',
      },
      contentId: {
        type: 'string',
        description: 'Content ID (optional, for specific content)',
      },
      baseUrl: {
        type: 'string',
        description: 'Frontend base URL (optional, defaults to http://localhost:3000)',
        default: 'http://localhost:3000',
      },
      width: {
        type: 'string',
        description: 'Iframe width (optional, default: "100%")',
        default: '100%',
      },
      height: {
        type: 'string',
        description: 'Iframe height (optional, default: "600px")',
        default: '600px',
      },
    },
    required: ['creatorId'],
  },
};

/**
 * Execute the get iframe tool
 */
export async function executeGetIframe(params: GetIframeParams): Promise<GetIframeResult> {
  try {
    const baseUrl = params.baseUrl || 'http://localhost:3000';
    const width = params.width || '100%';
    const height = params.height || '600px';

    // Construct the content viewer URL
    let url = `${baseUrl}/creators/${encodeURIComponent(params.creatorId)}`;
    if (params.contentId) {
      url += `?contentId=${encodeURIComponent(params.contentId)}`;
    }

    // Generate iframe HTML code
    const iframeCode = `<iframe 
  src="${url}" 
  width="${width}" 
  height="${height}"
  frameborder="0"
  allowfullscreen
  style="border: none; border-radius: 8px;">
</iframe>`;

    return {
      success: true,
      iframeCode,
      url,
      message: 'Iframe code generated successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      error: 'Iframe generation error',
      message: error.message || 'Failed to generate iframe code',
    };
  }
}

