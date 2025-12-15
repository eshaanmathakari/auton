# Privy OAuth Setup Guide

## Fixing "redirect_uri_mismatch" Error

If you're seeing the error `Error 400: redirect_uri_mismatch` when trying to log in with Google or Twitter, you need to configure the redirect URIs in your Privy Dashboard.

## Steps to Fix

### 1. Go to Privy Dashboard

1. Visit https://dashboard.privy.io/
2. Sign in to your account
3. Select your app

### 2. Configure Allowed Origins

1. Navigate to **Settings** → **Domains**
2. Find the **Allowed origins** section
3. Add the following origins:

#### For Development:
```
http://localhost:3000
```

#### For Production:
```
https://your-production-domain.com
```

**Important**: 
- The origin must match exactly (including `http://` vs `https://` and the port number)
- No trailing slashes
- This is required for Privy to allow requests from your domain

### 3. Configure OAuth Redirect URLs (Advanced Settings)

1. Navigate to **Settings** → **Advanced**
2. Scroll down to **Allowed OAuth redirect URLs** section
3. Add the following URLs:

#### For Development:
```
http://localhost:3000
```

#### For Production:
```
https://your-production-domain.com
```

**Important**: 
- This is a **critical security setting** that restricts where Privy can redirect after OAuth authentication
- The full URL path is matched, so be precise
- The base domain must be within your allowed origins
- Add both development and production URLs if needed

### 4. Configure Google OAuth in Privy Dashboard

1. In Privy Dashboard, go to **Login Methods** → **Google**
2. Make sure Google is enabled
3. Verify your Google OAuth credentials are set up:
   - Client ID
   - Client Secret

### 5. Configure Google OAuth in Google Cloud Console

**This is critical for fixing redirect_uri_mismatch errors!**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (or create one)
5. Click **Edit** on your OAuth client
6. Under **Authorized redirect URIs**, add Privy's callback URL:

#### Format:
```
https://auth.privy.io/api/v1/oauth/callback/google?app_id=YOUR_PRIVY_APP_ID
```

Replace `YOUR_PRIVY_APP_ID` with your actual Privy App ID from the Privy Dashboard.

**Example**:
```
https://auth.privy.io/api/v1/oauth/callback/google?app_id=clxxxxxxxxxxxxxxxxxxxxx
```

7. Click **Save**

**Important Notes**:
- You can find your Privy App ID in the Privy Dashboard under **Settings** → **Basics**
- The redirect URI format is specific to Privy - don't use your app's URL here
- This is the URL Google will redirect to after authentication, and Privy will then redirect to your app

### 6. Configure Twitter/X OAuth

1. In Privy Dashboard, go to **Login Methods** → **Twitter** (or **X**)
2. Make sure Twitter is enabled
3. Verify your Twitter API credentials are set up
4. In Twitter Developer Portal, ensure callback URLs are configured:
   - Use Privy's callback URL format: `https://auth.privy.io/api/v1/oauth/callback/twitter?app_id=YOUR_PRIVY_APP_ID`

### 7. Configure Solana Embedded Wallets

1. Go to **Embedded Wallets** settings
2. Ensure **Solana** is set as the default chain (or at least enabled)
3. This ensures Privy creates Solana wallets instead of EVM wallets

### 8. Save and Test

1. Save all changes in the Privy Dashboard
2. Wait a few minutes for changes to propagate
3. Try logging in again with Google/Twitter

## Common Issues

### Issue: Still getting redirect_uri_mismatch after adding URI

**Solution**: 
- Double-check the URI matches exactly (case-sensitive, no trailing slash)
- Make sure you saved the changes in Privy Dashboard
- Wait 2-3 minutes for changes to propagate
- Clear browser cache and try again

### Issue: Google OAuth not working / redirect_uri_mismatch

**Solution**:
1. **Verify Privy Dashboard configuration**:
   - Check that `http://localhost:3000` is in **Settings** → **Domains** → **Allowed origins**
   - Check that `http://localhost:3000` is in **Settings** → **Advanced** → **Allowed OAuth redirect URLs**
   - Verify Google OAuth is enabled in **Login Methods** → **Google**
   - Verify Client ID and Client Secret are correctly set

2. **Verify Google Cloud Console configuration**:
   - Go to Google Cloud Console → **APIs & Services** → **Credentials**
   - Edit your OAuth 2.0 Client ID
   - Ensure **Authorized redirect URIs** includes: `https://auth.privy.io/api/v1/oauth/callback/google?app_id=YOUR_PRIVY_APP_ID`
   - Replace `YOUR_PRIVY_APP_ID` with your actual Privy App ID
   - Save changes

3. **Wait for propagation**:
   - Google Cloud Console changes can take 5-10 minutes to propagate
   - Privy Dashboard changes are usually instant, but wait 2-3 minutes to be safe

4. **Clear browser cache** and try again

### Issue: Twitter OAuth not working

**Solution**:
- Verify Twitter API credentials in Privy Dashboard
- Check that Twitter OAuth is enabled in your Twitter Developer Portal
- Ensure callback URLs are configured correctly

## Environment Variables

Make sure your `.env.local` has:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Optional, for production
```

## Testing

After configuring:

1. Start your frontend: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Click "Continue with Google" or "Continue with X (Twitter)"
4. Complete the OAuth flow
5. Verify a Solana wallet is created (check the wallet address - should not start with `0x`)

## Wallet Adapter Error Troubleshooting

If you're experiencing `WalletSendTransactionError` with empty error objects:

### Common Causes

1. **Connection endpoint mismatch**: Ensure wallet adapter and transaction building use the same RPC endpoint
2. **Transaction validation failures**: Check that transactions have valid blockhash and feePayer
3. **Insufficient funds**: Verify wallet has enough SOL for transaction fees
4. **Network issues**: Check RPC endpoint is accessible and responsive

### Debugging Steps

1. Check browser console for detailed error logs
2. Verify connection endpoint matches in logs
3. Test transaction with sufficient funds
4. Try with different RPC endpoint (devnet/mainnet)
5. Check wallet extension is properly connected

### Error Message Extraction

The code now includes improved error handling that extracts messages from:
- `error.error.message`
- `error.message`
- `error.cause.message`
- `error.logs`
- `error.toString()`

This should provide more descriptive error messages instead of empty objects.

## Need Help?

- Privy Documentation: https://docs.privy.io/
- Privy Support: support@privy.io
- Check Privy Dashboard logs for detailed error messages
- Solana Wallet Adapter: https://github.com/solana-labs/wallet-adapter

