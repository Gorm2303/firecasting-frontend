import { describe, expect, it } from 'vitest';

import type { Assumptions } from './assumptions';
import { appendAssumptionsHistory, clearAssumptionsHistory, listAssumptionsHistory } from './assumptionsHistory';

const key = 'firecasting:assumptionsHistory:v1';

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
      atpEligibilityGrossMonthlyThresholdDkk: 2340,
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

describe('assumptionsHistory', () => {
  it('can append entries with an optional source note', () => {
    window.localStorage.removeItem(key);
    clearAssumptionsHistory();

    appendAssumptionsHistory(a({ inflationPct: 3 }), { sourceNote: 'From spreadsheet' });

    const list = listAssumptionsHistory();
    expect(list.length).toBe(1);
    expect(list[0].assumptions.inflationPct).toBe(3);
    expect(list[0].sourceNote).toBe('From spreadsheet');
  });
});
