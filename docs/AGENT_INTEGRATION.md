# How an AI Agent Can Earn with Auton

**Auton** enables AI agents to monetize their outputs without managing invoices, payment processors, or custody. Agents generate content, publish it via Auton's API, and receive SOL directly to their wallets.

## Why Auton for Agents?

- **No custody**: Funds flow directly from buyer to agent's wallet
- **Simple integration**: REST API with x402 payment protocol
- **Instant settlement**: Payments confirmed on Solana in seconds
- **Minimal fees**: 0.75% vs. traditional payment processors (2-3%)

---

## Example 1: AI Research Agent Publishing Reports

Imagine an AI agent that generates market research reports. Here's how it can monetize with Auton:

### Flow

1. Agent generates a PDF report
2. Agent uploads and encrypts the report via Auton
3. Agent receives a shareable payment link
4. Agent includes the link in its responses
5. Users pay to unlock, funds go directly to agent's wallet

### Code Example (TypeScript) - Using Auton Agent SDK

```typescript
import { createAutonAgent, AutonAgentSDK } from '@/lib/auton-agent-sdk';

// One-time setup: Create API key
const { key } = await AutonAgentSDK.createApiKey(
  process.env.AGENT_WALLET_ADDRESS!,
  'Research Agent',
  process.env.AUTON_API_URL || 'https://api.auton.app'
);
// Store key in environment: AUTON_API_KEY=key

// Initialize SDK
const auton = createAutonAgent({
  apiKey: process.env.AUTON_API_KEY!,
  walletAddress: process.env.AGENT_WALLET_ADDRESS!,
  baseUrl: process.env.AUTON_API_URL || 'https://api.auton.app',
});

async function publishReport(reportBuffer: Buffer, title: string, price: number) {
  // Step 1: Register as creator (if not already)
  await auton.registerCreator('research_agent');
  
  // Step 2: Create content on Auton
  const content = await auton.createContent({
    title,
    description: 'AI-generated market research report',
    price, // Price in SOL
    assetType: 'SOL',
  }, {
    fileName: 'report.pdf',
    fileType: 'application/pdf',
    fileData: reportBuffer.toString('base64'),
  });
  
  // Step 3: Return the shareable link
  return {
    contentId: content.content.id,
    shareableUrl: `https://auton.vercel.app/content/${content.content.id}`,
    price: content.content.price,
    message: `I've published a new report: "${title}". Unlock it here: ${shareableUrl}`,
  };
}

// Usage in agent response
async function handleUserRequest(request: string) {
  // Agent generates the report...
  const report = await generateReport(request);
  
  // Publish to Auton
  const published = await publishReport(report.buffer, report.title, 0.1);
  
  // Return to user
  return `
    I've analyzed your request and prepared a detailed report.
    
    **${report.title}**
    
    To access the full report, unlock it here:
    ${published.shareableUrl}
    
    Price: ${published.price} SOL (≈ $XX USD)
    
    Funds go directly to my wallet - no middlemen!
  `;
}
```

---

## Example 2: SaaS Per-Download Billing

A SaaS platform can use Auton to charge for file downloads without building payment infrastructure.

### Flow

1. User requests a premium file (e.g., AI-generated image, processed data)
2. SaaS backend creates content on Auton
3. User pays via Auton
4. SaaS receives webhook confirmation (or polls status)
5. SaaS grants access

### Code Example (TypeScript)

```typescript
// SaaS Backend
class DownloadService {
  async createPaidDownload(userId: string, fileBuffer: Buffer, metadata: {
    title: string;
    price: number;
  }) {
    // Create content on Auton
    const autonContent = await this.auton.createContent({
      file: fileBuffer,
      title: metadata.title,
      price: metadata.price,
    });
    
    // Store mapping in your database
    await this.db.paidDownloads.create({
      userId,
      autonContentId: autonContent.id,
      status: 'pending',
    });
    
    // Return Auton payment URL
    return {
      paymentUrl: `https://auton.vercel.app/content/${autonContent.id}`,
      contentId: autonContent.id,
    };
  }
  
  // Poll for payment status
  async checkPaymentStatus(contentId: string, buyerWallet: string) {
    const paymentLink = await this.auton.getPaymentStatus(contentId, buyerWallet);
    
    if (paymentLink.status === 'confirmed') {
      // Grant access in your system
      await this.db.paidDownloads.updateOne(
        { autonContentId: contentId },
        { status: 'paid', paidAt: new Date() }
      );
      return true;
    }
    return false;
  }
}

// API endpoint in your SaaS
app.post('/api/create-download', async (req, res) => {
  const { userId, fileId, price } = req.body;
  
  // Get the file
  const file = await getFile(fileId);
  
  // Create Auton payment
  const download = await downloadService.createPaidDownload(userId, file.buffer, {
    title: file.name,
    price,
  });
  
  res.json({
    paymentUrl: download.paymentUrl,
    message: 'Pay to download this file',
  });
});
```

---

## Best Practices for Agents

### 1. Use Descriptive Titles

Help users understand what they're paying for:
- ✅ "Market Analysis: Q4 2024 Tech Sector Deep Dive"
- ❌ "report_001.pdf"

### 2. Set Fair Prices

Consider the value and effort:
- Quick analyses: 0.01-0.05 SOL
- Detailed reports: 0.1-0.5 SOL
- Premium data/research: 0.5-2 SOL

### 3. Include Previews

Use Auton's preview feature to show users what they'll get:
- Text snippets for documents
- Thumbnails for images
- Summaries for data files

### 4. Handle Errors Gracefully

```typescript
try {
  const published = await publishToAuton(content);
  return formatSuccessResponse(published);
} catch (error) {
  // Don't leave users hanging
  return "I couldn't publish this content right now. Let me try a different approach...";
}
```

### 5. Track Earnings

Query your content to see earnings:

```typescript
const myContent = await fetch(`${AUTON_API}/content?creatorId=${AGENT_WALLET}`, {
  headers: { 'Authorization': `Bearer ${API_KEY}` },
}).then(r => r.json());

const totalPotentialEarnings = myContent.content.reduce(
  (sum, c) => sum + c.price * c.unlockCount, 
  0
);
```

---

## Security Considerations

1. **Store API keys securely**: Use environment variables, never commit to code
2. **Validate wallet addresses**: Ensure you're sending to the right wallet
3. **Handle sensitive content**: Encryption happens automatically via Auton

---

## Quick Start with Auton Agent SDK

The easiest way to integrate Auton into your AI agent:

```typescript
// 1. Install (or copy the SDK file)
// The SDK is available at: frontend/lib/auton-agent-sdk.ts

// 2. Create API key (one-time)
import { AutonAgentSDK } from '@/lib/auton-agent-sdk';

const { key } = await AutonAgentSDK.createApiKey(
  'YOUR_WALLET_ADDRESS',
  'My Agent',
  'https://api.auton.app'
);
// Store in env: AUTON_API_KEY=key

// 3. Use in your agent
import { createAutonAgent } from '@/lib/auton-agent-sdk';

const auton = createAutonAgent({
  apiKey: process.env.AUTON_API_KEY!,
  walletAddress: process.env.AGENT_WALLET!,
  baseUrl: 'https://api.auton.app',
});

// Publish content
const content = await auton.createContent({
  title: 'Analysis Report',
  price: 0.1,
}, {
  fileName: 'report.pdf',
  fileType: 'application/pdf',
  fileData: buffer.toString('base64'),
});
```

## x402 Protocol Integration

Auton implements the [x402 protocol](https://www.x402.org/), making it compatible with:
- Pinata's x402 implementation
- Other x402-compatible services
- Standard HTTP 402 Payment Required responses

Your agent can use x402-compatible endpoints:

```typescript
// Get payment instructions (x402 format)
const instructions = await auton.listPaymentInstructions();

// Each instruction follows x402 spec
instructions.payment_instructions.forEach(instruction => {
  console.log(instruction.payment_requirements[0].pay_to);
  console.log(instruction.payment_requirements[0].max_amount_required);
});
```

## Need Help?

- **API Documentation**: [/docs/API.md](./API.md)
- **SDK Reference**: See `frontend/lib/auton-agent-sdk.ts`
- **x402 Protocol**: [x402.org](https://www.x402.org/)
- **Discord**: Join our developer community
- **Email**: agents@auton.app

---

## Coming Soon: MCP Server

We're building an MCP (Model Context Protocol) server so AI agents can:
- Create content via natural language
- Manage earnings
- Set up automated payouts

Stay tuned for updates!

