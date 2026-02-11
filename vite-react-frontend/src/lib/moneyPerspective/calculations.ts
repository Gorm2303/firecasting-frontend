export type MoneyPerspectiveError = {
  kind:
    | 'missing_purchase_amount'
    | 'missing_hourly_rate'
    | 'missing_core_expenses'
    | 'missing_monthly_benefit'
    | 'invalid_inputs';
  message: string;
};

export const DAYS_PER_MONTH = 365 / 12;

const isFinitePositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export const pctToRate = (pct: number): number => pct / 100;

export function deriveHourlyRateFromMonthly(netMonthlyIncome: number, workingHoursPerMonth: number): number | null {
  if (!isFinitePositive(netMonthlyIncome) || !isFinitePositive(workingHoursPerMonth)) return null;
  return netMonthlyIncome / workingHoursPerMonth;
}

export function deriveDailyCoreExpenseFromMonthly(monthlyCoreExpense: number): number | null {
  if (!isFinitePositive(monthlyCoreExpense)) return null;
  return monthlyCoreExpense / DAYS_PER_MONTH;
}

export function workHours(purchaseAmount: number, effectiveHourlyRate: number): number | null {
  if (!isFinitePositive(purchaseAmount) || !isFinitePositive(effectiveHourlyRate)) return null;
  return purchaseAmount / effectiveHourlyRate;
}

export function workDays(purchaseAmount: number, effectiveHourlyRate: number, hoursPerDay: number): number | null {
  if (!isFinitePositive(hoursPerDay)) return null;
  const hours = workHours(purchaseAmount, effectiveHourlyRate);
  if (hours == null) return null;
  return hours / hoursPerDay;
}

export function coreExpenseDays(purchaseAmount: number, dailyCoreExpense: number): number | null {
  if (!isFinitePositive(purchaseAmount) || !isFinitePositive(dailyCoreExpense)) return null;
  return purchaseAmount / dailyCoreExpense;
}

export function coreExpenseWeeks(purchaseAmount: number, dailyCoreExpense: number): number | null {
  const days = coreExpenseDays(purchaseAmount, dailyCoreExpense);
  if (days == null) return null;
  return days / 7;
}

export function coreExpenseMonths(purchaseAmount: number, dailyCoreExpense: number): number | null {
  const days = coreExpenseDays(purchaseAmount, dailyCoreExpense);
  if (days == null) return null;
  return days / DAYS_PER_MONTH;
}

export function applySimpleFeeDragToAnnualReturn(annualReturnPct: number, feeDragPct: number | null | undefined): number {
  const fee = typeof feeDragPct === 'number' && Number.isFinite(feeDragPct) ? feeDragPct : 0;
  return annualReturnPct - fee;
}

export function futureValueNominal(
  purchaseAmount: number,
  annualReturnPct: number,
  compoundsPerYear: number,
  years: number,
  feeDragPct?: number | null
): number | null {
  if (!isFinitePositive(purchaseAmount)) return null;
  if (!(typeof annualReturnPct === 'number' && Number.isFinite(annualReturnPct))) return null;
  if (!isFinitePositive(compoundsPerYear) || !isFinitePositive(years)) return null;

  const netAnnualReturnPct = applySimpleFeeDragToAnnualReturn(annualReturnPct, feeDragPct);
  const r = pctToRate(netAnnualReturnPct);
  const m = compoundsPerYear;

  // Allow negative r (e.g., pessimistic return) as long as 1 + r/m stays positive.
  const step = 1 + r / m;
  if (!(step > 0)) return null;

  return purchaseAmount * Math.pow(step, m * years);
}

export function futureValueReal(nominalFutureValue: number, inflationPct: number, years: number): number | null {
  if (!(typeof nominalFutureValue === 'number' && Number.isFinite(nominalFutureValue))) return null;
  if (!(typeof inflationPct === 'number' && Number.isFinite(inflationPct))) return null;
  if (!isFinitePositive(years)) return null;

  const i = pctToRate(inflationPct);
  const denom = Math.pow(1 + i, years);
  if (!(denom > 0)) return null;
  return nominalFutureValue / denom;
}

export function futureValueNominalRecurringMonthly(
  contributionPerMonth: number,
  annualReturnPct: number,
  years: number,
  feeDragPct?: number | null
): number | null {
  // Allows years=0 (FV=0) and contribution > 0.
  if (!(typeof contributionPerMonth === 'number' && Number.isFinite(contributionPerMonth) && contributionPerMonth > 0)) return null;
  if (!(typeof annualReturnPct === 'number' && Number.isFinite(annualReturnPct))) return null;
  if (!(typeof years === 'number' && Number.isFinite(years) && years >= 0)) return null;

  const netAnnualReturnPct = applySimpleFeeDragToAnnualReturn(annualReturnPct, feeDragPct);
  const r = pctToRate(netAnnualReturnPct);
  const m = 12;
  const n = Math.round(m * years);
  if (n <= 0) return 0;

  const step = 1 + r / m;
  if (!(step > 0)) return null;

  const i = r / m;
  if (i === 0) return contributionPerMonth * n;

  return contributionPerMonth * ((Math.pow(step, n) - 1) / i);
}

export function equivalentCoreExpenseDaysInYearN(futureValue: number, dailyCoreExpense: number): number | null {
  if (!(typeof futureValue === 'number' && Number.isFinite(futureValue))) return null;
  if (!isFinitePositive(dailyCoreExpense)) return null;
  return futureValue / dailyCoreExpense;
}

export function breakEvenMonths(purchaseAmount: number, monthlyBenefitMoney: number): number | null {
  if (!isFinitePositive(purchaseAmount) || !isFinitePositive(monthlyBenefitMoney)) return null;
  return purchaseAmount / monthlyBenefitMoney;
}

export function monthlyBenefitMoneyFromHours(hoursSavedPerMonth: number, effectiveHourlyRate: number): number | null {
  if (!isFinitePositive(hoursSavedPerMonth) || !isFinitePositive(effectiveHourlyRate)) return null;
  return hoursSavedPerMonth * effectiveHourlyRate;
}
