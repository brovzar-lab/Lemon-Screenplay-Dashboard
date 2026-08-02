/**
 * Central model choices for human-facing LLM features.
 *
 * The ingestion pipeline keeps its own pinned models because changing those
 * would change scoring behavior. New interactive features must choose from
 * this registry so model upgrades are deliberate, reviewable, and testable.
 */

// Anthropic lists Fable 5 as its highest-capability widely released model.
// Private Reader Chat is a quality-first feature, so cost is not used to
// select a weaker model here.
export const READER_CHAT_MODEL = "claude-fable-5";
export const READER_CHAT_MODEL_VERIFIED_AT = "2026-08-02";

export const INTERACTIVE_MODELS = new Set([
  READER_CHAT_MODEL,
]);
