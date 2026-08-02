"use strict";
/**
 * Central model choices for human-facing LLM features.
 *
 * The ingestion pipeline keeps its own pinned models because changing those
 * would change scoring behavior. New interactive features must choose from
 * this registry so model upgrades are deliberate, reviewable, and testable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.READER_CHAT_MODEL_IDS = exports.READER_CHAT_MODEL_VERIFIED_AT = exports.READER_CHAT_EFFORT = exports.READER_CHAT_DEFAULT_CHOICE = exports.READER_CHAT_MODEL = exports.READER_CHAT_MODELS = void 0;
exports.READER_CHAT_MODELS = {
    opus: "claude-opus-5",
    fable: "claude-fable-5",
};
// Opus 5 is the approved default for a private reader conversation. Fable 5
// remains available for a visible deep review or an objective Auto fallback.
exports.READER_CHAT_MODEL = exports.READER_CHAT_MODELS.opus;
exports.READER_CHAT_DEFAULT_CHOICE = "auto";
exports.READER_CHAT_EFFORT = "high";
exports.READER_CHAT_MODEL_VERIFIED_AT = "2026-08-02";
exports.READER_CHAT_MODEL_IDS = new Set([
    ...Object.values(exports.READER_CHAT_MODELS),
]);
//# sourceMappingURL=modelRegistry.js.map