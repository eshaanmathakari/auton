import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate a new Solana wallet
const wallet = Keypair.generate();

const publicKey = wallet.publicKey.toString();
const secretKey = bs58.encode(wallet.secretKey);

console.log('\n=== Auton Platform Wallet Generated ===\n');
console.log('Public Key (Platform Wallet Address):');
console.log(publicKey);
console.log('\nSecret Key (base58):');
console.log(secretKey);
console.log('\n⚠️  IMPORTANT: Keep this secret key secure!');
console.log('   Never commit it to version control.\n');

// Save to .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  const envContent = `PORT=3001
SOLANA_RPC_URL=https://api.devnet.solana.com
PLATFORM_WALLET_ADDRESS=${publicKey}
PLATFORM_FEE_PERCENTAGE=4
`;
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with platform wallet address\n');
} else {
  console.log('ℹ️  .env file already exists. Please manually add:');
  console.log(`   PLATFORM_WALLET_ADDRESS=${publicKey}\n`);
}

console.log('📝 Next steps:');
console.log('1. Request Devnet SOL for your platform wallet:');
console.log(`   https://faucet.solana.com/?address=${publicKey}`);
console.log('\n2. Request Devnet USDC (if needed):');
console.log('   You may need to use a Devnet USDC faucet or bridge');
console.log('\n3. Update your .env file with the PLATFORM_WALLET_ADDRESS\n');

