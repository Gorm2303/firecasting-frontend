import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/simulation', () => {
  return {
    exportRunBundle: vi.fn(),
    exportSimulationCsv: vi.fn(),
    getCompletedSummaries: vi.fn().mockResolvedValue(null),
    getReplayStatus: vi.fn().mockResolvedValue({ replayId: 'r', status: 'done' }),
    importRunBundle: vi.fn().mockResolvedValue({ replayId: 'replay-1', simulationId: 'sim-1', status: 'queued' }),
  };
});

import SimulationPage from './SimulationPage';

const ensureFileTextPolyfill = () => {
  // JSDOM environments can miss File.text(); SimulationPage relies on it during run-bundle import.
  const anyFileProto = File.prototype as any;
  if (typeof anyFileProto.text === 'function') return;
  anyFileProto.text = function text(this: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsText(this);
    });
  };
};

const getHiddenFileInput = (): HTMLInputElement => {
  const input = document.querySelector('input[type="file"][accept*="application/json"]') as HTMLInputElement | null;
  if (!input) throw new Error('File input not found');
  return input;
};

describe('SimulationPage run bundle import', () => {
  it('imports a normal run bundle and populates all normal fields', async () => {
    ensureFileTextPolyfill();
    window.localStorage.clear();

    render(
      <MemoryRouter initialEntries={['/simulation']}>
        <SimulationPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Import\/Export/i }));

    const modal = screen.getByRole('dialog', { name: /Import and export/i });
    fireEvent.click(within(modal).getByRole('button', { name: /Import Run Bundle/i }));

    const bundle = {
      inputs: {
        kind: 'normal',
        raw: {
          startDate: { date: '2033-02-03' },
          overallTaxRule: 'NOTIONAL',
          taxPercentage: 25,
          phases: [
            {
              phaseType: 'DEPOSIT',
              durationInMonths: 12,
              initialDeposit: 500,
              monthlyDeposit: 50,
              yearlyIncreaseInPercentage: 3,
              taxRules: ['EXEMPTIONCARD'],
            },
            {
              phaseType: 'WITHDRAW',
              durationInMonths: 6,
              withdrawRate: 0.04,
              withdrawAmount: 1234,
              lowerVariationPercentage: 2,
              upperVariationPercentage: 3,
              taxRules: ['STOCKEXEMPTION'],
            },
          ],
          // Unknown future field should not break import.
          someNewField: { hello: 'world' },
        },
      },
    };

    const file = new File([JSON.stringify(bundle)], 'bundle.json', { type: 'application/json' });
    fireEvent.change(getHiddenFileInput(), { target: { files: [file] } });

    await waitFor(() => {
      expect((screen.getByLabelText(/^Start Date$/i) as HTMLInputElement).value).toBe('2033-02-03');
    });

    expect((screen.getByLabelText(/Tax %/i) as HTMLInputElement).value).toBe('25');
  });

  it('imports an advanced run bundle and populates all advanced fields', async () => {
    ensureFileTextPolyfill();
    window.localStorage.clear();
    window.localStorage.setItem(
      'firecasting:simulation:advancedFeatureFlags:v1',
      JSON.stringify({ execution: true, inflation: true, fee: true, exemptions: true, returnModel: true })
    );

    render(
      <MemoryRouter initialEntries={['/simulation']}>
        <SimulationPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Import\/Export/i }));

    const modal = screen.getByRole('dialog', { name: /Import and export/i });
    fireEvent.click(within(modal).getByRole('button', { name: /Import Run Bundle/i }));

    const bundle = {
      inputs: {
        kind: 'advanced',
        raw: {
          startDate: { date: '2033-02-03' },
          overallTaxRule: 'CAPITAL',
          taxPercentage: 42,
          phases: [
            {
              phaseType: 'DEPOSIT',
              durationInMonths: 1,
              initialDeposit: 100,
              monthlyDeposit: 0,
              yearlyIncreaseInPercentage: 0,
              taxRules: [],
            },
          ],
          inflationFactor: 1.05,
          yearlyFeePercentage: 0.6,
          taxExemptionConfig: {
            exemptionCard: { limit: 111, yearlyIncrease: 2 },
            stockExemption: { taxRate: 27, limit: 222, yearlyIncrease: 1 },
          },
          returnType: 'distributionReturn',
          seed: 123,
          returnerConfig: {
            seed: 123,
            distribution: {
              type: 'studentT',
              studentT: { mu: 0.042, sigma: 0.609, nu: 3.6 },
            },
          },
          // Unknown future field should not break import.
          someNewAdvancedField: { ok: true },
        },
      },
    };

    const file = new File([JSON.stringify(bundle)], 'bundle.json', { type: 'application/json' });
    fireEvent.change(getHiddenFileInput(), { target: { files: [file] } });

    // Ensure SimulationPage flipped the form to advanced mode.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Advanced/i })).toHaveAttribute('aria-pressed', 'true');
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Inflation \(avg %/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Fee \(avg %/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Return type/i)).toBeInTheDocument();
    });

    expect(Number((screen.getByLabelText(/Inflation \(avg %/i) as HTMLInputElement).value)).toBeCloseTo(5, 6);
    expect(Number((screen.getByLabelText(/Fee \(avg %/i) as HTMLInputElement).value)).toBeCloseTo(0.6, 6);

    // Exemptions: duplicate labels exist; validate by value set.
    const limitInputs = screen.getAllByLabelText(/^Limit$/i) as HTMLInputElement[];
    const limitValues = limitInputs.map((i) => i.value);
    expect(limitValues).toContain('111');
    expect(limitValues).toContain('222');

    expect((screen.getByLabelText(/Tax rate %/i) as HTMLInputElement).value).toBe('27');

    // Return model
    expect((screen.getByLabelText(/Return type/i) as HTMLSelectElement).value).toBe('distributionReturn');
    expect((screen.getByLabelText(/Master seed/i) as HTMLSelectElement).value).toBe('custom');
    const seedLabel = screen.getByText(/Master seed/i).closest('label');
    const seedInput = seedLabel?.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(seedInput).toBeTruthy();
    expect((seedInput as HTMLInputElement).value).toBe('123');
    expect((screen.getByLabelText(/^Distribution$/i) as HTMLSelectElement).value).toBe('studentT');
    expect((screen.getByLabelText(/^mu$/i) as HTMLInputElement).value).toBe('0.042');
    expect((screen.getByLabelText(/^sigma$/i) as HTMLInputElement).value).toBe('0.609');
    expect((screen.getByLabelText(/^nu$/i) as HTMLInputElement).value).toBe('3.6');
  });
});
