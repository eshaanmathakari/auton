/**
 * Auton Agent SDK
 * 
 * Simple TypeScript SDK for AI agents to integrate with Auton.
 * Enables agents to publish content and earn SOL directly.
 */

export interface AutonConfig {
  apiKey: string;
  baseUrl?: string;
  walletAddress?: string;
}

export interface ContentMetadata {
  title: string;
  description?: string;
  price: number; // in SOL
  assetType?: 'SOL' | 'USDC';
}

export interface PaymentInstruction {
  id: string;
  version: number;
  payment_requirements: Array<{
    asset: string;
    pay_to: string;
    network: string;
    description: string;
    max_amount_required: string;
  }>;
  name: string;
  description: string;
  created_at: string;
}

export interface PaymentLink {
  paymentId: string;
  contentId: string;
  amount: number;
  assetType: string;
  paymentAddress: string;
  expiresAt: string;
  feeBreakdown: {
    contentPrice: number;
    platformFeeAmount: number;
    platformFeePercent: string;
    creatorReceives: number;
    creatorReceivesPercent: string;
  };
}

export class AutonAgentSDK {
  private apiKey: string;
  private baseUrl: string;
  private walletAddress?: string;

  constructor(config: AutonConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'http://localhost:3001';
    this.walletAddress = config.walletAddress;
  }

  /**
   * Create an API key for this agent
   * Call this once to get your API key, then store it securely
   */
  static async createApiKey(
    walletAddress: string,
    name: string,
    baseUrl?: string
  ): Promise<{ id: string; key: string; name: string }> {
    const url = (baseUrl || 'http://localhost:3001') + '/api/v1/api-keys';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create API key');
    }

    const data = await response.json();
    return {
      id: data.apiKey.id,
      key: data.apiKey.key, // ⚠️ Store this securely - shown only once!
      name: data.apiKey.name,
    };
  }

  /**
   * Register or get creator profile
   */
  async registerCreator(username?: string) {
    if (!this.walletAddress) {
      throw new Error('walletAddress is required in config');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/creators`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: this.walletAddress,
        username,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to register creator');
    }

    return await response.json();
  }

  /**
   * Create content and get payment link
   * Note: For file upload, use the /content endpoint directly
   */
  async createContent(metadata: ContentMetadata, fileData?: {
    fileName: string;
    fileType: string;
    fileData: string; // base64 encoded
  }) {
    if (!this.walletAddress) {
      throw new Error('walletAddress is required in config');
    }

    // If file data provided, use the full content endpoint
    if (fileData) {
      const response = await fetch(`${this.baseUrl}/content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creatorId: this.walletAddress,
          walletAddress: this.walletAddress,
          title: metadata.title,
          description: metadata.description || '',
          price: metadata.price,
          assetType: metadata.assetType || 'SOL',
          fileName: fileData.fileName,
          fileType: fileData.fileType,
          fileData: fileData.fileData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create content');
      }

      return await response.json();
    }

    // Otherwise, create via x402 endpoint (simplified)
    const response = await fetch(`${this.baseUrl}/api/v1/x402/payment-instructions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: metadata.title,
        description: metadata.description,
        payment_requirements: [{
          asset: metadata.assetType || 'SOL',
          pay_to: this.walletAddress,
          network: 'solana',
          max_amount_required: metadata.price.toString(),
        }],
        walletAddress: this.walletAddress,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create payment instruction');
    }

    return await response.json();
  }

  /**
   * Generate a payment link for existing content
   */
  async generatePaymentLink(contentId: string, buyerPubkey: string): Promise<PaymentLink> {
    const response = await fetch(`${this.baseUrl}/api/v1/payment-links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentId,
        buyerPubkey,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate payment link');
    }

    const data = await response.json();
    return data.paymentLink;
  }

  /**
   * Get payment instruction (x402-compatible)
   */
  async getPaymentInstruction(contentId: string): Promise<PaymentInstruction> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/x402/payment-instructions/${contentId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get payment instruction');
    }

    const data = await response.json();
    return data.data.payment_instruction;
  }

  /**
   * List all payment instructions (x402-compatible)
   */
  async listPaymentInstructions(options?: {
    limit?: number;
    pageToken?: string;
    cid?: string;
    name?: string;
  }): Promise<{ payment_instructions: PaymentInstruction[]; next_page_token?: string }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.pageToken) params.append('pageToken', options.pageToken);
    if (options?.cid) params.append('cid', options.cid);
    if (options?.name) params.append('name', options.name);

    const response = await fetch(
      `${this.baseUrl}/api/v1/x402/payment-instructions?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to list payment instructions');
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Get content details
   */
  async getContent(contentId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get content');
    }

    return await response.json();
  }

  /**
   * List all content
   */
  async listContent(options?: {
    creatorId?: string;
    username?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.creatorId) params.append('creatorId', options.creatorId);
    if (options?.username) params.append('username', options.username);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await fetch(`${this.baseUrl}/api/v1/content?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to list content');
    }

    return await response.json();
  }

  /**
   * Get fee information
   */
  async getFeeInfo() {
    const response = await fetch(`${this.baseUrl}/api/v1/fees`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get fee info');
    }

    return await response.json();
  }
}

/**
 * Helper function for quick agent integration
 * 
 * Example usage:
 * ```typescript
 * const auton = createAutonAgent({
 *   apiKey: process.env.AUTON_API_KEY!,
 *   walletAddress: process.env.AGENT_WALLET!,
 *   baseUrl: 'https://api.auton.app'
 * });
 * 
 * // Publish content
 * const content = await auton.createContent({
 *   title: 'Market Analysis Report',
 *   description: 'Q4 2024 tech sector analysis',
 *   price: 0.1, // 0.1 SOL
 * }, {
 *   fileName: 'report.pdf',
 *   fileType: 'application/pdf',
 *   fileData: reportBuffer.toString('base64'),
 * });
 * 
 * // Get payment link
 * const paymentLink = await auton.generatePaymentLink(
 *   content.content.id,
 *   buyerWalletAddress
 * );
 * ```
 */
export function createAutonAgent(config: AutonConfig): AutonAgentSDK {
  return new AutonAgentSDK(config);
}

