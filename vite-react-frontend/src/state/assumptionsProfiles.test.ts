import { describe, expect, it } from 'vitest';

import type { Assumptions } from './assumptions';
import {
  deleteAssumptionsProfile,
  listAssumptionsProfiles,
  saveAssumptionsProfile,
} from './assumptionsProfiles';

const key = 'firecasting:assumptionsProfiles:v1';

const a = (overrides: Partial<Assumptions> = {}): Assumptions => {
  // Minimal shape for this test: only needs to be truthy and carry a few fields.
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

describe('assumptionsProfiles', () => {
  it('starts empty when storage empty', () => {
    window.localStorage.removeItem(key);
    expect(listAssumptionsProfiles()).toEqual([]);
  });

  it('can save, list, overwrite by name, and delete', () => {
    window.localStorage.clear();

    const p1 = saveAssumptionsProfile('Baseline', a({ inflationPct: 2 }));
    expect(p1.name).toBe('Baseline');

    const list1 = listAssumptionsProfiles();
    expect(list1.length).toBe(1);
    expect(list1[0].name).toBe('Baseline');

    const p2 = saveAssumptionsProfile(' baseline ', a({ inflationPct: 3 }));
    expect(p2.id).toBe(p1.id);

    const list2 = listAssumptionsProfiles();
    expect(list2.length).toBe(1);
    expect(list2[0].assumptions.inflationPct).toBe(3);

    deleteAssumptionsProfile(p2.id);
    expect(listAssumptionsProfiles()).toEqual([]);
  });
});
