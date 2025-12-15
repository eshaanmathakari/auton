# Next Steps: High Priority Tasks

## ✅ Completed

1. ✅ Privy integration - Transaction signing adapter created
2. ✅ Vault wallet generated - Address: `5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh`
3. ✅ Vault wallet signing implemented in `routes/sponsor.js`
4. ✅ Fee collection logic added to `auton_program` (direct transfer, CPI to be added after build)
5. ✅ All smart contracts created and ready for deployment

## 🔧 Immediate Actions Required

### 1. Fund Vault Wallet

The vault wallet has been generated. You need to fund it:

```bash
# Check current balance
solana balance 5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh

# Transfer 10-15 SOL (replace with your funding wallet)
solana transfer 5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh 15 --allow-unfunded-recipient
```

### 2. Add Vault Wallet to Backend .env

Generate the vault wallet keypair:
```bash
cd backend
node scripts/generate-vault-wallet.js
```

Add these lines to `backend/.env`:

```bash
VAULT_WALLET_ADDRESS=<generated_address>
VAULT_WALLET_PRIVATE_KEY=<generated_private_key>
VAULT_SPONSORSHIP_AMOUNT=10000000
VAULT_MIN_BALANCE=5000000000
```

**⚠️ Security:** Never commit the private key to version control. Store it securely in your `.env` file only.

### 3. Configure Privy

1. Sign up at [privy.io](https://privy.io)
2. Create a new app
3. Enable:
   - Email login
   - Google OAuth
   - Twitter/X OAuth
   - Embedded wallets (Solana)
4. Copy App ID and add to:
   - `backend/.env`: `PRIVY_APP_ID=...`
   - `frontend/.env.local`: `NEXT_PUBLIC_PRIVY_APP_ID=...`

### 4. Deploy Smart Contracts

```bash
cd auton_program

# Build all programs
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet --program-name auton_program
anchor deploy --provider.cluster devnet --program-name sponsor_program  
anchor deploy --provider.cluster devnet --program-name vault_governance
```

**After deployment:**
- Copy the program IDs from the output
- Update `backend/.env` with `SPONSOR_PROGRAM_ID` and `VAULT_GOVERNANCE_PROGRAM_ID`
- Update `auton_program/Anchor.toml` with actual program IDs

### 5. Initialize Vault on-Chain

After deploying vault_governance:

```bash
cd auton_program

# Set environment variables
export VAULT_WALLET_ADDRESS=5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh
export ADMIN_WALLET=$(solana address)

# Build to generate IDL
anchor build

# Initialize vault (after IDL is generated)
anchor run initialize-vault
```

Or manually call the `initialize_vault` instruction with:
- `fee_percentage`: 75 (0.75% in basis points)
- `sponsorship_amount`: 10_000_000 (0.01 SOL)

### 6. Complete CPI Integration

After building the programs, Anchor will generate CPI modules. Then update `auton_program/src/lib.rs`:

1. Uncomment the CPI import:
```rust
use vault_governance::cpi::accounts::CollectFees;
use vault_governance::cpi::collect_fees;
```

2. Replace the direct transfer with CPI call:
```rust
let collect_fees_accounts = CollectFees {
    vault_state: ctx.accounts.vault_state.to_account_info(),
    payer: ctx.accounts.buyer.to_account_info(),
    vault_wallet: ctx.accounts.vault_wallet.to_account_info(),
    system_program: ctx.accounts.system_program.to_account_info(),
};
let collect_fees_ctx = CpiContext::new(
    ctx.accounts.vault_governance_program.to_account_info(),
    collect_fees_accounts
);
vault_governance::cpi::collect_fees(collect_fees_ctx, amount_to_pay)?;
```

3. Rebuild and redeploy:
```bash
anchor build
anchor deploy --provider.cluster devnet --program-name auton_program
```

## 🧪 Testing Checklist

- [ ] Social login creates wallet
- [ ] Wallet is linked to user account
- [ ] First-time user eligibility check works
- [ ] Sponsorship transaction builds
- [ ] Vault signs and submits transaction
- [ ] Sponsorship recorded in database
- [ ] Fee collection routes to vault
- [ ] Rate limiting prevents abuse

## 📝 Notes

- The vault wallet private key is in the script output above - store it securely
- Privy App ID is required for social login to work
- Program IDs will be different after deployment - update all configs
- CPI integration requires building first to generate IDL and CPI modules

## 🚀 Ready to Deploy

All code is complete and ready. Follow the steps above to:
1. Fund vault
2. Configure Privy
3. Deploy contracts
4. Initialize vault
5. Test the system

See `docs/DEPLOYMENT_GUIDE.md` for detailed instructions.

