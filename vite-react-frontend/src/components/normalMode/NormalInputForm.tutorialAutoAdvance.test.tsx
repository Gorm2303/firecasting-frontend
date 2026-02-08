import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SimulationForm, { type TutorialStep } from './NormalInputForm';

const renderWithSteps = (steps: TutorialStep[]) => {
  render(
    <SimulationForm
      tutorialSteps={steps}
      onExitTutorial={() => {
        // no-op
      }}
    />
  );
};

describe('NormalInputForm tutorial auto-advance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('auto-advances when Start Date matches requirement', async () => {
    const steps: TutorialStep[] = [
      {
        id: 'start-date',
        title: 'Start date',
        body: 'Set Start date to 2026-01-01.',
        selector: '[data-tour="start-date"]',
        placement: 'bottom',
        requires: [
          {
            kind: 'valueEquals',
            selector: '[data-tour="start-date"] input',
            value: '2026-01-01',
            message: 'Set Start date to 2026-01-01.',
          },
        ],
      },
      {
        id: 'after',
        title: 'After start date',
        body: 'Reached next step.',
      },
    ];

    renderWithSteps(steps);

    expect(screen.getByRole('dialog')).toHaveTextContent('Start date');

    const startDate = screen.getByLabelText(/^Start Date:?$/i) as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2026-01-01' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByRole('dialog')).toHaveTextContent('After start date');
  });

  it('accepts comma as decimal separator for numberEquals requirements', async () => {
    const steps: TutorialStep[] = [
      {
        id: 'fee',
        title: 'Fee',
        body: 'Set fee to 0.5.',
        selector: '[data-tour="fee"]',
        placement: 'bottom',
        requires: [
          {
            kind: 'numberEquals',
            selector: '[data-tour="fee"] input',
            value: 0.5,
            tolerance: 1e-9,
            message: 'Set fee to 0.5.',
          },
        ],
      },
      {
        id: 'after-fee',
        title: 'After fee',
        body: 'Reached next step.',
      },
    ];

    render(
      <SimulationForm
        mode="advanced"
        advancedFeatureFlags={{ execution: true, inflation: true, fee: true, exemptions: true, returnModel: true }}
        tutorialSteps={steps}
      />
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('Fee');

    const fee = screen.getByLabelText(/Fee \(avg % \/ year\)/i) as HTMLInputElement;
    fireEvent.change(fee, { target: { value: '0,5' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByRole('dialog')).toHaveTextContent('After fee');
  });

  it('does not lock out auto-advance if requirement becomes unmet right before the auto-advance re-check', async () => {
    const raceInput = document.createElement('input');
    raceInput.id = 'race-input';
    raceInput.value = 'ok';
    document.body.appendChild(raceInput);

    try {
      const steps: TutorialStep[] = [
        {
          id: 'race',
          title: 'Race step',
          body: 'Should advance when external input is ok.',
          selector: '[data-tour="template"]',
          placement: 'bottom',
          requires: [
            {
              kind: 'valueEquals',
              selector: '#race-input',
              value: 'ok',
              message: 'Set race-input to ok.',
            },
          ],
        },
        {
          id: 'after-race',
          title: 'After race',
          body: 'Reached next step.',
        },
      ];

      renderWithSteps(steps);

      // Flush initial effects (interval + initial auto-advance timer scheduling).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Sanity: we start on the first step.
      expect(screen.getByRole('dialog')).toHaveTextContent('Race step');

      // Wait almost until the auto-advance timeout fires, then make the requirement unmet
      // WITHOUT dispatching events (mimics browser widgets not emitting captured events).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(199);
      });

      raceInput.value = 'bad';

      // Let the scheduled auto-advance re-check fire at ~200ms.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // Now restore correctness (still without events). Polling should detect this and
      // auto-advance should be able to retry (no permanent lockout).
      raceInput.value = 'ok';

      await act(async () => {
        // Phase 1: let the polling interval tick (at ~400ms) observe that we're OK again.
        await vi.advanceTimersByTimeAsync(250);
      });

      await act(async () => {
        // Phase 2: allow the auto-advance effect (scheduled by the poll-driven state update)
        // to arm its 200ms timeout, then fire it.
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(screen.getByRole('dialog')).toHaveTextContent('After race');
    } finally {
      raceInput.remove();
    }
  });
});
