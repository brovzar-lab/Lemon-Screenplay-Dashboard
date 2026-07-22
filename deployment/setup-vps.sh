#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Lemon Ingest Daemon — Hostinger VPS Setup Script
# Run once as root on a fresh Ubuntu 22.04 / Debian 12 VPS
#
# Usage:
#   ssh root@YOUR_VPS_IP
#   curl -fsSL https://raw.githubusercontent.com/.../setup-vps.sh | bash
#   -- OR --
#   scp deployment/setup-vps.sh root@YOUR_VPS_IP:/tmp/
#   ssh root@YOUR_VPS_IP "bash /tmp/setup-vps.sh"
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

REPO_DIR="/opt/lemon-ingest"
DAEMON_USER="lemon"
LOG_DIR="/var/log/lemon-daemon"
WORK_DIR="/tmp/lemon"
SERVICE_FILE="/etc/systemd/system/lemon-daemon.service"
PYTHON_MIN="3.11"

echo "════════════════════════════════════════════════════"
echo "🍋  Lemon Ingest Daemon — VPS Setup"
echo "════════════════════════════════════════════════════"

# ── 1. System packages ────────────────────────────────────────────────────────
echo ""
echo "▶ Installing system packages..."
apt-get update -q
apt-get install -y -q \
    python3 python3-pip python3-venv \
    git curl wget \
    libmupdf-dev \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-spa      # Spanish OCR language data

PYTHON=$(command -v python3)
PY_VERSION=$($PYTHON --version 2>&1 | awk '{print $2}')
echo "  Python: $PY_VERSION"

# ── 2. Create daemon user (non-root) ─────────────────────────────────────────
echo ""
echo "▶ Creating daemon user '$DAEMON_USER'..."
if ! id "$DAEMON_USER" &>/dev/null; then
    useradd --system --shell /usr/sbin/nologin --create-home "$DAEMON_USER"
    echo "  Created user: $DAEMON_USER"
else
    echo "  User '$DAEMON_USER' already exists — skipping"
fi

# ── 3. Clone / update repo ────────────────────────────────────────────────────
echo ""
echo "▶ Setting up repo at $REPO_DIR..."
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "  NOTE: Repo not found. Copy your project to $REPO_DIR manually:"
    echo "    scp -r /path/to/LEMON-SCREENPLAY-DASHBOARD root@VPS_IP:$REPO_DIR"
    echo "  -- OR -- clone if you have a git remote:"
    echo "    git clone YOUR_REPO_URL $REPO_DIR"
    echo ""
    echo "  Then re-run this script."
    echo "  (Creating directory structure now...)"
    mkdir -p "$REPO_DIR"
fi

# ── 4. Python virtual environment ─────────────────────────────────────────────
echo ""
echo "▶ Creating Python virtual environment..."
cd "$REPO_DIR"
if [ ! -d "venv" ]; then
    $PYTHON -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip -q
pip install -r execution/requirements.txt -q
deactivate
echo "  ✓ Dependencies installed"

# ── 5. Create directories ─────────────────────────────────────────────────────
echo ""
echo "▶ Creating log and work directories..."
mkdir -p "$LOG_DIR" "$WORK_DIR"
chown -R "$DAEMON_USER:$DAEMON_USER" "$LOG_DIR" "$WORK_DIR" "$REPO_DIR"
chmod 755 "$LOG_DIR"
echo "  ✓ $LOG_DIR"
echo "  ✓ $WORK_DIR"

# ── 6. .env file ──────────────────────────────────────────────────────────────
echo ""
if [ ! -f "$REPO_DIR/.env" ]; then
    echo "▶ Creating .env from template..."
    cp "$REPO_DIR/deployment/.env.daemon.example" "$REPO_DIR/.env"
    chmod 600 "$REPO_DIR/.env"
    chown "$DAEMON_USER:$DAEMON_USER" "$REPO_DIR/.env"
    echo ""
    echo "  ⚠️  ACTION REQUIRED: Edit $REPO_DIR/.env and fill in:"
    echo "     - ANTHROPIC_API_KEY"
    echo "     - GOOGLE_APPLICATION_CREDENTIALS (path to service-account.json)"
    echo "     - TMDB_API_KEY (optional)"
    echo ""
    echo "  Also place your Firebase service account JSON at:"
    echo "     $REPO_DIR/service-account.json"
    echo "  Download from: Firebase Console → Project Settings → Service Accounts"
else
    echo "▶ .env already exists — skipping (not overwriting)"
fi

# ── 7. systemd service ────────────────────────────────────────────────────────
echo ""
echo "▶ Installing systemd service..."
cp "$REPO_DIR/deployment/lemon-daemon.service" "$SERVICE_FILE"
chmod 644 "$SERVICE_FILE"
systemctl daemon-reload
echo "  ✓ Service installed: $SERVICE_FILE"

# ── 8. Final instructions ─────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo "✅  Setup complete!"
echo "════════════════════════════════════════════════════"
echo ""
echo "NEXT STEPS:"
echo ""
echo "  1. Place your Firebase service account JSON:"
echo "       $REPO_DIR/service-account.json"
echo "     (chmod 600 $REPO_DIR/service-account.json)"
echo ""
echo "  2. Fill in your API keys:"
echo "       nano $REPO_DIR/.env"
echo ""
echo "  3. Start the daemon:"
echo "       sudo systemctl enable lemon-daemon"
echo "       sudo systemctl start lemon-daemon"
echo ""
echo "  4. Watch the logs:"
echo "       journalctl -fu lemon-daemon"
echo "       tail -f $LOG_DIR/daemon.log"
echo ""
echo "  5. Test it — upload a PDF to Firebase Storage:"
echo "       ingest-queue/BLKLST/MyScript.pdf"
echo "     Then check Firestore → ingest-queue for a pending doc."
echo ""
echo "════════════════════════════════════════════════════"
