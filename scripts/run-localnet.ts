import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import idl from "../idl/later_mintpass.json";

const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const LOCALNET_URL = "http://127.0.0.1:8899";

function loadLocalWallet(): Keypair {
  const defaultPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const keypairPath = process.env.ANCHOR_WALLET || defaultPath;
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function main() {
  const connection = new Connection(LOCALNET_URL, "confirmed");
  const authorityKeypair = loadLocalWallet();
  const wallet = new Wallet(authorityKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = new Program(idl as anchor.Idl, provider);

  console.log("==> Program ID:", program.programId.toBase58());
  console.log("==> Authority:", authorityKeypair.publicKey.toBase58());

  const balance = await connection.getBalance(authorityKeypair.publicKey);
  if (balance < 1e9) {
    console.log("==> Solicitando airdrop de 2 SOL (Localnet)...");
    const sig = await connection.requestAirdrop(authorityKeypair.publicKey, 2e9);
    await connection.confirmTransaction(sig, "confirmed");
  }

  const collectionKeypair = Keypair.generate();
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);

  console.log("\n==> Ejecutando initialize_collection...");
  console.log("    Config PDA:", configPda.toBase58());
  console.log("    Collection:", collectionKeypair.publicKey.toBase58());

  const txInit = await program.methods
    .initializeCollection("LATER Mint Pass — Genesis Collection", "https://arweave.net/PLACEHOLDER_COLLECTION_URI")
    .accounts({
      config: configPda,
      collection: collectionKeypair.publicKey,
      authority: authorityKeypair.publicKey,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([collectionKeypair])
    .rpc();
  console.log("    ✅ initialize_collection confirmado. Tx:", txInit);

  const recipientKeypair = Keypair.generate();
  const assetKeypair = Keypair.generate();

  console.log("\n==> Ejecutando mint_pass...");
  console.log("    Recipient:", recipientKeypair.publicKey.toBase58());
  console.log("    Asset:", assetKeypair.publicKey.toBase58());

  const txMint = await program.methods
    .mintPass("LATER Mint Pass #0001", "https://arweave.net/PLACEHOLDER_ASSET_URI_0001")
    .accounts({
      config: configPda,
      asset: assetKeypair.publicKey,
      collection: collectionKeypair.publicKey,
      authority: authorityKeypair.publicKey,
      recipient: recipientKeypair.publicKey,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([assetKeypair])
    .rpc();
  console.log("    ✅ mint_pass confirmado. Tx:", txMint);

  const configAccount: any = await (program.account as any).mintPassConfig.fetch(configPda);
  console.log("\n==> Estado final de MintPassConfig:");
  console.log("    authority:", configAccount.authority.toBase58());
  console.log("    collection:", configAccount.collection.toBase58());
  console.log("    minted_count:", configAccount.mintedCount.toString());
  console.log("    max_supply:", configAccount.maxSupply.toString());
  console.log("\n✅ Flujo extremo a extremo validado en Localnet.");
}

main().catch((err) => {
  console.error("Fallo el script:", err);
  process.exit(1);
});