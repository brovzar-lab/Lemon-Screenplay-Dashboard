"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preCallAccountingUnavailableResponse = preCallAccountingUnavailableResponse;
exports.postCallAccountingUncertainResponse = postCallAccountingUncertainResponse;
exports.upstreamInvalidRequestResponse = upstreamInvalidRequestResponse;
function preCallAccountingUnavailableResponse() {
    return {
        error: "AI budget accounting is unavailable. No model call was made.",
        code: "PRE_CALL_ACCOUNTING_UNAVAILABLE",
        isRetryable: true,
    };
}
function postCallAccountingUncertainResponse() {
    return {
        error: "A model call may have incurred cost. Manual review is required before retrying.",
        code: "POST_CALL_ACCOUNTING_UNCERTAIN",
        isRetryable: false,
        manualReviewRequired: true,
    };
}
function upstreamInvalidRequestResponse() {
    return {
        error: "Anthropic rejected the request before model generation. No AI spend was recorded.",
        code: "UPSTREAM_INVALID_REQUEST",
        isRetryable: false,
    };
}
//# sourceMappingURL=llmProxyErrors.js.map