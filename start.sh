#!/bin/bash
echo "=============================="
echo "  OpenAI Image2API Web Starter"
echo "=============================="
echo ""

echo "[1/3] Installing root dependencies..."
npm install || { echo "Failed to install root dependencies!"; exit 1; }

echo ""
echo "[2/3] Installing server dependencies..."
(cd server && npm install) || { echo "Failed to install server dependencies!"; exit 1; }

echo ""
echo "[3/3] Installing client dependencies..."
(cd client && npm install) || { echo "Failed to install client dependencies!"; exit 1; }

echo ""
echo "=============================="
echo "  All dependencies installed!"
echo "  Starting dev servers..."
echo "=============================="
echo ""

npm run dev
