import { describe, expect, it } from 'vitest';

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
