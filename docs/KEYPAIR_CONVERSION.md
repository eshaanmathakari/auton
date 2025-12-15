# Keypair Conversion Guide

## Phantom Wallet Import

Your admin wallet keypair has been converted to Base58 format for Phantom wallet import.

### Base58 Private Key (for Phantom):
```
5votahWFwzmu41AMjEWuuke6NQm2nyudMAqaC3piJAbFb3vp1gb51PKS66gdgozYyV5LedmQLUHvnyLWQsZ8YgCw
```

### Instructions to Import into Phantom:

1. Open Phantom wallet
2. Go to **Settings** → **Security & Privacy**
3. Click **"Import Private Key"**
4. Paste the Base58 key above
5. Verify the address matches: `4eUJuTomQxrmvWwz2CQ74iJzeq28RL16BmsNpwmsTFP9`

### Note on Keypair Format

The keypair array you provided appears to have validation issues when used directly. However, the Base58 format should work with Phantom.

If you need to use this wallet with Solana CLI, you can:
1. Import it into Phantom first
2. Export it from Phantom (which will give you a valid format)
3. Or use Phantom's wallet adapter in your application

## Alternative: Use Phantom Wallet Directly

Since the keypair validation is having issues, you can:
1. Import the wallet into Phantom using the Base58 key above
2. Use Phantom's wallet adapter in your backend/scripts
3. Or create a new admin wallet and use that instead

## For Vault Initialization

The vault initialization script only needs the **admin wallet address**, not the private key. The transaction will be signed by your deployer wallet (the one with SOL), but the admin address will be set as the vault's admin.

This means:
- You can initialize the vault even if the admin wallet keypair has issues
- The admin wallet address (`4eUJuTomQxrmvWwz2CQ74iJzeq28RL16BmsNpwmsTFP9`) is what matters
- Later, if you need to perform admin operations, you can use Phantom to sign those transactions

