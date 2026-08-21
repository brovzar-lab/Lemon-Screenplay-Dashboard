# Anthropic model routes and local benchmark

Availability and approval are separate. A model appearing in Anthropic's catalog does not change Lemon scoring. The machine-readable source of truth is [`src/config/anthropic-model-catalog.json`](../src/config/anthropic-model-catalog.json).

## Route policy

| Use | Exact route | State |
| --- | --- | --- |
| Non-binding cold read and genre | `claude-haiku-4-5-20251001` | Active support route |
| Standard five-reader scoring | `claude-sonnet-4-6` | Active scoring route |
| Deep five-reader scoring | `claude-opus-4-7` | Active scoring route |
| Standard scoring candidate | `claude-sonnet-5` | Benchmark pending |
| Deep scoring candidate | `claude-opus-5` | Benchmark pending |
| Reader Chat default | `claude-opus-5` | Active, Reader Chat only |
| Reader Chat escalation | `claude-fable-5` | Active, Reader Chat only |

Haiku never decides whether the complete Sonnet panel runs. Its PASS is supporting evidence only. Fable is not a screenplay-scoring candidate. Fable also has a minimum 30-day provider-retention condition, which must be accepted before private screenplay material is sent to it.

Sonnet 5 and Opus 5 use adaptive thinking at high effort and omit sampling parameters. Haiku 4.5 and Sonnet 4.6 support manual thinking and sampling. Opus 4.7 uses adaptive thinking. Unsupported combinations are rejected before budget reservation.

Historical records remain readable by their stored exact model ID. Historical pricing remains in the cost ledger. Reading an old record never makes that model active again.

`claude-opus-4-8` is cataloged as historical and read-only. It is priced for accurate old cost records, but is absent from every request allowlist.

## Offline checks

These commands make no model call:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD-anthropic-modernization
npm run models:test
npm run models:check:offline
```

The monthly catalog workflow performs metadata discovery only. It never runs inference or changes a route.

## Local screenplay benchmark

The benchmark defaults to a dry run. It requires an explicit local PDF path and that file's exact SHA-256 approval. It records both old and candidate route configuration, prompt and structured-output schema hashes, calibration-prompt hash when supplied, planned provenance, and zeroed usage and cost fields.

Dry-run example:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD-anthropic-modernization
shasum -a 256 /absolute/path/to/approved-screenplay.pdf
npm run models:benchmark -- --input /absolute/path/to/approved-screenplay.pdf --approve-sha256 EXACT_SHA256_FROM_THE_PREVIOUS_COMMAND --route all
```

Artifacts go only to the gitignored `benchmark-artifacts/` directory. The manifest does not store the source path or calibration prompt text. A paid result stores the analysis locally because blind creative review needs the output. Treat that artifact as confidential screenplay material.

Paid execution is deliberately harder. It additionally requires `--execute`, `--i-understand-paid-inference`, a positive `--max-cost-usd`, and an `http://localhost` or `http://127.0.0.1` proxy URL. The harness rejects production URLs. It calls the existing V9 readers and proxy, and it never imports Firebase Admin, archives a PDF, or calls Firestore or Storage persistence functions. It also calculates a conservative ceiling before every request and stops before a request could exceed the local cap.

Do not execute a paid run until the exact files, route, and cap receive separate approval. Do not use Claude subscription capacity. The supported paid path is metered API inference through the local Functions emulator.

## Proposed validation ladder

The next approvals should be separate:

1. Smoke: one schema-valid call on Haiku 4.5, Sonnet 5, and Opus 5, maximum total spend $1.00. This proves request compatibility and exact provenance, not creative quality.
2. Pilot: three explicitly approved screenplays, old versus candidate Sonnet and Opus routes, maximum total spend $75.00. Review failures, score movement, citations, latency, tokenizer change, and cost before continuing.
3. Blinded benchmark: twelve explicitly approved screenplays, old versus candidate routes with titles hidden from the reviewer, maximum total spend $300.00. Activation still requires a human creative-quality decision.

The remaining risks are creative and privacy based. API correctness cannot prove that a candidate understands comedy, Mexican cultural specificity, emotional payoff, or Lemon's producer taste. Full scripts and locally stored outputs are sensitive. Fable's retention policy makes it unsuitable for material that cannot accept at least 30 days of provider retention.

Primary sources:

- [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Model migration guide](https://platform.claude.com/docs/en/about-claude/models/migration-guide)
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
