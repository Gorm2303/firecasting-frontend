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

import SimulationForm, { type NormalInputFormHandle } from './NormalInputForm';

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
    const scenarioSelect = within(dialog).getByRole('combobox') as HTMLSelectElement;
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
});
