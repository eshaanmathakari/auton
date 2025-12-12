import { NextResponse } from 'next/server';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import IDL from '@/lib/anchor/auton_program.json';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'http://127.0.0.1:8899';
const AUTON_PROGRAM_ID = process.env.NEXT_PUBLIC_AUTON_PROGRAM_ID;
if (!AUTON_PROGRAM_ID) throw new Error('NEXT_PUBLIC_AUTON_PROGRAM_ID is not set');

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const creator = url.searchParams.get('creator');
    const dateFilter = (url.searchParams.get('dateFilter') || 'all') as 'all' | 'today' | '7days' | '30days';
    if (!creator) return NextResponse.json({ error: 'creator required' }, { status: 400 });

    const programId = new PublicKey(AUTON_PROGRAM_ID as string);
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const provider = new anchor.AnchorProvider(connection, {
      publicKey: anchor.web3.Keypair.generate().publicKey,
      signAllTransactions: async (txs) => txs,
      signTransaction: async (tx) => tx,
    } as any, { commitment: 'confirmed' });
    const program = new anchor.Program(IDL as any, provider) as any;

    // Calculate startTs
    const now = Math.floor(Date.now() / 1000);
    const startTs = (() => {
      switch (dateFilter) {
        case 'today': return now - 24 * 60 * 60;
        case '7days': return now - 7 * 24 * 60 * 60;
        case '30days': return now - 30 * 24 * 60 * 60;
        default: return 0;
      }
    })();

    // Fetch all creator accounts to map content IDs -> creator wallets
    const creators = await program.account.creatorAccount.all();
    const contentCreatorMap: Record<number, string> = {};
    type CreatorAccountRow = { publicKey: PublicKey, account: any };
    for (const ca of creators as CreatorAccountRow[]) {
      const items = (ca.account as any).content || [];
      const wallet = (ca.account as any).creatorWallet || (ca.account as any).creator_wallet || ca.publicKey.toBase58();
      const walletStr = (wallet && wallet.toBase58) ? wallet.toBase58() : String(wallet);
      for (const it of items) {
        const idNum = (it.id && typeof it.id.toNumber === 'function') ? it.id.toNumber() : Number(it.id);
        if (!isNaN(idNum)) contentCreatorMap[idNum] = walletStr;
      }
    }

    // Build price map and content IDs to scan for this creator
    const creatorPubkey = new PublicKey(creator);
    const [creatorAccountPDA] = PublicKey.findProgramAddressSync([Buffer.from('creator'), creatorPubkey.toBuffer()], programId);
    const creatorAccount = await program.account.creatorAccount.fetch(creatorAccountPDA);
    const contentItems = (creatorAccount.content || []).map((c: any) => ({ id: c.id.toNumber(), price: (c.price && typeof c.price.toNumber === 'function') ? c.price.toNumber() : Number(c.price) }));
    const priceMap: Record<number, number> = {};
    const contentIds = contentItems.map((ci: any) => {
      priceMap[ci.id] = (ci.price || 0) / anchor.web3.LAMPORTS_PER_SOL;
      return ci.id;
    });

    const seen = new Set<string>();
    const counts: Record<number, number> = {};
    let total = 0;

    // Creator memcmp first
    try {
      const creatorFilter = [{ memcmp: { offset: 8 + 32 + 8, bytes: creator } }];
      const receiptsByCreator = await program.account.paidAccessAccount.all(creatorFilter);
      for (const r of receiptsByCreator) {
        const acc: any = r.account;
        const pub = r.publicKey.toBase58();
        const tsRaw = acc.created_at ?? acc.createdAt ?? 0;
        const createdAt = typeof tsRaw === 'number' ? tsRaw : (tsRaw?.toNumber?.() ?? 0);
        if (startTs > 0 && createdAt < startTs) continue;
        if (seen.has(pub)) continue;
        seen.add(pub);
        const cid = (acc.contentId && typeof acc.contentId.toNumber === 'function') ? acc.contentId.toNumber() : Number(acc.contentId || acc.content_id || 0);
        counts[cid] = (counts[cid] || 0) + 1;
        total += priceMap[cid] || 0;
      }
    } catch (e) {
      // If creator memcmp fails or returns nothing, continue to fallback
    }

    // Helper: Verify a receipt was paid to the provided creator by inspecting its creating transaction
    async function verifyReceiptPaidToCreator(receiptPubkeyStr: string, creatorPubkeyStr: string) {
      try {
        const receiptPubkey = new PublicKey(receiptPubkeyStr);
        // Look for recent signatures involving this PDA; limit to avoid excessive RPC calls
        const sigs = await connection.getSignaturesForAddress(receiptPubkey, { limit: 10 });
        for (const s of sigs) {
          if (!s.signature) continue;
          const parsed = await connection.getParsedTransaction(s.signature, 'confirmed');
          if (!parsed || !parsed.transaction) continue;
          const instrs = (parsed.transaction.message as any).instructions || [];
          // Check top-level parsed instructions
          for (const ix of instrs) {
            const prog = ix.program;
            const parsedIx = ix.parsed || ix; // some RPCs return parsed at different shape
            if (prog === 'system' && parsedIx && parsedIx.type === 'transfer') {
              const dest = parsedIx.info && parsedIx.info.destination;
              if (dest === creatorPubkeyStr) return true;
            }
            // Some RPC responses have program === 'system' and parsed.type === 'transfer'
            if (prog === 'system' && parsedIx && parsedIx.parsed && parsedIx.parsed.type === 'transfer') {
              const dest = parsedIx.parsed.info && parsedIx.parsed.info.destination;
              if (dest === creatorPubkeyStr) return true;
            }
          }
          // Also inspect inner instructions if present
          const inner = parsed.meta?.innerInstructions || [];
          for (const innerBlock of inner) {
            for (const ix of innerBlock.instructions || []) {
              const prog = ix.program;
              const parsedIx = ix.parsed || ix;
              if (prog === 'system' && parsedIx && parsedIx.type === 'transfer') {
                const dest = parsedIx.info && parsedIx.info.destination;
                if (dest === creatorPubkeyStr) return true;
              }
              if (prog === 'system' && parsedIx && parsedIx.parsed && parsedIx.parsed.type === 'transfer') {
                const dest = parsedIx.parsed.info && parsedIx.parsed.info.destination;
                if (dest === creatorPubkeyStr) return true;
              }
            }
          }
        }
      } catch (e) {
        // ignore errors; return false
      }
      return false;
    }

    // Per content fallback
    console.debug('creator_receipts: scanning contentIds', contentIds);
    for (const cid of contentIds) {
      const idBuf = new anchor.BN(cid).toArrayLike(Buffer, 'le', 8);
      const bs58mod = await import('bs58');
      // Determine encoder function across different package exports
      const encodeFn = (bs58mod && typeof (bs58mod as any).encode === 'function')
        ? (bs58mod as any).encode
        : (bs58mod && typeof (bs58mod as any).default === 'function')
        ? (bs58mod as any).default
        : ((bs58mod && bs58mod.default && typeof (bs58mod as any).default.encode === 'function') ? (bs58mod as any).default.encode : null);
      if (!encodeFn) throw new Error('bs58 encode function not found');
      const bytes = encodeFn(idBuf);
      const contentFilter = [{ memcmp: { offset: 8 + 32, bytes } }];
      console.debug('creator_receipts: cid', cid, 'bytes', bytes, 'filter', contentFilter);
      try {
        const res = await program.account.paidAccessAccount.all(contentFilter as any);
        console.debug('creator_receipts: res length', res?.length, 'for cid', cid, 'example', res?.[0]?.publicKey?.toBase58?.());
        for (const r of res) {
          const pub = r.publicKey.toBase58();
          if (seen.has(pub)) continue;
          const acc: any = r.account;
          const mappedCreator = contentCreatorMap[cid];
          console.debug('creator_receipts: mappedCreator', mappedCreator, 'for cid', cid);
          // If the account has a creator field, prefer that; otherwise, try simple mapping
          const accCreator = (acc.creator && typeof acc.creator.toBase58 === 'function') ? acc.creator.toBase58() : (acc.creator || acc.creator_pubkey || acc.creatorWallet || acc.creator_wallet);
          let shouldCount = false;
          if (accCreator) {
            if (String(accCreator) === creator) shouldCount = true;
          } else if (mappedCreator === creator) {
            shouldCount = true;
          } else {
            // As a fallback, inspect the transaction to verify transfer destination
            const verified = await verifyReceiptPaidToCreator(pub, creator);
            if (verified) shouldCount = true;
          }
          if (!shouldCount) continue;
          const tsRaw = acc.created_at ?? acc.createdAt ?? 0;
          const createdAt = typeof tsRaw === 'number' ? tsRaw : (tsRaw?.toNumber?.() ?? 0);
          if (startTs > 0 && createdAt < startTs) continue;
          seen.add(pub);
          counts[cid] = (counts[cid] || 0) + 1;
          total += priceMap[cid] || 0;
        }
      } catch (e) {
        // ignore
      }
    }

    console.debug('creator_receipts: counts', counts, 'total', total);
    return NextResponse.json({ soldCounts: counts, totalCollected: total });
  } catch (err: any) {
    console.error('creator_receipts API error', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
