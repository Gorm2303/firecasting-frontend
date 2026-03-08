import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import AssumptionsHubPage from './AssumptionsHubPage';
import { AssumptionsProvider, getDefaultAssumptions } from '../state/assumptions';
import { ExecutionDefaultsProvider } from '../state/executionDefaults';
import { UiPreferencesProvider } from '../state/uiPreferences';

const ASSUMPTIONS_STORAGE_KEY = 'firecasting:assumptions:v2';
const GOVERNANCE_STORAGE_KEY = 'firecasting:assumptionsGovernance:v1';

const renderHub = () => {
  return render(
    <UiPreferencesProvider>
      <AssumptionsProvider>
        <ExecutionDefaultsProvider>
          <AssumptionsHubPage />
        </ExecutionDefaultsProvider>
      </AssumptionsProvider>
    </UiPreferencesProvider>
  );
};

describe('AssumptionsHubPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('switches between tabs and view modes', () => {
    renderHub();

    expect(screen.getByRole('button', { name: /basic view/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Currency')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /deposit/i }));
    expect(screen.getByLabelText('Deposit timing')).toBeInTheDocument();
    expect(screen.queryByLabelText('Emergency buffer target (months)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /advanced view/i }));
    expect(screen.getByRole('button', { name: /advanced view/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Emergency buffer target (months)')).toBeInTheDocument();
  });

  it('supports edit, cancel, reset, and save flows', () => {
    renderHub();

    const inflationInput = screen.getByLabelText('Inflation (%/year)') as HTMLInputElement;
    expect(inflationInput.value).toBe('2');

    fireEvent.change(inflationInput, { target: { value: '3.5' } });
    expect(screen.getByText(/you have unsaved draft changes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect((screen.getByLabelText('Inflation (%/year)') as HTMLInputElement).value).toBe('2');

    fireEvent.change(screen.getByLabelText('Inflation (%/year)'), { target: { value: '3.5' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.queryByText(/you have unsaved draft changes/i)).not.toBeInTheDocument();
    expect((screen.getByLabelText('Inflation (%/year)') as HTMLInputElement).value).toBe('3.5');

    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect((screen.getByLabelText('Inflation (%/year)') as HTMLInputElement).value).toBe('2');
  });

  it('disables baseline editing when governance lock is enabled', () => {
    const assumptions = getDefaultAssumptions();
    window.localStorage.setItem(
      ASSUMPTIONS_STORAGE_KEY,
      JSON.stringify({ current: assumptions, draft: assumptions })
    );
    window.localStorage.setItem(
      GOVERNANCE_STORAGE_KEY,
      JSON.stringify({ sourceNote: '', lockBaseline: true, updatedAt: '2026-03-08T00:00:00.000Z' })
    );

    renderHub();

    expect(screen.getByText(/^Baseline is locked\.$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeDisabled();
    expect(screen.getByLabelText('Currency')).toBeDisabled();
  });

  it('shows deterministic diagnostics warnings from the draft assumptions', () => {
    const assumptions = getDefaultAssumptions();
    const draft = {
      ...assumptions,
      expectedReturnPct: 2,
      inflationPct: 3,
      withdrawalStrategyDefaults: {
        ...assumptions.withdrawalStrategyDefaults,
        guardrailFloorPct: 6,
        guardrailCeilingPct: 4,
      },
    };

    window.localStorage.setItem(
      ASSUMPTIONS_STORAGE_KEY,
      JSON.stringify({ current: assumptions, draft })
    );

    renderHub();

    fireEvent.click(screen.getByRole('button', { name: /diagnostics view/i }));
    expect(screen.getByText(/non-positive real drift/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /withdrawal/i }));
    expect(screen.getByText(/withdrawal guardrails are inverted/i)).toBeInTheDocument();
  });
});