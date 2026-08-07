import { describe, expect, it } from 'vitest';

import {
  filterUsedByForAssumptionsHub,
  getRegistryEnumOptions,
  isNumericRegistryUnit,
  listRegistryItemsByUsedBy,
  normalizeUsedByLabels,
} from './assumptionsRegistry';

describe('assumptionsRegistry helpers', () => {
  it('normalizeUsedByLabels trims, dedupes, and drops empties', () => {
    expect(normalizeUsedByLabels(['  A ', 'A', '  ', 'B', 'b', 'B'])).toEqual(['A', 'B', 'b']);
  });

  it('filterUsedByForAssumptionsHub removes hub-internal labels and dedupes', () => {
    const out = filterUsedByForAssumptionsHub([
      'AssumptionsHub',
      ' Assumptions Hub ',
      'AssumptionsSummaryBar',
      'MoneyPerspective',
      'MoneyPerspective',
    ]);

    expect(out).toEqual(['MoneyPerspective']);
  });

  it('returns shared enum options for registry-backed fields', () => {
    expect(getRegistryEnumOptions('incomeSetupDefaults.taxRegime')).toEqual(['DK', 'none']);
    expect(getRegistryEnumOptions('incomeSetupDefaults.referenceSalaryPeriod')).toEqual(['hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly']);
    expect(getRegistryEnumOptions('withdrawalStrategyDefaults.withdrawalRule')).toEqual(['fixedPct', 'fixedReal', 'guardrails']);
    expect(getRegistryEnumOptions('unknown.path')).toBeNull();
  });

  it('detects numeric registry units', () => {
    expect(isNumericRegistryUnit('pct')).toBe(true);
    expect(isNumericRegistryUnit('dkkPerMonth')).toBe(true);
    expect(isNumericRegistryUnit('enum')).toBe(false);
    expect(isNumericRegistryUnit('boolean')).toBe(false);
  });
  it('lists registry items by consumer label', () => {
    const salaryItems = listRegistryItemsByUsedBy('SalaryTaxator', { excludeCurrency: true });
    const salaryKeys = salaryItems.map((item) => item.keyPath);

    expect(salaryKeys).toContain('salaryTaxatorDefaults.defaultMunicipalTaxRatePct');
    expect(salaryKeys).toContain('salaryTaxatorDefaults.atpMonthlyDkk');
    expect(salaryKeys.every((key) => key !== 'currency')).toBe(true);

    const depositItems = listRegistryItemsByUsedBy('AssumptionsHub', { tabs: ['depositStrategy'] });
    expect(depositItems.every((item) => item.tab === 'depositStrategy')).toBe(true);
    expect(depositItems.some((item) => item.keyPath === 'depositStrategyDefaults.contributionCadence')).toBe(true);
  });
});
