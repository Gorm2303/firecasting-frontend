import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../api/simulation', () => {
  return {
    startSimulation: vi.fn().mockResolvedValue('test-sim-id'),
    startAdvancedSimulation: vi.fn().mockResolvedValue({ id: 'test-sim-id', createdAt: '2026-01-01T00:00:00Z', rngSeed: 123 }),
    exportSimulationCsv: vi.fn(),
    findRunForInput: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('qrcode.react', () => {
  return {
    QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr" data-value={value} />,
  };
});

import { startAdvancedSimulation } from '../../api/simulation';
import SimulationForm, { type NormalInputFormHandle } from './NormalInputForm';
import { decodeSharedScenarioFromShareParam, encodeScenarioToShareParam } from '../../utils/shareScenarioLink';
import { ExecutionDefaultsProvider } from '../../state/executionDefaults';

const WITHDRAWAL_STORAGE_KEY = 'firecasting:strategyProfiles:withdrawalStrategy:v1';

describe('NormalInputForm share links', () => {
  it('creates a share link for a saved scenario', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => 'My scenario');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    window.localStorage.clear();
    window.localStorage.setItem(
      WITHDRAWAL_STORAGE_KEY,
      JSON.stringify({
        draft: {
          title: 'Guardrail bridge',
          baseMonthlySpending: 28000,
        },
        draftSavedAt: '2026-03-08T00:00:00.000Z',
        activeProfileId: 'withdrawal-profile-1',
        profiles: [
          {
            id: 'withdrawal-profile-1',
            name: 'Guardrail bridge',
            data: {
              title: 'Guardrail bridge',
              baseMonthlySpending: 28000,
            },
            savedAt: '2026-03-08T00:00:00.000Z',
          },
        ],
      })
    );

    const ref = React.createRef<NormalInputFormHandle>();
    render(
      <ExecutionDefaultsProvider>
        <SimulationForm ref={ref} />
      </ExecutionDefaultsProvider>
    );

    act(() => {
      ref.current?.openSavedScenarios();
    });
    // 1st prompt call: scenario name
    fireEvent.click(screen.getByRole('button', { name: /Save scenario/i }));

    // Subsequent prompt calls: used as share-link fallback
    promptSpy.mockImplementation(() => '');

    const dialog = screen.getByRole('dialog', { name: /Saved scenarios/i });

    // pick the first saved scenario option
    const scenarioSelect = within(dialog).getByRole('combobox', { name: /^Scenario$/i }) as HTMLSelectElement;
    await waitFor(() => {
      expect(scenarioSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    const id = scenarioSelect.querySelectorAll('option')[1].getAttribute('value');
    fireEvent.change(scenarioSelect, { target: { value: id } });

    fireEvent.click(within(dialog).getByRole('button', { name: /Share scenario/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });

    const shareLinkInput = within(dialog).getByRole('textbox', { name: /Share link/i }) as HTMLInputElement;
    expect(shareLinkInput.value).toContain('/simulation');
    expect(shareLinkInput.value).toMatch(/\bscenario=/);

    // QR should encode the exact same URL.
    const qr = within(dialog).getByTestId('qr');
    expect(qr.getAttribute('data-value')).toBe(shareLinkInput.value);

    const scenarioParam = new URL(shareLinkInput.value).searchParams.get('scenario');
    expect(scenarioParam).toMatch(/^z:/);
    expect(decodeSharedScenarioFromShareParam(scenarioParam ?? '')?.strategyProfileAttachments).toEqual({
      withdrawalStrategy: {
        id: 'withdrawal-profile-1',
        name: 'Guardrail bridge',
        savedAt: '2026-03-08T00:00:00.000Z',
        data: {
          title: 'Guardrail bridge',
          baseMonthlySpending: 28000,
        },
      },
    });

    promptSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('loads from /simulation?scenario=... and auto-runs', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const request = {
      startDate: { date: '2033-02-03' },
      overallTaxRule: 'CAPITAL' as const,
      taxPercentage: 25,
      phases: [
        {
          phaseType: 'DEPOSIT' as const,
          durationInMonths: 12,
          initialDeposit: 500,
          monthlyDeposit: 50,
          yearlyIncreaseInPercentage: 0,
          taxRules: [],
        },
      ],
    };

    const param = encodeScenarioToShareParam(request, undefined, {
      withdrawalStrategy: {
        id: 'withdrawal-profile-99',
        name: 'Shared guardrails',
        savedAt: '2026-03-08T00:00:00.000Z',
        data: {
          title: 'Shared guardrails',
          baseMonthlySpending: 29000,
        },
      },
    });
    window.history.pushState({}, '', `/simulation?scenario=${param}`);

    render(
      <ExecutionDefaultsProvider>
        <SimulationForm />
      </ExecutionDefaultsProvider>
    );

    await waitFor(() => {
      expect(startAdvancedSimulation).toHaveBeenCalled();
    });

    expect(startAdvancedSimulation).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: { date: '2033-02-03' },
      })
    );

    const savedProfileState = JSON.parse(window.localStorage.getItem(WITHDRAWAL_STORAGE_KEY) ?? '{}') as {
      activeProfileId?: string;
      draft?: { title?: string; baseMonthlySpending?: number };
    };
    expect(savedProfileState.activeProfileId).toBe('withdrawal-profile-99');
    expect(savedProfileState.draft?.title).toBe('Shared guardrails');
    expect(savedProfileState.draft?.baseMonthlySpending).toBe(29000);

    // It should have populated the form as well
    expect((screen.getByLabelText(/^Start Date:?$/i) as HTMLInputElement).value).toBe('2033-02-03');

    confirmSpy.mockRestore();
  });
});
