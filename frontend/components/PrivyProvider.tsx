'use client';

import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { ReactNode } from 'react';

interface PrivyProviderProps {
  children: ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  
  if (!appId) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID is not set. Privy features will be disabled.');
    return <>{children}</>;
  }

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        // Login methods - must match Privy Dashboard configuration
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        
        // Embedded wallets for Solana
        // IMPORTANT: Configure Solana as the default chain in Privy Dashboard
        // Go to: https://dashboard.privy.io/ -> Your App -> Embedded Wallets
        // Set Solana as the default chain to ensure Solana wallets are created
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
          noPromptOnSignature: false,
        },
        
        // OAuth configuration
        // IMPORTANT: Privy automatically uses allowed origins for OAuth redirects
        // Make sure to configure in Privy Dashboard:
        // 1. Settings -> Domains: Add http://localhost:3000 to "Allowed origins"
        // 2. Settings -> Advanced: Add http://localhost:3000 to "Allowed OAuth redirect URLs"
        // 3. For Google OAuth: Configure redirect URI in Google Cloud Console
        //    Format: https://auth.privy.io/api/v1/oauth/callback/google?app_id=YOUR_APP_ID
        // See docs/PRIVY_OAUTH_SETUP.md for detailed instructions
        
        // OAuth redirect configuration
        // This helps ensure redirect URIs match what's configured
        oauth: {
          // Use the current origin for redirects
          redirectUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        },
        
        // Appearance
        appearance: {
          theme: 'light',
          accentColor: '#6366f1',
          logo: '/auton-logo.png',
        },
        
        // Legal
        legal: {
          termsAndConditionsUrl: 'https://auton.app/terms',
          privacyPolicyUrl: 'https://auton.app/privacy',
        },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}

