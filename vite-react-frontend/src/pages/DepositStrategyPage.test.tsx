import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import DepositStrategyPage from './DepositStrategyPage';
import { AssumptionsProvider } from '../state/assumptions';

const STORAGE_KEY = 'firecasting:strategyProfiles:depositStrategy:v1';

const renderPage = () => {
  return render(
    <MemoryRouter>
      <AssumptionsProvider>
        <DepositStrategyPage />
      </AssumptionsProvider>
    </MemoryRouter>
  );
};

describe('DepositStrategyPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves a named deposit profile and updates the preview totals', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Base deposit amount'), {
      target: { value: '12000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add one-off/i }));
    fireEvent.change(screen.getByLabelText('One-off 1 amount'), {
      target: { value: '5000' },
    });
    fireEvent.change(screen.getByLabelText('Profile name'), {
      target: { value: 'Front-load decade' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save as profile/i }));

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      profiles?: Array<{ name: string; data: { baseDepositAmount: number } }>;
    };
    expect(saved.profiles?.[0]?.name).toBe('Front-load decade');
    expect(saved.profiles?.[0]?.data.baseDepositAmount).toBe(12000);
    expect(screen.getAllByText('149000').length).toBeGreaterThan(0);
  });

  it('exports and imports deposit profiles', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:deposit-profiles'),
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
        target: { value: 'Import/export profile' },
      });
      fireEvent.click(screen.getByRole('button', { name: /save as profile/i }));
      fireEvent.click(screen.getByRole('button', { name: /export profiles/i }));

      expect(vi.mocked(URL.createObjectURL)).toHaveBeenCalledTimes(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);

      const payload = {
        kind: 'firecasting-strategy-profiles',
        version: 1,
        tab: 'depositStrategy',
        exportedAt: '2026-03-08T00:00:00.000Z',
        state: {
          draft: {
            title: 'Imported deposits',
            description: 'Imported profile',
            mode: 'aggressive',
            baseDepositAmount: 9000,
            cadence: 'monthly',
            startYearOffset: 1,
            durationYears: 15,
            pauseMonthsPerYear: 1,
            escalationMode: 'pctYearly',
            escalationPct: 4,
            escalationDkkPerYear: 0,
            inflationAdjust: true,
            routingPriority: 'buffer>goals>debt>wrappers>taxable',
            routingCapsNote: 'Prioritize wrappers after buffer.',
            recurringBoostMonth: 6,
            recurringBoostAmount: 2500,
            oneOffs: [],
          },
          draftSavedAt: '2026-03-08T00:00:00.000Z',
          activeProfileId: 'deposit-profile-1',
          profiles: [
            {
              id: 'deposit-profile-1',
              name: 'Imported deposits',
              data: {
                title: 'Imported deposits',
                description: 'Imported profile',
                mode: 'aggressive',
                baseDepositAmount: 9000,
                cadence: 'monthly',
                startYearOffset: 1,
                durationYears: 15,
                pauseMonthsPerYear: 1,
                escalationMode: 'pctYearly',
                escalationPct: 4,
                escalationDkkPerYear: 0,
                inflationAdjust: true,
                routingPriority: 'buffer>goals>debt>wrappers>taxable',
                routingCapsNote: 'Prioritize wrappers after buffer.',
                recurringBoostMonth: 6,
                recurringBoostAmount: 2500,
                oneOffs: [],
              },
              savedAt: '2026-03-08T00:00:00.000Z',
            },
          ],
        },
      };
      const file = new File([JSON.stringify(payload)], 'deposit-profiles.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', {
        configurable: true,
        value: () => Promise.resolve(JSON.stringify(payload)),
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect((screen.getByLabelText('Strategy title') as HTMLInputElement).value).toBe('Imported deposits');
        expect((screen.getByLabelText('Base deposit amount') as HTMLInputElement).value).toBe('9000');
        expect((screen.getByLabelText('Profile name') as HTMLInputElement).value).toBe('Imported deposits');
      });
    } finally {
      anchorClickSpy.mockRestore();
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: originalRevokeObjectUrl });
    }
  });
});