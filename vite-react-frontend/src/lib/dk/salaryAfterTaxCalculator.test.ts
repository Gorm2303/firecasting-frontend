import { describe, expect, it } from 'vitest';
import { calculateSalaryAfterTax } from './salaryAfterTaxCalculator';

const baseInputs = {
  year: 2026 as const,
  grossAmount: 0,
  grossPeriod: 'annual' as const,
  employeePensionRate: 0,
  atpAnnualDkk: 0,
  otherDeductionsAnnualDkk: 0,
  municipalTaxRate: 0.25,
  churchTaxRate: 0.008,
  churchMember: false,
};

describe('calculateSalaryAfterTax (DK 2026)', () => {
  it('handles zero income deterministically', () => {
    const r = calculateSalaryAfterTax({ ...baseInputs, grossAmount: 0 });
    expect(r.grossAnnualDkk).toBe(0);
    expect(r.totalTaxAnnualDkk).toBe(0);
    expect(r.netAnnualDkk).toBe(0);
  });

  it('applies AM-bidrag after pension/ATP deductions', () => {
    const r = calculateSalaryAfterTax({
      ...baseInputs,
      grossAmount: 100_000,
      employeePensionRate: 0.10,
      atpAnnualDkk: 1_000,
    });

    // AM base = 100,000 - 10,000 - 1,000 = 89,000
    expect(r.amBaseAnnualDkk).toBe(89_000);
    // AM = 8% of 89,000 = 7,120
    expect(r.amBidragAnnualDkk).toBe(7_120);
  });

  it('keeps mellemskat/topskat/toptopskat at 0 below thresholds', () => {
    const r = calculateSalaryAfterTax({ ...baseInputs, grossAmount: 600_000 });
    expect(r.mellemskatAnnualDkk).toBe(0);
    expect(r.topskatAnnualDkk).toBe(0);
    expect(r.toptopskatAnnualDkk).toBe(0);
  });

  it('starts mellemskat when personal income after AM crosses 641,200', () => {
    // Choose gross so that personalIncomeAfterAM is just above the threshold.
    // personalIncomeAfterAM = gross*(1-0.08) = gross*0.92 (no pension/ATP)
    // Because we round each tax line-item to nearest DKK, we need enough headroom
    // so (income - threshold) * 7.5% rounds to at least 1 DKK.
    const gross = Math.ceil((641_200 + 20) / 0.92);
    const r = calculateSalaryAfterTax({ ...baseInputs, grossAmount: gross });
    expect(r.personalIncomeAfterAmAnnualDkk).toBeGreaterThan(641_200);
    expect(r.mellemskatAnnualDkk).toBeGreaterThan(0);
  });

  it('computes jobfradrag only above 235,200 and caps at 3,100', () => {
    const rBelow = calculateSalaryAfterTax({ ...baseInputs, grossAmount: 200_000 });
    expect(rBelow.jobfradragAnnualDkk).toBe(0);

    const rHigh = calculateSalaryAfterTax({ ...baseInputs, grossAmount: 2_000_000 });
    expect(rHigh.jobfradragAnnualDkk).toBe(3_100);
  });

  it('caps beskæftigelsesfradrag at 63,300', () => {
    const r = calculateSalaryAfterTax({ ...baseInputs, grossAmount: 2_000_000 });
    expect(r.beskaeftigelsesfradragAnnualDkk).toBe(63_300);
  });

  it('includes church tax only when churchMember is enabled', () => {
    const off = calculateSalaryAfterTax({ ...baseInputs, grossAmount: 500_000, churchMember: false });
    const on = calculateSalaryAfterTax({ ...baseInputs, grossAmount: 500_000, churchMember: true });
    expect(off.churchTaxAnnualDkk).toBe(0);
    expect(on.churchTaxAnnualDkk).toBeGreaterThan(0);
  });
});
