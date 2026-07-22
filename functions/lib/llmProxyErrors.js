"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preCallAccountingUnavailableResponse = preCallAccountingUnavailableResponse;
exports.postCallAccountingUncertainResponse = postCallAccountingUncertainResponse;
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
//# sourceMappingURL=llmProxyErrors.js.map