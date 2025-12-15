import { Connection, PublicKey, Transaction, TransactionInstruction, VersionedTransaction, Message } from '@solana/web3.js';
import { loadRelayerWallet } from './vault'; // Renamed from vault.ts to reflect purpose more accurately
import * as anchor from '@coral-xyz/anchor';
import { AutonProgram } from '@/lib/anchor/auton_program'; // Adjust path as needed
import IDL from '@/lib/anchor/auton_program.json'; // Adjust path as needed

const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;

if (!AUTON_PROGRAM_ID) {
    throw new Error('AUTON_PROGRAM_ID is not set in environment variables.');
}

const autonProgramId = new PublicKey(AUTON_PROGRAM_ID);

/**
 * Validates a transaction to ensure it only performs allowed operations within the Auton program.
 * This is crucial to prevent abuse of the relayer.
 *
 * @param transaction The transaction to validate.
 * @returns True if the transaction is valid for sponsorship, false otherwise.
 */
export function validateSponsoredTransaction(transaction: Transaction | VersionedTransaction): boolean {
    // 1. Normalize instructions
    let instructions: { programId: PublicKey; data: Uint8Array }[] = [];

    if (transaction instanceof Transaction) {
        // Legacy Transaction
        if (transaction.instructions.length === 0) {
            console.warn('Sponsored transaction rejected: No instructions found.');
            return false;
        }
        instructions = transaction.instructions.map(ix => ({
            programId: ix.programId,
            data: ix.data
        }));
    } else {
        // Versioned Transaction
        const message = transaction.message;
        // Check if we have instructions
        if (message.compiledInstructions.length === 0) {
             console.warn('Sponsored transaction rejected: No instructions found.');
             return false;
        }

        instructions = message.compiledInstructions.map(ix => {
            // Resolve program ID from index
            const programIdIndex = ix.programIdIndex;
            const programId = message.staticAccountKeys[programIdIndex];
            return {
                programId,
                data: ix.data
            };
        });
    }

    // 2. Validate Instructions
    for (const instruction of instructions) {
        // All sponsored instructions MUST be for the Auton Program
        if (!instruction.programId.equals(autonProgramId)) {
            console.warn(`Sponsored transaction rejected: Instruction not for Auton Program. Program ID: ${instruction.programId.toBase58()}`);
            return false;
        }

        // Decode the instruction data to verify the instruction name
        let decodedInstruction: anchor.IdlInstruction | null = null;
        try {
            const idl = IDL as AutonProgram; // Cast to your program's IDL type
            const discriminator = instruction.data.subarray(0, 8); // Anchor instruction discriminator
            for (const inst of idl.instructions) {
                // discriminator is number[] in IDL, but Buffer/Uint8Array in tx
                if (Buffer.from(inst.discriminator).equals(Buffer.from(discriminator))) {
                    decodedInstruction = inst;
                    break;
                }
            }
        } catch (e) {
            console.error('Failed to decode instruction:', e);
            return false;
        }

        if (!decodedInstruction) {
            console.warn('Sponsored transaction rejected: Could not decode instruction.');
            return false;
        }

        const allowedInstructions = [
            'initializeCreator', 'initialize_creator',
            'addContent', 'add_content',
            'registerUsername', 'register_username'
        ];

        // Explicitly allow 'initializeCreator', 'addContent', and 'registerUsername'
        if (!allowedInstructions.includes(decodedInstruction.name)) {
            console.warn(`Sponsored transaction rejected: Disallowed instruction '${decodedInstruction.name}'.`);
            return false;
        }
    }

    return true; // All instructions passed validation
}

/**
 * Signs a partially signed transaction with the relayer's keypair and submits it to the network.
 * @param partiallySignedTx A base64 encoded partially signed transaction from the user.
 * @returns The transaction signature.
 */
export async function signAndSubmitSponsoredTransaction(
    partiallySignedTxBase64: string,
    connection: Connection
): Promise<string> {
    const relayer = loadRelayerWallet();
    let transaction: Transaction | VersionedTransaction;

    // Determine transaction type and deserialize
    const txBuffer = Buffer.from(partiallySignedTxBase64, 'base64');
    try {
        // Try as VersionedTransaction first (modern way)
        transaction = VersionedTransaction.deserialize(txBuffer);
        // Ensure the relayer wallet is set as the fee payer
        const message = transaction.message;
        const feePayerIndex = 0; // Fee payer is always index 0 in staticAccountKeys
        const feePayer = message.staticAccountKeys[feePayerIndex];
        
        if (!feePayer.equals(relayer.publicKey)) {
             throw new Error(`Transaction fee payer mismatch. Expected Relayer (${relayer.publicKey.toBase58()}), got ${feePayer.toBase58()}`);
        }

    } catch (versionedError: any) {
        // console.log("Not a versioned transaction:", versionedError.message);
        // Fallback to legacy Transaction
        try {
            transaction = Transaction.from(txBuffer);
            if (!transaction.feePayer?.equals(relayer.publicKey)) {
                 throw new Error(`Transaction fee payer mismatch. Expected Relayer (${relayer.publicKey.toBase58()}), got ${transaction.feePayer?.toBase58()}`);
            }
        } catch (legacyError: any) {
             console.error("Deserialization Error (Legacy):", legacyError);
             console.error("Deserialization Error (Versioned):", versionedError);
             throw new Error(`Failed to deserialize transaction. Invalid format. Legacy Error: ${legacyError.message}`);
        }
    }


    // Validate the transaction BEFORE signing it with the relayer's key!
    if (!validateSponsoredTransaction(transaction)) {
        throw new Error('Transaction content is not allowed for sponsorship.');
    }

    // Sign the transaction with the relayer's keypair
    if (transaction instanceof Transaction) {
        transaction.partialSign(relayer.keypair);
    } else {
        // VersionedTransactions
        transaction.sign([relayer.keypair]);
    }
    
    // Send the raw transaction
    try {
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            maxRetries: 5,
        });
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
    } catch (sendError: any) {
        console.error("Send/Confirm Transaction Error:", sendError);
        throw new Error(`Failed to send transaction: ${sendError.message}`);
    }
}