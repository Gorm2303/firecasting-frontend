import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SimulationForm from './NormalInputForm';
import { getTemplateById, resolveTemplateToRequest } from '../../config/simulationTemplates';

describe('NormalInputForm templates', () => {
  it('applies Starter template and shows explanation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const expected = resolveTemplateToRequest(getTemplateById('starter'));

    render(<SimulationForm />);

    const templateSelect = screen.getByLabelText(/Template:/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'starter' } });

    const startDate = screen.getByLabelText(/Start Date:/i) as HTMLInputElement;
    expect(startDate.value).toBe(expected.startDate.date);

    expect(screen.getByText(getTemplateById('starter').description)).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('asks before overwriting edits', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SimulationForm />);

    const startDate = screen.getByLabelText(/Start Date:/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2030-01-01' } });

    const templateSelect = screen.getByLabelText(/Template:/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'starter' } });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(startDate.value).toBe('2030-01-01');
  });

  it('switches template back to Custom when editing', async () => {
    render(<SimulationForm />);

    const templateSelect = screen.getByLabelText(/Template:/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'starter' } });

    const startDate = screen.getByLabelText(/Start Date:/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2041-01-01' } });

    await waitFor(() => {
      expect((screen.getByLabelText(/Template:/i) as HTMLSelectElement).value).toBe('custom');
    });
  });
});
