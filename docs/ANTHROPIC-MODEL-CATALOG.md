# Anthropic model catalog

The app separates two facts that must not be confused:

1. **Approved routes** are the exact model IDs used by scoring and Reader Chat.
2. **Latest observed models** are the newest models Anthropic currently lists.

New availability never changes a production route automatically. A new model must first pass the screenplay benchmark suite and receive explicit approval. This prevents an unreviewed model release from silently changing scores or verdicts.

## Current approved routes

| Use | Approved route |
| --- | --- |
| Budget analysis | `claude-haiku-4-5-20251001` |
| Standard analysis | `claude-sonnet-4-6` |
| Deep analysis | `claude-opus-4-7` |
| Reader Chat default | `claude-opus-5` |
| Reader Chat escalation | `claude-fable-5` |

The source of truth is [`src/config/anthropic-model-catalog.json`](../src/config/anthropic-model-catalog.json). Intake and Model Comparison read that catalog instead of repeating model names.

## Monthly review

The `Anthropic model catalog check` GitHub Actions workflow runs on the first day of every month. It calls Anthropic's Models API and verifies that approved routes remain available and the recorded newest model in each family has not changed.

The workflow requires the repository secret `ANTHROPIC_API_KEY`. It performs metadata discovery only. It does not run inference and does not change code, scoring, or routing.

When the check reports a change:

1. Confirm the release in Anthropic's model and deprecation documentation.
2. Add the candidate to a local benchmark branch.
3. Run the sealed screenplay benchmark and compare quality, stability, latency, and cost.
4. Obtain explicit approval before changing an approved route.
5. Update the catalog verification date and model IDs in one reviewed commit.

Local structure validation is available without a network call:

```bash
npm run models:check:offline
```

Primary sources:

- [Models API](https://platform.claude.com/docs/en/api/models/list)
- [Choosing a model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)
- [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)
- [Release notes](https://platform.claude.com/docs/en/release-notes/overview)
