export type MoneyPerspectiveSalaryPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type MoneyPerspectiveCompensationSettings = {
  /** Net salary/wage amount for the selected period. */
  period: MoneyPerspectiveSalaryPeriod;
  amount: number;

  /** Used to derive hourly from non-hourly periods. */
  workingHoursPerMonth: number;

  /** Expected yearly pay raise (pct). Used in projections. */
  payRaisePct: number;
};

export type MoneyPerspectiveCoreExpenseSettings = {
  source: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dailyCoreExpense: number;
  weeklyCoreExpense: number;
  monthlyCoreExpense: number;
  yearlyCoreExpense: number;
};

export type MoneyPerspectiveInvestingSettings = {
  timeHorizonYears: number;

  /** Always monthly compounding (12). Kept in settings for transparency and persistence. */
  compoundsPerYear: 12;

  /** Expected annual return before fee drag (pct). */
  annualReturnPct: number;

  /** Inflation rate (pct). Expected (non-optional). */
  inflationPct: number;

  /** Simple annual fee drag (pct-point subtraction). Expected (non-optional). */
  feeDragPct: number;
};

export type MoneyPerspectiveSettingsV3 = {
  version: 3;
  currency: string;
  compensation: MoneyPerspectiveCompensationSettings;
  coreExpenses: MoneyPerspectiveCoreExpenseSettings;
  investing: MoneyPerspectiveInvestingSettings;
};

const STORAGE_KEY_V3 = 'firecasting:moneyPerspective:settings:v3';
const STORAGE_KEY_V2 = 'firecasting:moneyPerspective:settings:v2';
const STORAGE_KEY_V1 = 'firecasting:moneyPerspective:settings:v1';

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null;
  if (Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function asNumber(v: unknown, fallback: number): number {
  return isFiniteNumber(v) ? v : fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v : fallback;
}

function normalizeSalaryPeriod(v: unknown, fallback: MoneyPerspectiveSalaryPeriod): MoneyPerspectiveSalaryPeriod {
  return v === 'hourly' || v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'yearly' ? v : fallback;
}

function normalizeCoreSource(v: unknown, fallback: MoneyPerspectiveCoreExpenseSettings['source']): MoneyPerspectiveCoreExpenseSettings['source'] {
  return v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'yearly' ? v : fallback;
}

export function defaultMoneyPerspectiveSettings(): MoneyPerspectiveSettingsV3 {
  const monthlyCoreExpense = 12_000;
  const dailyCoreExpense = monthlyCoreExpense / (365 / 12);
  return {
    version: 3,
    currency: 'DKK',
    compensation: {
      period: 'hourly',
      amount: 200,
      workingHoursPerMonth: 160,
      payRaisePct: 2,
    },
    coreExpenses: {
      source: 'monthly',
      dailyCoreExpense,
      weeklyCoreExpense: dailyCoreExpense * 7,
      monthlyCoreExpense,
      yearlyCoreExpense: dailyCoreExpense * 365,
    },
    investing: {
      timeHorizonYears: 10,
      compoundsPerYear: 12,
      annualReturnPct: 7,
      inflationPct: 2,
      feeDragPct: 0.5,
    },
  };
}

function normalizeV3(raw: Record<string, unknown>, defaults: MoneyPerspectiveSettingsV3): MoneyPerspectiveSettingsV3 {
  const comp = asRecord(raw.compensation) ?? {};
  const core = asRecord(raw.coreExpenses) ?? {};
  const inv = asRecord(raw.investing) ?? {};

  return {
    version: 3,
    currency: asString(raw.currency, defaults.currency),
    compensation: {
      period: normalizeSalaryPeriod(comp.period, defaults.compensation.period),
      amount: asNumber(comp.amount, defaults.compensation.amount),
      workingHoursPerMonth: asNumber(comp.workingHoursPerMonth, defaults.compensation.workingHoursPerMonth),
      payRaisePct: asNumber(comp.payRaisePct, defaults.compensation.payRaisePct),
    },
    coreExpenses: {
      source: normalizeCoreSource(core.source, defaults.coreExpenses.source),
      dailyCoreExpense: asNumber(core.dailyCoreExpense, defaults.coreExpenses.dailyCoreExpense),
      weeklyCoreExpense: asNumber(core.weeklyCoreExpense, defaults.coreExpenses.weeklyCoreExpense),
      monthlyCoreExpense: asNumber(core.monthlyCoreExpense, defaults.coreExpenses.monthlyCoreExpense),
      yearlyCoreExpense: asNumber(core.yearlyCoreExpense, defaults.coreExpenses.yearlyCoreExpense),
    },
    investing: {
      timeHorizonYears: Math.max(0, Math.trunc(asNumber(inv.timeHorizonYears, defaults.investing.timeHorizonYears))),
      // Force and normalize to 12. (Even if localStorage contains something else.)
      compoundsPerYear: 12,
      annualReturnPct: asNumber(inv.annualReturnPct, defaults.investing.annualReturnPct),
      inflationPct: asNumber(inv.inflationPct, defaults.investing.inflationPct),
      feeDragPct: asNumber(inv.feeDragPct, defaults.investing.feeDragPct),
    },
  };
}

function migrateFromV2ToV3(rawV2: Record<string, unknown>): MoneyPerspectiveSettingsV3 {
  const defaults = defaultMoneyPerspectiveSettings();

  const v2Comp = asRecord(rawV2.compensation) ?? {};
  const v2Core = asRecord(rawV2.coreExpenses) ?? {};
  const v2Inv = asRecord(rawV2.investing) ?? {};

  // v2 had multiple "sources"; map to a single amount+period.
  const source = v2Comp.source;
  const netHourlyRate = asNumber(v2Comp.netHourlyRate, defaults.compensation.amount);
  const netMonthlyIncome = asNumber(v2Comp.netMonthlyIncome, netHourlyRate * defaults.compensation.workingHoursPerMonth);
  const effectiveAfterTaxAndCosts = asNumber(v2Comp.effectiveHourlyAfterTaxAndCosts, netHourlyRate);
  const workingHoursPerMonth = asNumber(v2Comp.workingHoursPerMonth, defaults.compensation.workingHoursPerMonth);

  let period: MoneyPerspectiveSalaryPeriod = defaults.compensation.period;
  let amount = defaults.compensation.amount;
  if (source === 'monthlyDerived') {
    period = 'monthly';
    amount = netMonthlyIncome;
  } else if (source === 'effectiveAfterTaxAndCosts') {
    period = 'hourly';
    amount = effectiveAfterTaxAndCosts;
  } else {
    period = 'hourly';
    amount = netHourlyRate;
  }

  return {
    version: 3,
    currency: asString(rawV2.currency, defaults.currency),
    compensation: {
      period,
      amount,
      workingHoursPerMonth,
      payRaisePct: 0,
    },
    coreExpenses: {
      source: normalizeCoreSource(v2Core.source, defaults.coreExpenses.source),
      dailyCoreExpense: asNumber(v2Core.dailyCoreExpense, defaults.coreExpenses.dailyCoreExpense),
      weeklyCoreExpense: asNumber(v2Core.weeklyCoreExpense, defaults.coreExpenses.weeklyCoreExpense),
      monthlyCoreExpense: asNumber(v2Core.monthlyCoreExpense, defaults.coreExpenses.monthlyCoreExpense),
      yearlyCoreExpense: asNumber(v2Core.yearlyCoreExpense, defaults.coreExpenses.yearlyCoreExpense),
    },
    investing: {
      timeHorizonYears: Math.max(0, Math.trunc(asNumber(v2Inv.timeHorizonYears, defaults.investing.timeHorizonYears))),
      compoundsPerYear: 12,
      annualReturnPct: asNumber(v2Inv.annualReturnPct, defaults.investing.annualReturnPct),
      inflationPct: asNumber(v2Inv.inflationPct, defaults.investing.inflationPct),
      feeDragPct: asNumber(v2Inv.feeDragPct, defaults.investing.feeDragPct),
    },
  };
}

function migrateFromV1ToV3(rawV1: Record<string, unknown>): MoneyPerspectiveSettingsV3 {
  const defaults = defaultMoneyPerspectiveSettings();

  const v1Comp = asRecord(rawV1.compensation) ?? {};
  const v1Core = asRecord(rawV1.coreExpenses) ?? {};
  const v1Inv = asRecord(rawV1.investing) ?? {};

  // v1 had presets; pick selected preset's return when possible.
  let annualReturnPct = defaults.investing.annualReturnPct;
  const selectedPresetId = v1Inv.selectedPresetId;
  const presets = v1Inv.presets;
  if (typeof selectedPresetId === 'string' && Array.isArray(presets)) {
    const selected = presets
      .map((p) => asRecord(p))
      .find((p) => p && p.id === selectedPresetId);
    if (selected) annualReturnPct = asNumber(selected.annualReturnPct, annualReturnPct);
  } else {
    annualReturnPct = asNumber(v1Inv.annualReturnPct, annualReturnPct);
  }

  // v1 had a few compensation sources. Default to hourly.
  const v1Source = v1Comp.source;
  const v1NetHourly = asNumber(v1Comp.netHourlyRate, defaults.compensation.amount);
  const v1Monthly = asNumber(v1Comp.netMonthlyIncome, v1NetHourly * defaults.compensation.workingHoursPerMonth);
  const v1Effective = asNumber(v1Comp.effectiveHourlyAfterTaxAndCosts, v1NetHourly);
  const v1Hours = asNumber(v1Comp.workingHoursPerMonth, defaults.compensation.workingHoursPerMonth);
  let period: MoneyPerspectiveSalaryPeriod = 'hourly';
  let amount = v1NetHourly;
  if (v1Source === 'monthlyDerived') {
    period = 'monthly';
    amount = v1Monthly;
  } else if (v1Source === 'effectiveAfterTaxAndCosts') {
    period = 'hourly';
    amount = v1Effective;
  }

  return {
    version: 3,
    currency: asString(rawV1.currency, defaults.currency),
    compensation: {
      period,
      amount,
      workingHoursPerMonth: v1Hours,
      payRaisePct: 0,
    },
    coreExpenses: {
      source: normalizeCoreSource(v1Core.source, defaults.coreExpenses.source),
      dailyCoreExpense: asNumber(v1Core.dailyCoreExpense, defaults.coreExpenses.dailyCoreExpense),
      weeklyCoreExpense: asNumber(v1Core.weeklyCoreExpense, defaults.coreExpenses.weeklyCoreExpense),
      monthlyCoreExpense: asNumber(v1Core.monthlyCoreExpense, defaults.coreExpenses.monthlyCoreExpense),
      yearlyCoreExpense: asNumber(v1Core.yearlyCoreExpense, defaults.coreExpenses.yearlyCoreExpense),
    },
    investing: {
      timeHorizonYears: Math.max(0, Math.trunc(asNumber(v1Inv.timeHorizonYears, defaults.investing.timeHorizonYears))),
      compoundsPerYear: 12,
      annualReturnPct,
      inflationPct: asNumber(v1Inv.inflationPct, defaults.investing.inflationPct),
      feeDragPct: asNumber(v1Inv.feeDragPct, defaults.investing.feeDragPct),
    },
  };
}

export function loadMoneyPerspectiveSettings(): MoneyPerspectiveSettingsV3 {
  const defaults = defaultMoneyPerspectiveSettings();
  if (typeof window === 'undefined') return defaults;

  const rawV3 = asRecord(safeParse(window.localStorage.getItem(STORAGE_KEY_V3)));
  if (rawV3 && rawV3.version === 3) return normalizeV3(rawV3, defaults);

  // Migrate from v2 if present.
  const rawV2 = asRecord(safeParse(window.localStorage.getItem(STORAGE_KEY_V2)));
  if (rawV2 && rawV2.version === 2) {
    const migrated = migrateFromV2ToV3(rawV2);
    saveMoneyPerspectiveSettings(migrated);
    return migrated;
  }

  // Migrate from v1 if present.
  const rawV1 = asRecord(safeParse(window.localStorage.getItem(STORAGE_KEY_V1)));
  if (rawV1 && rawV1.version === 1) {
    const migrated = migrateFromV1ToV3(rawV1);
    saveMoneyPerspectiveSettings(migrated);
    return migrated;
  }

  return defaults;
}

export function saveMoneyPerspectiveSettings(settings: MoneyPerspectiveSettingsV3): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
