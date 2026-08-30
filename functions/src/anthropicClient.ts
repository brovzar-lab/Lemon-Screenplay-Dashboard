import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 0 });
}

function errorMessage(error: unknown): string {
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

const TRANSPORT_CODE_DETAILS = new Map<string, string>([
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

export interface SafeAnthropicFailureMetadata {
  provider_error_class: string;
  provider_http_status: number | null;
  provider_error_type: string;
  provider_request_id: string | null;
  provider_transport_detail: string;
  provider_failure_summary: string;
}

function errorRecord(error: unknown): Record<string, unknown> | undefined {
  return error && typeof error === "object"
    ? error as Record<string, unknown>
    : undefined;
}

function providerErrorClass(error: unknown): string {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "APIConnectionTimeoutError";
  if (error instanceof Anthropic.APIConnectionError) return "APIConnectionError";
  if (error instanceof Anthropic.APIUserAbortError) return "APIUserAbortError";
  if (error instanceof Anthropic.BadRequestError) return "BadRequestError";
  if (error instanceof Anthropic.AuthenticationError) return "AuthenticationError";
  if (error instanceof Anthropic.PermissionDeniedError) return "PermissionDeniedError";
  if (error instanceof Anthropic.NotFoundError) return "NotFoundError";
  if (error instanceof Anthropic.ConflictError) return "ConflictError";
  if (error instanceof Anthropic.UnprocessableEntityError) return "UnprocessableEntityError";
  if (error instanceof Anthropic.RateLimitError) return "RateLimitError";
  if (error instanceof Anthropic.InternalServerError) return "InternalServerError";
  if (error instanceof Anthropic.APIError) return "APIError";
  if (error instanceof Anthropic.AnthropicError) return "AnthropicError";
  if (error instanceof Error) return "Error";
  return "UnknownError";
}

function providerErrorType(error: unknown): string {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "connection_timeout";
  if (error instanceof Anthropic.APIConnectionError) return "connection_error";
  if (error instanceof Anthropic.APIUserAbortError) return "user_abort";
  if (!(error instanceof Anthropic.APIError)) return "unknown_provider_error";
  const outer = errorRecord(error);
  const response = errorRecord(outer?.error);
  const nested = errorRecord(response?.error);
  for (const value of [outer?.type, response?.type, nested?.type]) {
    if (typeof value === "string" && PROVIDER_ERROR_TYPES.has(value)) return value;
  }
  return "unknown_provider_error";
}

function providerRequestId(error: unknown): string | null {
  if (!(error instanceof Anthropic.APIError)) return null;
  const outer = errorRecord(error);
  const response = errorRecord(outer?.error);
  for (const value of [outer?.requestID, outer?.request_id, response?.request_id]) {
    if (typeof value === "string" && /^req_[A-Za-z0-9_-]{8,160}$/.test(value)) {
      return value;
    }
  }
  return null;
}

function providerHttpStatus(error: unknown): number | null {
  if (!(error instanceof Anthropic.APIError)) return null;
  const status = errorRecord(error)?.status;
  return typeof status === "number" && Number.isInteger(status)
    && status >= 400 && status <= 599
    ? status
    : null;
}

function providerTransportDetail(
  error: unknown,
  errorClass: string,
  status: number | null,
): string {
  if (errorClass === "APIConnectionTimeoutError") return "request_timeout";
  if (errorClass === "APIUserAbortError") return "user_abort";
  if (status !== null) return "provider_http_error";
  let current: unknown = error;
  const messages: string[] = [];
  for (let depth = 0; depth < 4; depth += 1) {
    const record = errorRecord(current);
    if (!record) break;
    if (typeof record.code === "string") {
      const detail = TRANSPORT_CODE_DETAILS.get(record.code.toUpperCase());
      if (detail) return detail;
    }
    if (typeof record.message === "string") messages.push(record.message.toLowerCase());
    current = record.cause;
  }
  const message = messages.join(" ");
  if (/timed? out|timeout/.test(message)) return "request_timeout";
  if (/socket hang up|connection reset|econnreset/.test(message)) return "connection_reset";
  if (/terminated|premature close|aborted/.test(message)) return "stream_terminated";
  if (/refused/.test(message)) return "connection_refused";
  if (/getaddrinfo|enotfound|\bdns\b/.test(message)) return "dns_failure";
  if (/unreachable/.test(message)) return "network_unreachable";
  return errorClass === "APIConnectionError"
    ? "unknown_connection_error"
    : "unknown_transport_error";
}

export function safeAnthropicFailureMetadata(
  error: unknown,
  streamRequestId?: unknown,
): SafeAnthropicFailureMetadata {
  const errorClass = providerErrorClass(error);
  const status = providerHttpStatus(error);
  const errorType = providerErrorType(error);
  const requestId = providerRequestId(error) ?? (
    typeof streamRequestId === "string"
    && /^req_[A-Za-z0-9_-]{8,160}$/.test(streamRequestId)
      ? streamRequestId
      : null
  );
  const detail = providerTransportDetail(error, errorClass, status);
  return {
    provider_error_class: errorClass,
    provider_http_status: status,
    provider_error_type: errorType,
    provider_request_id: requestId,
    provider_transport_detail: detail,
    provider_failure_summary: (
      `Anthropic provider failure: class=${errorClass}; `
      + `status=${status ?? "none"}; type=${errorType}; detail=${detail}; `
      + `request_id=${requestId ?? "unavailable"}.`
    ),
  };
}

export function isDefiniteAnthropicRequestRejection(
  error: unknown,
): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    status?: unknown;
    type?: unknown;
    error?: unknown;
  };
  const responseBody = (
    candidate.error
    && typeof candidate.error === "object"
  )
    ? candidate.error as {
        error?: unknown;
      }
    : undefined;
  const responseError = (
    responseBody?.error
    && typeof responseBody.error === "object"
  )
    ? responseBody.error as {
        type?: unknown;
      }
    : undefined;
  return (
    candidate.status === 400
    && (
      candidate.type === "invalid_request_error"
      || responseError?.type === "invalid_request_error"
    )
  );
}

export async function finalMessageWithUncertainSpendProtection<T>(
  finalMessage: () => Promise<T>,
  accountForUncertainSpend: (reason: string, error: unknown) => Promise<void>,
  releaseDefiniteRejection: (reason: string, error: unknown) => Promise<void>,
): Promise<T> {
  try {
    return await finalMessage();
  } catch (error) {
    const reason = errorMessage(error);
    if (isDefiniteAnthropicRequestRejection(error)) {
      await releaseDefiniteRejection(reason, error);
    } else {
      await accountForUncertainSpend(reason, error);
    }
    throw error;
  }
}
