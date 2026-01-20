import { describe, expect, it } from 'vitest';
import { DEFAULT_TAX_PERCENTAGE } from '../config/simulationDefaults';
import { decodeScenarioFromShareParam, encodeScenarioToShareParam, normalizeDecodedScenario } from './shareScenarioLink';

describe('shareScenarioLink', () => {
  it('encodes and decodes a request (round-trip)', () => {
    const request = {
      startDate: { date: '2040-01-01' },
      overallTaxRule: 'NOTIONAL' as const,
      taxPercentage: 30,
      phases: [
        {
          phaseType: 'DEPOSIT' as const,
          durationInMonths: 12,
          initialDeposit: 100,
          monthlyDeposit: 10,
          yearlyIncreaseInPercentage: 1,
          taxRules: ['EXEMPTIONCARD'] as const,
        },
      ],
    };

    const param = encodeScenarioToShareParam(request);
    const decoded = decodeScenarioFromShareParam(param);

    expect(decoded).toEqual(request);
  });

  it('fills defaults and normalizes phases when decoding', () => {
    const decoded = normalizeDecodedScenario({
      startDate: { date: '2031-02-03' },
      overallTaxRule: 'CAPITAL',
      phases: [
        {
          phaseType: 'WITHDRAW',
          durationInMonths: 6,
          // omit withdrawRate/withdrawAmount: normalizePhase should restore a valid default combination
        },
      ],
    });

    expect(decoded).not.toBeNull();
    expect(decoded!.taxPercentage).toBe(DEFAULT_TAX_PERCENTAGE);
    expect(decoded!.phases[0].phaseType).toBe('WITHDRAW');
    expect(typeof decoded!.phases[0].withdrawAmount).toBe('number');
    expect(typeof decoded!.phases[0].withdrawRate).toBe('number');
  });
});
