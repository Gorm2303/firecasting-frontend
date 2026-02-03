export type MoneyStoryStepKey = 'capital' | 'start' | 'deposit' | 'return' | 'withdraw' | 'tax' | 'fee' | 'other' | 'end';

// Requested palette (intuitive money semantics):
// - capital (state / balance): Blue — #0072B2
// - deposit (money in): Light green — #7BCF5A
// - return (growth / performance): Dark green — #1B5E20
// - withdrawal (money out): Orange — #E69F00
// - tax (government drag): Vermillion — #D55E00
// - fee (provider drag): Purple — #CC79A7
export const METRIC_COLORS: Record<string, string> = {
  capital: '#0072B2',
  deposit: '#7BCF5A',
  return: '#1B5E20',
  withdraw: '#E69F00',
  tax: '#D55E00',
  fee: '#CC79A7',
  inflation: '#8349cf',
};

export const MONEY_STORY_STEP_COLORS: Record<MoneyStoryStepKey, string> = {
  capital: METRIC_COLORS.capital,
  start: METRIC_COLORS.capital,
  deposit: METRIC_COLORS.deposit,
  return: METRIC_COLORS.return,
  withdraw: METRIC_COLORS.withdraw,
  tax: METRIC_COLORS.tax,
  fee: METRIC_COLORS.fee,
  other: '#8b8b8b',
  end: METRIC_COLORS.capital,
};

export function metricColor(metricName: string | null | undefined): string | undefined {
  const m = String(metricName ?? '').toLowerCase();
  return METRIC_COLORS[m];
}

export function moneyStoryStepColor(key: MoneyStoryStepKey): string {
  return MONEY_STORY_STEP_COLORS[key] ?? '#999';
}
