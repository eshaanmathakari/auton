#!/bin/bash

# Deploy All Programs Script
# 
# Deploys auton_program, sponsor_program, and vault_governance to devnet
# 
# Usage: ./scripts/deploy-all.sh

set -e

echo "🚀 Deploying Auton programs to devnet..."
echo ""

# Build all programs
echo "📦 Building programs..."
anchor build

# Deploy auton_program
echo ""
echo "📤 Deploying auton_program..."
anchor deploy --provider.cluster devnet --program-name auton_program

# Deploy sponsor_program
echo ""
echo "📤 Deploying sponsor_program..."
anchor deploy --provider.cluster devnet --program-name sponsor_program

# Deploy vault_governance
echo ""
echo "📤 Deploying vault_governance..."
anchor deploy --provider.cluster devnet --program-name vault_governance

echo ""
echo "✅ All programs deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Update program IDs in backend/.env and frontend/.env.local"
echo "2. Initialize vault governance program"
echo "3. Fund vault wallet with 10-15 SOL"

