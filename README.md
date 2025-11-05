# Auton - Decentralized Tipping Miniapp

Auton is a lightweight, decentralized tipping miniapp built on Solana Devnet using the x402 payment protocol. The app enables instant micropayments for content creators, service providers, or community members without requiring accounts, subscriptions, or complex authentication flows.

## 🚀 Features

- **Instant Tipping**: Send tips directly to creators using Solana blockchain
- **x402 Protocol**: Leverages HTTP 402 "Payment Required" status code for seamless payment flows
- **No Registration Required**: Users only need a Solana wallet (Phantom, Solflare, etc.)
- **Fast Settlements**: Transactions settle in under 400ms on Solana Devnet
- **Transparent Fees**: 4% platform fee with real-time breakdown
- **Multi-Token Support**: Support for SOL and USDC payments
- **Creator Dashboard**: Track tips and earnings in real-time
- **Embeddable Widget**: Easy-to-integrate tip button for any website

## 🏗️ Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Frontend      │         │    Backend      │         │   Solana         │
│   (Next.js)     │────────▶│   (Express)     │────────▶│   Devnet         │
│                 │         │                 │         │                  │
│ - Creator Page  │         │ - x402 Server   │         │ - Transactions   │
│ - Tipping Page  │         │ - Payment Verify│         │ - Wallet         │
│ - Wallet Adapter│         │ - Tip History   │         │                  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
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

1. Open the app at `http://localhost:3000`
2. Connect your Solana wallet
3. Your creator ID will be auto-generated from your wallet address
4. Copy your tipping link or QR code
5. Share the link with your audience

### For Tippers

1. Click on a creator's tipping link
2. Connect your Solana wallet
3. Select the amount you want to tip
4. Confirm the transaction
5. Payment is verified and settled instantly

## 🔌 API Endpoints

### GET `/tip/:creatorId`

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

1. Generate a platform wallet and fund it with Devnet SOL
2. Start both backend and frontend servers
3. Connect a wallet in the frontend
4. Generate a tipping link
5. Open the link in a new tab/incognito window
6. Connect a different wallet
7. Send a test tip
8. Verify the transaction on Solana Explorer

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
│   │   ├── tip.js          # x402 tipping endpoint
│   │   └── tips.js          # Tip history endpoint
│   ├── utils/
│   │   └── payment.js       # Payment verification logic
│   ├── scripts/
│   │   └── generate-wallet.js  # Wallet generation script
│   ├── database.js          # Simple JSON database
│   ├── db.json              # Database file
│   └── server.js            # Express server
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Creator dashboard
│   │   ├── tip/
│   │   │   └── [creatorId]/
│   │   │       └── page.tsx  # Tipping page
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
