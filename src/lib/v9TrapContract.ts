import rawContract from '../../execution/v9_trap_contract.json';

type ReaderReports = Record<string, Record<string, unknown>>;

type TrapExpression = {
  all?: TrapExpression[];
  any?: TrapExpression[];
  path?: string;
  lt?: number;
  gte?: number;
  gap_gte?: {
    left: string;
    right_average: string[];
    value: number;
  };
};

export interface FalsePositiveTrapDefinition {
  name: string;
  tier: string;
  weight: number;
  description: string;
  expression: TrapExpression;
}

export const V9_TRAP_CONTRACT = rawContract as {
  version: string;
  traps: FalsePositiveTrapDefinition[];
};

function numericPath(readerReports: ReaderReports, path: string): number {
  let value: unknown = readerReports;
  for (const part of path.split('.')) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Trap contract path is unavailable: ${path}`);
    }
    value = (value as Record<string, unknown>)[part];
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Trap contract path is not numeric: ${path}`);
  }
  return value;
}

function evaluateExpression(
  expression: TrapExpression,
  readerReports: ReaderReports,
): boolean {
  if (expression.all) {
    return expression.all.every((child) => evaluateExpression(child, readerReports));
  }
  if (expression.any) {
    return expression.any.some((child) => evaluateExpression(child, readerReports));
  }
  if (expression.gap_gte) {
    const right = expression.gap_gte.right_average.map(
      (path) => numericPath(readerReports, path),
    );
    if (right.length === 0) throw new Error('Trap contract average is empty.');
    const average = right.reduce((sum, value) => sum + value, 0) / right.length;
    return numericPath(readerReports, expression.gap_gte.left) - average
      >= expression.gap_gte.value;
  }
  if (expression.path && expression.lt !== undefined) {
    return numericPath(readerReports, expression.path) < expression.lt;
  }
  if (expression.path && expression.gte !== undefined) {
    return numericPath(readerReports, expression.path) >= expression.gte;
  }
  throw new Error('Trap contract contains an unsupported expression.');
}

function expressionPaths(expression: TrapExpression): string[] {
  if (expression.all) return expression.all.flatMap(expressionPaths);
  if (expression.any) return expression.any.flatMap(expressionPaths);
  if (expression.gap_gte) {
    return [expression.gap_gte.left, ...expression.gap_gte.right_average];
  }
  return expression.path ? [expression.path] : [];
}

export function evaluateFalsePositiveTrapTriggers(
  readerReports: ReaderReports,
): Map<string, boolean> {
  return new Map(V9_TRAP_CONTRACT.traps.map((trap) => [
    trap.name,
    evaluateExpression(trap.expression, readerReports),
  ]));
}

export function buildFalsePositiveTrapEvidence(
  trap: FalsePositiveTrapDefinition,
  readerReports: ReaderReports,
  triggered: boolean,
): string {
  const values = [...new Set(expressionPaths(trap.expression))]
    .map((path) => `${path}=${numericPath(readerReports, path)}`)
    .join(', ');
  return `Canonical evaluation: ${values}. Rule: ${trap.description}. Result: ${
    triggered ? 'triggered' : 'not triggered'
  }.`;
}

export const FALSE_POSITIVE_TRAP_INSTRUCTIONS = V9_TRAP_CONTRACT.traps
  .map((trap, index) => `${index + 1}. ${trap.name} (${trap.tier}, ${trap.weight}) — ${trap.description}`)
  .join('\n');

export const FALSE_POSITIVE_TRAP_OUTPUT_TEMPLATE = V9_TRAP_CONTRACT.traps
  .map((trap) => JSON.stringify({
    name: trap.name,
    triggered: false,
    tier: trap.tier,
    weight: trap.weight,
    evidence: '',
  }))
  .join(',\n      ');
