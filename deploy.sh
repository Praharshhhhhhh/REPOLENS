#!/bin/bash
# ============================================================
# REPOLENS - Build & Start / Deploy Script
# Run this after setup.sh, or whenever you push new changes.
# Usage: bash deploy.sh
# ============================================================

set -e

APP_DIR="/home/ubuntu/REPOLENS"

echo "=========================================="
echo "  REPOLENS - Deploy Script"
echo "=========================================="

cd "$APP_DIR"

# ── Pull latest code ─────────────────────────────────────────
echo "[1/4] Pulling latest code from GitHub..."
git pull origin main

# ── Install any new dependencies ─────────────────────────────
echo "[2/4] Installing dependencies..."
npm install

# ── Build frontend (Vite) ────────────────────────────────────
echo "[3/4] Building frontend..."
npm run build

# ── Start / Restart with PM2 ─────────────────────────────────
echo "[4/4] Starting app with PM2..."

if pm2 list | grep -q "repolens"; then
  echo "Restarting existing PM2 process..."
  pm2 restart ecosystem.config.cjs --env production
else
  echo "Starting new PM2 process..."
  pm2 start ecosystem.config.cjs --env production
fi

# Save PM2 process list so it auto-starts on reboot
pm2 save

# Setup PM2 to start on system boot (only needed once)
pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true

echo ""
echo "=========================================="
echo "  ✅ App deployed successfully!"
echo "  🌐 Visit: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
echo "=========================================="

pm2 status
