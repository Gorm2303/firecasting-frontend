import { describe, expect, it } from 'vitest';

import {
  filterUsedByForAssumptionsHub,
  getRegistryEnumOptions,
  isNumericRegistryUnit,
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
    expect(getRegistryEnumOptions('withdrawalStrategyDefaults.withdrawalRule')).toEqual(['fixedPct', 'fixedReal', 'guardrails']);
    expect(getRegistryEnumOptions('unknown.path')).toBeNull();
  });

  it('detects numeric registry units', () => {
    expect(isNumericRegistryUnit('pct')).toBe(true);
    expect(isNumericRegistryUnit('dkkPerMonth')).toBe(true);
    expect(isNumericRegistryUnit('enum')).toBe(false);
    expect(isNumericRegistryUnit('boolean')).toBe(false);
  });
});import { describe, expect, it } from 'vitest';

import { filterUsedByForAssumptionsHub, normalizeUsedByLabels } from './assumptionsRegistry';

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
});
