# Deployment Status & Cost Analysis

## Current Status (Devnet)

### ✅ Successfully Deployed (Devnet)
- **sponsor_program**: `FqvRWFBSiDmN3PBwCfs9YZAhh53goQF2YxYku2b8jVXo`
  - Signature: `3N6womXsxVefM2tsTYNNPfYZUrgxBPmKuRLnCpn7VMY1zAwy1V9DeF15x3ZxkETnxwVnsngA6LvhWfEiQbauFPT1`
- **vault_governance**: `Afe5nZMYr8s63mbbrBCweydXsB4o45ztiKFAA5gmmPvm`
  - Signature: `2AwTaYeenBwQxte94kEFK2mvGqgeBeET1KGSbpJTruLNhTow67TueDxrqDRrd2T9PJM5BvtDD5XdhEqxmiPG9TF1`
- **auton_program**: `CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk`
  - Signature: `3Vtmu2f4oFamnMLXY15Cin5jgRKQucb16GUCAwgpw1NuELygcpXchVBtb5vvx2TSR8ovbMsx3m91xDtqAqAsai95`

### Current Wallet Balance
- **Deployer Wallet**: `4eUJuTomQxrmvWwz2CQ74iJzeq28RL16BmsNpwmsTFP9`
- **Current Balance**: ~0.98 SOL
- **Required**: ~3.48 SOL total for remaining deployments
- **Additional Needed**: ~2.5 SOL

## Program Sizes & Rent Requirements

| Program | Size (bytes) | Devnet Rent | Mainnet Rent |
|---------|--------------|-------------|--------------|
| auton_program | 259,768 | 1.80887616 SOL | 1.80887616 SOL |
| sponsor_program | 217,680 | 1.51594368 SOL | 1.51594368 SOL |
| vault_governance | 238,920 | 1.66377408 SOL | 1.66377408 SOL |
| **Total** | **716,368** | **~4.99 SOL** | **~4.99 SOL** |

## Mainnet Deployment Costs

### Rent Requirements (Storage)
- **auton_program**: 1.80887616 SOL
- **sponsor_program**: 1.51594368 SOL  
- **vault_governance**: 1.66377408 SOL
- **Total Rent**: ~4.99 SOL

### Transaction Fees
- Each deployment transaction: ~0.001-0.002 SOL
- **Total Transaction Fees**: ~0.003-0.006 SOL

### **Total Mainnet Cost Estimate**
- **Minimum Required**: ~5.0 SOL
- **Recommended Buffer**: ~5.5-6.0 SOL (for safety margin)

### Cost Breakdown
```
Rent (storage):        ~4.99 SOL
Transaction fees:     ~0.01 SOL
Buffer (recommended): ~0.5 SOL
───────────────────────────────
Total Recommended:     ~5.5 SOL
```

## Next Steps

### For Devnet Deployment
1. Fund deployer wallet with additional ~2.5 SOL
   - Use faucet: https://faucet.solana.com/
   - Or transfer from another devnet wallet
2. Deploy remaining programs:
   ```bash
   cd auton_program
   export PATH="/Users/apple/.local/share/solana/install/active_release/bin:$PATH"
   anchor deploy --provider.cluster devnet --program-name vault_governance
   anchor deploy --provider.cluster devnet --program-name auton_program
   ```

### For Mainnet Deployment
1. **Fund deployer wallet with ~5.5-6.0 SOL** (mainnet SOL, not devnet!)
2. Switch to mainnet:
   ```bash
   solana config set --url https://api.mainnet-beta.solana.com
   ```
3. Deploy all programs:
   ```bash
   ./scripts/deploy-all.sh
   ```
   Or individually:
   ```bash
   anchor deploy --provider.cluster mainnet --program-name sponsor_program
   anchor deploy --provider.cluster mainnet --program-name vault_governance
   anchor deploy --provider.cluster mainnet --program-name auton_program
   ```

## RPC Endpoint Notes

The default devnet RPC (`https://api.devnet.solana.com`) can sometimes be overloaded or rate-limited. If you encounter "error sending request" errors:

1. **Wait and retry** - The RPC may be temporarily overloaded
2. **Use alternative RPC endpoints**:
   - Helius (free tier available): `https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY`
   - QuickNode (free tier available): Custom endpoint from dashboard
   - Triton: Custom endpoint

To use a custom RPC, update `Anchor.toml`:
```toml
[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
# Add custom RPC if needed
```

Or use environment variable:
```bash
export ANCHOR_PROVIDER_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

## Program IDs Reference

### Devnet
- **auton_program**: `CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk`
- **sponsor_program**: `FqvRWFBSiDmN3PBwCfs9YZAhh53goQF2YxYku2b8jVXo` ✅ Deployed
- **vault_governance**: `Afe5nZMYr8s63mbbrBCweydXsB4o45ztiKFAA5gmmPvm`

### Mainnet
- Program IDs will be generated during mainnet deployment (same keypairs, different network)

## Vault Wallet

- **Vault Address**: `5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh`
- **Status**: Funded with 0.01 SOL on mainnet, 0.3 SOL on devnet ✅
- **Purpose**: Receives platform fees and sponsors new user gas fees

## Vault Initialization

- **Status**: ✅ Initialized successfully
- **Transaction**: `34zvm5xdwcraqKwDddU4TxJhMq2jxFRzpfo8nUnGqcidmpjPRsU5pXU8yK97SxJ7nsMzK3NMriT6BvYR3agQFtGw`
- **Vault State PDA**: `63BeUWyjxirmE5pzQ2kDuaejJQ8R6w7d8DLHeMrV9V56`
- **Admin Wallet**: `8cn4SU7XhsddE1V9me2G71JRhV8JAyxatN5NTuZATSHW`
- **Fee Percentage**: 0.75% (75 basis points)
- **Sponsorship Amount**: 0.01 SOL (10,000,000 lamports)

