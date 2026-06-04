#!/bin/bash
# dev-full.sh — Runs Vite dev server + Firebase Functions emulator together
# Usage: bash dev-full.sh  (or: npm run dev:full)
#
# This starts both processes so AI features work locally.
# Press Ctrl+C to stop both.

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  LEMON — Full Dev (App + Cloud Functions)${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Ensure functions dependencies are installed
if [ ! -d "functions/node_modules" ]; then
  echo -e "${YELLOW}Installing Cloud Functions dependencies...${NC}"
  (cd functions && npm install)
  echo ""
fi

# Kill child processes on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $VITE_PID $EMU_PID 2>/dev/null
  wait $VITE_PID $EMU_PID 2>/dev/null
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# Start Firebase Functions emulator in background
echo -e "${BLUE}[Functions]${NC} Starting emulator on port 5001..."
(cd functions && npx firebase emulators:start --only functions 2>&1 | sed "s/^/  [functions] /") &
EMU_PID=$!

# Give the emulator a moment to boot
sleep 3

# Start Vite dev server in background
echo -e "${BLUE}[Vite]${NC} Starting dev server..."
npx vite 2>&1 | sed "s/^/  [vite] /" &
VITE_PID=$!

echo ""
echo -e "${GREEN}Both processes running. Ctrl+C to stop.${NC}"
echo ""

# Wait for either to exit
wait -n $VITE_PID $EMU_PID 2>/dev/null
