"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnthropicClient = createAnthropicClient;
exports.isDefiniteAnthropicRequestRejection = isDefiniteAnthropicRequestRejection;
exports.finalMessageWithUncertainSpendProtection = finalMessageWithUncertainSpendProtection;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
function createAnthropicClient(apiKey) {
    return new sdk_1.default({ apiKey, maxRetries: 0 });
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function isDefiniteAnthropicRequestRejection(error) {
    if (!error || typeof error !== "object")
        return false;
    const candidate = error;
    const responseBody = (candidate.error
        && typeof candidate.error === "object")
        ? candidate.error
        : undefined;
    const responseError = (responseBody?.error
        && typeof responseBody.error === "object")
        ? responseBody.error
        : undefined;
    return (candidate.status === 400
        && (candidate.type === "invalid_request_error"
            || responseError?.type === "invalid_request_error"));
}
async function finalMessageWithUncertainSpendProtection(finalMessage, accountForUncertainSpend, releaseDefiniteRejection) {
    try {
        return await finalMessage();
    }
    catch (error) {
        const reason = errorMessage(error);
        if (isDefiniteAnthropicRequestRejection(error)) {
            await releaseDefiniteRejection(reason);
        }
        else {
            await accountForUncertainSpend(reason);
        }
        throw error;
    }
}
//# sourceMappingURL=anthropicClient.js.map