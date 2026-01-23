import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
    startAdvancedSimulation: vi.fn().mockResolvedValue('test-sim-id'),
    exportSimulationCsv: vi.fn(),
  };
});

import SimulationForm, { type NormalInputFormHandle } from './NormalInputForm';
import { saveScenario } from '../../config/savedScenarios';
import { startSimulation } from '../../api/simulation';

describe('NormalInputForm scenarios', () => {
  it('saves and reloads a scenario with identical inputs', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('My scenario');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    window.localStorage.clear();

    const ref = React.createRef<NormalInputFormHandle>();
    render(<SimulationForm ref={ref} />);

    const startDate = screen.getByLabelText(/^Start Date:?$/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2033-02-03' } });

    act(() => {
      ref.current?.openSavedScenarios();
    });
    fireEvent.click(screen.getByRole('button', { name: /Save scenario/i }));

    // Change the form away from the saved config
    fireEvent.change(startDate, { target: { value: '2044-04-04' } });

    // Select saved scenario
    const dialog = screen.getByRole('dialog', { name: /Saved scenarios/i });
    const scenarioSelect = within(dialog).getByRole('combobox', { name: /^Scenario$/i }) as HTMLSelectElement;
    await waitFor(() => {
      expect(scenarioSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    fireEvent.change(scenarioSelect, { target: { value: scenarioSelect.querySelectorAll('option')[1].getAttribute('value') } });
    fireEvent.click(screen.getByRole('button', { name: /Load scenario/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    expect(startDate.value).toBe('2033-02-03');

    promptSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('loads a maximal saved scenario and runs with identical payload (contract test)', async () => {
    window.localStorage.clear();

    const request = {
      startDate: { date: '2033-02-03' },
      overallTaxRule: 'NOTIONAL' as const,
      taxPercentage: 25,
      phases: [
        {
          phaseType: 'DEPOSIT' as const,
          durationInMonths: 12,
          initialDeposit: 500,
          monthlyDeposit: 50,
          yearlyIncreaseInPercentage: 3,
          taxRules: ['EXEMPTIONCARD'] as const,
        },
        {
          phaseType: 'WITHDRAW' as const,
          durationInMonths: 6,
          withdrawRate: 0.04,
          withdrawAmount: 1234,
          lowerVariationPercentage: 2,
          upperVariationPercentage: 3,
          taxRules: ['STOCKEXEMPTION'] as const,
        },
        {
          phaseType: 'PASSIVE' as const,
          durationInMonths: 3,
          taxRules: [] as const,
        },
      ],
    };

    saveScenario('Maximal scenario', request as any);

    const ref = React.createRef<NormalInputFormHandle>();
    render(<SimulationForm ref={ref} />);

    act(() => {
      ref.current?.openSavedScenarios();
    });

    const dialog = screen.getByRole('dialog', { name: /Saved scenarios/i });
    const scenarioSelect = within(dialog).getByRole('combobox', { name: /^Scenario$/i }) as HTMLSelectElement;
    await waitFor(() => {
      expect(scenarioSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    const id = scenarioSelect.querySelectorAll('option')[1].getAttribute('value');
    fireEvent.change(scenarioSelect, { target: { value: id } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Load scenario/i }));

    // Loading a scenario auto-runs the simulation; assert payload equality — this is the core "all fields" contract.
    await waitFor(() => {
      expect(startSimulation).toHaveBeenCalled();
    });

    const lastCallArg = (startSimulation as any).mock.calls.at(-1)[0];
    expect(lastCallArg).toEqual(request);
  });

  it('compares two saved scenarios and highlights differences', async () => {
    window.localStorage.clear();

    navigateMock.mockClear();

    saveScenario(
      'Scenario A',
      {
        startDate: { date: '2033-02-03' },
        overallTaxRule: 'NOTIONAL',
        taxPercentage: 25,
        phases: [
          { phaseType: 'DEPOSIT', durationInMonths: 12, initialDeposit: 500, monthlyDeposit: 50 },
          { phaseType: 'PASSIVE', durationInMonths: 6 },
        ],
      } as any
    );
    saveScenario(
      'Scenario B',
      {
        startDate: { date: '2034-03-04' },
        overallTaxRule: 'CAPITAL',
        taxPercentage: 30,
        phases: [
          { phaseType: 'DEPOSIT', durationInMonths: 12, initialDeposit: 700, monthlyDeposit: 40 },
          { phaseType: 'WITHDRAW', durationInMonths: 12, withdrawAmount: 1000 },
        ],
      } as any
    );

    const ref = React.createRef<NormalInputFormHandle>();
    render(<SimulationForm ref={ref} />);

    act(() => {
      ref.current?.openSavedScenarios();
    });

    const dialog = screen.getByRole('dialog', { name: /Saved scenarios/i });
    const selects = within(dialog).getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects.length).toBeGreaterThanOrEqual(2);

    const primarySelect = selects[0];
    const compareSelect = selects[1];

    await waitFor(() => {
      expect(primarySelect.querySelectorAll('option').length).toBeGreaterThan(2);
    });

    const getOptionValue = (select: HTMLSelectElement, optionText: string) => {
      const opt = Array.from(select.options).find((o) => o.text === optionText);
      return opt?.value ?? '';
    };

    const aId = getOptionValue(primarySelect, 'Scenario A');
    const bId = getOptionValue(primarySelect, 'Scenario B');
    expect(aId).not.toBe('');
    expect(bId).not.toBe('');

    fireEvent.change(primarySelect, { target: { value: aId } });
    fireEvent.change(compareSelect, { target: { value: bId } });

    fireEvent.click(within(dialog).getByRole('button', { name: /Compare scenarios/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled();
    });

    const [path, opts] = navigateMock.mock.calls.at(-1) ?? [];
    expect(String(path)).toContain('/simulation/diff');
    expect(String(path)).toContain(`scenarioA=${encodeURIComponent(aId)}`);
    expect(String(path)).toContain(`scenarioB=${encodeURIComponent(bId)}`);
    expect(opts).toMatchObject({
      state: {
        scenarioA: expect.any(Object),
        scenarioB: expect.any(Object),
      },
    });
  });
});
