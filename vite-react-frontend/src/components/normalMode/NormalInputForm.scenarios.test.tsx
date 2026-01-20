import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SimulationForm from './NormalInputForm';

describe('NormalInputForm scenarios', () => {
  it('saves and reloads a scenario with identical inputs', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('My scenario');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    window.localStorage.clear();

    render(<SimulationForm />);

    const startDate = screen.getByLabelText(/Start Date:/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2033-02-03' } });

    fireEvent.click(screen.getByRole('button', { name: /Save scenario/i }));

    // Change the form away from the saved config
    fireEvent.change(startDate, { target: { value: '2044-04-04' } });

    // Select saved scenario
    const scenarioSelect = screen.getByLabelText(/Saved scenario:/i) as HTMLSelectElement;
    await waitFor(() => {
      expect(scenarioSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    fireEvent.change(scenarioSelect, { target: { value: scenarioSelect.querySelectorAll('option')[1].getAttribute('value') } });
    fireEvent.click(screen.getByRole('button', { name: /^Load$/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(startDate.value).toBe('2033-02-03');

    promptSpy.mockRestore();
  });
});
