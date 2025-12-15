# Quick Test Start Guide

## ✅ Everything is Ready!

All programs are deployed and vault is initialized. You can start testing immediately.

## 🚀 Quick Start

### 1. Start Backend
```bash
cd backend
npm install  # If needed
npm start
```

Backend should start on `http://localhost:3001`

### 2. Start Frontend
```bash
cd frontend
npm install  # If needed
npm run dev
```

Frontend should start on `http://localhost:3000`

### 3. Test Social Login
1. Open `http://localhost:3000`
2. Click "Sign in with Google" or "Sign in with Twitter"
3. Complete OAuth flow
4. ✅ Wallet should be created automatically!

### 4. Test First-Time Sponsorship
1. With your new embedded wallet, try to upload/create content
2. ✅ First transaction should be free (sponsored by vault)
3. Check transaction on [Solana Explorer](https://explorer.solana.com/?cluster=devnet)

### 5. Test Fee Collection
1. Make a payment for content
2. ✅ Check that 0.75% fee goes to vault
3. Verify vault balance increased

## 📊 Current Status

- **Programs Deployed**: ✅ All 3 programs on devnet
- **Vault Initialized**: ✅ Ready to collect fees and sponsor users
- **Admin Wallet**: `8cn4SU7XhsddE1V9me2G71JRhV8JAyxatN5NTuZATSHW`
- **Vault Wallet**: `5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh` (0.3 SOL)

## 🔗 Useful Links

- **Solana Explorer (Devnet)**: https://explorer.solana.com/?cluster=devnet
- **Vault Transaction**: https://explorer.solana.com/tx/34zvm5xdwcraqKwDddU4TxJhMq2jxFRzpfo8nUnGqcidmpjPRsU5pXU8yK97SxJ7nsMzK3NMriT6BvYR3agQFtGw?cluster=devnet
- **Vault State Account**: `63BeUWyjxirmE5pzQ2kDuaejJQ8R6w7d8DLHeMrV9V56`

## 📝 Environment Variables Needed

Make sure these are set in `backend/.env`:
```bash
AUTON_PROGRAM_ID=CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk
SPONSOR_PROGRAM_ID=FqvRWFBSiDmN3PBwCfs9YZAhh53goQF2YxYku2b8jVXo
VAULT_GOVERNANCE_PROGRAM_ID=Afe5nZMYr8s63mbbrBCweydXsB4o45ztiKFAA5gmmPvm
VAULT_WALLET_ADDRESS=5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh
SOLANA_RPC_URL=https://api.devnet.solana.com
```

And in `frontend/.env.local`:
```bash
NEXT_PUBLIC_AUTON_PROGRAM_ID=CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk
NEXT_PUBLIC_SPONSOR_PROGRAM_ID=FqvRWFBSiDmN3PBwCfs9YZAhh53goQF2YxYku2b8jVXo
NEXT_PUBLIC_VAULT_GOVERNANCE_PROGRAM_ID=Afe5nZMYr8s63mbbrBCweydXsB4o45ztiKFAA5gmmPvm
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PRIVY_APP_ID=<your_privy_app_id>
```

## 🎯 What to Test

1. **Social Login** → Creates wallet automatically
2. **First Upload** → Free (sponsored by vault)
3. **Second Upload** → Requires payment
4. **Content Purchase** → Fees route to vault
5. **API Keys** → Can create and use API keys

See `docs/TESTING_GUIDE.md` for detailed testing instructions!

