/**
 * promptClient.ts
 *
 * Exports the `LensName` type used by promptClient.v9.ts and multiPassAnalysis.ts.
 * Legacy client-side prompt builders have been removed — all analysis prompts
 * are built by the V9 engine paths (promptClient.v9.ts / ingest_v9.py).
 */

export type LensName = 'latam' | 'commercial' | 'production' | 'coproduction';
