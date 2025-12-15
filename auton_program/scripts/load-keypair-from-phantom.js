/**
 * Load keypair from Phantom-exported Base58 private key
 * 
 * Usage: node scripts/load-keypair-from-phantom.js <base58_private_key>
 */

const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const privateKeyBase58 = process.argv[2];

if (!privateKeyBase58) {
  console.error('❌ Usage: node scripts/load-keypair-from-phantom.js <base58_private_key>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/load-keypair-from-phantom.js Hb7nTfvAhZ9c9YZZotqgfhxUC4jJL7AhYX5EkAbnWrx8');
  process.exit(1);
}

try {
  // Decode Base58 private key
  const decode = bs58.default?.decode || bs58.decode;
  const privateKeyBytes = decode(privateKeyBase58);
  
  console.log('Decoded private key length:', privateKeyBytes.length, 'bytes');
  
  // Create keypair from private key
  let keypair;
  if (privateKeyBytes.length === 32) {
    // 32-byte private key - need to expand to 64 bytes for Solana
    // Solana expects 64 bytes: 32-byte private key + 32-byte public key
    // We'll create the keypair first, then extract the full secret key
    try {
      keypair = Keypair.fromSecretKey(privateKeyBytes);
    } catch (e) {
      // If that fails, try creating from seed
      const { derivePath } = require('ed25519-hd-key');
      // This might be a seed that needs derivation
      throw new Error(`Cannot create keypair from 32-byte key. Error: ${e.message}. Try using the 64-byte secret key format from Phantom.`);
    }
  } else if (privateKeyBytes.length === 64) {
    // 64-byte secret key (private + public) - this is what Solana CLI expects
    keypair = Keypair.fromSecretKey(privateKeyBytes);
  } else {
    throw new Error(`Invalid key length: ${privateKeyBytes.length} bytes. Expected 32 or 64 bytes.`);
  }
  
  const address = keypair.publicKey.toBase58();
  console.log('✅ Wallet Address:', address);
  console.log('');
  
  // Verify it matches expected address
  const expectedAddress = '4eUJuTomQxrmvWwz2CQ74iJzeq28RL16BmsNpwmsTFP9';
  if (address === expectedAddress) {
    console.log('✅ Address matches expected wallet!');
  } else {
    console.log('⚠️  Address does not match expected wallet');
    console.log('   Expected: ' + expectedAddress);
    console.log('   Got:      ' + address);
  }
  
  // Save as Solana CLI keypair format (64 bytes: 32 private + 32 public)
  const publicKeyBytes = keypair.publicKey.toBuffer();
  const fullKeypair = new Uint8Array(64);
  fullKeypair.set(privateKeyBytes.slice(0, 32), 0);
  fullKeypair.set(publicKeyBytes, 32);
  
  const keypairPath = path.join(process.env.HOME, '.config', 'solana', 'id.json');
  const keypairDir = path.dirname(keypairPath);
  
  if (!fs.existsSync(keypairDir)) {
    fs.mkdirSync(keypairDir, { recursive: true });
  }
  
  fs.writeFileSync(keypairPath, JSON.stringify(Array.from(fullKeypair)));
  console.log('');
  console.log('✅ Keypair saved to:', keypairPath);
  console.log('');
  console.log('You can now use this wallet with Solana CLI and Anchor.');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

