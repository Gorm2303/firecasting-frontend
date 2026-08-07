import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import AssumptionsHubPage from './AssumptionsHubPage';
import { convertSalaryAmountBetweenPeriods } from '../lib/income/sharedSalary';
import { deriveReferenceNetSalary } from '../lib/income/referenceNetSalary';
import { AssumptionsProvider, getDefaultAssumptions } from '../state/assumptions';
import { ExecutionDefaultsProvider } from '../state/executionDefaults';
import { UiPreferencesProvider } from '../state/uiPreferences';

const ASSUMPTIONS_STORAGE_KEY = 'firecasting:assumptions:v2';
const GOVERNANCE_STORAGE_KEY = 'firecasting:assumptionsGovernance:v1';
const SNAPSHOTS_STORAGE_KEY = 'firecasting:simulationSnapshots:v1';

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

    expect(screen.getByRole('button', { name: /advanced view/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Currency')).toBeInTheDocument();
    expect(screen.getByLabelText('Reference gross salary')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /deposit/i }));
    expect(screen.getByLabelText('Deposit timing')).toBeInTheDocument();
    expect(screen.getByLabelText('Emergency buffer target (months)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /basic view/i }));
    expect(screen.getByRole('button', { name: /basic view/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Emergency buffer target (months)')).not.toBeInTheDocument();
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

  it('routes assumptions into income, invest, expense, and withdrawal tabs', () => {
    renderHub();

    expect(screen.getByLabelText('Inflation (%/year)')).toBeInTheDocument();
    expect(screen.getByLabelText('Reference gross salary')).toBeInTheDocument();
    expect(screen.getByLabelText('Working hours per month')).toBeInTheDocument();
    expect(screen.getByLabelText('Salary growth (%/year)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /tax/i }));
    expect(screen.getByLabelText('Tax regime')).toBeInTheDocument();
    expect(screen.getByLabelText('Overall tax rule')).toBeInTheDocument();
    expect(screen.getByLabelText('Simulation tax percentage')).toBeInTheDocument();
    expect(screen.getByLabelText('Stock exemption tax rate (%/year)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /invest/i }));
    expect(screen.getByLabelText('Return engine')).toBeInTheDocument();
    expect(screen.getByLabelText('Yearly fee (%/year)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Expected return (%/year)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /plan/i }));
    expect(screen.getByLabelText('Simulation template')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date (YYYY-MM-DD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Phase list (JSON)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /expense/i }));
    expect(screen.getByLabelText('Core expense (DKK/month)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Time horizon (years)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /withdrawal/i }));
    expect(screen.getByLabelText('Safe withdrawal rate (%/year)')).toBeInTheDocument();
  });

  it('can auto-calculate reference net salary from Salary Taxator defaults or unlock it for manual editing', () => {
    renderHub();

    const autoCheckbox = screen.getByLabelText('Auto-calculate reference net salary') as HTMLInputElement;
    const netSalaryInput = screen.getByLabelText('Reference net salary') as HTMLInputElement;
    const grossSalaryInput = screen.getByLabelText('Reference gross salary') as HTMLInputElement;

    expect(autoCheckbox.checked).toBe(true);
    expect(netSalaryInput).toBeDisabled();

    const expectedDefault = deriveReferenceNetSalary({
      referenceSalaryPeriod: 'monthly',
      referenceGrossSalaryAmount: 50_000,
      workingHoursPerMonth: 160,
      salaryTaxatorDefaults: getDefaultAssumptions().salaryTaxatorDefaults,
    }).value;
    expect(Number(netSalaryInput.value)).toBe(expectedDefault);

    fireEvent.change(grossSalaryInput, { target: { value: '60000' } });

    const expectedUpdated = deriveReferenceNetSalary({
      referenceSalaryPeriod: 'monthly',
      referenceGrossSalaryAmount: 60_000,
      workingHoursPerMonth: 160,
      salaryTaxatorDefaults: getDefaultAssumptions().salaryTaxatorDefaults,
    }).value;
    expect(Number((screen.getByLabelText('Reference net salary') as HTMLInputElement).value)).toBe(expectedUpdated);

    fireEvent.click(autoCheckbox);
    expect((screen.getByLabelText('Reference net salary') as HTMLInputElement)).not.toBeDisabled();
  });

  it('converts salary reference amounts when the reference period changes', () => {
    renderHub();

    const periodSelect = screen.getByLabelText('Salary reference period') as HTMLSelectElement;
    const grossSalaryInput = screen.getByLabelText('Reference gross salary') as HTMLInputElement;

    expect(grossSalaryInput.value).toBe('50000');

    fireEvent.change(periodSelect, { target: { value: 'hourly' } });

    expect((screen.getByLabelText('Reference gross salary') as HTMLInputElement).value).toBe(
      String(convertSalaryAmountBetweenPeriods(50_000, 'monthly', 'hourly', 160))
    );
    expect((screen.getByLabelText('Reference net salary') as HTMLInputElement)).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Auto-calculate reference net salary'));
    fireEvent.change(screen.getByLabelText('Reference net salary'), { target: { value: '210.4' } });
    fireEvent.change(periodSelect, { target: { value: 'monthly' } });

    expect((screen.getByLabelText('Reference net salary') as HTMLInputElement).value).toBe(
      String(Number(convertSalaryAmountBetweenPeriods(210.4, 'hourly', 'monthly', 160).toFixed(2)))
    );
  });

  it('shows aligned policy and milestone fields in basic view', () => {
    renderHub();

    fireEvent.click(screen.getByRole('button', { name: /basic view/i }));

    fireEvent.click(screen.getByRole('tab', { name: /policy/i }));
    expect(screen.getByLabelText('Max deposit increase (%/year)')).toBeInTheDocument();
    expect(screen.getByLabelText('Critical threshold (failure risk %)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /milestones/i }));
    expect(screen.getByLabelText('Sustained months')).toBeInTheDocument();
    expect(screen.getByLabelText('Barista FIRE: required monthly income (DKK)')).toBeInTheDocument();
  });

  it('moves hub-only fields into a bottom Placeholder section', () => {
    renderHub();

    fireEvent.click(screen.getByRole('tab', { name: /income/i }));

    expect(screen.getByText(/^Placeholder$/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Bonus frequency')).toBeInTheDocument();
    expect(screen.getByLabelText('Bonus (% of salary)')).toBeInTheDocument();
    expect(screen.queryByText('Income modeling')).not.toBeInTheDocument();
  });

  it('shows a page-specific assumptions view grouped by hub domains', () => {
    renderHub();

    fireEvent.click(screen.getByRole('button', { name: /page view/i }));

    expect(screen.queryByRole('tablist', { name: /assumptions hub sections/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Page')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Money Perspective' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Salary Taxator' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Page'), { target: { value: 'MoneyPerspective' } });

    expect(screen.getByText(/^Income$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Expense$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Invest$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Tax$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Deposit$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reference net salary')).toBeInTheDocument();
    expect(screen.getByLabelText('Core expense (DKK/month)')).toBeInTheDocument();
    expect(screen.getByLabelText('Expected return (%/year)')).toBeInTheDocument();
    expect(screen.queryByText(/^Placeholder$/i)).not.toBeInTheDocument();
  });

  it('keeps page-view fields disabled when the baseline is locked', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /page view/i }));
    fireEvent.change(screen.getByLabelText('Page'), { target: { value: 'SalaryTaxator' } });

    expect(screen.getByLabelText('Page')).toBeEnabled();
    expect(screen.getByLabelText('Reference gross salary')).toBeDisabled();
    expect(screen.getByLabelText('Default municipality id')).toBeDisabled();
  });

  it('imports and exports assumptions through browser-style interactions', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:test-url'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const createObjectUrlSpy = vi.mocked(URL.createObjectURL);
    const revokeObjectUrlSpy = vi.mocked(URL.revokeObjectURL);
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      renderHub();

      fireEvent.click(screen.getByRole('tab', { name: /overview/i }));

      fireEvent.click(screen.getByRole('button', { name: /export json/i }));
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:test-url');

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const imported = {
        draft: {
          ...getDefaultAssumptions(),
          inflationPct: 4.25,
        },
      };
      const file = new File([JSON.stringify(imported)], 'assumptions.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', {
        configurable: true,
        value: () => Promise.resolve(JSON.stringify(imported)),
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('tab', { name: /income/i }));
        expect((screen.getByLabelText('Inflation (%/year)') as HTMLInputElement).value).toBe('4.25');
      });
    } finally {
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectUrl,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectUrl,
      });
    }
  });

  it('compares snapshots to draft and can load snapshot assumptions into the draft', async () => {
    const assumptions = getDefaultAssumptions();
    const snapshotAssumptions = {
      ...assumptions,
      inflationPct: 5,
    };

    window.localStorage.setItem(
      SNAPSHOTS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'snapshot-1',
          runId: 'run-123',
          createdAt: '2026-03-08T00:00:00.000Z',
          assumptions: snapshotAssumptions,
          advancedRequest: {
            startDate: { date: '2030-01-01' },
            phases: [],
            overallTaxRule: 'NOTIONAL',
            taxPercentage: 27,
            paths: 1000,
            batchSize: 1000,
            seed: 1,
            inflationFactor: 1.02,
            yearlyFeePercentage: 0.5,
          },
        },
      ])
    );

    renderHub();

    fireEvent.click(screen.getByRole('tab', { name: /preview/i }));
    fireEvent.click(screen.getByRole('button', { name: /compare snapshot → draft/i }));

    await waitFor(() => {
      expect(screen.getByText(/selected snapshot → draft changes/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Inflation \(%\/year\)/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /use snapshot assumptions as draft/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /income/i })).toHaveAttribute('aria-selected', 'true');
      expect((screen.getByLabelText('Inflation (%/year)') as HTMLInputElement).value).toBe('5');
    });
  });
});