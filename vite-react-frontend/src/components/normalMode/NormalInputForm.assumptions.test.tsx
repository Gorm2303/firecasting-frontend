import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SimulationForm from './NormalInputForm';

describe('NormalInputForm assumptions panel', () => {
  it('toggles the assumptions panel and reflects current tax %', () => {
    render(<SimulationForm />);

    const btn = screen.getByRole('button', { name: /assumptions/i });
    expect(screen.queryByLabelText(/model assumptions/i)).not.toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.getByLabelText(/model assumptions/i)).toBeInTheDocument();
    expect(screen.getByText(/dataDrivenReturn/i)).toBeInTheDocument();
    expect(screen.getByText(/Inflation \(real spending\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.02/)).toBeInTheDocument();

    const taxInput = screen.getByLabelText(/Tax %/i);
    fireEvent.change(taxInput, { target: { value: '15' } });

    expect(screen.getByText(/15%/i)).toBeInTheDocument();
  });
});
