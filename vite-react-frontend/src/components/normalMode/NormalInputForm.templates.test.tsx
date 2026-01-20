import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SimulationForm from './NormalInputForm';

describe('NormalInputForm templates', () => {
  it('applies Late starter template and shows explanation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(<SimulationForm />);

    const templateSelect = screen.getByLabelText(/Template:/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'late-starter' } });

    const startDate = screen.getByLabelText(/Start Date:/i) as HTMLInputElement;
    expect(startDate.value).toBe('2040-01-01');

    expect(screen.getByRole('note')).toHaveTextContent('Starts later');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('asks before overwriting edits', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<SimulationForm />);

    const startDate = screen.getByLabelText(/Start Date:/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2030-01-01' } });

    const templateSelect = screen.getByLabelText(/Template:/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'late-starter' } });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(startDate.value).toBe('2030-01-01');
  });
});
