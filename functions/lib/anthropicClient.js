"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnthropicClient = createAnthropicClient;
exports.safeAnthropicFailureMetadata = safeAnthropicFailureMetadata;
exports.isDefiniteAnthropicRequestRejection = isDefiniteAnthropicRequestRejection;
exports.finalMessageWithUncertainSpendProtection = finalMessageWithUncertainSpendProtection;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
function createAnthropicClient(apiKey) {
    return new sdk_1.default({ apiKey, maxRetries: 0 });
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
const PROVIDER_ERROR_TYPES = new Set([
    "invalid_request_error",
    "authentication_error",
    "permission_error",
    "not_found_error",
    "conflict_error",
    "request_too_large",
    "rate_limit_error",
    "timeout_error",
    "overloaded_error",
    "api_error",
    "billing_error",
]);
const TRANSPORT_CODE_DETAILS = new Map([
    ["ETIMEDOUT", "request_timeout"],
    ["UND_ERR_CONNECT_TIMEOUT", "request_timeout"],
    ["UND_ERR_HEADERS_TIMEOUT", "request_timeout"],
    ["UND_ERR_BODY_TIMEOUT", "request_timeout"],
    ["ECONNRESET", "connection_reset"],
    ["EPIPE", "connection_reset"],
    ["UND_ERR_SOCKET", "connection_reset"],
    ["UND_ERR_ABORTED", "stream_terminated"],
    ["ECONNREFUSED", "connection_refused"],
    ["ENOTFOUND", "dns_failure"],
    ["EAI_AGAIN", "dns_failure"],
    ["ENETUNREACH", "network_unreachable"],
    ["EHOSTUNREACH", "network_unreachable"],
]);
function errorRecord(error) {
    return error && typeof error === "object"
        ? error
        : undefined;
}
function providerErrorClass(error) {
    if (error instanceof sdk_1.default.APIConnectionTimeoutError)
        return "APIConnectionTimeoutError";
    if (error instanceof sdk_1.default.APIConnectionError)
        return "APIConnectionError";
    if (error instanceof sdk_1.default.APIUserAbortError)
        return "APIUserAbortError";
    if (error instanceof sdk_1.default.BadRequestError)
        return "BadRequestError";
    if (error instanceof sdk_1.default.AuthenticationError)
        return "AuthenticationError";
    if (error instanceof sdk_1.default.PermissionDeniedError)
        return "PermissionDeniedError";
    if (error instanceof sdk_1.default.NotFoundError)
        return "NotFoundError";
    if (error instanceof sdk_1.default.ConflictError)
        return "ConflictError";
    if (error instanceof sdk_1.default.UnprocessableEntityError)
        return "UnprocessableEntityError";
    if (error instanceof sdk_1.default.RateLimitError)
        return "RateLimitError";
    if (error instanceof sdk_1.default.InternalServerError)
        return "InternalServerError";
    if (error instanceof sdk_1.default.APIError)
        return "APIError";
    if (error instanceof sdk_1.default.AnthropicError)
        return "AnthropicError";
    if (error instanceof Error)
        return "Error";
    return "UnknownError";
}
function providerErrorType(error) {
    if (error instanceof sdk_1.default.APIConnectionTimeoutError)
        return "connection_timeout";
    if (error instanceof sdk_1.default.APIConnectionError)
        return "connection_error";
    if (error instanceof sdk_1.default.APIUserAbortError)
        return "user_abort";
    if (!(error instanceof sdk_1.default.APIError))
        return "unknown_provider_error";
    const outer = errorRecord(error);
    const response = errorRecord(outer?.error);
    const nested = errorRecord(response?.error);
    for (const value of [outer?.type, response?.type, nested?.type]) {
        if (typeof value === "string" && PROVIDER_ERROR_TYPES.has(value))
            return value;
    }
    return "unknown_provider_error";
}
function providerRequestId(error) {
    if (!(error instanceof sdk_1.default.APIError))
        return null;
    const outer = errorRecord(error);
    const response = errorRecord(outer?.error);
    for (const value of [outer?.requestID, outer?.request_id, response?.request_id]) {
        if (typeof value === "string" && /^req_[A-Za-z0-9_-]{8,160}$/.test(value)) {
            return value;
        }
    }
    return null;
}
function providerHttpStatus(error) {
    if (!(error instanceof sdk_1.default.APIError))
        return null;
    const status = errorRecord(error)?.status;
    return typeof status === "number" && Number.isInteger(status)
        && status >= 400 && status <= 599
        ? status
        : null;
}
function providerTransportDetail(error, errorClass, status) {
    if (errorClass === "APIConnectionTimeoutError")
        return "request_timeout";
    if (errorClass === "APIUserAbortError")
        return "user_abort";
    if (status !== null)
        return "provider_http_error";
    let current = error;
    const messages = [];
    for (let depth = 0; depth < 4; depth += 1) {
        const record = errorRecord(current);
        if (!record)
            break;
        if (typeof record.code === "string") {
            const detail = TRANSPORT_CODE_DETAILS.get(record.code.toUpperCase());
            if (detail)
                return detail;
        }
        if (typeof record.message === "string")
            messages.push(record.message.toLowerCase());
        current = record.cause;
    }
    const message = messages.join(" ");
    if (/timed? out|timeout/.test(message))
        return "request_timeout";
    if (/socket hang up|connection reset|econnreset/.test(message))
        return "connection_reset";
    if (/terminated|premature close|aborted/.test(message))
        return "stream_terminated";
    if (/refused/.test(message))
        return "connection_refused";
    if (/getaddrinfo|enotfound|\bdns\b/.test(message))
        return "dns_failure";
    if (/unreachable/.test(message))
        return "network_unreachable";
    return errorClass === "APIConnectionError"
        ? "unknown_connection_error"
        : "unknown_transport_error";
}
function safeAnthropicFailureMetadata(error, streamRequestId) {
    const errorClass = providerErrorClass(error);
    const status = providerHttpStatus(error);
    const errorType = providerErrorType(error);
    const requestId = providerRequestId(error) ?? (typeof streamRequestId === "string"
        && /^req_[A-Za-z0-9_-]{8,160}$/.test(streamRequestId)
        ? streamRequestId
        : null);
    const detail = providerTransportDetail(error, errorClass, status);
    return {
        provider_error_class: errorClass,
        provider_http_status: status,
        provider_error_type: errorType,
        provider_request_id: requestId,
        provider_transport_detail: detail,
        provider_failure_summary: (`Anthropic provider failure: class=${errorClass}; `
            + `status=${status ?? "none"}; type=${errorType}; detail=${detail}; `
            + `request_id=${requestId ?? "unavailable"}.`),
    };
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
            await releaseDefiniteRejection(reason, error);
        }
        else {
            await accountForUncertainSpend(reason, error);
        }
        throw error;
    }
}
//# sourceMappingURL=anthropicClient.js.map