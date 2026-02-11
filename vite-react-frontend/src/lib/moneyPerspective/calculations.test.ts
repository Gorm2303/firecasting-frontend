import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_MONTH,
  applySimpleFeeDragToAnnualReturn,
  breakEvenMonths,
  coreExpenseDays,
  coreExpenseMonths,
  coreExpenseWeeks,
  deriveDailyCoreExpenseFromMonthly,
  deriveHourlyRateFromMonthly,
  equivalentCoreExpenseDaysInYearN,
  futureValueNominal,
  futureValueNominalRecurringMonthly,
  futureValueReal,
  monthlyBenefitMoneyFromHours,
  workDays,
  workHours,
} from './calculations';

describe('moneyPerspective/calculations', () => {
  it('derives hourly rate from monthly income and hours', () => {
    expect(deriveHourlyRateFromMonthly(10_000, 100)).toBe(100);
    expect(deriveHourlyRateFromMonthly(10_000, 0)).toBeNull();
  });

  it('derives daily core expense from monthly core expense', () => {
    const daily = deriveDailyCoreExpenseFromMonthly(30_416.6666667);
    expect(daily).not.toBeNull();
    expect(daily as number).toBeCloseTo(1_000, 6);
    expect(DAYS_PER_MONTH).toBeCloseTo(30.4166666, 6);
  });

  it('computes work hours and work days', () => {
    expect(workHours(1_000, 50)).toBeCloseTo(20, 8);
    expect(workDays(1_000, 50, 8)).toBeCloseTo(2.5, 8);
    expect(workDays(1_000, 50, 0)).toBeNull();
  });

  it('computes core-expense runway in days/weeks/months', () => {
    expect(coreExpenseDays(1_000, 100)).toBeCloseTo(10, 8);
    expect(coreExpenseWeeks(1_000, 100)).toBeCloseTo(10 / 7, 8);
    expect(coreExpenseMonths(1_000, 100)).toBeCloseTo(10 / DAYS_PER_MONTH, 8);
  });

  it('applies a simple fee drag as pct-point subtraction', () => {
    expect(applySimpleFeeDragToAnnualReturn(6, 1)).toBe(5);
    expect(applySimpleFeeDragToAnnualReturn(6, null)).toBe(6);
  });

  it('computes nominal and real future value with monthly compounding', () => {
    const fv = futureValueNominal(1_000, 6, 12, 10, 0);
    expect(fv).not.toBeNull();
    // 1000*(1+0.06/12)^(12*10) ≈ 1819.3967
    expect(fv as number).toBeCloseTo(1_819.397, 2);

    const real = futureValueReal(fv as number, 2, 10);
    expect(real).not.toBeNull();
    // nominal / 1.02^10 ≈ 1492.54
    expect(real as number).toBeCloseTo(1_492.54, 2);
  });

  it('computes nominal future value for recurring monthly contributions', () => {
    // 100/month, 6% annual, 10 years, monthly compounding.
    const fv = futureValueNominalRecurringMonthly(100, 6, 10, 0);
    expect(fv).not.toBeNull();
    // Ordinary annuity FV: P * (((1 + r/12)^(120) - 1) / (r/12))
    // ≈ 16,387.9347
    expect(fv as number).toBeCloseTo(16_387.935, 2);
  });

  it('computes equivalent core-expense days in year N', () => {
    expect(equivalentCoreExpenseDaysInYearN(1_500, 100)).toBeCloseTo(15, 8);
    expect(equivalentCoreExpenseDaysInYearN(Number.NaN, 100)).toBeNull();
  });

  it('computes break-even months from monthly benefit', () => {
    expect(breakEvenMonths(1_000, 100)).toBeCloseTo(10, 8);
    expect(breakEvenMonths(1_000, 0)).toBeNull();
  });

  it('converts hours saved/month into monetary benefit', () => {
    expect(monthlyBenefitMoneyFromHours(5, 50)).toBe(250);
    expect(monthlyBenefitMoneyFromHours(0, 50)).toBeNull();
  });
});
