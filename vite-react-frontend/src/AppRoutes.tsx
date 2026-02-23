import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import ExplorePage from './pages/ExplorePage';
import InfoPage from './pages/InfoPage';
import LandingPage from './pages/LandingPage';
import MoneyPerspectivePage from './pages/MoneyPerspectivePage';
import ProgressTrackerPage from './pages/ProgressTrackerPage';
import RunDiffPage from './pages/RunDiffPage';
import SalaryAfterTaxPage from './pages/SalaryAfterTaxPage';
import SimulationPage from './pages/SimulationPage';
import TutorialLandingPage from './pages/TutorialLandingPage';
import TutorialPage from './pages/TutorialPage';

import SkeletonPage, { type SkeletonSection } from './pages/skeleton/SkeletonPage';
import FeedbackPage from './pages/FeedbackPage';
import SecurityPrivacyCenterPage from './pages/SecurityPrivacyCenterPage';
import AssumptionsHubPage from './pages/AssumptionsHubPage';

type SkeletonRoute = {
  path: string;
  title: string;
  subtitle?: string;
  sections?: SkeletonSection[];
};

const skeletonRoutes: SkeletonRoute[] = [
  // Lifestyle
  {
    path: '/time-accounting',
    title: 'Time Accounting Dashboard',
    sections: [
      { title: 'Inputs', bullets: ['Income, taxes, commuting, stress/recovery', 'Work hours + commute schedule'] },
      { title: 'Outputs', bullets: ['Commuting time cost', 'Stress recovery time cost', 'Net life-hours after work'] },
      { title: 'Notes', bullets: ['Local-only calculations placeholder', 'No backend calls'] },
    ],
  },
  {
    path: '/fixed-vs-flexible-spending',
    title: 'Fixed vs Flexible Spending Analyzer',
    sections: [
      { title: 'Expense Split', bullets: ['Fixed (non-negotiable) vs elastic (adjustable)', 'Stiff vs bendable ratio'] },
      { title: 'Tail-Risk Survival', bullets: ['How flexibility affects bad-year survival (placeholder)'] },
    ],
  },
  {
    path: '/life-events-simulator',
    title: 'Life Events Simulator',
    sections: [
      { title: 'Timeline Events', bullets: ['Children, career breaks, parental leave, relocations', 'Home purchase, divorce, inheritance, health costs'] },
      { title: 'Uncertainty', bullets: ['Ranges + distributions (placeholder)', 'Scenario comparison (placeholder)'] },
    ],
  },
  {
    path: '/side-hustle-lab',
    title: 'Side Hustle Lab',
    sections: [
      { title: 'Explore', bullets: ['Idea catalog (placeholder)', 'Fit to schedule + energy (placeholder)'] },
      { title: 'Dream Hustle Builder', bullets: ['Inputs: hours/week, startup cost, expected income', 'Integration with FIRE plan (placeholder)'] },
    ],
  },
  {
    path: '/housing-decision-studio',
    title: 'Housing Decision Studio',
    sections: [
      { title: 'Options', bullets: ['Rent vs buy vs relocate'] },
      { title: 'Scenarios', bullets: ['Mortgage, maintenance, transaction costs', 'Opportunity cost (placeholder)'] },
    ],
  },
  {
    path: '/household-negotiation-board',
    title: 'Household Negotiation Board',
    sections: [
      { title: 'Trade-off Board', bullets: ['Spending choices → what they delay/accelerate', 'Math-first discussion tool (placeholder)'] },
    ],
  },
  {
    path: '/family-mode-planner',
    title: 'Family Mode Planner',
    sections: [
      { title: 'Setup', bullets: ['Shared vs separate accounts', 'Parental leave years', 'Childcare waves', 'Education funds'] },
    ],
  },
  {
    path: '/debt-freedom-optimizer',
    title: 'Debt Freedom Optimizer',
    sections: [
      { title: 'Strategies', bullets: ['Snowball', 'Avalanche', 'Pay minimum'] },
      { title: 'Consequences', bullets: ['FI-date impact (placeholder)', 'Stress score (placeholder)'] },
    ],
  },
  {
    path: '/emergency-buffer-optimizer',
    title: 'Emergency Buffer Optimizer',
    sections: [
      { title: 'Inputs', bullets: ['Income stability', 'Expense volatility', 'Dependents'] },
      { title: 'Recommendation', bullets: ['Target emergency fund size (placeholder)', 'Reasoning breakdown (placeholder)'] },
    ],
  },
  {
    path: '/insurance-risk-shield',
    title: 'Insurance Risk Shield',
    sections: [
      { title: 'Stress Tests', bullets: ['Health, disability, income protection, liability'] },
      { title: 'Blast Radius', bullets: ['Financial impact map (placeholder)'] },
    ],
  },

  // Plan
  {
    path: '/scenario-library',
    title: 'Scenario Library',
    sections: [
      { title: 'Public Templates', bullets: ['Aggressive saver', 'Family of 4', 'Late start', 'Coast/Barista FIRE'] },
      { title: 'Personal Scenario Builder', bullets: ['Create reusable template (placeholder)', 'Share privately (placeholder)'] },
    ],
  },
  {
    path: '/fire-milestones',
    title: 'FIRE Milestones',
    sections: [
      { title: 'Timeline', bullets: ['Deposits, yearly reports, withdrawals', 'Emergency buffer / Coast / Barista / Lean / FIRE / Fat unlocks'] },
      { title: 'Probabilities', bullets: ['Chance of FI by age X (placeholder)', 'Estimated date ranges (placeholder)'] },
      { title: 'Editors', bullets: ['What-If slider wall (placeholder)', 'Timeline editor (placeholder)'] },
    ],
  },
  {
    path: '/confidence-funnel',
    title: 'Confidence Funnel',
    sections: [
      { title: 'Uncertainty Funnel', bullets: ['Baseline vs interventions (placeholder)', 'Show narrowing/widening over time'] },
      { title: 'Interventions', bullets: ['Increase contributions', 'Reduce fees', 'Tax optimization'] },
    ],
  },
  {
    path: '/goal-planner',
    title: 'Goal Planner',
    sections: [
      { title: 'Multiple Goals', bullets: ['FI, house, sabbatical, buffer (placeholder)'] },
      { title: 'Prioritization', bullets: ['Priority sliders (placeholder)', 'Conflict warnings (placeholder)', 'Optimized split (placeholder)'] },
      { title: 'Expense Cut Impact', bullets: ['Rank expenses by “FI days bought per krone reduced” (placeholder)'] },
    ],
  },
  {
    path: '/uncertainty-tracks',
    title: 'Uncertainty Tracks',
    sections: [
      { title: 'Parallel Tracks', bullets: ['P10, P25, P50, P75, P90'] },
      { title: 'Per-Track KPIs', bullets: ['FI date range', 'Safe monthly spending', 'Failure probability', 'Required savings-rate changes', 'Plan health color'] },
      { title: 'Action Cards', bullets: ['Runbook-style “If we hit percentile X, do this” (placeholder)', 'Simulated alerts per scenario (placeholder)'] },
      { title: 'Core Needs Coverage', bullets: ['Months of core needs secured (placeholder)'] },
    ],
  },
  {
    path: '/plan-report',
    title: 'Plan Report',
    sections: [
      { title: 'Plain-Language Summary', bullets: ['“Your success depends mostly on X, Y, Z.” (placeholder)'] },
    ],
  },

  // Model / Build
  {
    path: '/policy-builder',
    title: 'Policy Builder',
    sections: [
      { title: 'Adaptive Rules', bullets: ['IF funded ratio < 0.9 and percentile < 25 → cut discretionary 10% (placeholder)', 'Guardrails + behavior autopilot (placeholder)'] },
    ],
  },
  {
    path: '/deposit-strategy',
    title: 'Deposit Strategy',
    sections: [
      { title: 'Strategy Header', bullets: ['Name + description', 'Preset selector (placeholder)'] },
      { title: 'Schedule', bullets: ['Base amount', 'Frequency monthly/yearly', 'Start/end condition', 'Break periods'] },
      { title: 'Step-Ups & One-Offs', bullets: ['Escalation rules', 'One-time contributions', 'Irregular recurring (placeholder)'] },
      { title: 'Routing & Modes', bullets: ['Priority order (placeholder)', 'Caps/targets (placeholder)', 'Normal/Lean/Aggressive/Emergency modes'] },
      { title: 'Preview', bullets: ['Avg monthly deposit', 'Total deposits (20y)', 'Timeline preview table (placeholder)', 'Deposits over time chart (placeholder)'] },
    ],
  },
  {
    path: '/withdrawal-strategy',
    title: 'Withdrawal Strategy',
    sections: [
      { title: 'Strategy Header', bullets: ['Name + description', 'Preset selector (placeholder)'] },
      { title: 'Timing', bullets: ['Start age/date', 'Horizon'] },
      { title: 'Base Rule', bullets: ['Fixed %', 'Fixed spending (inflation-adjusted)', 'Guardrails', 'Floor/ceiling', 'Variable spending'] },
      { title: 'Income Blending', bullets: ['Pension/part-time/side hustle toggles (placeholder)', 'Income schedule builder (placeholder)'] },
      { title: 'Routing & Buffer', bullets: ['Cash → taxable → wrappers/pension (placeholder)', 'Buffer target months + refill threshold'] },
      { title: 'Bad-Year Playbook', bullets: ['P10/P25/P50/P75/P90 action cards (placeholder)'] },
      { title: 'Preview', bullets: ['Timeline preview table (placeholder)', 'Withdrawals over time chart (placeholder)'] },
    ],
  },

  // Simulation
  {
    path: '/stress-test-lab',
    title: 'Stress Test Lab',
    sections: [
      { title: 'Shock Templates', bullets: ['Bad first 5 years', 'High inflation decade', 'Job loss year', 'Flat market period', 'Big unexpected expense'] },
      { title: 'Outputs', bullets: ['Sequence-of-returns fragility (placeholder)', 'Suggested interventions (placeholder)'] },
    ],
  },
  {
    path: '/model-validation-suite',
    title: 'Model Validation Suite',
    sections: [
      { title: 'Validation', bullets: ['Backtests across known historical periods (placeholder)', 'Synthetic edge cases (placeholder)'] },
    ],
  },

  // Execute / Progress
  {
    path: '/cashflow-command-center',
    title: 'Cashflow Command Center',
    sections: [
      { title: 'Calendar View', bullets: ['Monthly cashflow with deposits + recurring expenses', 'Annual spikes (insurance, travel, subscriptions)'] },
      { title: 'Guidance', bullets: ['Forecast surplus/deficit (placeholder)', 'Spike alerts (placeholder)', 'Auto-suggest buffer size (placeholder)'] },
      { title: 'Tax Map', bullets: ['Withdrawal tax thresholds over time (placeholder)'] },
      { title: 'Next Best Krone', bullets: ['Rank buffer vs debt vs wrappers vs index vs pension (placeholder)'] },
    ],
  },

  // Portfolio
  {
    path: '/portfolio',
    title: 'Portfolio',
    sections: [
      { title: 'Health Score', bullets: ['Diversification', 'Fee drag', 'Tax drag', 'Drawdown tolerance', 'Withdrawal robustness (placeholder)'] },
      { title: 'Optimizers & X-Ray', bullets: ['Tax wrapper optimizer (placeholder)', 'Exposure decomposition (placeholder)', 'Currency risk (placeholder)'] },
      { title: 'Workshops', bullets: ['Rebalancing', 'Glidepath', 'Fee forensics (placeholders)'] },
    ],
  },
  {
    path: '/sequence-risk-radar',
    title: 'Sequence Risk Radar',
    sections: [
      { title: 'Fragility View', bullets: ['Danger zones around retirement start (placeholder)', 'Runway by spending mode (placeholder)'] },
      { title: 'Bad Years', bullets: ['Worst-year return slider (placeholder)', 'Required buffer/spending cut/income boost (placeholder)'] },
    ],
  },

  // Reflect
  {
    path: '/decision-journal',
    title: 'Decision Journal',
    sections: [
      { title: 'Entries', bullets: ['Decision thesis (placeholder)', 'Confidence score (placeholder)', 'Future check-in date (placeholder)'] },
      { title: 'Review', bullets: ['Hindsight review (placeholder)'] },
    ],
  },
  {
    path: '/decision-replay',
    title: 'Decision Replay / Postmortem',
    sections: [
      { title: 'Replay', bullets: ['Evaluate decisions vs original assumptions (placeholder)'] },
    ],
  },
  {
    path: '/happiness-tracker',
    title: 'Happiness Tracker',
    sections: [
      { title: 'Tracking', bullets: ['Simple mood + notes timeline (placeholder)'] },
    ],
  },
  {
    path: '/community-benchmarks',
    title: 'Community Benchmarks (privacy-safe)',
    sections: [
      { title: 'Cohort Compare', bullets: ['Country, age band, savings rate band, goal type (placeholder)'] },
      { title: 'Privacy', bullets: ['Anonymized aggregates only (placeholder)'] },
    ],
  },
  {
    path: '/advisor-share-portal',
    title: 'Advisor / Share Portal',
    sections: [
      { title: 'Share Mode', bullets: ['Partner/advisor read access (placeholder)', 'Permissions + comments (placeholder)'] },
    ],
  },

  // Challenges
  {
    path: '/no-spend-challenge-arena',
    title: 'No-Spend Challenge Arena',
    sections: [
      { title: 'Sprints', bullets: ['7-day challenges (placeholder)', 'Connect to FI-date movement (placeholder)'] },
    ],
  },
];

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Firecasting */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/info" element={<InfoPage />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route path="/assumptions" element={<AssumptionsHubPage />} />
      <Route path="/security-privacy" element={<SecurityPrivacyCenterPage />} />

      {/* Existing app pages */}
      <Route path="/tutorial" element={<TutorialLandingPage />} />
      <Route path="/tutorial/:mode" element={<TutorialPage />} />
      <Route path="/diff-scenarios" element={<RunDiffPage />} />
      <Route path="/salary-after-tax" element={<SalaryAfterTaxPage />} />
      <Route path="/money-perspective" element={<MoneyPerspectivePage />} />
      <Route path="/progress-tracker" element={<ProgressTrackerPage />} />
      <Route path="/simulation" element={<SimulationPage />} />
      <Route path="/simulation/tutorial" element={<TutorialLandingPage />} />
      <Route path="/simulation/tutorial/:mode" element={<TutorialPage />} />
      <Route path="/simulation/diff" element={<RunDiffPage />} />
      <Route path="/explore" element={<ExplorePage />} />

      {/* Skeleton routes */}
      {skeletonRoutes.map((r) => (
        <Route
          key={r.path}
          path={r.path}
          element={<SkeletonPage title={r.title} subtitle={r.subtitle} sections={r.sections} />}
        />
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
