import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AutonProgram } from "../target/types/auton_program";
import { assert } from "chai";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

describe("auton_program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AutonProgram as Program<AutonProgram>;
  
  // We'll use the provider's wallet as the creator for testing.
  const creator = provider.wallet;

  // PDA for the creator's content account.
  const [creatorAccountPDA, _creatorBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("creator"), creator.publicKey.toBuffer()],
      program.programId
    );

  // Encryption key (in production, derive this securely or store in wallet)
  const encryptionKey = randomBytes(32); // 256-bit key for ChaCha20-Poly1305

  function encryptCID(cid: string, key: Buffer): Buffer {
    const nonce = randomBytes(12); // 96-bit nonce for ChaCha20-Poly1305
    const cipher = createCipheriv('chacha20-poly1305', key, nonce, {
      authTagLength: 16,
    });
    
    const encrypted = Buffer.concat([
      cipher.update(cid, 'utf8'),
      cipher.final(),
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Return: nonce(12) + encrypted(variable) + authTag(16)
    return Buffer.concat([nonce, encrypted, authTag]);
  }

  function decryptCID(encryptedData: Buffer, key: Buffer): string {
    const nonce = encryptedData.subarray(0, 12);
    const authTag = encryptedData.subarray(encryptedData.length - 16);
    const encrypted = encryptedData.subarray(12, encryptedData.length - 16);
    
    const decipher = createDecipheriv('chacha20-poly1305', key, nonce, {
      authTagLength: 16,
    });
    decipher.setAuthTag(authTag);
    
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  }

  it("Initializes a creator account", async () => {
    await program.methods
      .initializeCreator()
      .accounts({
        creatorAccount: creatorAccountPDA,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch the created account.
    const accountData = await program.account.creatorAccount.fetch(
      creatorAccountPDA
    );

    assert.ok(
      accountData.creatorWallet.equals(creator.publicKey),
      "Creator wallet does not match"
    );
    assert.isEmpty(accountData.content, "Content list should be empty");
  });

  it("Adds a new piece of content", async () => {
    const title = "My First Drop";
    const price = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
    const ipfsCid = "QmXgZAUc3kCn7C4s21N2b345aD567890E12345F67890";
    
    // Encrypt the IPFS CID
    const encryptedCid = encryptCID(ipfsCid, encryptionKey);

    await program.methods
      .addContent(title, price, encryptedCid)
      .accounts({
        creatorAccount: creatorAccountPDA,
        creator: creator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const accountData = await program.account.creatorAccount.fetch(
      creatorAccountPDA
    );

    assert.equal(accountData.content.length, 1, "Content was not added");
    assert.equal(accountData.content[0].title, title);
    assert.ok(accountData.content[0].price.eq(price));
    
    // Decrypt and verify
    const decryptedCid = decryptCID(
      Buffer.from(accountData.content[0].encryptedCid),
      encryptionKey
    );
    assert.equal(decryptedCid, ipfsCid, "Decrypted CID doesn't match");
  });

  it("Processes a payment and creates an access receipt", async () => {
    const buyer = anchor.web3.Keypair.generate();
    
    // Fund the buyer's account
    const tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
            fromPubkey: provider.wallet.publicKey,
            toPubkey: buyer.publicKey,
            lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        })
    );
    await provider.sendAndConfirm(tx);

    // --- Get the content to be purchased ---
    const creatorAccountData = await program.account.creatorAccount.fetch(
      creatorAccountPDA
    );
    const contentToBuy = creatorAccountData.content[0];
    const price = contentToBuy.price;
    const encryptedCid = Buffer.from(contentToBuy.encryptedCid);
    
    // Hash the encrypted CID for the PDA seeds
    // Note: Anchor's on-chain SHA256 is slightly different from Node's.
    // For testing, we can re-fetch the content and hash it, but for a real client,
    // it's crucial to use a library that produces a Solana-compatible SHA256 hash.
    // Here, we'll simulate the client having the correct hash.
    const contentHash = createHash("sha256").update(encryptedCid).digest();

    const [paidAccessPDA, _accessBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("access"),
          buyer.publicKey.toBuffer(),
          contentHash,
        ],
        program.programId
      );

    // --- Check balances before the transaction ---
    const creatorBalanceBefore = await provider.connection.getBalance(creator.publicKey);

    // --- Execute the payment ---
    await program.methods
      .processPayment(Array.from(contentHash))
      .accounts({
        paidAccessAccount: paidAccessPDA,
        creatorAccount: creatorAccountPDA,
        creatorWallet: creator.publicKey, // The address for the check
        buyer: buyer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // --- Verify the results ---
    const accessAccountData = await program.account.paidAccessAccount.fetch(
      paidAccessPDA
    );

    // 1. Check the access receipt
    assert.ok(accessAccountData.buyer.equals(buyer.publicKey));
    assert.deepEqual(accessAccountData.contentHash, Array.from(contentHash));
    
    // 2. Check if the creator received the correct payment
    const creatorBalanceAfter = await provider.connection.getBalance(creator.publicKey);
    const expectedBalance = creatorBalanceBefore + price.toNumber();
    assert.equal(creatorBalanceAfter, expectedBalance, "Creator did not receive the correct payment amount");
    
    console.log("✓ Payment verified! User can now decrypt and access content.");
  });
});