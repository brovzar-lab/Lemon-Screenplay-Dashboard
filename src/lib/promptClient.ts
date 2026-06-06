/**
 * promptClient.ts
 *
 * Exports the `LensName` type used by promptClient.v9.ts and multiPassAnalysis.ts.
 * The V6 client-side prompt builder has been removed — all V6 analysis now goes
 * through the `analyzeScreenplay` Cloud Function which builds the prompt server-side.
 */

export type LensName = 'latam' | 'commercial' | 'production' | 'coproduction';
