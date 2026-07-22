export interface LlmProxyAccountingErrorResponse {
  error: string;
  code: "PRE_CALL_ACCOUNTING_UNAVAILABLE" | "POST_CALL_ACCOUNTING_UNCERTAIN";
  isRetryable: boolean;
  manualReviewRequired?: boolean;
}

export function preCallAccountingUnavailableResponse(): LlmProxyAccountingErrorResponse {
  return {
    error: "AI budget accounting is unavailable. No model call was made.",
    code: "PRE_CALL_ACCOUNTING_UNAVAILABLE",
    isRetryable: true,
  };
}

export function postCallAccountingUncertainResponse(): LlmProxyAccountingErrorResponse {
  return {
    error: "A model call may have incurred cost. Manual review is required before retrying.",
    code: "POST_CALL_ACCOUNTING_UNCERTAIN",
    isRetryable: false,
    manualReviewRequired: true,
  };
}
