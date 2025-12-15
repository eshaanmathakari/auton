import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Loads the vault (relayer) wallet from environment variables.
 * This keypair is used to pay for sponsored transactions.
 *
 * This function MUST ONLY BE CALLED ON THE SERVER (e.g., within Next.js API routes).
 * The private key should never be exposed to the client.
 */
export function loadRelayerWallet() {
  const privateKeyBase64 = process.env.RELAYER_WALLET_PRIVATE_KEY;

  if (!privateKeyBase64) {
    throw new Error('RELAYER_WALLET_PRIVATE_KEY must be set in environment variables (e.g., .env.local).');
  }

  try {
    const secretKey = bs58.decode(privateKeyBase64!);
    const keypair = Keypair.fromSecretKey(secretKey);
    
    return {
      keypair,
      publicKey: keypair.publicKey,
      address: keypair.publicKey.toBase58(),
    };
  } catch (error) {
    console.error('Error loading relayer wallet from environment variable:', error);
    throw new Error('Failed to load relayer wallet. Ensure RELAYER_WALLET_PRIVATE_KEY is a valid base64-encoded private key.');
  }
}

/**
 * Generates a new Solana Keypair.
 * Use this to create a RELAYER_WALLET_PRIVATE_KEY if you don't have one.
 * Store the outputted privateKeyBase64 in your .env.local file.
 */
export function generateNewRelayerWallet() {
  const keypair = Keypair.generate();
  const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');
  console.log(`
  ********************************************************************************
  *                         NEW RELAYER WALLET GENERATED                         *
  ********************************************************************************
  * Add the following to your .env.local file:                                   *
  * RELAYER_WALLET_PRIVATE_KEY="${privateKeyBase64}"                             *
  * RELAYER_WALLET_PUBLIC_KEY="${keypair.publicKey.toBase58()}"                  *
  ********************************************************************************
  * Fund this address on Devnet to pay for sponsored transactions:               *
  * ${keypair.publicKey.toBase58()}                                            *
  ********************************************************************************
  `);
  return {
    keypair,
    publicKey: keypair.publicKey,
    address: keypair.publicKey.toBase58(),
    privateKeyBase64,
  };
}
