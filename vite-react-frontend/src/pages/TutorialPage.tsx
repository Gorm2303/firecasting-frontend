import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import NormalInputForm, { TutorialStep } from '../components/normalMode/NormalInputForm';
import MultiPhaseOverview from '../MultiPhaseOverview';
import { YearlySummary } from '../models/YearlySummary';
import { SimulationTimelineContext } from '../models/types';
import PageLayout from '../components/PageLayout';

type TutorialMode = 'normal' | 'advanced';

const TutorialPage: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useParams<{ mode: string }>();

  const tutorialMode: TutorialMode | null = mode === 'normal' ? 'normal' : mode === 'advanced' ? 'advanced' : null;
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [timeline, setTimeline] = useState<SimulationTimelineContext | null>(null);

  const steps: TutorialStep[] = useMemo(() => {
    if (tutorialMode === 'advanced') {
      return [
        {
          id: 'intro',
          title: 'Goal (Advanced)',
          body:
            'This track covers the extra knobs in Advanced mode: engine settings, inflation/fees, exemption configuration, and return models. Your phases/tax setup are pre-made like the Aktiedepot template so we can focus on advanced-only fields.',
        },

        {
          id: 'engine',
          title: 'Engine settings',
          body: 'We’ll go field-by-field and auto-advance when each value is correct.',
          selector: '[data-tour="engine-settings"]',
          placement: 'bottom',
        },
        {
          id: 'seed',
          title: 'Master seed = Random',
          body: 'Set Master seed to Random so each run gets a fresh sample (not deduplicated).',
          selector: '[data-tour="master-seed"]',
          placement: 'bottom',
          requires: [
            { kind: 'valueEquals', selector: '[data-tour="master-seed"] select', value: 'random', message: 'Set Master seed to Random.' },
          ],
        },

        {
          id: 'inflation',
          title: 'Inflation (avg %/year)',
          body: 'Set inflation to 2. This enables real (inflation-adjusted) views.',
          selector: '[data-tour="inflation"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="inflation"] input', value: 2, tolerance: 1e-9, message: 'Set inflation to 2.' },
          ],
        },
        {
          id: 'fee',
          title: 'Fee (avg %/year)',
          body: 'Set fee to 0.5 (meaning 0.5% per year).',
          selector: '[data-tour="fee"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="fee"] input', value: 0.5, tolerance: 1e-9, message: 'Set fee to 0.5.' },
          ],
        },

        {
          id: 'exemptions-intro',
          title: 'Exemptions config',
          body:
            'Advanced mode lets you configure exemption limits and yearly increases. You still enable exemptions per phase (inside the withdraw phase), but these values define the rule limits.',
          selector: '[data-tour="exemptions-config"]',
          placement: 'bottom',
        },
        {
          id: 'exemption-card-limit',
          title: 'Exemption card: limit',
          body: 'Set Exemption card Limit to 51600.',
          selector: '[data-tour="exemption-card-limit"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="exemption-card-limit"]', value: 51600, tolerance: 1e-9, message: 'Set Exemption card Limit to 51600.' },
          ],
        },
        {
          id: 'exemption-card-increase',
          title: 'Exemption card: yearly increase',
          body: 'Set Exemption card Yearly increase to 1000.',
          selector: '[data-tour="exemption-card-yearly-increase"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="exemption-card-yearly-increase"]', value: 1000, tolerance: 1e-9, message: 'Set Exemption card Yearly increase to 1000.' },
          ],
        },
        {
          id: 'stock-tax-rate',
          title: 'Stock exemption: tax rate',
          body: 'Set Stock exemption Tax rate to 27.',
          selector: '[data-tour="stock-exemption-tax-rate"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="stock-exemption-tax-rate"]', value: 27, tolerance: 1e-9, message: 'Set Stock exemption Tax rate to 27.' },
          ],
        },
        {
          id: 'stock-limit',
          title: 'Stock exemption: limit',
          body: 'Set Stock exemption Limit to 67500.',
          selector: '[data-tour="stock-exemption-limit"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="stock-exemption-limit"]', value: 67500, tolerance: 1e-9, message: 'Set Stock exemption Limit to 67500.' },
          ],
        },
        {
          id: 'stock-increase',
          title: 'Stock exemption: yearly increase',
          body: 'Set Stock exemption Yearly increase to 1000.',
          selector: '[data-tour="stock-exemption-yearly-increase"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="stock-exemption-yearly-increase"]', value: 1000, tolerance: 1e-9, message: 'Set Stock exemption Yearly increase to 1000.' },
          ],
        },

        {
          id: 'return-model',
          title: 'Return models',
          body: 'Now we’ll walk through the return models, then end on a Normal distribution calibrated to an S&P 500-like profile.',
          selector: '[data-tour="return-type"]',
          placement: 'bottom',
        },
        {
          id: 'return-model-historical',
          title: 'Data-driven (historical)',
          body: 'Data-driven samples from historical return data. It tends to preserve real-world fat tails and sequences of good/bad years.',
          selector: '[data-tour="return-type"]',
          placement: 'bottom',
          requires: [
            { kind: 'valueEquals', selector: '[data-tour="return-type"]', value: 'dataDrivenReturn', message: 'Set Return type to Data-driven (historical).' },
          ],
        },
        {
          id: 'return-model-distribution',
          title: 'Distribution-based',
          body: 'Switch Return type to Distribution-based. This enables the Distribution selector.',
          selector: '[data-tour="return-type"]',
          placement: 'bottom',
          requires: [
            { kind: 'valueEquals', selector: '[data-tour="return-type"]', value: 'distributionReturn', message: 'Set Return type to Distribution-based.' },
            { kind: 'exists', selector: '[data-tour="return-distribution"]', message: 'Wait for the Distribution selector to appear.' },
          ],
        },
        {
          id: 'return-model-regime',
          title: 'Regime-based (briefly)',
          body: 'Set Distribution to Regime-based. This models switching between multiple market “regimes” (e.g., calm vs volatile).',
          selector: '[data-tour="return-distribution"]',
          placement: 'bottom',
          requires: [
            { kind: 'valueEquals', selector: '[data-tour="return-distribution"]', value: 'regimeBased', message: 'Set Distribution to Regime-based.' },
            { kind: 'exists', selector: '[data-tour="return-regime-tick-months"]', message: 'Wait for Regime-based settings to appear.' },
          ],
        },
        {
          id: 'return-model-regime-multiple',
          title: 'Multiple regimes',
          body:
            'Regime-based uses several regimes (0..2 by default). Each regime can have its own distribution and parameters. Think of them as different “market states” that you can tune independently.',
          selector: '[data-tour="return-regime-settings"]',
          placement: 'bottom',
        },
        {
          id: 'return-model-regime-switching',
          title: 'Switching between regimes',
          body:
            'When a switch happens, the “Switch to 0/1/2” values act like weights. They are normalized into probabilities, so increasing one weight makes that destination regime more likely (relative to the others).',
          selector: '[data-tour="return-regime-0-to-0"]',
          placement: 'bottom',
        },
        {
          id: 'return-model-regime-tick',
          title: 'Regime tick months',
          body: 'Set Tick months to 1.',
          selector: '[data-tour="return-regime-tick-months"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="return-regime-tick-months"]', value: 1, tolerance: 1e-9, message: 'Set Tick months to 1.' },
          ],
        },
        {
          id: 'return-model-normal',
          title: 'Normal distribution',
          body: 'Now set Distribution to Normal. Next we’ll set mean and volatility.',
          selector: '[data-tour="return-distribution"]',
          placement: 'bottom',
          requires: [
            { kind: 'valueEquals', selector: '[data-tour="return-distribution"]', value: 'normal', message: 'Set Distribution to Normal.' },
          ],
        },
        {
          id: 'return-normal-mean',
          title: 'Normal mean',
          body: 'Set Normal mean to 0.10 (10% expected annual return, as a decimal).',
          selector: '[data-tour="return-normal-mean"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="return-normal-mean"]', value: 0.1, tolerance: 1e-6, message: 'Set Normal mean to 0.10.' },
          ],
        },
        {
          id: 'return-normal-stddev',
          title: 'Normal std dev',
          body: 'Set Normal std dev to 0.18 (18% annual volatility, as a decimal).',
          selector: '[data-tour="return-normal-stddev"]',
          placement: 'bottom',
          requires: [
            { kind: 'numberEquals', selector: '[data-tour="return-normal-stddev"]', value: 0.18, tolerance: 1e-6, message: 'Set Normal std dev to 0.18.' },
          ],
        },

        {
          id: 'run',
          title: 'Run (see results)',
          body: 'Click Run Simulation. When results appear, the tutorial will auto-advance.',
          selector: '[data-tour="run"]',
          placement: 'top',
          requires: [
            { kind: 'exists', selector: '[data-tour="capital-chart"]', message: 'Run the simulation and wait until the chart appears.' },
          ],
        },
        {
          id: 'chart',
          title: 'Results',
          body: 'You can now compare how return-model assumptions affect outcomes and failure risk in the withdraw phase.',
          selector: '[data-tour="capital-chart"]',
          placement: 'top',
          autoAdvance: false,
          requires: [
            { kind: 'exists', selector: '[data-tour="capital-chart"]', message: 'Wait until the chart is visible.' },
          ],
        },

        {
          id: 'done',
          title: 'Done',
          body: 'Advanced setup complete. You now have Aktiedepot phases + advanced settings + a distribution-based return model.',
        },
      ];
    }

    return [
      {
        id: 'intro',
        title: 'Aktiedepot investment (normal case)',
        body:
          'We’re going to model an “aktiedepot” style investing journey: DEPOSIT → PASSIVE → WITHDRAW. We’ll enter the numbers manually so you learn what each input means.',
      },
      {
        id: 'template',
        title: 'Template',
        body:
          'Templates are just presets. In tutorial mode, you’ll see a Tutorial template that intentionally starts with “wrong” values so you have to change them.',
        selector: '[data-tour="template"]',
        placement: 'bottom',
      },

      {
        id: 'start-date',
        title: 'Start date',
        body: 'Set Start date to 2026-01-01. This is when the simulation starts counting months.',
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
        id: 'tax-rule',
        title: 'Tax rule',
        body:
          'Set Tax rule to Capital gains. This is the “aktiedepot” style: tax is applied on realized gains when you withdraw. Phase exemptions are configured inside the WITHDRAW phase later.',
        selector: '[data-tour="tax-rule"]',
        placement: 'bottom',
        requires: [
          {
            kind: 'valueEquals',
            selector: '[data-tour="tax-rule"] select',
            value: 'CAPITAL',
            message: 'Set Tax rule to Capital gains.',
          },
        ],
      },
      {
        id: 'tax-percent',
        title: 'Tax %',
        body: 'Set Tax % to 42. Think of this as your overall tax rate when tax applies.',
        selector: '[data-tour="tax-percent"]',
        placement: 'bottom',
        requires: [
          {
            kind: 'numberEquals',
            selector: '[data-tour="tax-percent"] input',
            value: 42,
            tolerance: 1e-9,
            message: 'Set Tax % to 42.',
          },
        ],
      },

      {
        id: 'phase-list',
        title: 'Phases (time periods)',
        body:
          'A simulation is built from phases. Each phase is a time period where one rule applies: you either deposit, do nothing (passive), or withdraw. Phases run in order, month-by-month, starting from your start date.',
        selector: '[data-tour="phase-list"]',
        placement: 'bottom',
      },

      {
        id: 'phase-add-1',
        title: 'Add Phase #1 (Deposit)',
        body: 'Click Add Phase. We’ll use Phase #1 to invest money over time.',
        selector: '[data-tour="add-phase"]',
        placement: 'top',
        requires: [
          { kind: 'exists', selector: '[data-tour="phase-0-type"]', message: 'Click Add Phase to create Phase #1.' },
        ],
      },
      {
        id: 'deposit-type',
        title: 'Phase type',
        body:
          'Phase type controls the behavior for that period. For Phase #1 we want DEPOSIT (investing). PASSIVE is “just returns”, and WITHDRAW is spending.',
        selector: '[data-tour="phase-0-type"]',
        placement: 'bottom',
        requires: [
          { kind: 'valueEquals', selector: '[data-tour="phase-0-type"]', value: 'DEPOSIT', message: 'Set Phase #1 Type to DEPOSIT.' },
        ],
      },
      {
        id: 'deposit-duration',
        title: 'Deposit duration',
        body: 'Set Phase #1 duration to 20 years. That’s 20 years of investing.',
        selector: '[data-tour="phase-0-duration-years"]',
        placement: 'bottom',
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-0-duration-years"]', value: 20, message: 'Set Phase #1 years to 20.' },
        ],
      },
      {
        id: 'deposit-initial',
        title: 'Initial deposit',
        body: 'Set Initial deposit to 5000 (a one-time starting deposit).',
        selector: '[data-tour="phase-0-initial-deposit"]',
        placement: 'bottom',
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-0-initial-deposit"]', value: 5000, message: 'Set Initial deposit to 5000.' },
        ],
      },
      {
        id: 'deposit-monthly',
        title: 'Monthly deposit',
        body: 'Set Monthly deposit to 5000 (your recurring monthly investing).',
        selector: '[data-tour="phase-0-monthly-deposit"]',
        placement: 'bottom',
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-0-monthly-deposit"]', value: 5000, message: 'Set Monthly deposit to 5000.' },
        ],
      },
      {
        id: 'deposit-increase',
        title: 'Yearly increase',
        body: 'Set Yearly increase to 1.5%. This grows your monthly deposit each year (like salary growth).',
        selector: '[data-tour="phase-0-yearly-increase"]',
        placement: 'bottom',
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-0-yearly-increase"]', value: 1.5, tolerance: 1e-6, message: 'Set Yearly increase to 1.5%.' },
        ],
      },

      {
        id: 'phase-add-2',
        title: 'Add Phase #2 (Passive)',
        body:
          'Now add a second phase. We’ll keep it PASSIVE (no deposits/withdrawals) to match the Aktiedepot phase structure.',
        selector: '[data-tour="add-phase"]',
        placement: 'top',
        requires: [
          { kind: 'exists', selector: '[data-tour="phase-1-type"]', message: 'Click Add Phase to create Phase #2.' },
        ],
      },
      {
        id: 'passive-type',
        title: 'Passive phase type',
        body: 'Keep Phase #2 Type as PASSIVE. This models time where you neither deposit nor withdraw — only returns apply.',
        selector: '[data-tour="phase-1-type"]',
        placement: 'bottom',
        autoAdvance: false,
        requires: [
          { kind: 'valueEquals', selector: '[data-tour="phase-1-type"]', value: 'PASSIVE', message: 'Set Phase #2 Type to PASSIVE.' },
        ],
      },
      {
        id: 'passive-duration',
        title: 'Passive duration',
        body: 'Set Phase #2 duration to 5 years.',
        selector: '[data-tour="phase-1-duration-years"]',
        placement: 'bottom',
        autoAdvance: false,
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-1-duration-years"]', value: 5, message: 'Set Phase #2 years to 5.' },
        ],
      },

      {
        id: 'phase-add-3',
        title: 'Add Phase #3 (Withdraw)',
        body: 'Add the final phase for spending (WITHDRAW).',
        selector: '[data-tour="add-phase"]',
        placement: 'top',
        requires: [
          { kind: 'exists', selector: '[data-tour="phase-2-type"]', message: 'Click Add Phase to create Phase #3.' },
        ],
      },
      {
        id: 'withdraw-type',
        title: 'Withdraw phase type',
        body: 'Set Phase #3 Type to WITHDRAW. This is where the portfolio needs to support your spending.',
        selector: '[data-tour="phase-2-type"]',
        placement: 'bottom',
        requires: [
          { kind: 'valueEquals', selector: '[data-tour="phase-2-type"]', value: 'WITHDRAW', message: 'Set Phase #3 Type to WITHDRAW.' },
        ],
      },
      {
        id: 'withdraw-duration',
        title: 'Withdraw duration',
        body: 'Set Phase #3 duration to 30 years (intentionally not the default so you have to change it).',
        selector: '[data-tour="phase-2-duration-years"]',
        placement: 'bottom',
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-2-duration-years"]', value: 30, message: 'Set Phase #3 years to 30.' },
        ],
      },

      {
        id: 'withdraw-mode',
        title: 'Withdraw amount vs rate',
        body:
          'Withdrawals can be configured as a fixed amount (AMOUNT) or a percentage of current capital (RATE). Switch to RATE for a moment so you can see the difference.',
        selector: '[data-tour="phase-2-withdraw-mode"]',
        placement: 'bottom',
        requires: [
          { kind: 'valueEquals', selector: '[data-tour="phase-2-withdraw-mode"]', value: 'RATE', message: 'Switch Withdraw mode to RATE.' },
        ],
      },
      {
        id: 'withdraw-rate',
        title: 'Withdraw rate (RATE mode)',
        body:
          'RATE means “take X% of current capital each month”. It adapts automatically if the portfolio shrinks, which can reduce the chance of hitting 0.',
        selector: '[data-tour="phase-2-withdraw-rate"]',
        placement: 'bottom',
        autoAdvance: false,
        requires: [
          { kind: 'exists', selector: '[data-tour="phase-2-withdraw-rate"]', message: 'Make sure Withdraw mode is RATE so this field appears.' },
        ],
      },
      {
        id: 'withdraw-mode-amount',
        title: 'Back to AMOUNT',
        body:
          'Now switch back to AMOUNT. Fixed spending is easy to interpret, but it can fail if returns are poor for long enough.',
        selector: '[data-tour="phase-2-withdraw-mode"]',
        placement: 'bottom',
        requires: [
          { kind: 'valueEquals', selector: '[data-tour="phase-2-withdraw-mode"]', value: 'AMOUNT', message: 'Switch Withdraw mode back to AMOUNT.' },
        ],
      },
      {
        id: 'withdraw-amount',
        title: 'Withdraw amount (AMOUNT mode)',
        body:
          'Set Withdraw amount to 11000 (intentionally not the default). This is the main driver of failure risk in this scenario.',
        selector: '[data-tour="phase-2-withdraw-amount"]',
        placement: 'bottom',
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-2-withdraw-amount"]', value: 11000, message: 'Set Withdraw amount to 11000.' },
        ],
      },

      {
        id: 'withdraw-variation-lower',
        title: 'Lower variation %',
        body:
          'Variation lets spending react to last month’s return. Lower variation reduces withdrawals after a negative return (a “belt-tightening” rule). Set it to 5%.',
        selector: '[data-tour="phase-2-lower-variation"]',
        placement: 'bottom',
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-2-lower-variation"]', value: 5, message: 'Set Lower variation % to 5.' },
        ],
      },
      {
        id: 'withdraw-variation-upper',
        title: 'Upper variation %',
        body:
          'Upper variation increases withdrawals after a positive return (spend a bit more in good times). Set it to 5%.',
        selector: '[data-tour="phase-2-upper-variation"]',
        placement: 'bottom',
        requires: [
          { kind: 'numberEquals', selector: '[data-tour="phase-2-upper-variation"]', value: 5, message: 'Set Upper variation % to 5.' },
        ],
      },

      {
        id: 'exemptions',
        title: 'Tax rule exemptions (in this phase)',
        body:
          'Exemptions reduce what gets taxed within this phase. Enable both to match the Aktiedepot template.',
        selector: '[data-tour="phase-2-tax-exemptions"]',
        placement: 'top',
        requires: [
          { kind: 'checkboxChecked', selector: '[data-tour="phase-2-tax-exemptioncard"]', message: 'Check Exemption Card.' },
          { kind: 'checkboxChecked', selector: '[data-tour="phase-2-tax-stockexemption"]', message: 'Check Stock Exemption.' },
        ],
      },

      {
        id: 'failure-driver',
        title: 'Withdraw risk is set here',
        body:
          'Failure rate comes from the WITHDRAW phase: in some market paths, withdrawals can drain the portfolio to 0. Withdraw amount/rate, duration, and variation rules all affect this risk.',
        selector: '[data-tour="phase-2-withdraw-amount"]',
        placement: 'bottom',
      },

      {
        id: 'run',
        title: 'Run',
        body: 'Click Run Simulation. When results appear, the tutorial will auto-advance.',
        selector: '[data-tour="run"]',
        placement: 'top',
        requires: [
          { kind: 'exists', selector: '[data-tour="capital-chart"]', message: 'Run the simulation and wait until the chart appears.' },
        ],
      },
      {
        id: 'chart',
        title: 'Charts',
        body:
          'The blue line is the median (50th percentile): half the paths end above it, half below. The blue shaded bands are percentile ranges: 25th–75th is the “middle 50%” of outcomes (typical range), and 5th–95th is a wider “most outcomes” range (extremes are outside). Wider bands = more uncertainty/volatility.',
        selector: '[data-tour="capital-chart"]',
        placement: 'top',
        autoAdvance: false,
        requires: [
          { kind: 'exists', selector: '[data-tour="capital-chart"]', message: 'Wait until the chart is visible.' },
        ],
      },
      {
        id: 'failure-line-withdraw',
        title: 'Withdraw phase: failure rate (red line)',
        body:
          'In the WITHDRAW phase chart, the red line is the failure rate: % of paths where capital is <= 0 at that month. It answers “how often does this withdrawal plan run out of money?”.',
        selector: '[data-tour="results-phase-withdraw"] [data-tour="capital-chart"]',
        placement: 'top',
        autoAdvance: false,
        requires: [
          { kind: 'exists', selector: '[data-tour="results-phase-withdraw"] [data-tour="capital-chart"]', message: 'Wait until the WITHDRAW phase results chart is visible.' },
        ],
      },
      {
        id: 'failed-cases-withdraw',
        title: 'Withdraw phase: failed cases summary',
        body:
          'This summary is specific to the WITHDRAW phase. It condenses the red line into a quick “how many paths failed” view for that phase, and shows the yearly breakdown of *when* failures happen (e.g. early-sequence risk vs late depletion). Earlier failures usually mean the withdrawal plan is too aggressive for bad early returns.',
        selector: '[data-tour="results-phase-withdraw"] [data-tour="failed-cases-summary"]',
        placement: 'top',
        autoAdvance: false,
        requires: [
          { kind: 'exists', selector: '[data-tour="results-phase-withdraw"] [data-tour="failed-cases-summary"]', message: 'Wait until the WITHDRAW phase failed-cases summary is visible.' },
        ],
      },

      {
        id: 'capital-view',
        title: 'Nominal vs real',
        body:
          'Nominal is “as-of-that-time” currency. Real divides by the inflation index so you can compare purchasing power over time.',
        selector: '[data-tour="capital-view"]',
        placement: 'bottom',
      },
      {
        id: 'real-how',
        title: 'Real view + inflation',
        body:
          'Real view depends on the inflation factor. If the Real button is disabled, it’s because inflation is not enabled for this run. In advanced mode you can edit Inflation to control the real-vs-nominal conversion.',
        selector: '[data-tour="capital-view-real"]',
        placement: 'bottom',
      },

      {
        id: 'done',
        title: 'All set!',
        body:
          'You now have the Aktiedepot phase structure (DEPOSIT → PASSIVE → WITHDRAW). Try tweaking withdraw amount/duration/variation and see how the failure rate changes.',
      },
    ];
  }, [tutorialMode]);

  if (!tutorialMode) return <Navigate to="/simulation/tutorial" replace />;

  return (
    <PageLayout variant="wide">
      <div style={{ maxWidth: 1500 }}>
        <h1 style={{ textAlign: 'center' }}>Tutor</h1>
        <p style={{ textAlign: 'center', opacity: 0.85, marginTop: 0 }}>
          Learn by doing. Same components, guided steps.
        </p>

        <NormalInputForm
          tutorialSteps={steps}
          onExitTutorial={() => navigate('/simulation')}
          onSimulationComplete={(results, ctx) => {
            setStats(results);
            setTimeline(ctx ?? null);
          }}
          mode={tutorialMode}
        />

        {stats && stats.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <MultiPhaseOverview data={stats} timeline={timeline} />
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default TutorialPage;
