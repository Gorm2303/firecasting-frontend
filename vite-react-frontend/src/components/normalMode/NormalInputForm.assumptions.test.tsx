import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SimulationForm from './NormalInputForm';

describe('NormalInputForm info tooltips', () => {
  it('shows an info tooltip for Tax %', () => {
    render(<SimulationForm />);

    const infoBtn = screen.getByRole('button', { name: /info: tax percentage/i });
    fireEvent.click(infoBtn);

    expect(screen.getByRole('tooltip')).toHaveTextContent(/tax rate applied/i);
  });
});
