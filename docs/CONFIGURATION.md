# Auton Configuration Guide

This guide covers environment configuration for both development and mainnet deployment.

## Backend Configuration

### Required Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=3001
NODE_ENV=development  # or 'production'

# ============================================
# SOLANA NETWORK CONFIGURATION
# ============================================
# Options: devnet, mainnet-beta
SOLANA_NETWORK=devnet

# RPC Endpoints
# For devnet:
SOLANA_RPC_URL=https://api.devnet.solana.com

# For mainnet (use a paid RPC for reliability):
# SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# Recommended: Helius, QuickNode, or Alchemy
# SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# ============================================
# PLATFORM WALLET
# ============================================
# Generate with: npm run generate-wallet
PLATFORM_WALLET_ADDRESS=<your-wallet-address>

# ============================================
# FEES
# ============================================
# Platform fee percentage (0.75% = 0.75)
PLATFORM_FEE_PERCENTAGE=0.75

# ============================================
# ACCESS TOKENS & SECURITY
# ============================================
# Secret for signing access tokens (generate a random 32+ char string)
ACCESS_TOKEN_SECRET=<generate-a-secure-random-string>

# Public URL for the API (used in download URLs)
PUBLIC_API_BASE=http://localhost:3001

# Payment intent expiry (minutes)
PAYMENT_TTL_MINUTES=10

# Access token expiry (seconds)
ACCESS_TOKEN_TTL_SECONDS=300

# ============================================
# STORAGE
# ============================================
# Local storage (dev only)
USE_LOCAL_STORAGE=true

# AWS S3 (production)
# S3_BUCKET=your-bucket-name
# S3_REGION=us-east-1
# AWS_ACCESS_KEY_ID=<your-key>
# AWS_SECRET_ACCESS_KEY=<your-secret>

# ============================================
# API KEYS
# ============================================
# Comma-separated list of valid API keys
# API_KEYS=key1,key2,key3

# Development API key
DEV_API_KEY=auton-dev-key-12345
```

---

## Frontend Configuration

Create a `.env.local` file in the `frontend/` directory:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Solana RPC URL
NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899

# For devnet:
# NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# For mainnet:
# NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Auton Program ID (from your deployed Anchor program)
NEXT_PUBLIC_AUTON_PROGRAM_ID=<your-program-id>

# IPFS/Pinata Configuration
PINATA_API_KEY=<your-pinata-api-key>
PINATA_API_SECRET=<your-pinata-api-secret>

# Encryption key (32 bytes = 64 hex characters)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_SECRET_KEY=<64-char-hex-string>

# Privy Authentication
# Get your App ID from https://dashboard.privy.io/
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>
```

**Important Privy Dashboard Configuration:**
1. Go to https://dashboard.privy.io/ and select your app
2. Enable **Google** and **Twitter** as login methods in **Login Methods** settings
3. In **Embedded Wallets** settings, configure **Solana** as the default chain (or ensure Solana is enabled)
4. This ensures Privy creates Solana wallets instead of EVM wallets

---

## Mainnet Deployment Checklist

### 1. Update Network Configuration

**Backend:**
```bash
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # or paid RPC
```

**Frontend:**
```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### 2. Deploy Anchor Program to Mainnet

#### Step 1: Build the Program

```bash
cd auton_program
anchor build
```

This will:
- Compile your Rust program
- Generate the IDL (Interface Definition Language)
- Update the program ID in `lib.rs` if it changed

#### Step 2: Deploy to Devnet (for testing)

```bash
anchor deploy --provider.cluster devnet
```

**Output example:**
```
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: YOUR_KEYPAIR_PATH
Deploying program "auton_program"...
Program Id: CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk

Deploy success
```

#### Step 3: Deploy to Mainnet

```bash
anchor deploy --provider.cluster mainnet-beta
```

**Important**: 
- Ensure you have SOL in your deployer wallet for mainnet
- The program ID will be different on mainnet vs devnet
- Save the Program Id from the output

#### Step 4: Update Program ID

After deployment, update these files with the Program Id from the output:

1. **Frontend `.env.local`:**
   ```bash
   NEXT_PUBLIC_AUTON_PROGRAM_ID=CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk
   ```

2. **Backend** (if needed):
   ```bash
   AUTON_PROGRAM_ID=CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk
   ```

3. **Anchor Program** (`auton_program/programs/auton_program/src/lib.rs`):
   ```rust
   declare_id!("CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk");
   ```

4. **Anchor.toml** (optional, for future deployments):
   ```toml
   [programs.devnet]
   auton_program = "CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk"
   
   [programs.mainnet]
   auton_program = "YOUR_MAINNET_PROGRAM_ID"
   ```

**Note**: The program ID is automatically updated by Anchor during build, but you should verify it matches your deployment.

### 3. Update Explorer URLs

The code automatically uses the correct explorer cluster based on `SOLANA_NETWORK`. Ensure it's set to `mainnet-beta`.

### 4. Set Up Production Storage

Use S3 or compatible object storage instead of local filesystem:

```bash
USE_LOCAL_STORAGE=false
S3_BUCKET=your-auton-bucket
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

### 5. Secure Your Secrets

- Generate strong `ACCESS_TOKEN_SECRET`
- Use environment variables, never commit secrets
- Rotate API keys periodically

### 6. Set Up Monitoring

- Monitor transaction failures
- Set up alerts for payment verification errors
- Track platform fee collection

---

## Token Addresses Reference

| Token | Address | Network |
|-------|---------|---------|
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Both |
| SOL | Native | Both |

---

## RPC Provider Recommendations

For production mainnet deployment, use a reliable RPC provider:

| Provider | Free Tier | Paid Plans | Notes |
|----------|-----------|------------|-------|
| [Helius](https://helius.dev) | Yes | $49/mo+ | Best for Solana |
| [QuickNode](https://quicknode.com) | Yes | $49/mo+ | Multi-chain |
| [Alchemy](https://alchemy.com) | Yes | $49/mo+ | Multi-chain |
| [Triton](https://triton.one) | No | Custom | Enterprise |

The public Solana RPC (`api.mainnet-beta.solana.com`) has rate limits and is not recommended for production.

---

## Vercel Deployment

### Backend

1. Create a new Vercel project for the backend
2. Set environment variables in Vercel dashboard
3. Deploy:
   ```bash
   cd backend
   vercel --prod
   ```

### Frontend

1. Create a new Vercel project for the frontend
2. Set environment variables
3. Update `NEXT_PUBLIC_API_URL` to your backend URL
4. Deploy:
   ```bash
   cd frontend
   vercel --prod
   ```

---

## Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use separate keys for dev/prod** - Don't reuse API keys
3. **Rotate secrets regularly** - Especially after team changes
4. **Enable CORS properly** - Only allow your frontend domain
5. **Rate limit API endpoints** - Already implemented, tune as needed
6. **Monitor for anomalies** - Set up alerts for unusual activity

