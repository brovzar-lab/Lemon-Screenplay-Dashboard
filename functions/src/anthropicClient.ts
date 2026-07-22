import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 0 });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function finalMessageWithUncertainSpendProtection<T>(
  finalMessage: () => Promise<T>,
  accountForUncertainSpend: (reason: string) => Promise<void>,
): Promise<T> {
  try {
    return await finalMessage();
  } catch (error) {
    await accountForUncertainSpend(errorMessage(error));
    throw error;
  }
}
