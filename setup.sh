#!/bin/bash
# ============================================================
# REPOLENS - AWS EC2 Setup Script (Ubuntu 22.04 LTS)
# Run this script on your EC2 instance after SSH-ing in.
# Usage: bash setup.sh
# ============================================================

set -e

echo "=========================================="
echo "  REPOLENS - EC2 Setup Script"
echo "=========================================="

# ── 1. System Update ─────────────────────────────────────────
echo "[1/7] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ── 2. Install Node.js 20 LTS ────────────────────────────────
echo "[2/7] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

node -v
npm -v

# ── 3. Install PM2 globally ──────────────────────────────────
echo "[3/7] Installing PM2..."
sudo npm install -g pm2

# ── 4. Install Git ───────────────────────────────────────────
echo "[4/7] Installing Git..."
sudo apt-get install -y git

# ── 5. Clone the Repository ──────────────────────────────────
echo "[5/7] Cloning REPOLENS repository..."
cd /home/ubuntu

# Replace with your actual GitHub repo URL
REPO_URL="https://github.com/Praharshhhhhhh/REPOLENS.git"

if [ -d "REPOLENS" ]; then
  echo "Repo already exists, pulling latest..."
  cd REPOLENS && git pull
else
  git clone "$REPO_URL"
  cd REPOLENS
fi

# ── 6. Install Dependencies ──────────────────────────────────
echo "[6/7] Installing npm dependencies..."
npm install

# ── 7. Create .env file ──────────────────────────────────────
echo "[7/7] Creating .env template..."
# ⚠️  Fill in your actual keys after setup completes
cat > .env << 'EOF'
GROQ_API_KEY=your_groq_api_key_here
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
NODE_ENV=production
EOF
echo ""
echo "⚠️  IMPORTANT: Edit .env and add your GROQ_API_KEY:"
echo "    nano /home/ubuntu/REPOLENS/.env"

echo ""
echo "=========================================="
echo "  Dependencies installed!"
echo "  Next: run  bash deploy.sh  to build & start"
echo "=========================================="
