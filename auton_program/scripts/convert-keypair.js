/**
 * Convert keypair array to Phantom wallet format
 * 
 * Usage: node scripts/convert-keypair.js
 */

// Your keypair array (64 bytes: 32 private + 32 public)
const keypairArray = [246,120,104,166,58,242,178,185,87,74,120,242,178,185,87,74,120,242,178,185,87,74,120,242,178,185,87,74,120,242,178,185,21,12,68,246,120,104,166,58,242,178,185,87,74,120,242,178,185,87,74,120,242,178,185,87,74,120,242,178,185,87,74,120];

const fs = require('fs');
const path = require('path');

// Convert to Uint8Array
const keypairBytes = new Uint8Array(keypairArray);

// For Phantom: Base58 encode the 32-byte private key (first 32 bytes)
let bs58;
try {
  bs58 = require('bs58');
  const encode = bs58.default?.encode || bs58.encode || bs58;
  if (typeof encode !== 'function') {
    throw new Error('bs58 encode function not found');
  }
  // Phantom expects the 32-byte private key in Base58
  const privateKeyBytes = keypairBytes.slice(0, 32);
  var base58PrivateKey = encode(privateKeyBytes);
  
  // Also provide 64-byte format (some wallets use this)
  var base58SecretKey = encode(keypairBytes);
} catch (e) {
  console.error('❌ Error encoding with bs58:', e.message);
  process.exit(1);
}

console.log('\n✅ Keypair Conversion Complete\n');
console.log('📝 Formats:\n');

// 1. Base58 for Phantom wallet (32-byte private key)
console.log('1. Base58 Private Key (32 bytes - for Phantom wallet import):');
console.log('   ' + base58PrivateKey);
console.log('');
console.log('   Alternative (64-byte secret key - if 32-byte doesn\'t work):');
console.log('   ' + base58SecretKey);
console.log('');

// 2. JSON array format (for Solana CLI)
const keypairPath = path.join(process.env.HOME, '.config', 'solana', 'id.json');
const keypairDir = path.dirname(keypairPath);

// Create directory if it doesn't exist
if (!fs.existsSync(keypairDir)) {
  fs.mkdirSync(keypairDir, { recursive: true });
}

fs.writeFileSync(keypairPath, JSON.stringify(keypairArray));
console.log('2. Solana CLI keypair file saved to:');
console.log('   ' + keypairPath);
console.log('');

// 3. Verify the address
try {
  const { Keypair } = require('@solana/web3.js');
  // fromSecretKey expects only the first 32 bytes (private key)
  const privateKeyBytes = keypairBytes.slice(0, 32);
  const kp = Keypair.fromSecretKey(privateKeyBytes);
  const address = kp.publicKey.toBase58();
  console.log('3. Wallet Address:');
  console.log('   ' + address);
  console.log('');
  const expectedAddress = '4eUJuTomQxrmvWwz2CQ74iJzeq28RL16BmsNpwmsTFP9';
  if (address === expectedAddress) {
    console.log('✅ Verification: Address matches expected wallet!');
  } else {
    console.log('⚠️  Warning: Address does not match expected wallet');
    console.log('   Expected: ' + expectedAddress);
    console.log('   Got:      ' + address);
  }
} catch (e) {
  console.log('⚠️  Could not verify address:', e.message);
}

console.log('\n📋 Instructions for Phantom:');
console.log('1. Open Phantom wallet');
console.log('2. Go to Settings > Security & Privacy');
console.log('3. Click "Import Private Key"');
console.log('4. Paste the Base58 key above');
console.log('5. Verify the address matches:', '4eUJuTomQxrmvWwz2CQ74iJzeq28RL16BmsNpwmsTFP9');
console.log('');

