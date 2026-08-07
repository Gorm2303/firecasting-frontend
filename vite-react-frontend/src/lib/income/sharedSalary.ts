export type SharedSalaryPeriod = 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

const DAYS_PER_MONTH = 365 / 12;
const WEEKS_PER_YEAR = 52;
const BIWEEKS_PER_YEAR = 26;

const toFinite = (value: number): number => (Number.isFinite(value) ? value : 0);

export function monthlyEquivalentFromSalaryAmount(
  amount: number,
  period: SharedSalaryPeriod,
  workingHoursPerMonth: number,
): number {
  const safeAmount = toFinite(amount);
  const safeWorkingHoursPerMonth = workingHoursPerMonth > 0 ? workingHoursPerMonth : 0;

  switch (period) {
    case 'hourly':
      return safeAmount * safeWorkingHoursPerMonth;
    case 'daily':
      return safeAmount * DAYS_PER_MONTH;
    case 'weekly':
      return (safeAmount * WEEKS_PER_YEAR) / 12;
    case 'biweekly':
      return (safeAmount * BIWEEKS_PER_YEAR) / 12;
    case 'monthly':
      return safeAmount;
    case 'yearly':
      return safeAmount / 12;
  }
}

export function salaryAmountFromMonthlyEquivalent(
  monthlyAmount: number,
  period: SharedSalaryPeriod,
  workingHoursPerMonth: number,
): number {
  const safeMonthlyAmount = toFinite(monthlyAmount);
  const safeWorkingHoursPerMonth = workingHoursPerMonth > 0 ? workingHoursPerMonth : 0;

  switch (period) {
    case 'hourly':
      return safeWorkingHoursPerMonth > 0 ? safeMonthlyAmount / safeWorkingHoursPerMonth : 0;
    case 'daily':
      return safeMonthlyAmount / DAYS_PER_MONTH;
    case 'weekly':
      return (safeMonthlyAmount * 12) / WEEKS_PER_YEAR;
    case 'biweekly':
      return (safeMonthlyAmount * 12) / BIWEEKS_PER_YEAR;
    case 'monthly':
      return safeMonthlyAmount;
    case 'yearly':
      return safeMonthlyAmount * 12;
  }
}

export function convertSalaryAmountBetweenPeriods(
  amount: number,
  fromPeriod: SharedSalaryPeriod,
  toPeriod: SharedSalaryPeriod,
  workingHoursPerMonth: number,
): number {
  const monthlyEquivalent = monthlyEquivalentFromSalaryAmount(amount, fromPeriod, workingHoursPerMonth);
  return salaryAmountFromMonthlyEquivalent(monthlyEquivalent, toPeriod, workingHoursPerMonth);
}