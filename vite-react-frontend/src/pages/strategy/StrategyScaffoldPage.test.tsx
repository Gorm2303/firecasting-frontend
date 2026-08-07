import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AssumptionsProvider } from '../../state/assumptions';
import WithdrawalStrategyPage from '../WithdrawalStrategyPage';

const STORAGE_KEY = 'firecasting:strategyProfiles:withdrawalStrategy:v1';

const renderPage = () => {
  return render(
    <MemoryRouter>
      <AssumptionsProvider>
        <WithdrawalStrategyPage />
      </AssumptionsProvider>
    </MemoryRouter>
  );
};

describe('WithdrawalStrategyPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves a named withdrawal profile and updates the preview totals', () => {
    const first = renderPage();
    const target = screen.getByLabelText('Base monthly spending');

    fireEvent.change(target, {
      target: { value: '30000' },
    });
    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: { value: 'Flexible guardrails' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save as profile/i }));

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      profiles?: Array<{ name: string; data: { baseMonthlySpending: number } }>;
    };
    expect(saved.profiles?.[0]?.name).toBe('Flexible guardrails');
    expect(saved.profiles?.[0]?.data.baseMonthlySpending).toBe(30000);
    expect(screen.getAllByText('22000').length).toBeGreaterThan(0);

    first.unmount();
    renderPage();

    expect((screen.getByLabelText('Profile name') as HTMLInputElement).value).toBe('Flexible guardrails');
    expect((screen.getByLabelText('Base monthly spending') as HTMLInputElement).value).toBe('30000');
  });

  it('exports and imports withdrawal profiles', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:withdrawal-profiles'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      renderPage();

      fireEvent.change(screen.getByLabelText('Profile name'), {
        target: { value: 'Import/export guardrails' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save as profile/i }));
      fireEvent.click(screen.getByRole('button', { name: /export profiles/i }));

      expect(vi.mocked(URL.createObjectURL)).toHaveBeenCalledTimes(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);

      const payload = {
        kind: 'firecasting-strategy-profiles',
        version: 1,
        tab: 'withdrawalStrategy',
        exportedAt: '2026-03-08T00:00:00.000Z',
        state: {
          draft: {
            title: 'Imported withdrawal profile',
            description: 'Imported profile',
            withdrawalStartAge: 57,
            horizonYears: 32,
            withdrawalRule: 'guardrails',
            inflationAdjust: true,
            baseMonthlySpending: 31000,
            spendingFloor: 20000,
            spendingCeiling: 36000,
            maxCutPerYearPct: 7,
            triggerPercentile: 20,
            triggerDrawdownPct: 18,
            includePension: true,
            includePartTime: true,
            includeSideHustle: false,
            supplementalIncomeMonthly: 12000,
            routingOrder: 'cash>wrappers>taxable>pension',
            cashBufferTargetMonths: 8,
            refillThresholdMonths: 5,
            playbook: [
              {
                id: 'playbook-1',
                percentile: 'P25',
                spendingAdjustmentPct: -6,
                depositAdjustmentPct: 0,
                note: 'Pause travel budget',
              },
            ],
          },
          draftSavedAt: '2026-03-08T00:00:00.000Z',
          activeProfileId: 'withdrawal-profile-1',
          profiles: [
            {
              id: 'withdrawal-profile-1',
              name: 'Imported withdrawal profile',
              data: {
                title: 'Imported withdrawal profile',
                description: 'Imported profile',
                withdrawalStartAge: 57,
                horizonYears: 32,
                withdrawalRule: 'guardrails',
                inflationAdjust: true,
                baseMonthlySpending: 31000,
                spendingFloor: 20000,
                spendingCeiling: 36000,
                maxCutPerYearPct: 7,
                triggerPercentile: 20,
                triggerDrawdownPct: 18,
                includePension: true,
                includePartTime: true,
                includeSideHustle: false,
                supplementalIncomeMonthly: 12000,
                routingOrder: 'cash>wrappers>taxable>pension',
                cashBufferTargetMonths: 8,
                refillThresholdMonths: 5,
                playbook: [
                  {
                    id: 'playbook-1',
                    percentile: 'P25',
                    spendingAdjustmentPct: -6,
                    depositAdjustmentPct: 0,
                    note: 'Pause travel budget',
                  },
                ],
              },
              savedAt: '2026-03-08T00:00:00.000Z',
            },
          ],
        },
      };
      const file = new File([JSON.stringify(payload)], 'withdrawal-profiles.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', {
        configurable: true,
        value: () => Promise.resolve(JSON.stringify(payload)),
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect((screen.getByLabelText('Strategy title') as HTMLInputElement).value).toBe('Imported withdrawal profile');
        expect((screen.getByLabelText('Base monthly spending') as HTMLInputElement).value).toBe('31000');
        expect((screen.getByLabelText('Profile name') as HTMLInputElement).value).toBe('Imported withdrawal profile');
      });
    } finally {
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: originalRevokeObjectUrl });
    }
  });

  it('can load and delete a named withdrawal profile', () => {
    const first = renderPage();
    const target = screen.getByLabelText('Base monthly spending');

    fireEvent.change(target, {
      target: { value: '28000' },
    });
    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: { value: 'Lean year' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save as profile/i }));
    const savedProfileId = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').profiles?.[0]?.id as string;
    fireEvent.click(screen.getByRole('button', { name: /clear draft/i }));

    expect((screen.getByLabelText('Base monthly spending') as HTMLInputElement).value).toBe('26000');
    fireEvent.change(screen.getByLabelText('Withdrawal profile'), {
      target: { value: savedProfileId },
    });
    fireEvent.click(screen.getByRole('button', { name: /load selected/i }));
    expect((screen.getByLabelText('Base monthly spending') as HTMLInputElement).value).toBe('28000');

    fireEvent.click(screen.getByRole('button', { name: /delete profile/i }));
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as { profiles?: unknown[] };
    expect(saved.profiles ?? []).toHaveLength(0);

    first.unmount();
    renderPage();
    expect((screen.getByLabelText('Withdrawal profile') as HTMLSelectElement).value).toBe('');
  });
});