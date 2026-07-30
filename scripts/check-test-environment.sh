#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

failures=0

pass() {
  printf 'PASS  %s\n' "$1"
}

fail() {
  printf 'FAIL  %s\n' "$1" >&2
  failures=$((failures + 1))
}

if [[ -x ".venv/bin/python" ]]; then
  python_version="$(.venv/bin/python -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
  pass "Project Python environment (${python_version})"
else
  fail "Project Python environment is missing. Create .venv and install requirements."
fi

if [[ -x ".venv/bin/python" ]] && .venv/bin/python -c \
  'import PyPDF2, pdfplumber, fitz, pytesseract, firebase_admin' >/dev/null 2>&1
then
  pypdf_version="$(.venv/bin/python -c 'import PyPDF2; print(PyPDF2.__version__)')"
  pass "PDF, OCR, and Firebase Python packages (PyPDF2 ${pypdf_version})"
else
  fail "Python test packages are incomplete. Install requirements.txt and execution/requirements.txt."
fi

if bash scripts/with-java-21.sh java -version >/dev/null 2>&1; then
  java_version="$(bash scripts/with-java-21.sh java -version 2>&1 | head -n 1)"
  pass "Firebase Java runtime (${java_version})"
else
  fail "Java 21 or newer is unavailable to the Firebase emulators."
fi

if command -v firebase >/dev/null 2>&1; then
  firebase_output="$(firebase --version 2>/dev/null || true)"
  firebase_version="$(head -n 1 <<<"$firebase_output")"
  if [[ "$firebase_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    pass "Firebase CLI (${firebase_version})"
  else
    fail "Firebase CLI was found but did not report a valid version."
  fi
else
  fail "Firebase CLI is missing."
fi

if [[ -x "node_modules/.bin/vitest" ]]; then
  pass "Dashboard test dependencies"
else
  fail "Dashboard test dependencies are missing. Run npm install."
fi

if [[ -x "functions/node_modules/.bin/tsc" ]]; then
  pass "Functions test dependencies"
else
  fail "Functions test dependencies are missing. Run npm install in functions/."
fi

if (( failures > 0 )); then
  printf '\n%d test environment check(s) failed.\n' "$failures" >&2
  exit 1
fi

printf '\nAll test environments are ready.\n'
