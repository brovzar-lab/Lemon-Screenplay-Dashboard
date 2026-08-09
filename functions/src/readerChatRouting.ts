import {
  READER_CHAT_DEFAULT_CHOICE,
  READER_CHAT_EFFORT,
  READER_CHAT_MODELS,
  type ReaderChatModelChoice,
} from "./modelRegistry";

export const READER_CHAT_ROUTING_POLICY_VERSION = "reader-chat-routing-v1";

export type ReaderChatFailureReason =
  | "refusal"
  | "invalid_grounded_answer"
  | "budget_exceeded"
  | "accounting_uncertain"
  | "invalid_request"
  | "unknown";

export type ReaderChatRouteReason =
  | "auto_default_opus"
  | "producer_selected_opus"
  | "producer_selected_fable"
  | "producer_deep_review"
  | "objective_fallback_refusal"
  | "objective_fallback_invalid_grounded_answer";

export interface ReaderChatRoute {
  requestedChoice: ReaderChatModelChoice;
  modelId: string;
  effort: typeof READER_CHAT_EFFORT;
  reason: ReaderChatRouteReason;
  fallbackFrom?: string;
}

export interface ReaderChatAttemptUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
  actual_cost_microusd?: number;
  actual_cost_usd?: number;
}

export interface ReaderChatModelAttempt {
  modelId: string;
  outcome: "success" | "failed";
  failureReason?: ReaderChatFailureReason;
  responseId?: string;
  usage?: ReaderChatAttemptUsage;
}

export class ReaderChatAttemptFailure extends Error {
  constructor(
    message: string,
    readonly failureReason: ReaderChatFailureReason,
    readonly attempt: ReaderChatModelAttempt,
    readonly status: number,
  ) {
    super(message);
  }
}

export class ReaderChatRoutingFailure extends Error {
  constructor(
    readonly cause: ReaderChatAttemptFailure,
    readonly route: ReaderChatRoute,
    readonly attempts: ReaderChatModelAttempt[],
  ) {
    super(cause.message);
  }

  get status(): number {
    return this.cause.status;
  }

  get failureReason(): ReaderChatFailureReason {
    return this.cause.failureReason;
  }
}

export function parseReaderChatModelChoice(value: unknown): ReaderChatModelChoice {
  if (value === undefined || value === null || value === "") {
    return READER_CHAT_DEFAULT_CHOICE;
  }
  if (value === "auto" || value === "opus" || value === "fable") return value;
  throw new Error("Reader Chat model choice is not recognized.");
}

export function initialReaderChatRoute(
  choice: ReaderChatModelChoice,
  deepReview = false,
): ReaderChatRoute {
  if (deepReview) {
    return {
      requestedChoice: "fable",
      modelId: READER_CHAT_MODELS.fable,
      effort: READER_CHAT_EFFORT,
      reason: "producer_deep_review",
    };
  }
  if (choice === "fable") {
    return {
      requestedChoice: choice,
      modelId: READER_CHAT_MODELS.fable,
      effort: READER_CHAT_EFFORT,
      reason: "producer_selected_fable",
    };
  }
  return {
    requestedChoice: choice,
    modelId: READER_CHAT_MODELS.opus,
    effort: READER_CHAT_EFFORT,
    reason: choice === "auto" ? "auto_default_opus" : "producer_selected_opus",
  };
}

export function objectiveFallbackRoute(
  choice: ReaderChatModelChoice,
  failure: ReaderChatFailureReason,
): ReaderChatRoute | null {
  if (choice !== "auto") return null;
  const reasons: Partial<Record<ReaderChatFailureReason, ReaderChatRouteReason>> = {
    refusal: "objective_fallback_refusal",
    invalid_grounded_answer: "objective_fallback_invalid_grounded_answer",
  };
  const reason = reasons[failure];
  if (!reason) return null;
  return {
    requestedChoice: choice,
    modelId: READER_CHAT_MODELS.fable,
    effort: READER_CHAT_EFFORT,
    reason,
    fallbackFrom: READER_CHAT_MODELS.opus,
  };
}

export async function executeReaderChatRoute<T>(input: {
  choice: ReaderChatModelChoice;
  deepReview?: boolean;
  attempt: (route: ReaderChatRoute) => Promise<{
    value: T;
    attempt: ReaderChatModelAttempt;
  }>;
}): Promise<{
  value: T;
  route: ReaderChatRoute;
  attempts: ReaderChatModelAttempt[];
}> {
  let route = initialReaderChatRoute(input.choice, input.deepReview === true);
  const attempts: ReaderChatModelAttempt[] = [];
  try {
    const result = await input.attempt(route);
    attempts.push(result.attempt);
    return { value: result.value, route, attempts };
  } catch (error) {
    if (!(error instanceof ReaderChatAttemptFailure)) throw error;
    attempts.push(error.attempt);
    const fallback = objectiveFallbackRoute(input.choice, error.failureReason);
    if (!fallback) throw new ReaderChatRoutingFailure(error, route, attempts);
    route = fallback;
  }

  try {
    const result = await input.attempt(route);
    attempts.push(result.attempt);
    return { value: result.value, route, attempts };
  } catch (error) {
    if (!(error instanceof ReaderChatAttemptFailure)) throw error;
    attempts.push(error.attempt);
    throw new ReaderChatRoutingFailure(error, route, attempts);
  }
}

export function readerChatRouteLabel(reason: ReaderChatRouteReason): string {
  const labels: Record<ReaderChatRouteReason, string> = {
    auto_default_opus: "Auto selected Opus 5",
    producer_selected_opus: "You selected Opus 5",
    producer_selected_fable: "You selected Fable 5",
    producer_deep_review: "You requested a Fable deep review",
    objective_fallback_refusal: "Escalated after Opus declined to answer",
    objective_fallback_invalid_grounded_answer: "Escalated after Opus returned an invalid grounded answer",
  };
  return labels[reason];
}
