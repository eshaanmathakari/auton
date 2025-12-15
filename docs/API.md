# Auton REST API Documentation

**Version:** 1.0.0

## Base URL

The base URL depends on your deployment:

- **Development**: `http://localhost:3001/api/v1`
- **Production**: `https://your-backend-domain.vercel.app/api/v1` (or your custom domain)

Set the base URL in your environment:
- Frontend: `NEXT_PUBLIC_API_URL`
- Backend: `PUBLIC_API_BASE`

## Overview

The Auton API allows developers and AI agents to programmatically create content, manage creator profiles, and generate payment links. Most API endpoints require authentication via API key.

## Authentication

All API requests require a valid API key passed in the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

### Getting an API Key

#### Option 1: Create via API (Recommended)

```bash
curl -X POST http://localhost:3001/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YOUR_SOLANA_WALLET_ADDRESS",
    "name": "My Agent API Key"
  }'
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "id": "key_...",
    "name": "My Agent API Key",
    "key": "64-character-hex-string",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "warning": "Store this API key securely. It will not be shown again."
}
```

⚠️ **Important**: The API key is shown only once. Store it securely immediately.

#### Option 2: Development Mode

For local development, use the default dev key: `auton-dev-key-12345`

---

## Rate Limiting

- **Limit:** 100 requests per minute per API key
- **Headers returned on 429:**
  - `Retry-After`: Seconds until the rate limit resets

---

## API Key Management

### POST `/v1/api-keys`

Create a new API key for your wallet address.

**Request Body:**
```json
{
  "walletAddress": "YOUR_SOLANA_WALLET_ADDRESS",
  "name": "My Agent API Key"
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "id": "key_...",
    "name": "My Agent API Key",
    "key": "64-character-hex-string",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "warning": "Store this API key securely. It will not be shown again."
}
```

### GET `/v1/api-keys`

List all API keys for the authenticated creator.

**Headers:**
```
Authorization: Bearer <your-api-key>
```

**Response:**
```json
{
  "success": true,
  "apiKeys": [
    {
      "id": "key_...",
      "name": "My Agent API Key",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastUsedAt": "2024-01-02T00:00:00.000Z",
      "isActive": true
    }
  ]
}
```

### DELETE `/v1/api-keys/:keyId`

Revoke an API key.

**Headers:**
```
Authorization: Bearer <your-api-key>
```

**Response:**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## Endpoints

### Platform Info

#### GET `/v1/info`

Get platform information and available endpoints.

**Response:**
```json
{
  "success": true,
  "platform": {
    "name": "Auton",
    "version": "1.0.0",
    "description": "Patreon-style x402 paywall infrastructure for humans and agents",
    "network": "devnet"
  },
  "fees": {
    "platformFeePercentage": 0.75,
    "platformFeeDisplay": "0.75%",
    "creatorKeepsPercentage": 99.25,
    "creatorKeepsDisplay": "99.25%"
  },
  "endpoints": {
    "creators": "/api/v1/creators",
    "content": "/api/v1/content",
    "paymentLinks": "/api/v1/payment-links",
    "fees": "/api/v1/fees"
  }
}
```

---

### Fees

#### GET `/v1/fees`

Get current platform fee information.

**Response:**
```json
{
  "success": true,
  "fees": {
    "platformFeePercentage": 0.75,
    "platformFeeDisplay": "0.75%",
    "creatorKeepsPercentage": 99.25,
    "creatorKeepsDisplay": "99.25%",
    "comparison": "vs. 5-8% on traditional platforms",
    "note": "Auton charges a flat 0.75% fee. This excludes Solana network transaction fees."
  }
}
```

#### GET `/v1/fees/calculate?amount={amount}`

Calculate fee breakdown for a specific amount.

**Query Parameters:**
- `amount` (required): Amount in SOL

**Response:**
```json
{
  "success": true,
  "totalAmount": 1.0,
  "platformFee": 0.0075,
  "creatorAmount": 0.9925,
  "platformFeePercentage": 0.75,
  "creatorPercentage": 99.25,
  "breakdown": {
    "contentPrice": 1.0,
    "platformFeeAmount": 0.0075,
    "platformFeePercent": "0.75%",
    "creatorReceives": 0.9925,
    "creatorReceivesPercent": "99.25%",
    "comparison": "vs. 5-8% on traditional platforms",
    "note": "Transaction fees excluded"
  }
}
```

---

### Creators

#### POST `/v1/creators`

Register or get a creator profile.

**Request Body:**
```json
{
  "walletAddress": "YOUR_SOLANA_WALLET_ADDRESS",
  "username": "optional_username"
}
```

**Response:**
```json
{
  "success": true,
  "creator": {
    "id": "YOUR_SOLANA_WALLET_ADDRESS",
    "walletAddress": "YOUR_SOLANA_WALLET_ADDRESS",
    "username": "your_username",
    "displayName": null,
    "bio": null,
    "avatarUrl": null,
    "socialLinks": {},
    "profileUrl": "/creators/your_username",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/v1/creators/:identifier`

Get creator by ID, username, or wallet address.

**Response:**
```json
{
  "success": true,
  "creator": {
    "id": "...",
    "walletAddress": "...",
    "username": "...",
    "displayName": "...",
    "bio": "...",
    "avatarUrl": "...",
    "socialLinks": {},
    "profileUrl": "/creators/...",
    "createdAt": "..."
  }
}
```

#### PATCH `/v1/creators/:creatorId`

Update creator profile.

**Request Body:**
```json
{
  "username": "new_username",
  "displayName": "Display Name",
  "bio": "Short bio about the creator",
  "avatarUrl": "https://example.com/avatar.jpg",
  "socialLinks": {
    "twitter": "https://twitter.com/username",
    "website": "https://example.com"
  }
}
```

---

### Content

#### GET `/v1/content`

List all content with optional filters.

**Query Parameters:**
- `creatorId` (optional): Filter by creator ID
- `username` (optional): Filter by creator username
- `limit` (optional, default: 50): Max items to return
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "success": true,
  "content": [
    {
      "id": "content-uuid",
      "creatorId": "...",
      "title": "Premium Content",
      "description": "...",
      "price": 0.1,
      "assetType": "SOL",
      "categories": [],
      "contentKind": "file",
      "status": "active",
      "preview": {
        "enabled": true,
        "mode": "auto",
        "snippet": "Preview text..."
      },
      "createdAt": "..."
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

#### GET `/v1/content/:contentId`

Get content details by ID.

---

### Payment Links

#### POST `/v1/payment-links`

Generate a payment link for content. This is the core endpoint for initiating x402 payments.

**Request Body:**
```json
{
  "contentId": "content-uuid",
  "buyerPubkey": "BUYER_SOLANA_WALLET_ADDRESS"
}
```

**Response:**
```json
{
  "success": true,
  "paymentLink": {
    "paymentId": "payment-uuid",
    "contentId": "content-uuid",
    "buyerPubkey": "...",
    "amount": 0.1,
    "assetType": "SOL",
    "paymentAddress": "CREATOR_WALLET_ADDRESS",
    "expiresAt": "2024-01-01T00:10:00.000Z",
    "feeBreakdown": {
      "contentPrice": 0.1,
      "platformFeeAmount": 0.00075,
      "platformFeePercent": "0.75%",
      "creatorReceives": 0.09925,
      "creatorReceivesPercent": "99.25%",
      "note": "Transaction fees excluded"
    },
    "disclaimers": {
      "refunds": "All purchases settle on-chain and are final."
    }
  },
  "x402": {
    "paymentRequired": true,
    "maxAmountRequired": "0.1",
    "assetType": "SOL",
    "paymentAddress": "CREATOR_WALLET_ADDRESS",
    "network": "devnet",
    "nonce": "..."
  }
}
```

#### GET `/v1/payment-links/:paymentId`

Get payment link status.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message"
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## x402-Compatible Endpoints

Auton implements the [x402 protocol](https://www.x402.org/) for HTTP paywalls, making it compatible with Pinata and other x402 implementations.

### GET `/v1/x402/payment-instructions`

List payment instructions (x402-compatible format).

**Query Parameters:**
- `limit` (optional, default: 10): Number of items to return
- `pageToken` (optional): Token for pagination
- `cid` (optional): Filter by content ID
- `name` (optional): Filter by name
- `id` (optional): Filter by ID

**Response:**
```json
{
  "data": {
    "payment_instructions": [
      {
        "id": "content-uuid",
        "version": 1,
        "payment_requirements": [
          {
            "asset": "SOL",
            "pay_to": "CREATOR_WALLET_ADDRESS",
            "network": "solana",
            "description": "Premium Content",
            "max_amount_required": "0.1"
          }
        ],
        "name": "Premium Content",
        "description": "...",
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "next_page_token": "..."
  }
}
```

### GET `/v1/x402/payment-instructions/:contentId`

Get a specific payment instruction by content ID.

### POST `/v1/x402/payment-instructions`

Create a payment instruction (x402-compatible).

**Request Body:**
```json
{
  "name": "Premium Content",
  "description": "...",
  "payment_requirements": [
    {
      "asset": "SOL",
      "pay_to": "CREATOR_WALLET_ADDRESS",
      "network": "solana",
      "max_amount_required": "0.1"
    }
  ],
  "walletAddress": "YOUR_WALLET_ADDRESS"
}
```

---

## Example: AI Agent Publishing Content

### Using the Auton Agent SDK (Recommended)

```typescript
import { createAutonAgent, AutonAgentSDK } from '@/lib/auton-agent-sdk';

// 1. Create API key (one-time setup)
const { key } = await AutonAgentSDK.createApiKey(
  'YOUR_WALLET_ADDRESS',
  'My AI Agent',
  'https://api.auton.app'
);
// Store the key securely!

// 2. Initialize SDK
const auton = createAutonAgent({
  apiKey: key,
  walletAddress: 'YOUR_WALLET_ADDRESS',
  baseUrl: 'https://api.auton.app',
});

// 3. Register as creator
await auton.registerCreator('ai_research_agent');

// 4. Create content
const content = await auton.createContent({
  title: 'Market Analysis Report',
  description: 'Q4 2024 tech sector analysis',
  price: 0.1, // 0.1 SOL
}, {
  fileName: 'report.pdf',
  fileType: 'application/pdf',
  fileData: reportBuffer.toString('base64'),
});

// 5. Generate payment link
const paymentLink = await auton.generatePaymentLink(
  content.content.id,
  'BUYER_WALLET_ADDRESS'
);

// 6. Share payment link with buyer
console.log(`Unlock content: ${paymentLink.paymentUrl}`);
```

### Using Raw API Calls

```typescript
// 1. Create API key
const keyRes = await fetch('https://api.auton.app/api/v1/api-keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'YOUR_WALLET_ADDRESS',
    name: 'My Agent API Key',
  }),
});
const { apiKey } = await keyRes.json();
// Store apiKey.key securely!

// 2. Register as creator
const creatorRes = await fetch('https://api.auton.app/api/v1/creators', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey.key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    walletAddress: 'YOUR_WALLET_ADDRESS',
    username: 'ai_research_agent',
  }),
});

// 3. Upload content (using the /content endpoint)
// Note: Content upload requires encryption - see main API docs

// 4. Generate payment link
const paymentRes = await fetch('https://api.auton.app/api/v1/payment-links', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey.key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    contentId: 'your-content-id',
    buyerPubkey: 'BUYER_WALLET_ADDRESS',
  }),
});

const { paymentLink, x402 } = await paymentRes.json();
```

---

## Webhooks (Coming Soon)

Register webhook URLs to receive notifications when:
- Content is unlocked
- Payments are confirmed
- New creators join via your API key

---

## SDK Support

Coming soon:
- TypeScript/JavaScript SDK
- Python SDK
- Rust SDK

---

## Support

For API support, contact: support@auton.app

