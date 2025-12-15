import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { AutonProgram } from "../target/types/auton_program";

async function main() {
  // Configure client to use the provider from environment (e.g., ANCHOR_PROVIDER_URL)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AutonProgram as Program<AutonProgram>;

  // 1. Derive the Protocol Config PDA
  const [configPDA] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log("Protocol Config PDA:", configPDA.toBase58());

  // 2. Define Initial Settings
  const INITIAL_FEE_BPS = new anchor.BN(500); // 5%
  // Admin will be the wallet currently configured in Anchor.toml / env
  const admin = provider.wallet; 

  console.log("Initializing config with:");
  console.log("  Admin:", admin.publicKey.toBase58());
  console.log("  Fee:", INITIAL_FEE_BPS.toString());

  try {
    // 3. Check if already initialized
    const existingConfig = await program.account.protocolConfig.fetch(configPDA).catch(() => null);
    if (existingConfig) {
      console.log("Config already initialized!");
      console.log("  Current Fee:", existingConfig.feePercentage.toString());
      console.log("  Current Admin:", existingConfig.adminWallet.toBase58());
      return;
    }

    // 4. Call initialize_config
    const tx = await program.methods
      .initializeConfig(INITIAL_FEE_BPS)
      .accounts({
        protocolConfig: configPDA,
        admin: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Success! Transaction signature:", tx);
  } catch (err) {
    console.error("Failed to initialize config:", err);
  }
}

main();
