"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnthropicClient = createAnthropicClient;
exports.finalMessageWithUncertainSpendProtection = finalMessageWithUncertainSpendProtection;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
function createAnthropicClient(apiKey) {
    return new sdk_1.default({ apiKey, maxRetries: 0 });
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
async function finalMessageWithUncertainSpendProtection(finalMessage, accountForUncertainSpend) {
    try {
        return await finalMessage();
    }
    catch (error) {
        await accountForUncertainSpend(errorMessage(error));
        throw error;
    }
}
//# sourceMappingURL=anthropicClient.js.map