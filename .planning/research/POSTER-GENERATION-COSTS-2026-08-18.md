# Poster generation cost research

**Checked:** 2026-08-18
**Scope:** One new portrait movie-poster image per screenplay. Prices are USD and use paid API rates.

## Short answer

Use **Gemini 3.1 Flash Lite Image at 1K, portrait 2:3** for automatic posters.

- One automatic generation costs about **$0.034** plus a very small prompt cost.
- A manual retry can use Flash Image at **$0.067** or Pro Image at **$0.134**.
- At the automatic rate, 100 screenplays cost about **$3.36** and 500 cost about **$16.80**.
- Google says the older Imagen models were deprecated and scheduled to shut down on August 17, 2026. Do not restore the old Imagen model ID.

## Cost table: one generated image per screenplay

These totals are the image-output cost only. Prompt text, Firebase Storage, network transfer, and retries are separate.

| Model and assumption                           |   Per image | 5 scripts | 25 scripts | 100 scripts | 500 scripts |
| ---------------------------------------------- | ----------: | --------: | ---------: | ----------: | ----------: |
| **Gemini 3.1 Flash Lite Image, 1K**            | **$0.0336** | **$0.17** |  **$0.84** |   **$3.36** |  **$16.80** |
| Gemini 2.5 Flash Image, 1K                     |     $0.0390 |     $0.20 |      $0.98 |       $3.90 |      $19.50 |
| Gemini 3.1 Flash Image, 1K                     |     $0.0670 |     $0.34 |      $1.68 |       $6.70 |      $33.50 |
| Gemini 3 Pro Image, 1K or 2K                   |     $0.1340 |     $0.67 |      $3.35 |      $13.40 |      $67.00 |
| OpenAI GPT Image 2, portrait 1024x1536, medium |     $0.0410 |     $0.21 |      $1.03 |       $4.10 |      $20.50 |
| OpenAI GPT Image 2, portrait 1024x1536, high   |     $0.1650 |     $0.83 |      $4.13 |      $16.50 |      $82.50 |

## Safer real-world budget: two attempts per screenplay

Poster generation can produce a weak composition, bad title text, or a safety block. Two attempts per screenplay are a more honest budget.

| Model and assumption                           | Per screenplay | 5 scripts | 25 scripts | 100 scripts | 500 scripts |
| ---------------------------------------------- | -------------: | --------: | ---------: | ----------: | ----------: |
| **Gemini 3.1 Flash Lite Image, two 1K images** |    **$0.0672** | **$0.34** |  **$1.68** |   **$6.72** |  **$33.60** |
| Gemini 3.1 Flash Image, two 1K images          |        $0.1340 |     $0.67 |      $3.35 |      $13.40 |      $67.00 |
| Gemini 3 Pro Image, two 1K or 2K images        |        $0.2680 |     $1.34 |      $6.70 |      $26.80 |     $134.00 |
| OpenAI GPT Image 2, two portrait medium images |        $0.0820 |     $0.41 |      $2.05 |       $8.20 |      $41.00 |
| OpenAI GPT Image 2, two portrait high images   |        $0.3300 |     $1.65 |      $8.25 |      $33.00 |     $165.00 |

## Batch pricing

Batch work is about half price, but it is asynchronous. It fits a backfill better than the normal upload flow.

| Model                       | Batch price per 1K image | 5 scripts | 25 scripts | 100 scripts | 500 scripts |
| --------------------------- | -----------------------: | --------: | ---------: | ----------: | ----------: |
| Gemini 3.1 Flash Lite Image |                  $0.0168 |     $0.08 |      $0.42 |       $1.68 |       $8.40 |
| Gemini 2.5 Flash Image      |                  $0.0195 |     $0.10 |      $0.49 |       $1.95 |       $9.75 |
| Gemini 3.1 Flash Image      |                  $0.0340 |     $0.17 |      $0.85 |       $3.40 |      $17.00 |
| Gemini 3 Pro Image          |                  $0.0670 |     $0.34 |      $1.68 |       $6.70 |      $33.50 |

OpenAI also lists image output at half price in Batch. For GPT Image 2 portrait medium, that is roughly **$0.0205 per image** before prompt input.

## Prompt cost and uncertainty

- A robust 1,000-token text prompt adds about **$0.0005** on Gemini 3.1 Flash Image.
- The same 1,000-token prompt adds about **$0.005** on GPT Image 2.
- A normal poster prompt is likely shorter than 1,000 tokens.
- Failed or blocked requests need explicit handling. The exact billing result for each failed request can depend on where it failed.
- Prices can change. Recheck them before a large backfill.
- Taxes and currency conversion are not included.

## API and product constraints

### Google

- Paid image generation has no listed free tier.
- Gemini 3.1 Flash Image supports portrait ratios including 2:3, 3:4, 4:5, and 9:16.
- It supports 1K, 2K, and 4K output. A 3:4 1K image is 896x1200.
- Gemini 2.5 Flash Image is fixed near 1K. Its 3:4 output is 864x1184.
- Google recommends Gemini 3.1 Flash Image as the best balance of quality, cost, and speed.
- Rate limits depend on the Google AI Studio project and billing tier. The app must queue work and retry temporary 429 or 5xx errors.
- Keep the Google key on the server. Do not put it in the browser bundle.

### OpenAI

- The Image API is the simpler API for one image from one prompt.
- Organization verification may be required before GPT Image access.
- Complex prompts can take up to two minutes.
- The API supports portrait 1024x1536 and low, medium, or high quality.
- OpenAI warns that exact text and exact composition can still fail.
- Prompts and results pass through content filters. The app should not automatically retry a moderation block without changing the prompt.

## Recommendation

1. Restore the original robust prompt if it is still in Git history.
2. Run a five-screenplay pilot with **Gemini 3.1 Flash Lite Image, 2:3, 1K**.
3. Generate one image first. Allow a manual Flash or Pro retry only when needed.
4. Keep a hard poster budget separate from the V9 analysis budget.
5. Generate posters after the analysis succeeds. A poster failure must not fail screenplay ingestion.
6. Store the final image once in Firebase Storage. Reuse it everywhere.

This design keeps the automatic five-script pilot below **$0.17**. Manual upgrades add only the selected model cost.

## Official sources

- [Google Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google Gemini image generation guide and supported aspect ratios](https://ai.google.dev/gemini-api/docs/image-generation)
- [Google Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Google Gemini 2.5 Flash Image model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI image generation guide, limits, and per-image calculator](https://developers.openai.com/api/docs/guides/image-generation)
