# Testing Guide - New Features

## ✅ Setup Complete

- **All programs deployed** to devnet
- **Vault initialized** successfully
- **Admin wallet**: `8cn4SU7XhsddE1V9me2G71JRhV8JAyxatN5NTuZATSHW`
- **Vault wallet**: `5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh` (0.3 SOL)

## 🧪 Testing New Features

### 1. Social Login & Embedded Wallet

**Test Flow:**
1. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Navigate to `http://localhost:3000`

3. **Test Google Login:**
   - Click "Sign in with Google"
   - Complete OAuth flow
   - Verify wallet is created automatically
   - Check browser console for wallet address

4. **Test Twitter/X Login:**
   - Click "Sign in with Twitter"
   - Complete OAuth flow
   - Verify wallet creation

5. **Test Email Login:**
   - Click "Sign in with Email"
   - Enter email and receive magic link
   - Verify wallet creation

**Expected Results:**
- ✅ Wallet address displayed after login
- ✅ User can interact with Solana dApp without installing Phantom
- ✅ Wallet persists across sessions
- ✅ Backend database has new user record

**Check Backend:**
```bash
cd backend
# Check database for new user
# Should see entry in users table with wallet address
```

### 2. First-Time User Gas Sponsorship

**Test Flow:**
1. **Create a new test account** (or use a fresh wallet)
   - Use social login to create new account
   - Or use a new Phantom wallet

2. **Check sponsorship eligibility:**
   ```bash
   curl http://localhost:3001/api/sponsor/check-eligibility/<wallet_address>
   ```
   Should return: `{ eligible: true, reason: "first_time_user" }`

3. **Upload/Create content** (first transaction):
   - Go to creator dashboard
   - Try to upload/create your first content
   - The transaction should be sponsored automatically

4. **Verify sponsorship:**
   - Check transaction on Solana Explorer
   - Transaction should show vault wallet as fee payer
   - Check backend database:
     ```bash
     # Should see entry in sponsoredUsers table
     ```

5. **Test second transaction** (should NOT be sponsored):
   - Try to upload another piece of content
   - This transaction should require you to pay gas
   - Sponsorship eligibility should return `false`

**Expected Results:**
- ✅ First transaction is free (sponsored by vault)
- ✅ Second transaction requires payment
- ✅ Sponsorship recorded in database
- ✅ Vault balance decreases by ~0.01 SOL per sponsorship

### 3. Fee Collection to Vault

**Test Flow:**
1. **Make a payment** for content:
   - Browse to a creator's content page
   - Click "Unlock" or "Purchase"
   - Complete payment flow

2. **Verify fee calculation:**
   - Check payment breakdown shows:
     - Content price: X SOL
     - Platform fee (0.75%): Y SOL
     - Creator receives: Z SOL

3. **Check vault balance:**
   ```bash
   solana balance 5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh
   ```
   Should increase by the platform fee amount

4. **Verify on-chain:**
   - Check transaction on Solana Explorer
   - Should show transfer to vault wallet
   - Check vault state account for `total_collected` increase

**Expected Results:**
- ✅ 0.75% fee calculated correctly
- ✅ Fee transferred to vault wallet
- ✅ Creator receives 99.25% of payment
- ✅ Vault state updated on-chain

### 4. Rate Limiting & Abuse Prevention

**Test Flow:**
1. **Rapid sponsorship requests:**
   ```bash
   # Try multiple sponsorship requests quickly
   for i in {1..10}; do
     curl http://localhost:3001/api/sponsor/check-eligibility/<wallet_address>
     sleep 0.1
   done
   ```

2. **Verify rate limiting:**
   - Should see rate limit errors after threshold
   - Check backend logs for abuse detection

3. **Test with different wallets:**
   - Try to get sponsorship from multiple wallets
   - System should detect suspicious patterns

**Expected Results:**
- ✅ Rate limiting prevents spam
- ✅ Abuse detection logs suspicious activity
- ✅ Legitimate users still get sponsorship

### 5. API Key Management

**Test Flow:**
1. **Create API key:**
   ```bash
   curl -X POST http://localhost:3001/api/v1/api-keys \
     -H "Authorization: Bearer <your_token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "Test API Key"}'
   ```

2. **List API keys:**
   ```bash
   curl http://localhost:3001/api/v1/api-keys \
     -H "Authorization: Bearer <your_token>"
   ```

3. **Use API key:**
   ```bash
   curl http://localhost:3001/api/v1/content \
     -H "Authorization: Bearer <api_key>"
   ```

**Expected Results:**
- ✅ API keys can be created
- ✅ Keys are stored in database
- ✅ Keys can be used for authentication
- ✅ Keys can be revoked

### 6. x402 Protocol Compatibility

**Test Flow:**
1. **Get payment instructions:**
   ```bash
   curl http://localhost:3001/api/v1/x402/payment-instructions/<content_id>
   ```

2. **Verify response format:**
   - Should return HTTP 402 status
   - Should include x402 headers:
     - `X-Payment-Required: true`
     - `X-Payment-Id: <id>`
     - `X-Asset-Type: SOL`
     - `X-Payment-Address: <address>`
     - `X-Platform-Fee-Percentage: 0.75`
     - `X-Platform-Fee-Address: <vault_address>`

3. **Test with AI agent:**
   - Use the agent SDK to fetch payment instructions
   - Verify agent can parse and process payment

**Expected Results:**
- ✅ Returns proper HTTP 402 status
- ✅ Includes all required x402 headers
- ✅ Compatible with Pinata-style API
- ✅ Agent SDK works correctly

## 🔍 Verification Commands

### Check Vault State
```bash
solana account 63BeUWyjxirmE5pzQ2kDuaejJQ8R6w7d8DLHeMrV9V56
```

### Check Vault Balance
```bash
solana balance 5inb57eQXugKNyACDc85w7kUksD15dnHhbRRWuoiEZFh
```

### Check Program Deployments
```bash
solana program show CP4u2AjZeWdjjhxuGUsWLFAqyzGLu8cUU3xdeDnzkqyk
solana program show FqvRWFBSiDmN3PBwCfs9YZAhh53goQF2YxYku2b8jVXo
solana program show Afe5nZMYr8s63mbbrBCweydXsB4o45ztiKFAA5gmmPvm
```

### Check Transaction on Explorer
Visit: `https://explorer.solana.com/tx/<signature>?cluster=devnet`

## 📝 Testing Checklist

- [ ] Social login creates embedded wallet
- [ ] Wallet persists across sessions
- [ ] First-time user gets gas sponsorship
- [ ] Second transaction requires payment
- [ ] Platform fees route to vault
- [ ] Fee calculation is correct (0.75%)
- [ ] Rate limiting prevents abuse
- [ ] API keys work for authentication
- [ ] x402 endpoints return proper format
- [ ] Agent SDK can interact with API

## 🐛 Troubleshooting

### Issue: Social login not working
- **Check**: Privy App ID configured in `.env.local`
- **Check**: Privy app has Solana embedded wallets enabled
- **Check**: Browser console for errors

### Issue: Sponsorship not working
- **Check**: Vault has sufficient balance
- **Check**: Wallet is truly first-time (not in `sponsoredUsers` table)
- **Check**: Backend logs for eligibility check

### Issue: Fees not routing to vault
- **Check**: Vault governance program is initialized
- **Check**: CPI call in `auton_program` is working
- **Check**: Transaction logs for errors

### Issue: Rate limiting too strict
- **Check**: `backend/middleware/rateLimit.js` configuration
- **Adjust**: Rate limits in environment variables

## 🚀 Next Steps After Testing

1. Document any issues found
2. Update environment variables for production
3. Set up monitoring and alerts
4. Prepare for mainnet deployment

