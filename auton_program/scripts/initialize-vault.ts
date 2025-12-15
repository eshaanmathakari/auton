/**
 * Initialize Vault Script
 * 
 * Initializes the vault governance program on-chain
 * 
 * Usage: anchor run initialize-vault
 */

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import { VaultGovernance } from '../target/types/vault_governance';
import IDL from '../target/idl/vault_governance.json';

// Configuration
const VAULT_WALLET_ADDRESS = process.env.VAULT_WALLET_ADDRESS || '';
const ADMIN_WALLET = process.env.ADMIN_WALLET || '';
const FEE_PERCENTAGE = 75; // 0.75% in basis points (75/10000)
const SPONSORSHIP_AMOUNT = 10_000_000; // 0.01 SOL in lamports

async function main() {
  console.log('🔧 Initializing vault governance...\n');

  if (!VAULT_WALLET_ADDRESS) {
    throw new Error('VAULT_WALLET_ADDRESS environment variable is required');
  }

  // Setup provider - this will use the wallet from Solana config (~/.config/solana/id.json)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(
    IDL as anchor.Idl,
    provider
  ) as Program<VaultGovernance>;

  const vaultWallet = new PublicKey(VAULT_WALLET_ADDRESS);
  
  // Use the provider wallet as admin (it has SOL and can sign)
  // This is now the permanent admin wallet: 8cn4SU7XhsddE1V9me2G71JRhV8JAyxatN5NTuZATSHW
  const admin = provider.wallet.publicKey;

  // Find vault state PDA
  const [vaultStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state')],
    program.programId
  );

  console.log('Vault State PDA:', vaultStatePDA.toBase58());
  console.log('Vault Wallet:', vaultWallet.toBase58());
  console.log('Admin Wallet:', admin.toBase58());
  console.log('Fee Percentage:', FEE_PERCENTAGE, 'basis points (0.75%)');
  console.log('Sponsorship Amount:', SPONSORSHIP_AMOUNT, 'lamports (0.01 SOL)');
  console.log('');

  try {
    const tx = await program.methods
      .initializeVault(
        new anchor.BN(FEE_PERCENTAGE),
        new anchor.BN(SPONSORSHIP_AMOUNT)
      )
      .accounts({
        vaultState: vaultStatePDA,
        vaultWallet: vaultWallet,
        admin: admin, // Provider wallet signs and becomes admin
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Vault initialized successfully!');
    console.log('Transaction signature:', tx);
    console.log('\n📝 Vault State:');
    console.log('  - Fee Percentage:', FEE_PERCENTAGE, 'basis points');
    console.log('  - Sponsorship Amount:', SPONSORSHIP_AMOUNT, 'lamports');
    console.log('  - Admin:', admin.toBase58());
  } catch (error) {
    console.error('❌ Error initializing vault:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

