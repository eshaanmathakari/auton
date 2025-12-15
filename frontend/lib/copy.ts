/**
 * Centralized Copy & Messaging System for Auton
 * 
 * All user-facing text should be imported from this file to ensure
 * consistency and make it easy to update messaging across the app.
 */

// ============================================
// BRAND & TAGLINES
// ============================================
export const BRAND = {
  name: 'Auton',
  tagline: 'Patreon-style x402 paywall infra for humans and agents.',
  shortDescription: 'Decentralized content monetization on Solana',
  fullDescription: 'Upload premium content, set your price, and earn directly. Encrypted. Instant. On-chain.',
};

// ============================================
// WHAT IS AUTON - EXPLANATIONS
// ============================================
export const WHAT_IS_AUTON = {
  headline: 'What is Auton?',
  forCreators: {
    title: 'For Creators',
    description: 'Upload encrypted content, set your price, and get paid directly in SOL. No middlemen, no custody, instant settlement.',
    steps: [
      'Sign up with email, Google, or Twitter (we create your wallet automatically)',
      'Upload & encrypt your content',
      'Set your price in SOL',
      'Share your link and earn',
    ],
  },
  forSupporters: {
    title: 'For Supporters',
    description: 'Discover and unlock premium content from your favorite creators. Pay once with Solana, unlock forever.',
    steps: [
      'Connect your Solana wallet',
      'Browse creator content',
      'Pay once to unlock',
      'Download or stream instantly',
    ],
  },
  forDevelopers: {
    title: 'For Builders & Agents',
    description: 'Integrate pay-per-file monetization into your apps. Perfect for AI agents, SaaS tools, and community platforms.',
    features: [
      'REST API for programmatic content creation',
      'x402 protocol for HTTP paywalls',
      'Webhook support for payment confirmations',
      'No infrastructure to manage',
    ],
  },
};

// ============================================
// HOW IT WORKS - STEP BY STEP
// ============================================
export const HOW_IT_WORKS = {
  creator: {
    title: 'How It Works for Creators',
    steps: [
      { number: 1, title: 'Connect', description: 'Link your Solana wallet to get started' },
      { number: 2, title: 'Create', description: 'Upload your content - it gets encrypted automatically' },
      { number: 3, title: 'Price', description: 'Set your price in SOL for each drop' },
      { number: 4, title: 'Share', description: 'Share your unique link and start earning' },
    ],
  },
  supporter: {
    title: 'How It Works for Supporters',
    steps: [
      { number: 1, title: 'Connect', description: 'Connect your Solana wallet (Phantom, Solflare, etc.)' },
      { number: 2, title: 'Browse', description: 'Explore content from creators you love' },
      { number: 3, title: 'Pay', description: 'Approve a one-time payment in SOL' },
      { number: 4, title: 'Enjoy', description: 'Instantly access your unlocked content' },
    ],
  },
};

// ============================================
// TOOLTIPS & HELPER TEXT
// ============================================
export const TOOLTIPS = {
  wallet: {
    title: 'What is a Solana wallet?',
    description: 'A Solana wallet (like Phantom or Solflare) is how you hold and send SOL cryptocurrency. It\'s like a digital wallet for blockchain payments.',
    embeddedWallet: 'We can create a wallet for you automatically when you sign up with email or social login. No need to install anything!',
    exportWallet: 'You can export your wallet keys anytime in settings if you want to use it with other apps.',
  },
  gasFees: {
    title: 'What are gas fees?',
    description: 'Gas fees are small payments required to process transactions on the blockchain. Think of them like postage stamps for your digital transactions.',
    firstTimeFree: 'Your first upload is free! We cover the gas fees for new creators to help you get started.',
    typicalCost: 'Typical gas fees are very low (less than $0.01), but we cover them for your first transaction.',
  },
  x402: {
    title: 'What is x402?',
    description: 'x402 is a standard for HTTP paywalls on Solana. It lets websites request payment before serving content, making pay-per-access seamless.',
  },
  noRefunds: {
    title: 'No-Refund Policy',
    description: 'Blockchain payments are final and cannot be reversed. Please review content details carefully before unlocking.',
  },
  directPayment: {
    title: 'Direct to Creator',
    description: 'Your payment goes directly to the creator\'s wallet. Auton never holds your funds.',
  },
  encryption: {
    title: 'Encrypted Content',
    description: 'All content is encrypted with AES-256-GCM before storage. Only after payment verification is the decryption key released.',
  },
  fees: {
    title: 'Platform Fee',
    description: 'Auton charges a 0.75% platform fee on payments. This excludes Solana network transaction fees.',
  },
};

// ============================================
// EMPTY STATES
// ============================================
export const EMPTY_STATES = {
  noDrops: {
    title: 'No drops yet',
    description: 'You haven\'t published any content yet.',
    cta: 'Create your first drop',
  },
  noEarnings: {
    title: 'No earnings yet',
    description: 'Share your profile link to start earning.',
    cta: 'Copy share link',
  },
  noContent: {
    title: 'No content found',
    description: 'This creator hasn\'t published any drops yet.',
    cta: 'Back to home',
  },
  noUnlocks: {
    title: 'No unlocked content',
    description: 'You haven\'t unlocked any content yet.',
    cta: 'Browse creators',
  },
};

// ============================================
// ERROR MESSAGES
// ============================================
export const ERRORS = {
  // Wallet Errors
  walletNotConnected: 'Please connect your wallet or sign up to continue.',
  walletConnectionFailed: 'We couldn\'t connect to your wallet. Please check your wallet extension or try signing up with email/social login.',
  walletSignatureFailed: 'Transaction signing was cancelled or failed. Please try again.',
  walletCreationFailed: 'We couldn\'t create your wallet. Please try again or use an existing wallet.',
  
  // Payment Errors
  paymentFailed: 'Payment failed. Please try again.',
  paymentVerificationFailed: 'We couldn\'t verify this transaction. Your funds are safe on-chain; please try again or contact support.',
  insufficientFunds: 'Insufficient funds in your wallet. Please add more SOL and try again.',
  paymentExpired: 'Payment session expired. Please refresh and try again.',
  
  // Network Errors
  networkError: 'Network is busy or unreachable. Please retry in a few seconds.',
  rpcError: 'Unable to connect to Solana network. Please try again later.',
  transactionTimeout: 'Transaction took too long. Please check your wallet for the status.',
  
  // Content Errors
  contentNotFound: 'Content not found. Please check the URL.',
  creatorNotFound: 'Creator not found. Please check the URL.',
  uploadFailed: 'Failed to upload content. Please try again.',
  encryptionFailed: 'Failed to encrypt content. Please try again.',
  
  // Validation Errors
  invalidUsername: 'Username can only contain letters, numbers, underscores, and hyphens.',
  usernameTaken: 'This username is already taken. Please choose another.',
  titleRequired: 'Please enter a title for your content.',
  priceRequired: 'Please set a price for your content.',
  fileRequired: 'Please upload a file to gate.',
  
  // Generic
  somethingWentWrong: 'Something went wrong. Please try again.',
  unauthorized: 'You don\'t have permission to perform this action.',
};

// ============================================
// SUCCESS MESSAGES
// ============================================
export const SUCCESS = {
  // Account
  profileCreated: 'Your Auton profile is live!',
  walletCreated: 'Your wallet was created successfully! You can export it anytime in settings.',
  usernameSet: (username: string) => `Username @${username} set successfully!`,
  profileUpdated: 'Profile updated successfully!',
  firstUploadSponsored: 'Your first upload is free! We covered the gas fees to help you get started.',
  
  // Content
  contentPublished: (title: string) => `Content "${title}" published on-chain!`,
  contentUnlocked: 'You\'ve unlocked this drop!',
  contentDownloaded: 'Download started!',
  
  // Payment
  paymentConfirmed: 'Payment confirmed!',
  paymentReceived: 'Payment received! Funds sent directly to creator.',
  
  // Misc
  linkCopied: 'Link copied to clipboard!',
  settingsSaved: 'Settings saved!',
};

// ============================================
// BUTTON LABELS
// ============================================
export const BUTTONS = {
  // Primary Actions
  getStarted: 'Get Started',
  connectWallet: 'Connect Wallet',
  createDrop: 'Create New Drop',
  publishDrop: 'Encrypt & Publish Drop',
  unlockContent: 'Unlock Content',
  download: 'Download',
  
  // Secondary Actions
  copyLink: 'Copy Link',
  shareProfile: 'Share Profile',
  viewProfile: 'View Profile',
  editProfile: 'Edit Profile',
  setUsername: 'Set Username',
  
  // Navigation
  backToHome: 'Back to Home',
  backToHub: 'Back to Creator Hub',
  viewAll: 'View All',
  
  // States
  processing: 'Processing...',
  saving: 'Saving...',
  uploading: 'Uploading...',
  confirming: 'Confirming...',
  
  // Misc
  cancel: 'Cancel',
  save: 'Save',
  continue: 'Continue',
  skip: 'Skip for now',
  tryAgain: 'Try Again',
};

// ============================================
// FEES & PRICING
// ============================================
export const FEES = {
  platformFeePercent: 0.75,
  platformFeeDisplay: '0.75%',
  creatorKeepsPercent: 99.25,
  creatorKeepsDisplay: '99.25%',
  comparison: 'vs. 5-8% on traditional platforms',
  disclaimer: 'This excludes Solana network transaction fees.',
  
  breakdown: {
    title: 'Fee Breakdown',
    price: 'Content Price',
    platformFee: 'Auton Fee (0.75%)',
    creatorReceives: 'Creator Receives',
    networkFee: 'Network Fee (estimated)',
  },
  
  sustainability: {
    title: 'Fees & Sustainability',
    description: 'Creators keep 99.25% of payments (vs. 92-95% on typical platforms). We never custody your funds; payments flow directly to your wallet.',
  },
};

// ============================================
// ROADMAP
// ============================================
export const ROADMAP = {
  title: 'Roadmap',
  phases: [
    {
      status: 'now',
      title: 'Now',
      description: 'Solana mainnet paywalled drops + basic creator dashboard',
    },
    {
      status: 'next',
      title: 'Next',
      description: 'Better analytics, API, agent integrations',
    },
    {
      status: 'later',
      title: 'Later',
      description: 'Mobile app, discovery, richer social features',
    },
  ],
};

// ============================================
// FORM LABELS & PLACEHOLDERS
// ============================================
export const FORMS = {
  username: {
    label: 'Username',
    placeholder: 'your_username',
    hint: 'This will be your public profile URL',
  },
  displayName: {
    label: 'Display Name',
    placeholder: 'Your Name',
    hint: 'How you want to be known to your audience',
  },
  bio: {
    label: 'Bio',
    placeholder: 'Tell your audience about yourself...',
    hint: 'Max 500 characters',
  },
  title: {
    label: 'Title',
    placeholder: 'e.g., Exclusive Track Preview',
    hint: 'Give your drop a catchy title',
  },
  description: {
    label: 'Description',
    placeholder: 'Tell your audience what makes this content special...',
    hint: 'Help buyers understand what they\'re getting',
  },
  price: {
    label: 'Price (SOL)',
    placeholder: '0.02',
    hint: 'Set your price in SOL',
  },
  file: {
    label: 'Upload Gated File',
    placeholder: 'Drag & drop your file here, or click to browse',
    hint: 'This file will be encrypted and gated',
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format price with SOL symbol
 */
export function formatPrice(lamports: number): string {
  const sol = lamports / 1e9;
  return `◎ ${sol.toFixed(sol < 0.01 ? 4 : 2)}`;
}

/**
 * Format price breakdown for display
 */
export function formatPriceBreakdown(priceInSol: number): {
  total: string;
  platformFee: string;
  creatorReceives: string;
} {
  const platformFee = priceInSol * (FEES.platformFeePercent / 100);
  const creatorReceives = priceInSol - platformFee;
  
  return {
    total: `◎ ${priceInSol.toFixed(4)}`,
    platformFee: `◎ ${platformFee.toFixed(6)}`,
    creatorReceives: `◎ ${creatorReceives.toFixed(4)}`,
  };
}

/**
 * Get error message by code
 */
export function getErrorMessage(code: string): string {
  return (ERRORS as Record<string, string>)[code] || ERRORS.somethingWentWrong;
}

