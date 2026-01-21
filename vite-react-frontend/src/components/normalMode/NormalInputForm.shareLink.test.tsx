import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../api/simulation', () => {
  return {
    startSimulation: vi.fn().mockResolvedValue('test-sim-id'),
    startAdvancedSimulation: vi.fn().mockResolvedValue('test-sim-id'),
    exportSimulationCsv: vi.fn(),
  };
});

import { startSimulation } from '../../api/simulation';
import SimulationForm, { type NormalInputFormHandle } from './NormalInputForm';
import { encodeScenarioToShareParam } from '../../utils/shareScenarioLink';

describe('NormalInputForm share links', () => {
  it('creates a share link for a saved scenario', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => 'My scenario');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    window.localStorage.clear();

    const ref = React.createRef<NormalInputFormHandle>();
    render(<SimulationForm ref={ref} />);

    act(() => {
      ref.current?.openSavedScenarios();
    });
    // 1st prompt call: scenario name
    fireEvent.click(screen.getByRole('button', { name: /Save scenario/i }));

    // Subsequent prompt calls: used as share-link fallback
    promptSpy.mockImplementation(() => '');

    const dialog = screen.getByRole('dialog', { name: /Saved scenarios/i });

    // pick the first saved scenario option
    const scenarioSelect = within(dialog).getByRole('combobox') as HTMLSelectElement;
    await waitFor(() => {
      expect(scenarioSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    const id = scenarioSelect.querySelectorAll('option')[1].getAttribute('value');
    fireEvent.change(scenarioSelect, { target: { value: id } });

    fireEvent.click(within(dialog).getByRole('button', { name: /Share scenario/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    const shareLinkInput = within(dialog).getByRole('textbox', { name: /Share link/i }) as HTMLInputElement;
    expect(shareLinkInput.value).toContain('/simulation');
    expect(shareLinkInput.value).toMatch(/\bscenario=/);

    const scenarioParam = new URL(shareLinkInput.value).searchParams.get('scenario');
    expect(scenarioParam).toMatch(/^z:/);

    promptSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('loads from /simulation?scenario=... and auto-runs', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const request = {
      startDate: { date: '2033-02-03' },
      overallTaxRule: 'CAPITAL' as const,
      taxPercentage: 25,
      phases: [
        {
          phaseType: 'DEPOSIT' as const,
          durationInMonths: 12,
          initialDeposit: 500,
          monthlyDeposit: 50,
          yearlyIncreaseInPercentage: 0,
          taxRules: [],
        },
      ],
    };

    const param = encodeScenarioToShareParam(request);
    window.history.pushState({}, '', `/simulation?scenario=${param}`);

    render(<SimulationForm />);

    await waitFor(() => {
      expect(startSimulation).toHaveBeenCalled();
    });

    expect(startSimulation).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: { date: '2033-02-03' },
      })
    );

    // It should have populated the form as well
    expect((screen.getByLabelText(/Start Date:/i) as HTMLInputElement).value).toBe('2033-02-03');

    confirmSpy.mockRestore();
  });
});
