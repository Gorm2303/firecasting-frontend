import { describe, expect, it } from 'vitest';
import { createDefaultPhase, createDefaultSimulationRequest, DEFAULT_TAX_PERCENTAGE } from '../config/simulationDefaults';
import { decodeScenarioFromShareParam, encodeScenarioToShareParam, normalizeDecodedScenario } from './shareScenarioLink';

const toBase64Url = (json: string): string => {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = globalThis.btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

describe('shareScenarioLink', () => {
  it('encodes and decodes a maximal request (round-trip)', () => {
    const request = {
      startDate: { date: '2040-01-01' },
      overallTaxRule: 'NOTIONAL' as const,
      taxPercentage: 30,
      phases: [
        {
          ...createDefaultPhase('DEPOSIT'),
          durationInMonths: 12,
          initialDeposit: 100,
          monthlyDeposit: 10,
          yearlyIncreaseInPercentage: 1,
          taxRules: ['EXEMPTIONCARD'],
        },
        {
          ...createDefaultPhase('WITHDRAW'),
          durationInMonths: 6,
          withdrawRate: 0.04,
          withdrawAmount: 1234,
          lowerVariationPercentage: 2,
          upperVariationPercentage: 3,
          taxRules: ['STOCKEXEMPTION'],
        },
        {
          ...createDefaultPhase('PASSIVE'),
          durationInMonths: 3,
          taxRules: [],
        },
      ],
    };

    const param = encodeScenarioToShareParam(request);
    const decoded = decodeScenarioFromShareParam(param);

    expect(decoded).toEqual(request);
  });

  it('decodes legacy base64url payloads (backward compatibility)', () => {
    const request = {
      startDate: { date: '2030-12-31' },
      overallTaxRule: 'CAPITAL' as const,
      taxPercentage: 42,
      phases: [
        {
          ...createDefaultPhase('PASSIVE'),
          durationInMonths: 1,
          taxRules: [],
        },
      ],
    };

    const legacy = toBase64Url(JSON.stringify(request));
    const decoded = decodeScenarioFromShareParam(legacy);
    expect(decoded).toEqual(request);
  });

  it('ignores unknown fields (forward compatibility)', () => {
    const decoded = normalizeDecodedScenario({
      startDate: { date: '2031-02-03' },
      overallTaxRule: 'CAPITAL',
      taxPercentage: 12,
      someNewTopLevelField: { nested: true },
      phases: [
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 1,
          initialDeposit: 100,
          monthlyDeposit: 0,
          yearlyIncreaseInPercentage: 0,
          taxRules: [],
          someNewPhaseField: 999,
        },
      ],
    });

    expect(decoded).not.toBeNull();
    expect(decoded!.startDate.date).toBe('2031-02-03');
    expect(decoded!.taxPercentage).toBe(12);
    expect(decoded!.phases).toHaveLength(1);
    expect(decoded!.phases[0].phaseType).toBe('DEPOSIT');
  });

  it('has an explicit key contract for SimulationRequest and phases (fails when fields change)', () => {
    const req = createDefaultSimulationRequest();
    expect(Object.keys(req).sort()).toEqual(['overallTaxRule', 'phases', 'startDate', 'taxPercentage']);

    expect(Object.keys(createDefaultPhase('DEPOSIT')).sort()).toEqual(
      ['durationInMonths', 'initialDeposit', 'monthlyDeposit', 'phaseType', 'taxRules', 'yearlyIncreaseInPercentage'].sort()
    );
    expect(Object.keys(createDefaultPhase('WITHDRAW')).sort()).toEqual(
      ['durationInMonths', 'lowerVariationPercentage', 'phaseType', 'taxRules', 'upperVariationPercentage', 'withdrawAmount', 'withdrawRate'].sort()
    );
    expect(Object.keys(createDefaultPhase('PASSIVE')).sort()).toEqual(['durationInMonths', 'phaseType', 'taxRules'].sort());
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
