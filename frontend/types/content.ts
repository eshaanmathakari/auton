import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export type ContentItem = {
  id: anchor.BN;
  title: string;
  description: string;
  price: anchor.BN;
  assetType: 'SOL' | 'USDC';
  contentKind: string;
  allowDownload: boolean;
  creatorWalletAddress: PublicKey;
  preview?: {
    enabled: boolean;
    mode: string;
    snippet?: string | null;
    previewUrl?: string | null;
    previewType?: string | null;
    previewContentType?: string | null;
  };
};

export type CreatorAccountData = {
  creatorWallet: PublicKey;
  lastContentId: anchor.BN;
  content: ContentItem[];
};
