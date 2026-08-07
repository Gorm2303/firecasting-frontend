import { describe, expect, it } from 'vitest';

import {
  applyAssumptionsOverride,
  getDefaultAssumptions,
  hasMeaningfulAssumptionsOverride,
  normalizeAssumptionsOverride,
  type AssumptionsOverride,
} from './assumptions';

describe('assumptions override helpers', () => {
  it('treats empty nested objects as no override', () => {
    const override = { taxExemptionDefaults: {} } as AssumptionsOverride;
    expect(normalizeAssumptionsOverride(override)).toBeNull();
    expect(hasMeaningfulAssumptionsOverride(override)).toBe(false);
  });

  it('keeps meaningful nested overrides', () => {
    const override = {
      taxExemptionDefaults: {
        stockExemptionLimit: 123456,
      },
    } as AssumptionsOverride;

    expect(normalizeAssumptionsOverride(override)).toEqual(override);
    expect(hasMeaningfulAssumptionsOverride(override)).toBe(true);
  });

  it('applies only the overridden leaf values', () => {
    const base = getDefaultAssumptions();
    const next = applyAssumptionsOverride(base, {
      inflationPct: 3.5,
      taxExemptionDefaults: {
        stockExemptionTaxRate: 29,
      },
    });

    expect(next.inflationPct).toBe(3.5);
    expect(next.taxExemptionDefaults.stockExemptionTaxRate).toBe(29);
    expect(next.taxExemptionDefaults.stockExemptionLimit).toBe(base.taxExemptionDefaults.stockExemptionLimit);
  });
});
