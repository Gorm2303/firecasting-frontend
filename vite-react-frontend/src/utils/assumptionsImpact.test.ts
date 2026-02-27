import { describe, expect, it } from 'vitest';

import type { Assumptions } from '../state/assumptions';
import { computeAssumptionsImpact, computeAssumptionsImpactSensitivity } from './assumptionsImpact';

const a = (overrides: Partial<Assumptions> = {}): Assumptions => {
  return {
    currency: 'DKK',
    inflationPct: 2,
    yearlyFeePct: 0.5,
    expectedReturnPct: 5,
    safeWithdrawalPct: 4,
    taxExemptionDefaults: {
      exemptionCardLimit: 51_600,
      exemptionCardYearlyIncrease: 1_000,
      stockExemptionTaxRate: 27,
      stockExemptionLimit: 67_500,
      stockExemptionYearlyIncrease: 1_000,
    },
    salaryTaxatorDefaults: {
      municipalityId: 'average',
      defaultMunicipalTaxRatePct: 25,
      churchMember: false,
      employeePensionRatePct: 0,
      otherDeductionsAnnualDkk: 0,
      atpMonthlyDkk: 99,
      atpEligibilityGrossMonthlyThresholdDkk: 2_340,
    },
    moneyPerspectiveDefaults: {
      workingHoursPerMonth: 160,
      payRaisePct: 2,
      timeHorizonYears: 10,
      coreExpenseMonthlyDkk: 12_000,
    },
    ...(overrides as any),
  } as Assumptions;
};

describe('computeAssumptionsImpact', () => {
  it('computes FI number and safe spending per 1M', () => {
    const impact = computeAssumptionsImpact(a());

    // safe monthly spend per 1M at 4% SWR
    expect(impact.safeMonthlySpendPer1MDkk).toBeCloseTo(1_000_000 * 0.04 / 12, 6);

    // FI number = annual expense / swr
    expect(impact.fiNumberDkk).toBeCloseTo((12_000 * 12) / 0.04, 6);
  });

  it('computes approximate real return using net nominal return and inflation', () => {
    const impact = computeAssumptionsImpact(a({ expectedReturnPct: 6, yearlyFeePct: 1, inflationPct: 2 }));

    // nominal net = 5%; real approx = (1.05/1.02)-1 ≈ 2.941%
    expect(impact.nominalNetReturnPct).toBeCloseTo(5, 6);
    expect(impact.approxRealReturnPct).toBeCloseTo(((1.05 / 1.02) - 1) * 100, 4);
  });

  it('handles zero SWR by returning null FI number', () => {
    const impact = computeAssumptionsImpact(a({ safeWithdrawalPct: 0 }));
    expect(impact.fiNumberDkk).toBeNull();
  });
});

describe('computeAssumptionsImpactSensitivity', () => {
  it('produces expected deltas for return/fee/inflation/SWR bumps', () => {
    const base = a({
      inflationPct: 2,
      yearlyFeePct: 0.5,
      expectedReturnPct: 5,
      safeWithdrawalPct: 4,
      moneyPerspectiveDefaults: {
        workingHoursPerMonth: 160,
        payRaisePct: 2,
        timeHorizonYears: 10,
        coreExpenseMonthlyDkk: 12_000,
      },
    });

    const s = computeAssumptionsImpactSensitivity(base);
    expect(s.rows).toHaveLength(4);

    const byLabel = Object.fromEntries(s.rows.map((r) => [r.label, r] as const));

    expect(byLabel['+1pp expected return']!.deltaFromBase.nominalNetReturnPct).toBeCloseTo(1, 8);
    expect(byLabel['+0.5pp yearly fee']!.deltaFromBase.nominalNetReturnPct).toBeCloseTo(-0.5, 8);

    // +1pp inflation reduces approx real return (net unchanged, denominator increases)
    expect(byLabel['+1pp inflation']!.deltaFromBase.approxRealReturnPct).toBeLessThan(0);

    // +0.5pp SWR increases safe spend per 1M by exactly 1_000_000*(0.5%)/12
    expect(byLabel['+0.5pp safe withdrawal rate']!.deltaFromBase.safeMonthlySpendPer1MDkk).toBeCloseTo(
      (1_000_000 * 0.005) / 12,
      6
    );
    // and reduces FI number
    const fiDelta = byLabel['+0.5pp safe withdrawal rate']!.deltaFromBase.fiNumberDkk;
    expect(fiDelta).not.toBeNull();
    expect(fiDelta as number).toBeLessThan(0);
  });
});
