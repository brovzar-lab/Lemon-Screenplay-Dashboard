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
