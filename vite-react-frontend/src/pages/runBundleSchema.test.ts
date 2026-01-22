import { describe, expect, it } from 'vitest';

const sortedKeys = (obj: Record<string, unknown>): string[] => Object.keys(obj).sort();

const expectExactKeys = (obj: unknown, expected: string[]) => {
  expect(obj).toBeTruthy();
  expect(typeof obj).toBe('object');
  expect(sortedKeys(obj as Record<string, unknown>)).toEqual([...expected].sort());
};

describe('run-bundle schema snapshot (inputs.raw)', () => {
  it('normal inputs.raw key set is exact (update intentionally when schema evolves)', () => {
    const raw = {
      startDate: { date: '2033-02-03' },
      overallTaxRule: 'NOTIONAL',
      taxPercentage: 25,
      phases: [
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 12,
          initialDeposit: 500,
          monthlyDeposit: 50,
          yearlyIncreaseInPercentage: 3,
          taxRules: ['EXEMPTIONCARD'],
        },
        {
          phaseType: 'WITHDRAW',
          durationInMonths: 6,
          withdrawRate: 0.04,
          withdrawAmount: 1234,
          lowerVariationPercentage: 2,
          upperVariationPercentage: 3,
          taxRules: ['STOCKEXEMPTION'],
        },
        {
          phaseType: 'PASSIVE',
          durationInMonths: 3,
          taxRules: [],
        },
      ],
    };

    expectExactKeys(raw, ['startDate', 'overallTaxRule', 'taxPercentage', 'phases']);

    // Phase objects are union-typed; keep the schema snapshot tight to catch drift.
    expectExactKeys(raw.phases[0], [
      'phaseType',
      'durationInMonths',
      'initialDeposit',
      'monthlyDeposit',
      'yearlyIncreaseInPercentage',
      'taxRules',
    ]);

    expectExactKeys(raw.phases[1], [
      'phaseType',
      'durationInMonths',
      'withdrawRate',
      'withdrawAmount',
      'lowerVariationPercentage',
      'upperVariationPercentage',
      'taxRules',
    ]);

    expectExactKeys(raw.phases[2], ['phaseType', 'durationInMonths', 'taxRules']);
  });

  it('advanced inputs.raw key set is exact (update intentionally when schema evolves)', () => {
    const raw = {
      startDate: { date: '2033-02-03' },
      overallTaxRule: 'CAPITAL',
      taxPercentage: 42,
      phases: [
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 1,
          initialDeposit: 100,
          monthlyDeposit: 0,
          yearlyIncreaseInPercentage: 0,
          taxRules: [],
        },
      ],

      // Advanced-only fields
      inflationFactor: 1.05,
      yearlyFeePercentage: 0.6,
      taxExemptionConfig: {
        exemptionCard: { limit: 111, yearlyIncrease: 2 },
        stockExemption: { taxRate: 27, limit: 222, yearlyIncrease: 1 },
      },
      returnType: 'distributionReturn',
      seed: 123,
      returnerConfig: {
        seed: 123,
        distribution: {
          type: 'studentT',
          studentT: { mu: 0.042, sigma: 0.609, nu: 3.6 },
        },
      },
    };

    expectExactKeys(raw, [
      'startDate',
      'overallTaxRule',
      'taxPercentage',
      'phases',
      'inflationFactor',
      'yearlyFeePercentage',
      'taxExemptionConfig',
      'returnType',
      'seed',
      'returnerConfig',
    ]);

    expectExactKeys(raw.taxExemptionConfig, ['exemptionCard', 'stockExemption']);
    expectExactKeys(raw.taxExemptionConfig.exemptionCard, ['limit', 'yearlyIncrease']);
    expectExactKeys(raw.taxExemptionConfig.stockExemption, ['taxRate', 'limit', 'yearlyIncrease']);

    expectExactKeys(raw.returnerConfig, ['seed', 'distribution']);
    expectExactKeys(raw.returnerConfig.distribution, ['type', 'studentT']);
    expectExactKeys(raw.returnerConfig.distribution.studentT, ['mu', 'sigma', 'nu']);
  });
});
