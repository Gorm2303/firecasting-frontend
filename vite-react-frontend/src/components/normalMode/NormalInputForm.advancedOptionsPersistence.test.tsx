import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../api/simulation', () => {
  return {
    startSimulation: vi.fn().mockResolvedValue('test-sim-id'),
    startAdvancedSimulation: vi.fn().mockResolvedValue({ id: 'test-sim-id', createdAt: '2026-01-01T00:00:00Z', rngSeed: 123 }),
    exportSimulationCsv: vi.fn(),
    findRunForInput: vi.fn().mockResolvedValue(null),
  };
});

import SimulationForm from './NormalInputForm';
import { AssumptionsProvider, getDefaultAssumptions } from '../../state/assumptions';
import { ExecutionDefaultsProvider } from '../../state/executionDefaults';

const ADVANCED_OPTIONS_KEY = 'firecasting:advancedOptions:v1';
const EXECUTION_DEFAULTS_KEY = 'firecasting:executionDefaults:v1';

describe('NormalInputForm advanced options persistence', () => {
  it('persists all advanced fields to localStorage (key contract)', async () => {
    window.localStorage.clear();

    const assumptions = getDefaultAssumptions();
    window.localStorage.setItem(
      'firecasting:assumptions:v2',
      JSON.stringify({ current: assumptions, draft: assumptions })
    );

    render(
      <AssumptionsProvider>
        <ExecutionDefaultsProvider>
          <SimulationForm mode="advanced" advancedFeatureFlags={{ execution: true, inflation: true, fee: true, exemptions: true, returnModel: true }} />
        </ExecutionDefaultsProvider>
      </AssumptionsProvider>
    );

    // Wait for advanced fields to appear (mode->advancedEnabled effect).
    await waitFor(() => {
      expect(screen.getByLabelText(/Inflation \(avg %/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Fee \(avg %/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Return type/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Inflation \(avg %/i)).toBeDisabled();
    expect(screen.getByLabelText(/Fee \(avg %/i)).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Return type/i), { target: { value: 'distributionReturn' } });
    fireEvent.change(screen.getByLabelText(/Master seed/i), { target: { value: 'custom' } });
    const seedLabel = screen.getByText(/Master seed/i).closest('label');
    const seedInput = seedLabel?.querySelector('input') as HTMLInputElement | null;
    expect(seedInput).toBeTruthy();
    fireEvent.change(seedInput as HTMLInputElement, { target: { value: '123' } });

    await waitFor(() => {
      const raw = window.localStorage.getItem(ADVANCED_OPTIONS_KEY);
      expect(raw).toBeTruthy();
    });

    const parsed = JSON.parse(window.localStorage.getItem(ADVANCED_OPTIONS_KEY) as string);

    // This is intentionally explicit so adding/removing advanced fields breaks tests.
    expect(Object.keys(parsed).sort()).toEqual(
      [
        'enabled',
        'returnType',
        'seed',
        'simpleAveragePercentage',
        'distributionType',
        'normalMean',
        'normalStdDev',
        'brownianDrift',
        'brownianVolatility',
        'studentMu',
        'studentSigma',
        'studentNu',
        'regimeTickMonths',
        'regimes',
        'exemptionCardLimit',
        'exemptionCardYearlyIncrease',
        'stockExemptionTaxRate',
        'stockExemptionLimit',
        'stockExemptionYearlyIncrease',
      ].sort()
    );

    expect(parsed.inflationAveragePct).toBeUndefined();
    expect(parsed.yearlyFeePercentage).toBeUndefined();
    expect(parsed.returnType).toBe('distributionReturn');
    expect(String(parsed.seed)).toBe('123');

    const execDefaults = JSON.parse(window.localStorage.getItem(EXECUTION_DEFAULTS_KEY) as string);
    expect(execDefaults.seedMode).toBe('custom');
  });

  it('rehydrates advanced fields from localStorage (round-trip)', async () => {
    window.localStorage.clear();

    const assumptions = { ...getDefaultAssumptions(), inflationPct: 3, yearlyFeePct: 0.75 };
    window.localStorage.setItem(
      'firecasting:assumptions:v2',
      JSON.stringify({ current: assumptions, draft: assumptions })
    );

    window.localStorage.setItem(
      ADVANCED_OPTIONS_KEY,
      JSON.stringify({
        enabled: true,
        inflationAveragePct: 7,
        yearlyFeePercentage: 1.25,
        returnType: 'distributionReturn',
        seedMode: 'custom',
        seed: '999',
        simpleAveragePercentage: '6',
        distributionType: 'studentT',
        normalMean: '0.07',
        normalStdDev: '0.2',
        brownianDrift: '0.07',
        brownianVolatility: '0.2',
        studentMu: '0.042',
        studentSigma: '0.609',
        studentNu: '3.6',
        regimeTickMonths: '12',
        regimes: [],
        exemptionCardLimit: '123',
        exemptionCardYearlyIncrease: '2',
        stockExemptionTaxRate: '27',
        stockExemptionLimit: '456',
        stockExemptionYearlyIncrease: '1',
      })
    );

    render(
      <AssumptionsProvider>
        <ExecutionDefaultsProvider>
          <SimulationForm mode="advanced" advancedFeatureFlags={{ execution: true, inflation: true, fee: true, exemptions: true, returnModel: true }} />
        </ExecutionDefaultsProvider>
      </AssumptionsProvider>
    );

    await waitFor(() => {
      expect((screen.getByLabelText(/Inflation \(avg %/i) as HTMLInputElement).value).toBe('3');
      expect((screen.getByLabelText(/Fee \(avg %/i) as HTMLInputElement).value).toBe('0.75');
    });

    // Exemptions fields have duplicate labels, so validate by checking that at least
    // one of the "Limit" inputs matches the stored values.
    const limitInputs = screen.getAllByLabelText(/^Limit$/i) as HTMLInputElement[];
    const limitValues = limitInputs.map((i) => i.value);
    expect(limitValues).toContain('123');
    expect(limitValues).toContain('456');
  });
});
