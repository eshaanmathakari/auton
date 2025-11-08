# Auton - Solana x402 Pay-to-Access Drops

Auton started as a lightweight tipping miniapp and now ships a Patreon-style, pay-to-access experience on Solana Devnet using the x402 protocol. Creators encrypt any file (video, audio, PDF, zip, text) client-side, choose whether to surface a spoiler, and fans unlock the full drop via a one-time Solana payment. Funds stream straight to the creator’s wallet—no custody, no platform middlemen, and purchases are final on-chain.

## 🚀 Features

- **Encrypted paywall drops**: Upload any file, encrypt with AES-256-GCM, and store on S3 (or local dev storage) before sharing a pay-to-access link.
- **Preview control**: Give fans nothing, a short teaser, or a custom preview file. Creators choose “auto snippet”, “custom text”, or “demo upload”.
- **Instant wallet payouts**: Solana Pay flows send funds directly to each creator. Auton never holds custody and surfaces an explicit “no refunds” disclaimer.
- **x402-first server**: `/content/:id/paywall` responds with HTTP `402 Payment Required`, Solana Pay headers, and unique payment IDs + references.
- **Short-lived access tokens**: After on-chain verification, users receive a JWT-style token and signed asset URL that expires within minutes.
- **Wallet Adapter UX**: Phantom + Solflare via `@solana/wallet-adapter` power both creator onboarding and buyer checkout, including direct extension checks on desktop.
- **Legacy tipping mode**: Original `/tip/:creatorId` endpoints still exist for simple gratuities or backwards compatibility.

## 🏗️ Architecture

```
┌─────────────────────┐    encrypt/upload     ┌──────────────────────────────┐
│ Next.js Frontend    │──────────────────────▶│ Express x402 API             │
│                     │                       │                              │
│ • Creator workspace │◀── gated asset token ─┤ • /content CRUD + previews   │
│ • Content paywall   │                       │ • 402 paywall + verification │
│ • Wallet Adapter UI │                       │ • AES key custody + JWT      │
└─────────┬───────────┘                       └────────────┬─────────────────┘
          │                                                │
request tx│                                                │verify tx
          ▼                                                ▼
┌──────────────────────┐                          ┌─────────────────────────┐
│  Solana wallets      │                          │  Storage (S3 or local)  │
│  (Phantom/Solflare)  │                          │  • Encrypted blobs      │
│  • Signs payments    │                          │  • Optional preview     │
│  • Receives access   │                          │                         │
└──────────────────────┘                          └─────────────────────────┘
```

## 📋 Prerequisites

- Node.js 18+ and npm
- A Solana wallet (Phantom, Solflare, etc.)
- Solana CLI (optional, for wallet generation)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd auton
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Generate a platform wallet:
```bash
npm run generate-wallet
```

This will create a `.env` file with your platform wallet address. You'll need to fund this wallet with Devnet SOL:
- Visit https://faucet.solana.com/
- Enter your platform wallet address
- Request Devnet SOL

Create/extend `backend/.env` with the new paywall parameters:

```
ACCESS_TOKEN_SECRET=replace-me
PUBLIC_API_BASE=http://localhost:3001
PAYMENT_TTL_MINUTES=10
ACCESS_TOKEN_TTL_SECONDS=300
PLATFORM_FEE_PERCENTAGE=0
# Optional S3 upload path
# S3_BUCKET=your-bucket
# S3_REGION=us-east-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

If S3 variables are omitted (or `USE_LOCAL_STORAGE=true`), the server writes encrypted blobs to `backend/uploads/` (gitignored) so you can demo everything locally.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🚀 Running Locally

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend will run on `http://localhost:3001`

### Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

## 📖 Usage

### For Creators

1. Run both servers and visit `http://localhost:3000`.
2. Connect Phantom/Solflare (or manually paste a payout address). A creator ID is derived from your wallet prefix.
3. Fill out the new “Encrypt & publish” form:
   - Upload any file to gate.
   - Pick a preview strategy: auto text snippet, custom teaser text, teaser file, or fully gated.
   - Set price (SOL for MVP), categories, and whether to allow downloads after unlock.
4. Submit. The backend encrypts the payload, stores it, and returns a sharable link: `/content/<contentId>`.
5. Manage all drops from the dashboard—preview snippet, price badge, stream/download toggle.

### For Buyers

1. Open a creator’s share link (`/content/<contentId>`).
2. Review the spoiler/preview and the mandatory “no refunds” disclaimer.
3. Connect a wallet, click “Get payment request” to receive the HTTP 402 payload, then approve the SOL transfer.
4. After on-chain confirmation, the app returns a short-lived download URL (backed by an HMAC access token). Click “Open download” to decrypt and fetch the file.

### Legacy Tipping

The original `/tip/:creatorId` and dashboard remain available in case you still want lightweight tipping links beside the premium paywall.

## 🔌 API Endpoints

### Pay-to-Access Endpoints

| Method & Path | Description |
| --- | --- |
| `POST /content` | Accepts encrypted upload metadata (base64 payload), preview preferences, price, categories, etc. Stores AES-256-GCM ciphertext + preview artifacts. |
| `GET /content` | Lists every published drop (optionally filtered by `?creatorId=`). |
| `GET /content/:id` | Returns metadata + preview details without exposing encryption keys. |
| `GET /content/:id/paywall?buyerPubkey=...` | Responds with HTTP 402, Solana Pay headers, and a short-lived payment intent tied to the buyer. |
| `POST /content/:id/paywall` | Accepts `{ paymentId, signature, buyerPubkey }`, verifies the on-chain transfer, records an access grant, and returns `{ accessToken, downloadUrl }`. |
| `GET /content/:id/asset?token=...` | Validates the signed token, decrypts the ciphertext, and streams the original file (respecting download/stream settings). |
| `GET /content/:id/preview-asset` | If a creator uploaded a custom teaser file, this endpoint streams it in the clear. |

All paywall responses include the non-refundable disclaimer so wallets and frontends can surface it before payment.

### Legacy Tipping Endpoints

The previous tipping API is untouched and still works side-by-side with the new paywall:

#### GET `/tip/:creatorId`

Returns a `402 Payment Required` response with payment parameters.

**Query Parameters:**
- `amount` (optional): Amount in SOL/USDC (default: 0.1)
- `assetType` (optional): 'SOL' or 'USDC' (default: 'SOL')
- `walletAddress` (optional): Creator wallet address (if creator not registered)

**Response Headers (402):**
- `X-Payment-Required`: 'true'
- `X-Payment-Id`: Unique payment ID
- `X-Max-Amount`: Maximum amount required
- `X-Asset-Type`: Asset type (SOL/USDC)
- `X-Payment-Address`: Recipient wallet address
- `X-Platform-Fee`: Platform fee amount
- `X-Creator-Amount`: Amount creator will receive
- `X-Network`: Network (devnet)
- `X-Nonce`: Payment nonce

### POST `/tip/:creatorId`

Submit payment transaction for verification.

**Request Body:**
```json
{
  "signature": "transaction_signature",
  "paymentId": "payment_id_from_402_response",
  "fromAddress": "tipper_wallet_address"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified and tip recorded",
  "tip": {
    "id": "tip_id",
    "amount": "0.1",
    "assetType": "SOL",
    "signature": "transaction_signature",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "transactionUrl": "https://explorer.solana.com/tx/..."
}
```

### GET `/tips/:creatorId`

Get tip history for a creator.

**Response:**
```json
{
  "creatorId": "creator_id",
  "creator": {
    "id": "creator_id",
    "walletAddress": "wallet_address",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "tips": [...],
  "totals": {
    "totalSOL": 1.5,
    "totalCreatorAmountSOL": 1.44
  },
  "count": 10
}
```

## 🎨 Embeddable Widget

Creators can embed a tip button on their websites:

```html
<a href="https://your-domain.com/tip/YOUR_CREATOR_ID" 
   target="_blank" 
   rel="noopener noreferrer"
   style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, #9333ea 0%, #6366f1 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none;">
  💜 Tip with Auton
</a>
```

See `frontend/public/widget-example.html` for more examples.

## 🔒 Security Considerations

- All transactions are verified on-chain before being recorded
- Payment signatures are validated against Solana blockchain
- Platform wallet private keys should never be committed to version control
- Use environment variables for sensitive configuration

## 🧪 Testing

### Pay-to-Access Flow

1. Start backend (`npm run dev` in `/backend`) and frontend (`npm run dev` in `/frontend`).
2. Connect Wallet A on the homepage, upload a small text file, and publish it (preview auto or custom).
3. Copy the generated link `/content/<id>` and open it in an incognito window with Wallet B.
4. Request the payment instructions, inspect the HTTP 402 headers in DevTools if needed.
5. Approve the SOL transfer, wait for confirmation, and click “Open download” to verify the decrypted file contents.
6. Check the backend logs (or `backend/db.json`) to confirm the payment intent + access grant records.

### Legacy Tipping Flow

1. Connect a creator wallet and grab the `/tip/<creatorId>` link.
2. Open it with a second wallet, choose an amount, and submit the transaction.
3. Confirm the tip shows up in the historical list as before.

## 📦 Deployment

### Backend Deployment (Vercel)

1. Create a `vercel.json` in the backend directory:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

2. Set environment variables in Vercel dashboard
3. Deploy: `vercel --prod`

### Frontend Deployment (Vercel)

1. Update `NEXT_PUBLIC_API_URL` in `.env.local` to your backend URL
2. Deploy: `vercel --prod`

## 🗂️ Project Structure

```
auton/
├── backend/
│   ├── routes/
│   │   ├── tip.js             # Legacy tipping endpoint
│   │   ├── tips.js            # Tip history endpoint
│   │   └── content.js         # Encrypted content + paywall routes
│   ├── utils/
│   │   ├── accessToken.js    # Short-lived download tokens
│   │   ├── encryption.js     # AES helpers
│   │   └── payment.js        # Payment verification logic
│   ├── storage/
│   │   ├── localStorage.js   # Dev-friendly filesystem storage
│   │   ├── s3Storage.js      # Optional AWS S3 adapter
│   │   └── storageProvider.js
│   ├── scripts/
│   │   └── generate-wallet.js  # Wallet generation script
│   ├── database.js          # Simple JSON database
│   ├── db.json              # Database file
│   └── server.js            # Express server
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Creator workspace (upload + catalog)
│   │   ├── content/
│   │   │   └── [contentId]/ # Paywall + unlock flow
│   │   └── tip/
│   │       └── [creatorId]/ # Legacy tipping page
│   │   └── layout.tsx       # Root layout with wallet provider
│   ├── components/
│   │   └── WalletContextProvider.tsx
│   └── public/
│       └── widget-example.html
└── README.md
```

## 🤝 Contributing

This project was built for the Solana X402 Hackathon. Contributions are welcome!

## 📄 License

MIT License

## 🙏 Acknowledgments

- Solana Foundation for the x402 protocol
- Solana Wallet Adapter team
- OpenLibx402-Core contributors

## 📚 Resources

- [Solana x402 Documentation](https://solana.com/x402/hackathon#resources)
- [OpenLibx402-Core Docs](https://docs.rs/openlibx402-core/latest/openlibx402_core/)
- [x402 GitBook](https://x402.gitbook.io/x402/getting-started/quickstart-for-buyers)
- [Solana Explorer](https://explorer.solana.com)

## 🔮 Future Enhancements

- USDC token transfer support
- Multi-chain support
- Social login integration
- Automated wallet creation for new users
- Analytics dashboard
- Recurring tips/subscriptions
- NFT gating for premium content
