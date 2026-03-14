/**
 * Shared utility functions
 */

/**
 * Safely convert an unknown value to a number.
 * Handles number, string, and fallback to default.
 */
export function toNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Safely parse a JSON string, returning a fallback value on failure.
 * Handles null, undefined, empty strings, and malformed JSON without throwing.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
