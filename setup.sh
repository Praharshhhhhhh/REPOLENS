#!/bin/bash
# ============================================================
# REPOLENS - AWS EC2 + Amazon RDS Setup Script (Ubuntu LTS)
# Run this script on your EC2 instance after SSH-ing in.
# Usage: bash setup.sh
# ============================================================

set -e

echo "=========================================="
echo "  REPOLENS - EC2 + RDS Setup Script"
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

# ── 6. Install Dependencies (including PostgreSQL driver) ────
echo "[6/7] Installing npm dependencies & PostgreSQL (pg) driver..."
npm install
npm install pg

# ── 7. Create .env file ──────────────────────────────────────
echo "[7/7] Creating .env template with your Amazon RDS endpoint..."
# ⚠️  Replace YOUR_DB_PASSWORD and API keys after setup completes
cat > .env << 'EOF'
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@repolens-db.c16k2muq017f.ap-south-1.rds.amazonaws.com:5432/postgres
NODE_ENV=production
PORT=3000
EOF
echo ""
echo "⚠️  IMPORTANT: Edit .env and replace YOUR_DB_PASSWORD and API keys:"
echo "    nano /home/ubuntu/REPOLENS/.env"

echo ""
echo "=========================================="
echo "  Dependencies installed!"
echo "  Next: run  bash deploy.sh  to build & start"
echo "=========================================="
