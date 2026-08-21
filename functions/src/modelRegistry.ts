/**
 * Central model choices for human-facing LLM features.
 *
 * The ingestion pipeline keeps its own pinned models because changing those
 * would change scoring behavior. New interactive features must choose from
 * this registry so model upgrades are deliberate, reviewable, and testable.
 */

export const READER_CHAT_MODELS = {
  opus: "claude-opus-5",
  fable: "claude-fable-5",
} as const;

export type ReaderChatModelChoice = "auto" | keyof typeof READER_CHAT_MODELS;

// Opus 5 is the approved default for a private reader conversation. Fable 5
// remains available for a visible deep review or an objective Auto fallback.
export const READER_CHAT_MODEL = READER_CHAT_MODELS.opus;
export const READER_CHAT_DEFAULT_CHOICE: ReaderChatModelChoice = "auto";
export const READER_CHAT_EFFORT = "high" as const;
export const READER_CHAT_MODEL_VERIFIED_AT = "2026-08-21";

export const READER_CHAT_MODEL_IDS = new Set<string>([
  ...Object.values(READER_CHAT_MODELS),
]);
