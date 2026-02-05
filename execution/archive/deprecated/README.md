# Deprecated Analysis Versions

**⚠️ DO NOT USE THESE SCRIPTS ⚠️**

These scripts have been consolidated into V6 and are archived for reference only.
They will raise `DeprecationWarning` if executed.

## Use V6 Instead

```bash
# Single screenplay analysis
python execution/analyze_screenplay_v6.py --input script.json

# Batch processing
python execution/batch_process_v6.py
```

## Version History

| Version | Description | Status |
|---------|-------------|--------|
| v1 (original) | First AI analysis implementation | **DEPRECATED** |
| v3 | 7-dimension scoring system | **DEPRECATED** |
| v4 | Added calibration, false positive traps | **DEPRECATED** |
| v5 | Added LatAm market, production readiness | **DEPRECATED** |
| **v6 (CURRENT)** | Core + Lenses architecture, execution-first weighting, weighted penalties | ✅ ACTIVE |

## Why V6?

V6 consolidates all previous versions with key improvements:

1. **Core + Lenses Architecture**: Quality scores are never contaminated by market factors
2. **Execution-First Weights**: 40% Execution, 30% Character, 20% Concept, 10% Voice
3. **Weighted Penalty System**: Critical failures apply penalties instead of auto-PASS
4. **False Positive Trap Detection**: 6 traps that catch inflated scores
5. **TMDB Integration**: Automatic production status checking
6. **Optional Lenses**: LatAm, Commercial, Production, Co-Production (no Budget)

## Migration Notes

If you have scripts that call old versions, update them to use:

```python
# Old (deprecated)
from analyze_screenplay_v5 import analyze_screenplay

# New (use this)
from analyze_screenplay_v6 import analyze_screenplay
```

The V6 API is backward-compatible with V5 for most use cases.
