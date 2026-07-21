#!/usr/bin/env bash
# check-legacy-refs.sh — fail if legacy V5/V6/V7 engine identifiers creep back in.
#
# ALLOWED legacy references (documented backward compat, do not flag):
#   - analysis_version string literals 'v7*'/'v8*' inside normalizeV9.ts
#     (prod Firestore still holds v8_archaeology docs) and its guard test
#   - 'v7_meta' in analysisStore.ts HEAVY_FIELDS (old cached records)
#   - the v8/v7 mention in daemon.py's normalizer-compat comment
#   - _analysis_v[3456] filename-suffix regexes (parse old export names)
#   - MIGRATION_KEY 'lemon-migration-v6-done' (stored localStorage flag)
#
# NOT legacy (never flag): claude model ids (claude-sonnet-4-6, claude-opus-4-7),
# parse_screenplay_pdf_v2.py, package versions, SVG path data.
#
# Usage: bash scripts/check-legacy-refs.sh   (exit 1 on violations)

set -uo pipefail
cd "$(dirname "$0")/.."

violations=$(grep -rnE "normalizeV[567]|isV[567]RawAnalysis|isV6UnifiedAnalysis|smartNormalize|V7PillarScore|v7PillarScores|ScreenplayWithV[67]|parsed_v7|v6_unified" \
    src functions/src execution daemon.py \
    --include="*.ts" --include="*.tsx" --include="*.py" 2>/dev/null \
  | grep -v "src/lib/normalizers/normalizeV9.ts" \
  | grep -v "src/lib/normalizers/legacyLabels.test.ts" \
  | grep -v "scripts/check-legacy-refs.sh")

if [ -n "$violations" ]; then
  echo "❌ Legacy version identifiers found (see scripts/check-legacy-refs.sh header for the allow-list):"
  echo "$violations"
  exit 1
fi

echo "✅ No legacy V5/V6/V7 engine identifiers found."
