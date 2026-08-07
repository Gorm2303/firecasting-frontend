import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import ExplorePage from './pages/ExplorePage';
import DecisionJournalPage from './pages/DecisionJournalPage';
import CategoryLandingPage from './pages/CategoryLandingPage';
import CashflowCommandCenterPage from './pages/CashflowCommandCenterPage';
import ConfidenceFunnelPage from './pages/ConfidenceFunnelPage';
import DebtFreedomOptimizerPage from './pages/DebtFreedomOptimizerPage';
import DecisionReplayPage from './pages/DecisionReplayPage';
import EmergencyBufferOptimizerPage from './pages/EmergencyBufferOptimizerPage';
import FamilyModePlannerPage from './pages/FamilyModePlannerPage';
import FireMilestonesPage from './pages/FireMilestonesPage';
import FireSimulatorPage from './pages/FireSimulatorPage';
import FixedVsFlexibleSpendingPage from './pages/FixedVsFlexibleSpendingPage';
import GoalPlannerPage from './pages/GoalPlannerPage';
import HouseholdNegotiationBoardPage from './pages/HouseholdNegotiationBoardPage';
import HappinessTrackerPage from './pages/HappinessTrackerPage';
import HousingDecisionStudioPage from './pages/HousingDecisionStudioPage';
import InfoPage from './pages/InfoPage';
import InsuranceRiskShieldPage from './pages/InsuranceRiskShieldPage';
import LandingPage from './pages/LandingPage';
import LifeEventsSimulatorPage from './pages/LifeEventsSimulatorPage';
import ModelValidationSuitePage from './pages/ModelValidationSuitePage';
import MoneyPerspectivePage from './pages/MoneyPerspectivePage';
import NoSpendChallengeArenaPage from './pages/NoSpendChallengeArenaPage';
import PlanReportPage from './pages/PlanReportPage';
import PolicyBuilderPage from './pages/PolicyBuilderPage';
import PortfolioPage from './pages/PortfolioPage';
import ProgressTrackerPage from './pages/ProgressTrackerPage';
import RunDiffPage from './pages/RunDiffPage';
import SalaryAfterTaxPage from './pages/SalaryAfterTaxPage';
import ScenarioLibraryPage from './pages/ScenarioLibraryPage';
import SequenceRiskRadarPage from './pages/SequenceRiskRadarPage';
import SideHustleLabPage from './pages/SideHustleLabPage';
import SimulationPage from './pages/SimulationPage';
import DepositStrategyPage from './pages/DepositStrategyPage';
import StressTestLabPage from './pages/StressTestLabPage';
import TimeAccountingPage from './pages/TimeAccountingPage';
import TutorialLandingPage from './pages/TutorialLandingPage';
import TutorialPage from './pages/TutorialPage';
import UncertaintyTracksPage from './pages/UncertaintyTracksPage';
import WithdrawalStrategyPage from './pages/WithdrawalStrategyPage';
import {
  SimulationEnginePage,
  SimulationInvestPage,
  SimulationPlanPage,
  SimulationStartTaxPage,
} from './pages/SimulationSetupPages';

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

  // Note: /time-accounting, /fixed-vs-flexible-spending, /life-events-simulator,
  // /side-hustle-lab, /housing-decision-studio, /household-negotiation-board,
  // /family-mode-planner, /debt-freedom-optimizer, /emergency-buffer-optimizer, and
  // /insurance-risk-shield are NOT skeleton routes — they have dedicated, fully-built page
  // components registered as explicit <Route> entries above (Phase 4 of
  // firecasting/docs/frontend-ui-plan.md). Placeholder section data for them used to live
  // here and has been removed.

  // Note: /scenario-library, /fire-milestones, /confidence-funnel, /goal-planner,
  // /uncertainty-tracks, and /plan-report are NOT skeleton routes — they have dedicated,
  // fully-built page components registered as explicit <Route> entries above (Phase 3 of
  // firecasting/docs/frontend-ui-plan.md). Placeholder section data for them used to live
  // here and has been removed.

  // Note: /policy-builder, /deposit-strategy, /withdrawal-strategy are NOT skeleton routes —
  // they have dedicated, fully-built page components (PolicyBuilderPage, DepositStrategyPage,
  // WithdrawalStrategyPage) registered as explicit <Route> entries above. Placeholder section
  // data for them used to live here, but was dead/unreachable (shadowed by the explicit routes)
  // and has been removed.

  // Note: /stress-test-lab and /model-validation-suite are NOT skeleton routes — they have
  // dedicated, fully-built page components registered as explicit <Route> entries above
  // (Phase 6 of firecasting/docs/frontend-ui-plan.md). Placeholder section data for them
  // used to live here and has been removed.

  // Note: /cashflow-command-center, /portfolio, and /sequence-risk-radar are NOT skeleton
  // routes — they have dedicated, fully-built page components registered as explicit
  // <Route> entries above (Phase 5 of firecasting/docs/frontend-ui-plan.md). Placeholder
  // section data for them used to live here and has been removed.

  // Note: /decision-replay and /happiness-tracker are NOT skeleton routes — they have
  // dedicated, fully-built page components registered as explicit <Route> entries above
  // (Phase 6 of firecasting/docs/frontend-ui-plan.md). Placeholder section data for them
  // used to live here and has been removed. /community-benchmarks and /advisor-share-portal
  // below remain skeleton routes deliberately — they need backend/product decisions
  // (anonymized aggregation + k-anonymity policy; auth + permissioned sharing) before
  // frontend work can proceed for real.

  // Reflect
  {
    path: '/community-benchmarks',
    title: 'Community Benchmarks (privacy-safe)',
    sections: [
      {
        title: 'Cohort compare (privacy-safe) (placeholder)',
        bullets: ['Country, age band, savings rate band, goal type (placeholder)'],
        fields: [
          { label: 'Country', placeholder: 'select (placeholder)' },
          { label: 'Age band', placeholder: 'e.g. 25–34 (placeholder)' },
          { label: 'Savings rate band', placeholder: 'e.g. 10–20% (placeholder)' },
          { label: 'Goal type', placeholder: 'FI / house / buffer / lifestyle (placeholder)' },
        ],
        actions: ['View aggregate (placeholder)'],
        widgets: [
          { kind: 'chart', title: 'Distribution (aggregate)', subtitle: 'Chart placeholder: anonymized histogram.' },
          { kind: 'table', title: 'Aggregate stats', columns: ['Metric', 'P25', 'P50', 'P75', 'Notes'], rows: 6 },
        ],
      },
      {
        title: 'Privacy model (placeholder)',
        bullets: ['Anonymized aggregates only.', 'Minimum cohort size (k-anonymity) before any stats are shown.', 'No raw scenario data is shared.'],
        widgets: [
          { kind: 'cards', title: 'Privacy guarantees', cards: [
            { title: 'Aggregates only', body: 'Only cohort-level percentiles and counts are displayed.' },
            { title: 'k-anonymity threshold', body: 'If the cohort is too small, we show nothing.' },
            { title: 'Opt-in', body: 'Sharing is opt-in and can be revoked.' },
          ] },
        ],
      },
      {
        title: 'Your sharing status (placeholder)',
        fields: [
          { label: 'Opt-in sharing', placeholder: 'off / on (placeholder)' },
          { label: 'Shared fields', placeholder: 'coarse aggregates only (placeholder)' },
        ],
        actions: ['Enable sharing (placeholder)', 'Revoke sharing (placeholder)'],
      },
    ],
  },
  {
    path: '/advisor-share-portal',
    title: 'Advisor / Share Portal',
    sections: [
      { title: 'Share mode', bullets: ['Partner/advisor read access (placeholder)', 'Permissions + comments (placeholder)'] },
      {
        title: 'Share controls (placeholder)',
        fields: [
          { label: 'Invite by email/link', placeholder: 'partner/advisor' },
          { label: 'Permissions', placeholder: 'read / comment / edit (placeholder)' },
          { label: 'Scope', placeholder: 'which scenarios/pages are shared' },
        ],
        actions: ['Create share link (placeholder)', 'Revoke access (placeholder)'],
      },
      {
        title: 'Shared items (placeholder)',
        widgets: [
          { kind: 'table', title: 'Links & invites', columns: ['Recipient', 'Permission', 'Scope', 'Created', 'Status', 'Action'], rows: 5 },
          { kind: 'table', title: 'Comments', columns: ['Page', 'Comment', 'Author', 'Time'], rows: 5 },
        ],
      },
      {
        title: 'Permissions matrix (placeholder)',
        widgets: [
          { kind: 'table', title: 'Matrix', columns: ['Capability', 'Read', 'Comment', 'Edit', 'Notes'], rows: 6 },
        ],
      },
      {
        title: 'Audit log (placeholder)',
        widgets: [
          { kind: 'table', title: 'Events', columns: ['Time', 'Event', 'Actor', 'Result'], rows: 6 },
        ],
      },
    ],
  },

  // Challenges
];

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Firecasting */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/category/:categoryId" element={<CategoryLandingPage />} />
      <Route path="/info" element={<InfoPage />} />
      <Route path="/feedback" element={<FeedbackPage />} />
      <Route path="/assumptions" element={<AssumptionsHubPage />} />
      <Route path="/security-privacy" element={<SecurityPrivacyCenterPage />} />

      {/* Existing app pages */}
      <Route path="/tutorial" element={<TutorialLandingPage />} />
      <Route path="/tutorial/:mode" element={<TutorialPage />} />
      <Route path="/diff-scenarios" element={<RunDiffPage />} />
      <Route path="/salary-after-tax" element={<SalaryAfterTaxPage />} />
      <Route path="/simulation-start-tax" element={<SimulationStartTaxPage />} />
      <Route path="/simulation-tax-exemptions" element={<Navigate to="/simulation-start-tax" replace />} />
      <Route path="/money-perspective" element={<MoneyPerspectivePage />} />
      <Route path="/progress-tracker" element={<ProgressTrackerPage />} />
      <Route path="/fire-simulator" element={<FireSimulatorPage />} />
      <Route path="/simulation" element={<SimulationPage />} />
      <Route path="/simulation/tutorial" element={<TutorialLandingPage />} />
      <Route path="/simulation/tutorial/:mode" element={<TutorialPage />} />
      <Route path="/simulation/diff" element={<RunDiffPage />} />
      <Route path="/policy-builder" element={<PolicyBuilderPage />} />
      <Route path="/simulation-invest" element={<SimulationInvestPage />} />
      <Route path="/simulation-engine" element={<SimulationEnginePage />} />
      <Route path="/simulation-plan" element={<SimulationPlanPage />} />
      <Route path="/deposit-strategy" element={<DepositStrategyPage />} />
      <Route path="/withdrawal-strategy" element={<WithdrawalStrategyPage />} />
      <Route path="/scenario-library" element={<ScenarioLibraryPage />} />
      <Route path="/fire-milestones" element={<FireMilestonesPage />} />
      <Route path="/confidence-funnel" element={<ConfidenceFunnelPage />} />
      <Route path="/goal-planner" element={<GoalPlannerPage />} />
      <Route path="/uncertainty-tracks" element={<UncertaintyTracksPage />} />
      <Route path="/plan-report" element={<PlanReportPage />} />
      <Route path="/time-accounting" element={<TimeAccountingPage />} />
      <Route path="/fixed-vs-flexible-spending" element={<FixedVsFlexibleSpendingPage />} />
      <Route path="/life-events-simulator" element={<LifeEventsSimulatorPage />} />
      <Route path="/side-hustle-lab" element={<SideHustleLabPage />} />
      <Route path="/housing-decision-studio" element={<HousingDecisionStudioPage />} />
      <Route path="/household-negotiation-board" element={<HouseholdNegotiationBoardPage />} />
      <Route path="/family-mode-planner" element={<FamilyModePlannerPage />} />
      <Route path="/debt-freedom-optimizer" element={<DebtFreedomOptimizerPage />} />
      <Route path="/emergency-buffer-optimizer" element={<EmergencyBufferOptimizerPage />} />
      <Route path="/insurance-risk-shield" element={<InsuranceRiskShieldPage />} />
      <Route path="/cashflow-command-center" element={<CashflowCommandCenterPage />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="/sequence-risk-radar" element={<SequenceRiskRadarPage />} />
      <Route path="/decision-replay" element={<DecisionReplayPage />} />
      <Route path="/happiness-tracker" element={<HappinessTrackerPage />} />
      <Route path="/stress-test-lab" element={<StressTestLabPage />} />
      <Route path="/model-validation-suite" element={<ModelValidationSuitePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/decision-journal" element={<DecisionJournalPage />} />
      <Route path="/no-spend-challenge-arena" element={<NoSpendChallengeArenaPage />} />

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
