// src/App.test.tsx
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render the input form and not show tabs initially', () => {
    render(<App />);

    // The tab buttons should not be present on the initial render
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Table')).not.toBeInTheDocument();
    expect(screen.queryByText('Charts')).not.toBeInTheDocument();
  });
});
