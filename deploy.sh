#!/usr/bin/env bash
set -euo pipefail

# Always run from the project root (where this script lives)
cd "$(dirname "${BASH_SOURCE[0]}")"

FIREBASE="./node_modules/.bin/firebase"

# Ensure local firebase-tools is installed
if [ ! -x "$FIREBASE" ]; then
  echo "ERROR: Firebase CLI not found at $FIREBASE"
  echo "Run: npm install"
  exit 1
fi

# Build the app
npm run build

# Check Firebase auth before attempting deploy.
# If not authenticated, print the login command and skip — do not crash the deploy.
if ! "$FIREBASE" projects:list > /dev/null 2>&1; then
  echo ""
  echo "WARNING: Firebase is not authenticated — skipping hosting deploy."
  echo ""
  echo "To authenticate, run from this directory:"
  echo "  npx firebase login --no-localhost"
  echo ""
  echo "Then re-run: npm run deploy"
  exit 0
fi

"$FIREBASE" deploy --only hosting
