"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApprovedProxyModel = isApprovedProxyModel;
exports.approvedOutputConfig = approvedOutputConfig;
const modelRegistry_1 = require("./modelRegistry");
const GENERAL_PROXY_MODELS = new Set([
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
]);
function isApprovedProxyModel(model, caller) {
    if (typeof model !== "string")
        return false;
    if (GENERAL_PROXY_MODELS.has(model))
        return true;
    return caller === "service" && modelRegistry_1.READER_CHAT_MODEL_IDS.has(model);
}
function approvedOutputConfig(value) {
    if (value === undefined)
        return undefined;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("output_config must be an object.");
    }
    const record = value;
    const keys = Object.keys(record);
    if (keys.some((key) => key !== "effort")) {
        throw new Error("output_config contains unsupported fields.");
    }
    const effort = record.effort;
    if (effort !== "low"
        && effort !== "medium"
        && effort !== "high"
        && effort !== "xhigh"
        && effort !== "max") {
        throw new Error("Unsupported effort level.");
    }
    return { effort };
}
//# sourceMappingURL=llmProxyPolicy.js.map