import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/simulation', async () => {
  const actual = await vi.importActual<any>('../api/simulation');
  return {
    ...actual,
    findRunForInput: vi.fn().mockResolvedValue('run-1'),
    listRuns: vi.fn().mockResolvedValue([
      { id: 'run-1', createdAt: '2026-01-01T00:00:00Z', rngSeed: 123 },
      { id: 'run-2', createdAt: '2026-01-02T00:00:00Z', rngSeed: null },
    ]),
    diffRuns: vi.fn().mockResolvedValue({
      a: {
        id: 'run-1',
        createdAt: '2026-01-01T00:00:00Z',
        modelAppVersion: '1.0.0',
        modelBuildTime: '2026-01-01T00:00:00Z',
        modelSpringBootVersion: '3.4.0',
        modelJavaVersion: '23',
        rngSeed: 123,
      },
      b: {
        id: 'run-2',
        createdAt: '2026-01-02T00:00:00Z',
        modelAppVersion: '1.0.1',
        modelBuildTime: '2026-01-02T00:00:00Z',
        modelSpringBootVersion: '3.4.1',
        modelJavaVersion: '23',
        rngSeed: null,
      },
      attribution: {
        inputsChanged: true,
        randomnessChanged: true,
        modelVersionChanged: true,
        summary: 'Differences may be attributable to: inputs, randomness, model version.',
      },
      output: {
        exactMatch: false,
        withinTolerance: false,
        mismatches: 10,
        maxAbsDiff: 0.42,
      },
    }),
    getRunSummaries: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../config/savedScenarios', () => {
  return {
    isRandomSeedRequested: () => false,
    listSavedScenarios: () => ([
      {
        id: 's1',
        name: 'Scenario A',
        savedAt: '2026-01-01T00:00:00Z',
        advancedRequest: { startDate: { date: '2026-01-01' }, phases: [], overallTaxRule: 'CAPITAL', taxPercentage: 0 },
        request: { startDate: { date: '2026-01-01' }, phases: [], overallTaxRule: 'CAPITAL', taxPercentage: 0 },
        runId: 'run-1',
      },
      {
        id: 's2',
        name: 'Scenario B',
        savedAt: '2026-01-02T00:00:00Z',
        advancedRequest: { startDate: { date: '2026-01-02' }, phases: [], overallTaxRule: 'CAPITAL', taxPercentage: 0 },
        request: { startDate: { date: '2026-01-02' }, phases: [], overallTaxRule: 'CAPITAL', taxPercentage: 0 },
        runId: 'run-2',
      },
    ]),
    materializeRandomSeedIfNeeded: (req: any) => req,
    saveScenario: () => ({
      id: 's1',
      name: 'Scenario A',
      savedAt: '2026-01-01T00:00:00Z',
      advancedRequest: { startDate: { date: '2026-01-01' }, phases: [], overallTaxRule: 'CAPITAL', taxPercentage: 0 },
    }),
    updateScenarioRunMeta: () => {},
  };
});

import RunDiffPage from './RunDiffPage';

describe('RunDiffPage metadata', () => {
  it('renders metadata rows when diff is available', async () => {
    render(
      <MemoryRouter initialEntries={['/simulation/diff']}>
        <RunDiffPage />
      </MemoryRouter>
    );

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(selects[0], { target: { value: 's1' } });
    fireEvent.change(selects[1], { target: { value: 's2' } });
    fireEvent.click(screen.getByRole('button', { name: /diff/i }));

    await waitFor(() => {
      expect(screen.getByText('Model build time')).toBeInTheDocument();
      expect(screen.getByText('Spring Boot version')).toBeInTheDocument();
      expect(screen.getByText('Java version')).toBeInTheDocument();
      expect(screen.getByText('Model app version')).toBeInTheDocument();
    });
  });
});
