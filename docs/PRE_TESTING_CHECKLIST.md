# Pre-Testing Checklist - Devnet

## ✅ Completed
- [x] All programs deployed to devnet
- [x] Vault wallet funded (5 SOL on devnet)

## 📋 Required Steps Before Testing

### 1. Update Environment Variables

#### Backend `.env` (if exists, or create one):
```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet

# Program IDs (Devnet)
AUTON_PROGRAM_ID=CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk
SPONSOR_PROGRAM_ID=FqvRWFBSiDmN3PBwCfs9YZAhh53goQF2YxYku2b8jVXo
VAULT_GOVERNANCE_PROGRAM_ID=Afe5nZMYr8s63mbbrBCweydXsB4o45ztiKFAA5gmmPvm

# Vault Configuration
VAULT_WALLET_ADDRESS=5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh
VAULT_WALLET_PRIVATE_KEY=<your_vault_private_key_base64>

# Privy Configuration
PRIVY_APP_ID=<your_privy_app_id>
PRIVY_APP_SECRET=<your_privy_app_secret>

# Platform Configuration
PLATFORM_FEE_PERCENTAGE=0.75
PLATFORM_WALLET_ADDRESS=5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh
```

#### Frontend `.env.local`:
```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=devnet

# Program IDs (Devnet)
NEXT_PUBLIC_AUTON_PROGRAM_ID=CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk
NEXT_PUBLIC_SPONSOR_PROGRAM_ID=FqvRWFBSiDmN3PBwCfs9YZAhh53goQF2YxYku2b8jVXo
NEXT_PUBLIC_VAULT_GOVERNANCE_PROGRAM_ID=Afe5nZMYr8s63mbbrBCweydXsB4o45ztiKFAA5gmmPvm

# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=<your_privy_app_id>
NEXT_PUBLIC_PRIVY_ENV=production

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2. Initialize Vault Governance Program

The vault needs to be initialized on-chain before it can collect fees or sponsor transactions.

```bash
cd auton_program

# Set environment variables
export VAULT_WALLET_ADDRESS=5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh
export ADMIN_WALLET=$(solana address)  # Your deployer wallet

# Make sure you're on devnet
solana config set --url https://api.devnet.solana.com

# Build to generate IDL (if not already done)
anchor build

# Initialize vault
anchor run initialize-vault
```

**Expected Output:**
```
🔧 Initializing vault governance...

Vault State PDA: <pda_address>
Vault Wallet: 5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh
Admin: <your_admin_wallet>
Fee Percentage: 75 basis points (0.75%)
Sponsorship Amount: 10000000 lamports (0.01 SOL)

✅ Vault initialized successfully!
Transaction signature: <tx_signature>
```

### 3. Verify Program Deployments

Check that all programs are deployed and accessible:

```bash
# Check sponsor_program
solana program show FqvRWFBSiDmN3PBwCfs9YZAhh53goQF2YxYku2b8jVXo

# Check vault_governance
solana program show Afe5nZMYr8s63mbbrBCweydXsB4o45ztiKFAA5gmmPvm

# Check auton_program
solana program show CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk
```

All should show "Program Id: <address>" and "Owner: BPFLoaderUpgradeable..."

### 4. Verify Vault State

After initialization, check the vault state account:

```bash
# Get the vault state PDA
# (You can get this from the initialization script output, or calculate it)
# PDA = findProgramAddressSync([Buffer.from('vault_state')], vault_governance_program_id)

# Check account exists and has data
solana account <vault_state_pda>
```

### 5. Test Backend Services

Start the backend and verify it can connect:

```bash
cd backend
npm install  # If needed
npm start
```

Check logs for:
- ✅ Database initialized
- ✅ Solana connection successful
- ✅ Program IDs loaded correctly
- ✅ Vault wallet loaded

### 6. Test Frontend

Start the frontend:

```bash
cd frontend
npm install  # If needed
npm run dev
```

Test:
- ✅ Page loads without errors
- ✅ Wallet connection works
- ✅ Social login buttons appear
- ✅ Can connect with Phantom/Solflare

## 🧪 Testing New Features

### Test 1: Social Login & Embedded Wallet
1. Click "Sign in with Google" or "Sign in with Twitter"
2. Complete OAuth flow
3. Verify wallet is created automatically
4. Check backend database for new user record

### Test 2: First-Time User Sponsorship
1. Create a new account (or use test account)
2. Try to upload/create content (first transaction)
3. Verify sponsorship eligibility check
4. Verify transaction is sponsored by vault
5. Check `sponsoredUsers` table in database

### Test 3: Fee Collection
1. Make a payment for content
2. Verify fee is calculated (0.75%)
3. Verify fee is routed to vault wallet
4. Check vault balance increases

### Test 4: Rate Limiting & Abuse Prevention
1. Try multiple sponsorship requests quickly
2. Verify rate limiting kicks in
3. Check abuse detection logs

## 🔍 Troubleshooting

### Issue: "Program not found"
- **Solution**: Verify program IDs in `.env` files match deployed addresses
- Check: `solana program show <program_id>`

### Issue: "Vault not initialized"
- **Solution**: Run `anchor run initialize-vault`
- Verify: Check vault state PDA exists

### Issue: "Insufficient funds"
- **Solution**: Fund vault wallet with more SOL
- Check: `solana balance 5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh`

### Issue: "RPC error"
- **Solution**: Use alternative RPC endpoint (Helius, QuickNode)
- Or: Wait and retry (public RPC can be rate-limited)

## 📝 Next Steps After Testing

Once all tests pass:
1. Document any issues found
2. Update production environment variables
3. Prepare for mainnet deployment
4. Set up monitoring and alerts

