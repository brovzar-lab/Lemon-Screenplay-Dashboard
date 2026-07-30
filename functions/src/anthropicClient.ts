import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 0 });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isDefiniteAnthropicRequestRejection(
  error: unknown,
): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    status?: unknown;
    type?: unknown;
  };
  return (
    candidate.status === 400
    && candidate.type === "invalid_request_error"
  );
}

export async function finalMessageWithUncertainSpendProtection<T>(
  finalMessage: () => Promise<T>,
  accountForUncertainSpend: (reason: string) => Promise<void>,
  releaseDefiniteRejection: (reason: string) => Promise<void>,
): Promise<T> {
  try {
    return await finalMessage();
  } catch (error) {
    const reason = errorMessage(error);
    if (isDefiniteAnthropicRequestRejection(error)) {
      await releaseDefiniteRejection(reason);
    } else {
      await accountForUncertainSpend(reason);
    }
    throw error;
  }
}
