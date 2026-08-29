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
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npm run models:test
npm run models:check:offline
```

The monthly catalog workflow performs metadata discovery only. It never runs inference or changes a route.

## Local screenplay benchmark

The benchmark defaults to a dry run. It requires an explicit local PDF path and that file's exact SHA-256 approval. It records both old and candidate route configuration, prompt and structured-output schema hashes, calibration-prompt hash when supplied, planned provenance, and zeroed usage and cost fields.

Dry-run example:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
shasum -a 256 /absolute/path/to/approved-screenplay.pdf
npm run models:benchmark -- --input /absolute/path/to/approved-screenplay.pdf --approve-sha256 EXACT_SHA256_FROM_THE_PREVIOUS_COMMAND --route sonnet --generation candidate
```

Artifacts go only to the gitignored `benchmark-artifacts/` directory. The manifest does not store the source path or calibration prompt text. A paid result stores the analysis locally because blind creative review needs the output. Treat that artifact as confidential screenplay material.

Paid execution is deliberately harder. It additionally requires `--execute`, `--i-understand-paid-inference`, an immutable `--run-id`, a positive `--max-cost-usd`, and the direct URL of `llmProxyCandidate`. Online execution also requires the dedicated caller service account, IAM-isolation verification, and exact Git and catalog hashes. The harness obtains short-lived identity tokens with service-account impersonation. It never accepts `/api/llm`, the normal `llmProxy`, a browser token, or a shared proxy password.

Each logical call carries a deterministic call ID over the approved screenplay hash, route generation, stage, reader, correction number, prompt hash, schema hash, exact request hash, and requested model. Candidate transport failures are never retried automatically. A structured-output correction is a new logical call and gets a new ID. Full outputs remain local. The named Firestore database receives operational metadata only, never screenplay text, titles, filenames, prompts, or results.

Authorized online form, run for one screenplay at a time only after the exact merged commit is deployed to the private candidate:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npm run models:benchmark -- --input /absolute/path/to/approved-screenplay.pdf --approve-sha256 EXACT_SHA256 --route sonnet --generation candidate --execute --i-understand-paid-inference --run-id IMMUTABLE_RUN_ID --proxy-url https://us-central1-lemon-screenplay-staging.cloudfunctions.net/llmProxyCandidate --caller-service-account benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com --verify-isolation --expected-git-sha EXACT_40_CHARACTER_GIT_SHA --expected-catalog-sha256 EXACT_CATALOG_SHA256 --max-cost-usd BOUNDED_RUN_CAP --prior-audit-spend-usd EXACT_SETTLED_AND_UNCERTAIN_PRIOR_SPEND
```

Paid `--smoke` is intentionally refused because it does not produce the full trust evidence. The authorized ceiling for this V9 audit is cumulative USD 40, including the settled USD 0.106425 pilot. Every new run must declare the exact settled and uncertain prior spend, use a conservative bounded cap, and run sequentially.

Do not execute a paid run until the exact files, route, deployed revision, and cap receive separate approval. Do not use Claude subscription capacity. The supported paid path is metered Anthropic API inference through the isolated candidate function.

## Authorized validation order

Run Santa mi Amor first through the candidate Sonnet route. Stop on any systemic defect. Once Santa passes, run four preselected diverse screenplays sequentially, locking and hashing each machine result before Billy sees only the five filenames for calibration. Production activation remains a separate approval.

The remaining risks are creative and privacy based. API correctness cannot prove that a candidate understands comedy, Mexican cultural specificity, emotional payoff, or Lemon's producer taste. Full scripts and locally stored outputs are sensitive. Fable's retention policy makes it unsuitable for material that cannot accept at least 30 days of provider retention.

Primary sources:

- [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Model migration guide](https://platform.claude.com/docs/en/about-claude/models/migration-guide)
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
