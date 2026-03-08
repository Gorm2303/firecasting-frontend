import { describe, expect, it } from 'vitest';

import {
  convertSalaryAmountBetweenPeriods,
  monthlyEquivalentFromSalaryAmount,
  salaryAmountFromMonthlyEquivalent,
} from './sharedSalary';

describe('sharedSalary', () => {
  it('converts salary references to monthly equivalents across supported periods', () => {
    expect(monthlyEquivalentFromSalaryAmount(200, 'hourly', 160)).toBe(32_000);
    expect(monthlyEquivalentFromSalaryAmount(2_500, 'biweekly', 160)).toBeCloseTo((2_500 * 26) / 12, 8);
    expect(monthlyEquivalentFromSalaryAmount(60_000, 'yearly', 160)).toBe(5_000);
  });

  it('converts monthly salary references back into target periods', () => {
    expect(salaryAmountFromMonthlyEquivalent(32_000, 'hourly', 160)).toBe(200);
    expect(salaryAmountFromMonthlyEquivalent(6_500, 'biweekly', 160)).toBeCloseTo((6_500 * 12) / 26, 8);
    expect(salaryAmountFromMonthlyEquivalent(5_000, 'yearly', 160)).toBe(60_000);
  });

  it('converts directly between salary periods with a shared interpretation', () => {
    expect(convertSalaryAmountBetweenPeriods(200, 'hourly', 'monthly', 160)).toBe(32_000);
    expect(convertSalaryAmountBetweenPeriods(39_000, 'monthly', 'biweekly', 160)).toBeCloseTo((39_000 * 12) / 26, 8);
  });
});