#!/usr/bin/env bash
# GestureFlow backend — environment setup
# Run from the backend/ directory:
#   bash install.sh
# Optional args:
#   VENV_DIR=.venv REQUIREMENTS=requirements.txt bash install.sh

set -euo pipefail

VENV_DIR="${VENV_DIR:-.venv}"
REQUIREMENTS="${REQUIREMENTS:-requirements.txt}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$ROOT/$VENV_DIR"
REQ_PATH="$ROOT/$REQUIREMENTS"

# ── Verify requirements.txt exists ───────────────────────────────────────────
if [[ ! -f "$REQ_PATH" ]]; then
    echo "ERROR: requirements.txt not found at: $REQ_PATH" >&2
    exit 1
fi

# ── Find python ──────────────────────────────────────────────────────────────
PYTHON=""
for candidate in python3 python; do
    if command -v "$candidate" &>/dev/null; then
        PYTHON="$candidate"
        break
    fi
done

if [[ -z "$PYTHON" ]]; then
    echo "ERROR: Python not found. Install Python 3.10+ and ensure it is on PATH." >&2
    exit 1
fi

echo "Using: $($PYTHON --version)"

# ── Create virtual environment ───────────────────────────────────────────────
if [[ -d "$VENV_PATH" ]]; then
    echo "Virtual environment already exists at '$VENV_DIR' — skipping creation."
else
    echo "Creating virtual environment at '$VENV_DIR'..."
    "$PYTHON" -m venv "$VENV_PATH"
    echo "Virtual environment created."
fi

VENV_PYTHON="$VENV_PATH/bin/python"
VENV_PIP="$VENV_PATH/bin/pip"
ACTIVATE_CMD="source $VENV_PATH/bin/activate"

# ── Upgrade pip ──────────────────────────────────────────────────────────────
echo "Upgrading pip..."
"$VENV_PYTHON" -m pip install --upgrade pip --quiet

# ── Install requirements ─────────────────────────────────────────────────────
echo "Installing packages from '$REQUIREMENTS'..."
"$VENV_PIP" install -r "$REQ_PATH"

echo ""
echo "Setup complete."
echo ""
echo "Activate the environment with:"
echo "  $ACTIVATE_CMD"
echo ""
echo "Then start the server:"
echo "  uvicorn app.main:app --reload"
