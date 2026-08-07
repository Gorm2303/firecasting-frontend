import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { convertSalaryAmountBetweenPeriods } from '../lib/income/sharedSalary';
import { deriveReferenceNetSalary } from '../lib/income/referenceNetSalary';
import { seedForMode } from '../models/advancedSimulation';
import { normalizeAssumptions, useAssumptions, type Assumptions } from '../state/assumptions';
import { clearAssumptionsHistory, listAssumptionsHistory } from '../state/assumptionsHistory';
import { loadAssumptionsGovernance, saveAssumptionsGovernance, type AssumptionsGovernance } from '../state/assumptionsGovernance';
import { deleteAssumptionsProfile, listAssumptionsProfiles, saveAssumptionsProfile } from '../state/assumptionsProfiles';
import {
  filterUsedByForAssumptionsHub,
  getRegistryEnumOptions,
  isNumericRegistryUnit,
  listRegistryByTab,
  type AssumptionRegistryItem,
} from '../state/assumptionsRegistry';
import { listConventionsByGroup } from '../state/conventionsRegistry';
import { getDefaultExecutionDefaults, type ExecutionDefaults, useExecutionDefaults } from '../state/executionDefaults';
import { listSimulationSnapshots } from '../state/simulationSnapshots';
import { useUiPreferences } from '../state/uiPreferences';
import { computeAssumptionsImpact } from '../utils/assumptionsImpact';

type HubTabId =
  | 'overview'
  | 'plan'
  | 'tax'
  | 'income'
  | 'expense'
  | 'invest'
  | 'deposit'
  | 'withdrawal'
  | 'policy'
  | 'milestones'
  | 'goals'
  | 'execution'
  | 'conventions'
  | 'preview';

type BaselineHubTabId =
  | 'plan'
  | 'tax'
  | 'income'
  | 'expense'
  | 'invest'
  | 'deposit'
  | 'withdrawal'
  | 'policy'
  | 'milestones'
  | 'goals';

type HubViewMode = 'basic' | 'advanced' | 'page';

type DiffRow = {
  keyPath: string;
  label: string;
  unit: string;
  usedBy: string[];
  from: unknown;
  to: unknown;
};

type HubFieldSection = {
  title: string;
  description?: string;
  keyPaths: string[];
};

type SectionedBaselineItems = {
  sections: Array<HubFieldSection & { items: AssumptionRegistryItem[] }>;
  additionalFields: AssumptionRegistryItem[];
  placeholders: AssumptionRegistryItem[];
};

const cardStyle: React.CSSProperties = {
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 14,
  padding: 14,
};

const fieldRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(170px, 0.9fr) minmax(0, 1.2fr)',
  gap: 10,
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--fc-card-border)',
  background: 'var(--fc-card-bg)',
  color: 'inherit',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  colorScheme: 'light dark',
};

const chipStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid var(--fc-card-border)',
  background: 'transparent',
  color: 'inherit',
};

const consumerChipStyle: React.CSSProperties = {
  ...chipStyle,
  padding: '2px 8px',
  fontSize: 11,
  opacity: 0.85,
};

const HUB_TABS: Array<{ id: HubTabId; label: string; isBaseline?: boolean }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'Plan', isBaseline: true },
  { id: 'tax', label: 'Tax', isBaseline: true },
  { id: 'income', label: 'Income', isBaseline: true },
  { id: 'expense', label: 'Expense', isBaseline: true },
  { id: 'invest', label: 'Invest', isBaseline: true },
  { id: 'deposit', label: 'Deposit', isBaseline: true },
  { id: 'withdrawal', label: 'Withdrawal', isBaseline: true },
  { id: 'policy', label: 'Policy', isBaseline: true },
  { id: 'milestones', label: 'Milestones', isBaseline: true },
  { id: 'goals', label: 'Goals', isBaseline: true },
  { id: 'execution', label: 'Execution' },
  { id: 'conventions', label: 'Conventions' },
  { id: 'preview', label: 'Preview' },
];

const BASELINE_HUB_TABS: Array<{ id: BaselineHubTabId; label: string; isBaseline: true }> = HUB_TABS.filter(
  (tab): tab is { id: BaselineHubTabId; label: string; isBaseline: true } => Boolean(tab.isBaseline)
);

const PAGE_VIEW_LABEL_OVERRIDES: Record<string, string> = {
  FireSimulator: 'FIRE Simulator',
  MoneyPerspective: 'Money Perspective',
  SalaryTaxator: 'Salary Taxator',
  SimulationEngine: 'Simulation Engine',
  SimulationInvest: 'Simulation Invest',
  SimulationPlan: 'Simulation Plan',
  TaxOptimizer: 'Tax Optimizer',
};

const BASIC_KEY_PATHS: Record<Exclude<HubTabId, 'overview' | 'conventions' | 'preview'>, string[]> = {
  plan: ['fireSimulatorDefaults.templateId', 'fireSimulatorDefaults.startDate', 'fireSimulatorDefaults.phases'],
  tax: [
    'incomeSetupDefaults.taxRegime',
    'fireSimulatorDefaults.overallTaxRule',
    'fireSimulatorDefaults.taxPercentage',
    'salaryTaxatorDefaults.municipalityId',
    'salaryTaxatorDefaults.defaultMunicipalTaxRatePct',
    'salaryTaxatorDefaults.churchMember',
    'salaryTaxatorDefaults.employeePensionRatePct',
    'salaryTaxatorDefaults.otherDeductionsAnnualDkk',
    'salaryTaxatorDefaults.atpMonthlyDkk',
    'salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk',
    'taxExemptionDefaults.exemptionCardLimit',
    'taxExemptionDefaults.exemptionCardYearlyIncrease',
    'taxExemptionDefaults.stockExemptionTaxRate',
    'taxExemptionDefaults.stockExemptionLimit',
    'taxExemptionDefaults.stockExemptionYearlyIncrease',
  ],
  income: [
    'currency',
    'inflationPct',
    'incomeSetupDefaults.referenceSalaryPeriod',
    'incomeSetupDefaults.workingHoursPerMonth',
    'incomeSetupDefaults.referenceGrossSalaryAmount',
    'incomeSetupDefaults.autoDeriveReferenceNetSalary',
    'incomeSetupDefaults.referenceNetSalaryAmount',
    'incomeSetupDefaults.salaryGrowthPct',
  ],
  expense: [
    'moneyPerspectiveDefaults.coreExpenseMonthlyDkk',
  ],
  invest: [
    'fireSimulatorDefaults.returnEngine.returnType',
    'yearlyFeePct',
    'fireSimulatorDefaults.returnEngine.simpleAveragePercentage',
    'fireSimulatorDefaults.returnEngine.distributionType',
    'fireSimulatorDefaults.returnEngine.normalMean',
    'fireSimulatorDefaults.returnEngine.normalStdDev',
    'fireSimulatorDefaults.returnEngine.brownianDrift',
    'fireSimulatorDefaults.returnEngine.brownianVolatility',
    'fireSimulatorDefaults.returnEngine.studentMu',
    'fireSimulatorDefaults.returnEngine.studentSigma',
    'fireSimulatorDefaults.returnEngine.studentNu',
    'fireSimulatorDefaults.returnEngine.regimeTickMonths',
    'fireSimulatorDefaults.returnEngine.regimes',
  ],
  deposit: [
    'depositStrategyDefaults.depositTiming',
    'depositStrategyDefaults.contributionCadence',
    'depositStrategyDefaults.escalationMode',
    'depositStrategyDefaults.routingPriority',
  ],
  withdrawal: [
    'safeWithdrawalPct',
    'withdrawalStrategyDefaults.withdrawalRule',
    'withdrawalStrategyDefaults.inflationAdjustSpending',
    'withdrawalStrategyDefaults.cashBufferTargetMonths',
  ],
  policy: [
    'policyBuilderDefaults.evaluationFrequency',
    'policyBuilderDefaults.conflictResolution',
    'policyBuilderDefaults.cooldownMonths',
    'policyBuilderDefaults.maxSpendingCutPctPerYear',
    'policyBuilderDefaults.maxDepositIncreasePctPerYear',
    'policyBuilderDefaults.warnFailureRiskPct',
    'policyBuilderDefaults.criticalFailureRiskPct',
  ],
  milestones: [
    'fireMilestonesDefaults.confidenceTarget',
    'fireMilestonesDefaults.milestoneStability',
    'fireMilestonesDefaults.sustainedMonths',
    'fireMilestonesDefaults.baristaFireRequiredMonthlyIncomeDkk',
    'fireMilestonesDefaults.leanSpendingMonthlyDkk',
    'fireMilestonesDefaults.fatSpendingMonthlyDkk',
  ],
  goals: [
    'goalPlannerDefaults.fundingOrder',
    'goalPlannerDefaults.goalInflationHandling',
    'goalPlannerDefaults.goalRiskHandling',
  ],
  execution: ['executionDefaults.paths', 'executionDefaults.batchSize', 'executionDefaults.seedMode', 'executionDefaults.customSeed'],
};

const HUB_FIELD_SECTIONS: Partial<Record<HubTabId, HubFieldSection[]>> = {
  plan: [
    {
      title: 'Plan structure',
      description: 'The ordered phase list materialized into the simulator request.',
      keyPaths: ['fireSimulatorDefaults.templateId', 'fireSimulatorDefaults.startDate', 'fireSimulatorDefaults.phases'],
    },
  ],
  tax: [
    {
      title: 'Payroll and tax defaults',
      description: 'Tax and payroll assumptions shared with salary and cashflow tools.',
      keyPaths: [
        'incomeSetupDefaults.taxRegime',
        'salaryTaxatorDefaults.municipalityId',
        'salaryTaxatorDefaults.defaultMunicipalTaxRatePct',
        'salaryTaxatorDefaults.churchMember',
        'salaryTaxatorDefaults.employeePensionRatePct',
        'salaryTaxatorDefaults.otherDeductionsAnnualDkk',
        'salaryTaxatorDefaults.atpMonthlyDkk',
        'salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk',
      ],
    },
    {
      title: 'Simulator tax rules',
      description: 'Top-level tax settings used by the FIRE simulator before phase-specific exemptions apply.',
      keyPaths: [
        'fireSimulatorDefaults.overallTaxRule',
        'fireSimulatorDefaults.taxPercentage',
      ],
    },
    {
      title: 'Investment tax defaults',
      description: 'Tax exemptions and thresholds used by simulation and exploration tools.',
      keyPaths: [
        'taxExemptionDefaults.exemptionCardLimit',
        'taxExemptionDefaults.exemptionCardYearlyIncrease',
        'taxExemptionDefaults.stockExemptionTaxRate',
        'taxExemptionDefaults.stockExemptionLimit',
        'taxExemptionDefaults.stockExemptionYearlyIncrease',
      ],
    },
  ],
  income: [
    {
      title: 'Salary reference',
      description: 'Shared income anchors and salary conversion conventions used across the app.',
      keyPaths: [
        'currency',
        'inflationPct',
        'incomeSetupDefaults.referenceSalaryPeriod',
        'incomeSetupDefaults.workingHoursPerMonth',
        'incomeSetupDefaults.referenceGrossSalaryAmount',
        'incomeSetupDefaults.autoDeriveReferenceNetSalary',
        'incomeSetupDefaults.referenceNetSalaryAmount',
        'incomeSetupDefaults.salaryGrowthPct',
      ],
    },
    {
      title: 'Income modeling',
      description: 'Additional shared income defaults that affect how the rest of the app interprets earnings.',
      keyPaths: [
        'incomeSetupDefaults.incomeModelType',
        'incomeSetupDefaults.bonusFrequency',
        'incomeSetupDefaults.bonusPct',
      ],
    },
  ],
  expense: [
    {
      title: 'Living costs',
      description: 'Shared defaults for the baseline spending line used by expense-focused views.',
      keyPaths: [
        'moneyPerspectiveDefaults.coreExpenseMonthlyDkk',
      ],
    },
  ],
  invest: [
    {
      title: 'Return engine',
      description: 'Advanced return engine controls for the new FIRE simulator.',
      keyPaths: [
        'fireSimulatorDefaults.returnEngine.returnType',
        'fireSimulatorDefaults.returnEngine.simpleAveragePercentage',
        'fireSimulatorDefaults.returnEngine.distributionType',
        'fireSimulatorDefaults.returnEngine.normalMean',
        'fireSimulatorDefaults.returnEngine.normalStdDev',
        'fireSimulatorDefaults.returnEngine.brownianDrift',
        'fireSimulatorDefaults.returnEngine.brownianVolatility',
        'fireSimulatorDefaults.returnEngine.studentMu',
        'fireSimulatorDefaults.returnEngine.studentSigma',
        'fireSimulatorDefaults.returnEngine.studentNu',
        'fireSimulatorDefaults.returnEngine.regimeTickMonths',
        'fireSimulatorDefaults.returnEngine.regimes',
        'yearlyFeePct',
      ],
    },
  ],
  deposit: [
    {
      title: 'Contribution schedule',
      description: 'Recurring deposit timing and escalation defaults for savings plans.',
      keyPaths: [
        'depositStrategyDefaults.depositTiming',
        'depositStrategyDefaults.contributionCadence',
        'depositStrategyDefaults.escalationMode',
        'depositStrategyDefaults.escalationPct',
        'depositStrategyDefaults.escalationDkkPerYear',
        'depositStrategyDefaults.inflationAdjustContributions',
      ],
    },
    {
      title: 'Buffer and routing',
      description: 'Default routing order and cash reserve targets before investing.',
      keyPaths: [
        'depositStrategyDefaults.emergencyBufferTargetMonths',
        'depositStrategyDefaults.routingPriority',
      ],
    },
  ],
  withdrawal: [
    {
      title: 'Withdrawal baseline',
      description: 'Core drawdown assumptions that define spending sustainability.',
      keyPaths: ['safeWithdrawalPct'],
    },
    {
      title: 'Withdrawal policy',
      description: 'Guardrails and cash-buffer defaults for drawdown strategies.',
      keyPaths: [
        'withdrawalStrategyDefaults.withdrawalRule',
        'withdrawalStrategyDefaults.inflationAdjustSpending',
        'withdrawalStrategyDefaults.guardrailFloorPct',
        'withdrawalStrategyDefaults.guardrailCeilingPct',
        'withdrawalStrategyDefaults.maxCutPctPerYear',
        'withdrawalStrategyDefaults.cashBufferTargetMonths',
      ],
    },
  ],
  policy: [
    {
      title: 'Evaluation cadence',
      description: 'How policy checks are coordinated and when they can fire again.',
      keyPaths: [
        'policyBuilderDefaults.evaluationFrequency',
        'policyBuilderDefaults.conflictResolution',
        'policyBuilderDefaults.cooldownMonths',
      ],
    },
    {
      title: 'Alerts and adjustment limits',
      description: 'Failure-risk thresholds and policy change guardrails.',
      keyPaths: [
        'policyBuilderDefaults.maxSpendingCutPctPerYear',
        'policyBuilderDefaults.maxDepositIncreasePctPerYear',
        'policyBuilderDefaults.warnFailureRiskPct',
        'policyBuilderDefaults.criticalFailureRiskPct',
      ],
    },
  ],
  milestones: [
    {
      title: 'Confidence and stability',
      description: 'How milestone achievement is judged and how long it must hold.',
      keyPaths: [
        'fireMilestonesDefaults.confidenceTarget',
        'fireMilestonesDefaults.milestoneStability',
        'fireMilestonesDefaults.sustainedMonths',
      ],
    },
    {
      title: 'Spending thresholds',
      description: 'Shared spending markers for Barista, Lean, and Fat FIRE discussions.',
      keyPaths: [
        'fireMilestonesDefaults.baristaFireRequiredMonthlyIncomeDkk',
        'fireMilestonesDefaults.leanSpendingMonthlyDkk',
        'fireMilestonesDefaults.fatSpendingMonthlyDkk',
      ],
    },
  ],
  goals: [
    {
      title: 'Funding order',
      description: 'Default sequencing for buffer, debt, goals, and FI funding decisions.',
      keyPaths: ['goalPlannerDefaults.fundingOrder'],
    },
    {
      title: 'Inflation and risk handling',
      description: 'How goal values and certainty expectations should be interpreted.',
      keyPaths: [
        'goalPlannerDefaults.goalInflationHandling',
        'goalPlannerDefaults.goalRiskHandling',
      ],
    },
  ],
};

const stringifyValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatValue = (unit: string, value: unknown): string => {
  if (value === undefined) return '—';
  if (unit === 'pct') return typeof value === 'number' ? `${value}%` : `${stringifyValue(value)}%`;
  return stringifyValue(value);
};

const incomeDerivedNetMeta = (assumptions: Assumptions): { value: number; sourceLabel: string } => {
  return deriveReferenceNetSalary({
    referenceSalaryPeriod: assumptions.incomeSetupDefaults.referenceSalaryPeriod,
    referenceGrossSalaryAmount: assumptions.incomeSetupDefaults.referenceGrossSalaryAmount,
    workingHoursPerMonth: assumptions.incomeSetupDefaults.workingHoursPerMonth,
    salaryTaxatorDefaults: assumptions.salaryTaxatorDefaults,
  });
};

const getValueAtKeyPath = (root: unknown, keyPath: string): unknown => {
  const parts = keyPath.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
};

const setObjectValueAtPath = (root: unknown, parts: string[], value: unknown): unknown => {
  if (parts.length === 0) return root;
  const base = root && typeof root === 'object' ? (root as Record<string, unknown>) : {};
  const [head, ...rest] = parts;
  if (rest.length === 0) return { ...base, [head]: value };
  return { ...base, [head]: setObjectValueAtPath(base[head], rest, value) };
};

const buildDiffRows = (
  registryItems: AssumptionRegistryItem[],
  fromRoot: unknown,
  toRoot: unknown
): DiffRow[] => {
  return registryItems
    .map((item) => {
      const from = getValueAtKeyPath(fromRoot, item.keyPath);
      const to = getValueAtKeyPath(toRoot, item.keyPath);
      const same = Object.is(from, to) || JSON.stringify(from) === JSON.stringify(to);
      if (same) return null;
      return {
        keyPath: item.keyPath,
        label: item.label,
        unit: item.unit,
        usedBy: item.usedBy,
        from,
        to,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a as DiffRow).keyPath.localeCompare((b as DiffRow).keyPath)) as DiffRow[];
};

const renderConsumerChips = (usedBy: string[]) => {
  if (usedBy.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
      {usedBy.map((label) => (
        <span key={label} style={consumerChipStyle}>{label}</span>
      ))}
    </div>
  );
};

const renderDiffCards = (rows: DiffRow[]) => {
  if (rows.length === 0) return <div style={{ opacity: 0.8, fontSize: 13 }}>No changes.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row) => {
        const usedBy = filterUsedByForAssumptionsHub(row.usedBy);
        return (
          <div key={row.keyPath} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
            <div style={{ fontWeight: 800 }}>{row.label}</div>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2 }}>
              {formatValue(row.unit, row.from)} → {formatValue(row.unit, row.to)}
            </div>
            {usedBy.length > 0 && <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>Used by: {usedBy.join(', ')}</div>}
            <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{row.keyPath}</div>
          </div>
        );
      })}
    </div>
  );
};

const formatPageViewLabel = (label: string): string => {
  const overridden = PAGE_VIEW_LABEL_OVERRIDES[label];
  if (overridden) return overridden;
  return String(label)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

const buildSectionedBaselineItems = (
  tabId: BaselineHubTabId,
  visibleItems: AssumptionRegistryItem[],
  options?: { includePlaceholders?: boolean }
): SectionedBaselineItems => {
  const includePlaceholders = options?.includePlaceholders ?? true;
  const sectionDefs = HUB_FIELD_SECTIONS[tabId] ?? [];
  const itemByPath = new Map(visibleItems.map((item) => [item.keyPath, item]));
  const assigned = new Set<string>();
  const isPlaceholderItem = (item: AssumptionRegistryItem) => filterUsedByForAssumptionsHub(item.usedBy).length === 0;

  const sections = sectionDefs
    .map((section) => {
      const items = section.keyPaths
        .map((keyPath) => itemByPath.get(keyPath))
        .filter((item): item is AssumptionRegistryItem => {
          if (!item) return false;
          return !isPlaceholderItem(item);
        });
      items.forEach((item) => assigned.add(item.keyPath));
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  const additionalFields = visibleItems
    .filter((item) => !assigned.has(item.keyPath) && !isPlaceholderItem(item))
    .sort((a, b) => a.label.localeCompare(b.label));

  const placeholders = includePlaceholders
    ? visibleItems
        .filter((item) => !assigned.has(item.keyPath) && isPlaceholderItem(item))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return { sections, additionalFields, placeholders };
};

const AssumptionsHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HubTabId>('income');
  const [viewMode, setViewMode] = useState<HubViewMode>('advanced');
  const [selectedPageView, setSelectedPageView] = useState('');
  const [showAssumptionsChangeLog, setShowAssumptionsChangeLog] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [profilesRefresh, setProfilesRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [governance, setGovernance] = useState<AssumptionsGovernance>(() => loadAssumptionsGovernance());
  const {
    currentAssumptions,
    draftAssumptions,
    isDraftDirty,
    updateDraftAssumptions,
    setDraftAssumptions,
    resetDraftToCurrent,
    resetDraftToDefaults,
    saveDraft,
  } = useAssumptions();
  const { uiPrefs, updateUiPrefs } = useUiPreferences();
  const { executionDefaults, updateExecutionDefaults, resetExecutionDefaults } = useExecutionDefaults();

  const baselineLocked = governance.lockBaseline;
  const activeTabMeta = HUB_TABS.find((tab) => tab.id === activeTab);

  const persistGovernance = React.useCallback(
    (patch: Partial<AssumptionsGovernance>) => {
      const next: AssumptionsGovernance = {
        ...governance,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      setGovernance(next);
      saveAssumptionsGovernance(next);
    },
    [governance]
  );

  const timingConventions = useMemo(() => listConventionsByGroup('timing'), []);

  const registryByTab = useMemo(
    () => ({
      plan: listRegistryByTab('fireSimulator').filter(
        (item) =>
          item.keyPath === 'fireSimulatorDefaults.templateId' ||
          item.keyPath === 'fireSimulatorDefaults.startDate' ||
          item.keyPath === 'fireSimulatorDefaults.phases'
      ),
      tax: [
        ...listRegistryByTab('incomeSetup').filter((item) => item.keyPath === 'incomeSetupDefaults.taxRegime'),
        ...listRegistryByTab('fireSimulator').filter(
          (item) => item.keyPath === 'fireSimulatorDefaults.overallTaxRule' || item.keyPath === 'fireSimulatorDefaults.taxPercentage'
        ),
        ...listRegistryByTab('salaryTaxator'),
        ...listRegistryByTab('simulatorTax'),
      ],
      income: [
        ...listRegistryByTab('worldModel').filter((item) => item.keyPath === 'currency' || item.keyPath === 'inflationPct'),
        ...listRegistryByTab('incomeSetup').filter(
          (item) =>
            item.keyPath !== 'incomeSetupDefaults.taxRegime'
        ),
      ],
      expense: listRegistryByTab('moneyPerspective').filter((item) => item.keyPath !== 'moneyPerspectiveDefaults.timeHorizonYears'),
      invest: [
        ...listRegistryByTab('fireSimulator').filter(
          (item) => item.keyPath.startsWith('fireSimulatorDefaults.returnEngine.')
        ),
        ...listRegistryByTab('worldModel').filter((item) => item.keyPath === 'yearlyFeePct' || item.keyPath === 'expectedReturnPct'),
      ],
      deposit: listRegistryByTab('depositStrategy'),
      withdrawal: [
        ...listRegistryByTab('worldModel').filter((item) => item.keyPath === 'safeWithdrawalPct'),
        ...listRegistryByTab('withdrawalStrategy'),
      ],
      policy: listRegistryByTab('policyBuilder'),
      milestones: listRegistryByTab('milestones'),
      goals: listRegistryByTab('goalPlanner'),
      execution: listRegistryByTab('execution'),
    }),
    []
  );

  const previewRegistryItems = useMemo(
    () => [
      ...registryByTab.plan,
      ...registryByTab.tax,
      ...registryByTab.income,
      ...registryByTab.expense,
      ...registryByTab.invest,
      ...registryByTab.deposit,
      ...registryByTab.withdrawal,
      ...registryByTab.policy,
      ...registryByTab.milestones,
      ...registryByTab.goals,
    ],
    [registryByTab]
  );

  const assumptionsProfiles = useMemo(() => {
    void profilesRefresh;
    return listAssumptionsProfiles();
  }, [profilesRefresh]);

  const assumptionsHistory = useMemo(() => {
    if (!showAssumptionsChangeLog) return [];
    void historyRefresh;
    return listAssumptionsHistory();
  }, [historyRefresh, showAssumptionsChangeLog]);

  const simulationSnapshots = useMemo(() => listSimulationSnapshots(), []);
  const selectedSnapshot = useMemo(
    () => simulationSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null,
    [selectedSnapshotId, simulationSnapshots]
  );
  const selectedSnapshotAssumptions = useMemo(
    () => (selectedSnapshot ? normalizeAssumptions(selectedSnapshot.assumptions) : null),
    [selectedSnapshot]
  );

  const currentImpact = useMemo(() => computeAssumptionsImpact(currentAssumptions), [currentAssumptions]);
  const draftImpact = useMemo(() => computeAssumptionsImpact(draftAssumptions), [draftAssumptions]);
  const derivedReferenceNet = useMemo(() => incomeDerivedNetMeta(draftAssumptions), [draftAssumptions]);

  const assumptionsDiffRows = useMemo(
    () => buildDiffRows(previewRegistryItems, currentAssumptions, draftAssumptions),
    [currentAssumptions, draftAssumptions, previewRegistryItems]
  );
  const snapshotDiffRows = useMemo(
    () => (selectedSnapshotAssumptions ? buildDiffRows(previewRegistryItems, selectedSnapshotAssumptions, draftAssumptions) : []),
    [draftAssumptions, previewRegistryItems, selectedSnapshotAssumptions]
  );

  const selectedSnapshotRerunRequest = useMemo(() => {
    if (!selectedSnapshot?.advancedRequest) return null;

    const base = selectedSnapshot.advancedRequest;
    const snapshotSeed = typeof base.seed === 'number' && Number.isFinite(base.seed) ? Math.trunc(base.seed) : 1;
    const snapshotSeedForCustom = snapshotSeed > 0 ? snapshotSeed : 1;
    const seed = seedForMode(executionDefaults.seedMode, executionDefaults.customSeed || snapshotSeedForCustom);
    const next: Record<string, unknown> = { ...base, seed };

    if (base.returnerConfig && typeof base.returnerConfig === 'object') {
      next.returnerConfig = { ...base.returnerConfig, seed };
    }

    if (base.paths !== undefined) next.paths = executionDefaults.paths;
    if (base.batchSize !== undefined) next.batchSize = executionDefaults.batchSize;
    if (executionDefaults.seedMode === 'custom') next.seed = executionDefaults.customSeed;
    if (base.inflationFactor !== undefined) next.inflationFactor = 1 + (Number(draftAssumptions.inflationPct) || 0) / 100;
    if (base.yearlyFeePercentage !== undefined) next.yearlyFeePercentage = Number(draftAssumptions.yearlyFeePct) || 0;

    return next;
  }, [draftAssumptions.inflationPct, draftAssumptions.yearlyFeePct, executionDefaults.batchSize, executionDefaults.customSeed, executionDefaults.paths, executionDefaults.seedMode, selectedSnapshot]);

  const snapshotAdvancedRequestDiffRows = useMemo(() => {
    if (!selectedSnapshot?.advancedRequest || !selectedSnapshotRerunRequest) return [];
    const fields = [
      { keyPath: 'paths', label: 'Paths' },
      { keyPath: 'batchSize', label: 'Batch size' },
      { keyPath: 'seed', label: 'Master seed' },
      { keyPath: 'returnerConfig.seed', label: 'Returner seed' },
      { keyPath: 'inflationFactor', label: 'Inflation factor' },
      { keyPath: 'yearlyFeePercentage', label: 'Yearly fee (%)' },
    ];

    return fields
      .map((field) => {
        const from = getValueAtKeyPath(selectedSnapshot.advancedRequest, field.keyPath);
        const to = getValueAtKeyPath(selectedSnapshotRerunRequest, field.keyPath);
        const same = Object.is(from, to) || JSON.stringify(from) === JSON.stringify(to);
        if (same) return null;
        return { ...field, from, to };
      })
      .filter(Boolean)
      .sort((a, b) => (a as { keyPath: string }).keyPath.localeCompare((b as { keyPath: string }).keyPath)) as Array<{
      keyPath: string;
      label: string;
      from: unknown;
      to: unknown;
    }>;
  }, [selectedSnapshot, selectedSnapshotRerunRequest]);

  const executionOverridesRows = useMemo(() => {
    const defaults = getDefaultExecutionDefaults();
    return registryByTab.execution
      .map((item) => {
        const prop = item.keyPath.replace('executionDefaults.', '');
        const from = (defaults as Record<string, unknown>)[prop];
        const to = (executionDefaults as Record<string, unknown>)[prop];
        const same = Object.is(from, to) || JSON.stringify(from) === JSON.stringify(to);
        if (same) return null;
        return { keyPath: item.keyPath, label: item.label, unit: item.unit, usedBy: item.usedBy, from, to };
      })
      .filter(Boolean)
      .sort((a, b) => (a as DiffRow).keyPath.localeCompare((b as DiffRow).keyPath)) as DiffRow[];
  }, [executionDefaults, registryByTab.execution]);

  const updateDraftValueAtKeyPath = React.useCallback(
    (keyPath: string, nextValue: unknown) => {
      if (baselineLocked) return;
      const parts = keyPath.split('.').filter(Boolean);
      if (parts.length === 0) return;
      if (parts.length === 1) {
        updateDraftAssumptions({ [parts[0]]: nextValue } as Partial<Assumptions>);
        return;
      }
      const [top, ...rest] = parts;
      const nextTop = setObjectValueAtPath((draftAssumptions as Record<string, unknown>)[top], rest, nextValue);
      if (top === 'fireSimulatorDefaults' && keyPath !== 'fireSimulatorDefaults.templateId') {
        const withTemplateReset = setObjectValueAtPath(nextTop, ['templateId'], 'custom');
        updateDraftAssumptions({ [top]: withTemplateReset } as Partial<Assumptions>);
        return;
      }
      updateDraftAssumptions({ [top]: nextTop } as Partial<Assumptions>);
    },
    [baselineLocked, draftAssumptions, updateDraftAssumptions]
  );

  const updateReferenceSalaryPeriod = React.useCallback(
    (nextPeriod: Assumptions['incomeSetupDefaults']['referenceSalaryPeriod']) => {
      if (baselineLocked) return;

      const income = draftAssumptions.incomeSetupDefaults;
      const currentPeriod = income.referenceSalaryPeriod;
      if (nextPeriod === currentPeriod) return;

      const workingHoursPerMonth = income.workingHoursPerMonth > 0 ? income.workingHoursPerMonth : 160;
      const nextGrossSalaryAmount = convertSalaryAmountBetweenPeriods(
        income.referenceGrossSalaryAmount,
        currentPeriod,
        nextPeriod,
        workingHoursPerMonth,
      );

      const nextIncomeSetupDefaults: Assumptions['incomeSetupDefaults'] = {
        ...income,
        referenceSalaryPeriod: nextPeriod,
        referenceGrossSalaryAmount: Number(nextGrossSalaryAmount.toFixed(2)),
      };

      if (!income.autoDeriveReferenceNetSalary) {
        const nextNetSalaryAmount = convertSalaryAmountBetweenPeriods(
          income.referenceNetSalaryAmount,
          currentPeriod,
          nextPeriod,
          workingHoursPerMonth,
        );
        nextIncomeSetupDefaults.referenceNetSalaryAmount = Number(nextNetSalaryAmount.toFixed(2));
      }

      updateDraftAssumptions({ incomeSetupDefaults: nextIncomeSetupDefaults });
    },
    [baselineLocked, draftAssumptions.incomeSetupDefaults, updateDraftAssumptions]
  );

  const updateExecutionValueAtKeyPath = React.useCallback(
    (keyPath: string, nextValue: unknown) => {
      const prop = keyPath.replace('executionDefaults.', '');
      updateExecutionDefaults({ [prop]: nextValue } as Partial<ExecutionDefaults>);
    },
    [updateExecutionDefaults]
  );

  const importAssumptionsJson = React.useCallback(
    async (file: File | null) => {
      setImportStatus('');
      if (!file) return;
      if (baselineLocked) {
        setImportStatus('Baseline is locked. Unlock it before importing into the draft assumptions.');
        return;
      }

      try {
        const text = await file.text();
        const raw = JSON.parse(text) as unknown;
        const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        const maybeGov = root.governance;
        if (maybeGov && typeof maybeGov === 'object') {
          const gov = maybeGov as Record<string, unknown>;
          persistGovernance({
            sourceNote: typeof gov.sourceNote === 'string' ? gov.sourceNote : governance.sourceNote,
            lockBaseline: typeof gov.lockBaseline === 'boolean' ? gov.lockBaseline : governance.lockBaseline,
          });
        }
        const imported = root.draft ?? root.current ?? raw;
        setDraftAssumptions(normalizeAssumptions(imported));
        setImportStatus('Imported into draft. Review the draft, then save when you are ready to make it authoritative.');
      } catch {
        setImportStatus('Import failed. The file could not be parsed as valid assumptions JSON.');
      }
    },
    [baselineLocked, governance.lockBaseline, governance.sourceNote, persistGovernance, setDraftAssumptions]
  );

  const exportAssumptionsJson = React.useCallback(() => {
    const payload = { governance, current: currentAssumptions, draft: draftAssumptions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'assumptions-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [currentAssumptions, draftAssumptions, governance]);

  const visibleBaselineItems = useMemo(() => {
    if (!activeTabMeta?.isBaseline) return [];
    const allItems = registryByTab[activeTab as keyof typeof registryByTab] ?? [];
    if (viewMode === 'advanced') {
      if (activeTab === 'invest') return allItems.filter((item) => item.keyPath !== 'expectedReturnPct');
      return allItems;
    }
    const allowed = new Set(BASIC_KEY_PATHS[activeTab as keyof typeof BASIC_KEY_PATHS] ?? []);
    return allItems.filter((item) => allowed.has(item.keyPath));
  }, [activeTab, activeTabMeta?.isBaseline, registryByTab, viewMode]);

  const pageViewOptions = useMemo(() => {
    return Array.from(
      new Set(
        BASELINE_HUB_TABS.flatMap((tab) =>
          (registryByTab[tab.id] ?? []).flatMap((item) => filterUsedByForAssumptionsHub(item.usedBy))
        )
      )
    )
      .sort((left, right) => formatPageViewLabel(left).localeCompare(formatPageViewLabel(right)))
      .map((value) => ({ value, label: formatPageViewLabel(value) }));
  }, [registryByTab]);

  const effectiveSelectedPageView = useMemo(() => {
    if (pageViewOptions.length === 0) return '';
    if (pageViewOptions.some((option) => option.value === selectedPageView)) return selectedPageView;
    return pageViewOptions[0].value;
  }, [pageViewOptions, selectedPageView]);

  const selectedPageViewOption = useMemo(
    () => pageViewOptions.find((option) => option.value === effectiveSelectedPageView) ?? null,
    [effectiveSelectedPageView, pageViewOptions]
  );

  const sectionedBaselineItems = useMemo(() => {
    if (!activeTabMeta?.isBaseline) {
      return { sections: [], additionalFields: [], placeholders: [] } satisfies SectionedBaselineItems;
    }
    return buildSectionedBaselineItems(activeTab as BaselineHubTabId, visibleBaselineItems);
  }, [activeTab, visibleBaselineItems]);

  const pageViewGroups = useMemo(() => {
    if (viewMode !== 'page' || !effectiveSelectedPageView) return [];

    return BASELINE_HUB_TABS.map((tab) => {
      const items = (registryByTab[tab.id] ?? []).filter((item) =>
        filterUsedByForAssumptionsHub(item.usedBy).includes(effectiveSelectedPageView)
      );
      if (items.length === 0) return null;
      return {
        id: tab.id,
        label: tab.label,
        groupedItems: buildSectionedBaselineItems(tab.id, items, { includePlaceholders: false }),
      };
    }).filter(
      (
        group
      ): group is {
        id: BaselineHubTabId;
        label: string;
        groupedItems: SectionedBaselineItems;
      } => Boolean(group)
    );
  }, [effectiveSelectedPageView, registryByTab, viewMode]);

  const renderBaselineRegistryField = (item: AssumptionRegistryItem) => {
    const inputId = `assumptions-${item.keyPath.replace(/\./g, '-')}`;
    const value = getValueAtKeyPath(draftAssumptions, item.keyPath);
    const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
    const disabled = baselineLocked;
    const autoDeriveReferenceNetSalary = Boolean(draftAssumptions.incomeSetupDefaults.autoDeriveReferenceNetSalary);
    const labelNode = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div>{item.label}</div>
        {renderConsumerChips(usedBy)}
      </div>
    );

    if (item.keyPath === 'incomeSetupDefaults.autoDeriveReferenceNetSalary') {
      return null;
    }

    const returnEngine = draftAssumptions.fireSimulatorDefaults.returnEngine;
    if (item.keyPath === 'fireSimulatorDefaults.returnEngine.simpleAveragePercentage' && returnEngine.returnType !== 'simpleReturn') {
      return null;
    }
    if (item.keyPath === 'fireSimulatorDefaults.returnEngine.distributionType' && returnEngine.returnType !== 'distributionReturn') {
      return null;
    }
    if (
      (item.keyPath === 'fireSimulatorDefaults.returnEngine.normalMean' || item.keyPath === 'fireSimulatorDefaults.returnEngine.normalStdDev') &&
      (returnEngine.returnType !== 'distributionReturn' || returnEngine.distributionType !== 'normal')
    ) {
      return null;
    }
    if (
      (item.keyPath === 'fireSimulatorDefaults.returnEngine.brownianDrift' || item.keyPath === 'fireSimulatorDefaults.returnEngine.brownianVolatility') &&
      (returnEngine.returnType !== 'distributionReturn' || returnEngine.distributionType !== 'brownianMotion')
    ) {
      return null;
    }
    if (
      (item.keyPath === 'fireSimulatorDefaults.returnEngine.studentMu' || item.keyPath === 'fireSimulatorDefaults.returnEngine.studentSigma' || item.keyPath === 'fireSimulatorDefaults.returnEngine.studentNu') &&
      (returnEngine.returnType !== 'distributionReturn' || returnEngine.distributionType !== 'studentT')
    ) {
      return null;
    }
    if (
      (item.keyPath === 'fireSimulatorDefaults.returnEngine.regimeTickMonths' || item.keyPath === 'fireSimulatorDefaults.returnEngine.regimes') &&
      (returnEngine.returnType !== 'distributionReturn' || returnEngine.distributionType !== 'regimeBased')
    ) {
      return null;
    }

    if (item.keyPath === 'incomeSetupDefaults.referenceNetSalaryAmount') {
      const displayValue = autoDeriveReferenceNetSalary ? derivedReferenceNet.value : value;
      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <input
                aria-label="Auto-calculate reference net salary"
                type="checkbox"
                checked={autoDeriveReferenceNetSalary}
                disabled={disabled}
                onChange={(event) => updateDraftValueAtKeyPath('incomeSetupDefaults.autoDeriveReferenceNetSalary', event.target.checked)}
              />
              Auto-calculate from Salary Taxator assumptions
            </label>
            <input
              id={inputId}
              aria-label={item.label}
              type="number"
              step={draftAssumptions.incomeSetupDefaults.referenceSalaryPeriod === 'hourly' ? 0.1 : 1}
              value={typeof displayValue === 'number' && Number.isFinite(displayValue) ? displayValue : ''}
              disabled={disabled || autoDeriveReferenceNetSalary}
              onChange={(event) => updateDraftValueAtKeyPath(item.keyPath, Number(event.target.value))}
              style={inputStyle}
            />
            {autoDeriveReferenceNetSalary && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Calculated from Salary Taxator assumptions using {derivedReferenceNet.sourceLabel}.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (item.unit === 'boolean') {
      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
          <input
            id={inputId}
            aria-label={item.label}
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => updateDraftValueAtKeyPath(item.keyPath, event.target.checked)}
          />
        </div>
      );
    }

    if (item.unit === 'enum') {
      const options = getRegistryEnumOptions(item.keyPath);
      if (options && options.length > 0) {
        const selectedValue = typeof value === 'string' ? value : String(value ?? options[0]);
        return (
          <div key={item.keyPath} style={fieldRowStyle}>
            <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
            <select
              className="fc-themed-select"
              id={inputId}
              aria-label={item.label}
              value={options.includes(selectedValue) ? selectedValue : options[0]}
              disabled={disabled}
              onChange={(event) => {
                if (item.keyPath === 'incomeSetupDefaults.referenceSalaryPeriod') {
                  updateReferenceSalaryPeriod(event.target.value as Assumptions['incomeSetupDefaults']['referenceSalaryPeriod']);
                  return;
                }
                updateDraftValueAtKeyPath(item.keyPath, event.target.value);
              }}
              style={selectStyle}
            >
              {options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );
      }
    }

    if (item.unit === 'json') {
      const draftValue = jsonDrafts[item.keyPath];
      const displayValue = draftValue ?? JSON.stringify(value ?? item.default ?? [], null, 2);
      const error = jsonErrors[item.keyPath];

      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
          <div style={{ display: 'grid', gap: 8 }}>
            <textarea
              id={inputId}
              aria-label={item.label}
              value={displayValue}
              disabled={disabled}
              rows={10}
              onChange={(event) => {
                const next = event.target.value;
                setJsonDrafts((prev) => ({ ...prev, [item.keyPath]: next }));
              }}
              onBlur={() => {
                const next = jsonDrafts[item.keyPath] ?? displayValue;
                try {
                  const parsed = JSON.parse(next);
                  updateDraftValueAtKeyPath(item.keyPath, parsed);
                  setJsonErrors((prev) => {
                    const clone = { ...prev };
                    delete clone[item.keyPath];
                    return clone;
                  });
                  setJsonDrafts((prev) => {
                    const clone = { ...prev };
                    delete clone[item.keyPath];
                    return clone;
                  });
                } catch {
                  setJsonErrors((prev) => ({ ...prev, [item.keyPath]: 'Invalid JSON. Fix the value before leaving the field.' }));
                }
              }}
              style={{ ...inputStyle, minHeight: 220, fontFamily: 'Consolas, Monaco, monospace' }}
            />
            {error ? <div style={{ fontSize: 12, color: '#b42318' }}>{error}</div> : null}
          </div>
        </div>
      );
    }

    if (isNumericRegistryUnit(item.unit)) {
      const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : value == null ? '' : Number(value);
      const numericStep = item.keyPath === 'incomeSetupDefaults.referenceGrossSalaryAmount'
        ? (draftAssumptions.incomeSetupDefaults.referenceSalaryPeriod === 'hourly' ? 0.1 : 1)
        : item.unit === 'pct'
          ? 0.1
          : 1;
      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
          <input
            id={inputId}
            aria-label={item.label}
            type="number"
            step={numericStep}
            value={Number.isFinite(numericValue as number) ? numericValue : ''}
            disabled={disabled}
            onChange={(event) => updateDraftValueAtKeyPath(item.keyPath, Number(event.target.value))}
            style={inputStyle}
          />
        </div>
      );
    }

    const placeholder = item.keyPath === 'currency' ? 'e.g. DKK' : item.keyPath === 'salaryTaxatorDefaults.municipalityId' ? 'average or municipality id' : undefined;
    return (
      <div key={item.keyPath} style={fieldRowStyle}>
        <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
        <input
          id={inputId}
          aria-label={item.label}
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          disabled={disabled}
          onChange={(event) => updateDraftValueAtKeyPath(item.keyPath, event.target.value)}
          style={inputStyle}
          placeholder={placeholder}
        />
      </div>
    );
  };

  const renderExecutionRegistryField = (item: AssumptionRegistryItem) => {
    const inputId = `execution-${item.keyPath.replace(/\./g, '-')}`;
    const prop = item.keyPath.replace('executionDefaults.', '');
    const value = (executionDefaults as Record<string, unknown>)[prop];
    if (item.keyPath === 'executionDefaults.customSeed' && executionDefaults.seedMode !== 'custom') return null;
    const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
    const labelNode = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div>{item.label}</div>
        {renderConsumerChips(usedBy)}
      </div>
    );

    if (item.unit === 'enum') {
      const options = item.keyPath === 'executionDefaults.seedMode' ? ['default', 'custom', 'random'] : getRegistryEnumOptions(item.keyPath) ?? [];
      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
          <select
            className="fc-themed-select"
            id={inputId}
            aria-label={item.label}
            value={typeof value === 'string' ? value : String(value ?? '')}
            onChange={(event) => updateExecutionValueAtKeyPath(item.keyPath, event.target.value)}
            style={selectStyle}
          >
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={item.keyPath} style={fieldRowStyle}>
        <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
        <input
          id={inputId}
          aria-label={item.label}
          type="number"
          min={1}
          step={1}
          value={typeof value === 'number' ? value : value == null ? '' : Number(value)}
          onChange={(event) => updateExecutionValueAtKeyPath(item.keyPath, Number(event.target.value))}
          style={inputStyle}
        />
      </div>
    );
  };

  const baselineSummary = `${currentAssumptions.currency} · Inflation ${currentAssumptions.inflationPct}% · Fee ${currentAssumptions.yearlyFeePct}% · Return ${currentAssumptions.expectedReturnPct}% · SWR ${currentAssumptions.safeWithdrawalPct}%`;
  const viewModeDescription =
    viewMode === 'basic'
      ? 'Basic view keeps each tab focused on the currently aligned assumptions.'
      : viewMode === 'advanced'
        ? 'Advanced view exposes the full registry-backed editor, including placeholder fields that are not fully wired yet.'
        : 'Page view lists only the assumptions used by a selected page, grouped by Hub domain instead of tabs.';

  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={cardStyle}>
          <h1 style={{ margin: 0 }}>Assumptions Hub</h1>
          <div style={{ opacity: 0.78, marginTop: 6 }}>
            Single source of truth for the app’s baseline assumptions, with draft editing and preview tooling stored locally for now.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {(['basic', 'advanced', 'page'] as HubViewMode[]).map((mode) => {
              const isActive = mode === viewMode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setViewMode(mode)}
                  style={{
                    ...chipStyle,
                    fontWeight: isActive ? 800 : 700,
                    opacity: isActive ? 1 : 0.8,
                    borderColor: isActive ? '#7ca8ff' : 'var(--fc-card-border)',
                  }}
                >
                  {mode[0].toUpperCase() + mode.slice(1)} view
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>{viewModeDescription}</div>
          {isDraftDirty && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>You have unsaved draft changes.</div>}
          {baselineLocked && <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>Baseline is locked.</div>}
        </div>

        {viewMode !== 'page' && (
          <div role="tablist" aria-label="Assumptions Hub sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HUB_TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  style={{ padding: '8px 10px', fontWeight: isActive ? 850 : 700, opacity: isActive ? 1 : 0.82 }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {viewMode === 'page' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 850, fontSize: 18 }}>Page assumptions</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>Current (saved): {baselineSummary}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={saveDraft} disabled={baselineLocked || !isDraftDirty}>Save</button>
                <button type="button" onClick={resetDraftToCurrent} disabled={baselineLocked || !isDraftDirty}>Cancel</button>
                <button type="button" onClick={resetDraftToDefaults} disabled={baselineLocked}>Reset to defaults</button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.82 }}>
              {baselineLocked
                ? 'Baseline edits remain disabled while locked, but you can still inspect assumptions by page.'
                : 'Choose a page to list every shared baseline assumption it uses, grouped by Hub domain.'}
            </div>

            <div style={{ ...fieldRowStyle, marginTop: 12 }}>
              <label htmlFor="assumptions-page-view" style={{ fontWeight: 700 }}>Page</label>
              <select
                className="fc-themed-select"
                id="assumptions-page-view"
                aria-label="Page"
                value={effectiveSelectedPageView}
                onChange={(event) => setSelectedPageView(event.target.value)}
                style={selectStyle}
              >
                {pageViewOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {selectedPageViewOption && (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.82 }}>
                Showing assumptions used by {selectedPageViewOption.label}.
              </div>
            )}

            {pageViewGroups.length === 0 ? (
              <div style={{ marginTop: 14, fontSize: 13, opacity: 0.8 }}>No shared baseline assumptions are registered for this page yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 14 }}>
                {pageViewGroups.map((group) => (
                  <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 850, fontSize: 18 }}>{group.label}</div>

                    {group.groupedItems.sections.map((section) => (
                      <div key={`${group.id}-${section.title}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{section.title}</div>
                          {section.description && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{section.description}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {section.items.map(renderBaselineRegistryField)}
                        </div>
                      </div>
                    ))}

                    {group.groupedItems.additionalFields.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>Additional fields</div>
                          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                            These fields are used by this page but do not fit a curated section yet.
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {group.groupedItems.additionalFields.map(renderBaselineRegistryField)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode !== 'page' && activeTabMeta?.isBaseline && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 850, fontSize: 18 }}>{activeTabMeta.label} assumptions</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>Current (saved): {baselineSummary}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={saveDraft} disabled={baselineLocked || !isDraftDirty}>Save</button>
                <button type="button" onClick={resetDraftToCurrent} disabled={baselineLocked || !isDraftDirty}>Cancel</button>
                <button type="button" onClick={resetDraftToDefaults} disabled={baselineLocked}>Reset to defaults</button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.82 }}>
              {baselineLocked
                ? 'Baseline edits and JSON imports are disabled while the baseline is locked.'
                : viewMode === 'basic'
                  ? 'Basic mode keeps this tab focused on the assumptions that are already aligned with current workflows.'
                  : 'Advanced mode includes the full registry-backed set for this tab, including placeholders not fully wired yet.'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
              {sectionedBaselineItems.sections.map((section) => (
                <div key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{section.title}</div>
                    {section.description && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{section.description}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {section.items.map(renderBaselineRegistryField)}
                  </div>
                </div>
              ))}

              {sectionedBaselineItems.additionalFields.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Additional fields</div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                      These fields have downstream consumers, but they do not fit the curated sections above yet.
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sectionedBaselineItems.additionalFields.map(renderBaselineRegistryField)}
                  </div>
                </div>
              )}

              {sectionedBaselineItems.placeholders.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Placeholder</div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                      These fields are currently only used by Assumptions Hub, so they stay grouped separately at the bottom.
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sectionedBaselineItems.placeholders.map(renderBaselineRegistryField)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode !== 'page' && activeTab === 'overview' && (
          <>
            <div style={cardStyle}>
              <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Assumption profiles</div>
              <div style={{ opacity: 0.8, marginBottom: 10, fontSize: 13 }}>Save named baseline assumption sets locally. Loading a profile copies it into draft.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={fieldRowStyle}>
                  <label htmlFor="assumptions-profile-name" style={{ fontWeight: 700 }}>Profile name</label>
                  <input
                    id="assumptions-profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="e.g. Baseline, Conservative"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={!profileName.trim()}
                    onClick={() => {
                      saveAssumptionsProfile(profileName, normalizeAssumptions(draftAssumptions));
                      setProfileName('');
                      setProfilesRefresh((value) => value + 1);
                    }}
                  >
                    Save draft as profile
                  </button>
                </div>
                {assumptionsProfiles.length === 0 ? (
                  <div style={{ opacity: 0.8, fontSize: 13 }}>No profiles yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assumptionsProfiles.slice(0, 20).map((profile) => (
                      <div key={profile.id} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 800 }}>{profile.name}</div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>{new Date(profile.createdAt).toLocaleString()}</div>
                        </div>
                        <div style={{ opacity: 0.85, fontSize: 13 }}>
                          {profile.assumptions.currency} · Inflation {profile.assumptions.inflationPct}% · Fee {profile.assumptions.yearlyFeePct}% · Return {profile.assumptions.expectedReturnPct}% · SWR {profile.assumptions.safeWithdrawalPct}%
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" disabled={baselineLocked} onClick={() => setDraftAssumptions(normalizeAssumptions(profile.assumptions))}>Load into draft</button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteAssumptionsProfile(profile.id);
                              setProfilesRefresh((value) => value + 1);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Governance & import/export</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ marginBottom: 4, fontSize: 13, opacity: 0.82 }}>
                  Locking the baseline prevents accidental draft edits and imports. It does not hide preview tooling.
                </div>
                <div style={fieldRowStyle}>
                  <label htmlFor="assumptions-source" style={{ fontWeight: 700 }}>Source note</label>
                  <textarea
                    id="assumptions-source"
                    value={governance.sourceNote}
                    onChange={(event) => persistGovernance({ sourceNote: event.target.value })}
                    placeholder="Where did these assumptions come from?"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <label htmlFor="assumptions-lock" style={{ fontWeight: 700 }}>Lock baseline</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input id="assumptions-lock" type="checkbox" checked={governance.lockBaseline} onChange={(event) => persistGovernance({ lockBaseline: event.target.checked })} />
                    <div style={{ opacity: 0.8, fontSize: 13 }}>Prevents accidental edits and JSON imports into the draft.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 750 }}>
                    <input type="checkbox" checked={uiPrefs.showAssumptionsBar} onChange={(event) => updateUiPrefs({ showAssumptionsBar: event.target.checked })} />
                    Show assumptions bar at top
                  </label>
                  <div style={{ opacity: 0.75, fontSize: 13, textAlign: 'right' }}>Default is hidden.</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={exportAssumptionsJson}>Export JSON</button>
                  <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <input
                      type="file"
                      accept="application/json"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files && event.target.files.length ? event.target.files[0] : null;
                        void importAssumptionsJson(file);
                        event.target.value = '';
                      }}
                      disabled={baselineLocked}
                    />
                    <span style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--fc-card-border)', cursor: baselineLocked ? 'not-allowed' : 'pointer', userSelect: 'none', opacity: baselineLocked ? 0.55 : 1 }}>
                      Import JSON
                    </span>
                  </label>
                  <button type="button" onClick={() => setShowAssumptionsChangeLog((value) => !value)}>
                    {showAssumptionsChangeLog ? 'Hide change log' : 'View change log'}
                  </button>
                  {showAssumptionsChangeLog && (
                    <button
                      type="button"
                      onClick={() => {
                        clearAssumptionsHistory();
                        setHistoryRefresh((value) => value + 1);
                      }}
                    >
                      Clear change log
                    </button>
                  )}
                </div>
                {importStatus && <div style={{ fontSize: 13, opacity: 0.88 }}>{importStatus}</div>}
                {showAssumptionsChangeLog && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Change log</div>
                    {assumptionsHistory.length === 0 ? (
                      <div style={{ opacity: 0.8, fontSize: 13 }}>No saved entries yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {assumptionsHistory.slice(0, 20).map((entry) => (
                          <div key={entry.id} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 800 }}>{new Date(entry.createdAt).toLocaleString()}</div>
                              <button type="button" disabled={baselineLocked} onClick={() => setDraftAssumptions(normalizeAssumptions(entry.assumptions))}>Use as draft</button>
                            </div>
                            <div style={{ opacity: 0.82, fontSize: 13, marginTop: 2 }}>
                              {entry.assumptions.currency} · Inflation {entry.assumptions.inflationPct}% · Fee {entry.assumptions.yearlyFeePct}% · Return {entry.assumptions.expectedReturnPct}% · SWR {entry.assumptions.safeWithdrawalPct}%
                            </div>
                            {entry.sourceNote && <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{entry.sourceNote}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Impact preview</div>
              <div style={{ opacity: 0.8, marginBottom: 10, fontSize: 13 }}>Quick derived metrics for current vs draft. This stays intentionally approximate.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.7fr)', gap: 10 }}>
                <div style={{ fontWeight: 800, opacity: 0.9 }}>Metric</div>
                <div style={{ fontWeight: 800, opacity: 0.9 }}>Current</div>
                <div style={{ fontWeight: 800, opacity: 0.9 }}>Draft</div>
                <div style={{ fontWeight: 800, opacity: 0.9 }}>Δ</div>
                {[
                  {
                    label: 'Net nominal return (return − fee)',
                    current: `${currentImpact.nominalNetReturnPct.toFixed(2)}%`,
                    draft: `${draftImpact.nominalNetReturnPct.toFixed(2)}%`,
                    delta: `${(draftImpact.nominalNetReturnPct - currentImpact.nominalNetReturnPct).toFixed(2)}pp`,
                  },
                  {
                    label: 'Approx real return',
                    current: `${currentImpact.approxRealReturnPct.toFixed(2)}%`,
                    draft: `${draftImpact.approxRealReturnPct.toFixed(2)}%`,
                    delta: `${(draftImpact.approxRealReturnPct - currentImpact.approxRealReturnPct).toFixed(2)}pp`,
                  },
                  {
                    label: 'Safe monthly spend per 1,000,000',
                    current: Math.round(currentImpact.safeMonthlySpendPer1MDkk).toLocaleString(),
                    draft: Math.round(draftImpact.safeMonthlySpendPer1MDkk).toLocaleString(),
                    delta: Math.round(draftImpact.safeMonthlySpendPer1MDkk - currentImpact.safeMonthlySpendPer1MDkk).toLocaleString(),
                  },
                  {
                    label: 'FI number',
                    current: currentImpact.fiNumberDkk === null ? '—' : Math.round(currentImpact.fiNumberDkk).toLocaleString(),
                    draft: draftImpact.fiNumberDkk === null ? '—' : Math.round(draftImpact.fiNumberDkk).toLocaleString(),
                    delta: currentImpact.fiNumberDkk === null || draftImpact.fiNumberDkk === null ? '—' : Math.round(draftImpact.fiNumberDkk - currentImpact.fiNumberDkk).toLocaleString(),
                  },
                ].map((row) => (
                  <React.Fragment key={row.label}>
                    <div style={{ opacity: 0.92 }}>{row.label}</div>
                    <div style={{ fontWeight: 750 }}>{row.current}</div>
                    <div style={{ fontWeight: 750 }}>{row.draft}</div>
                    <div style={{ opacity: 0.85 }}>{row.delta}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        )}

        {viewMode !== 'page' && activeTab === 'execution' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 850, fontSize: 18 }}>Execution defaults</div>
              <button type="button" onClick={resetExecutionDefaults}>Reset to defaults</button>
            </div>
            <div style={{ opacity: 0.78, marginTop: 6, fontSize: 13 }}>Execution defaults remain a sibling authority layer. They affect how runs are executed, not the baseline worldview itself.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {(viewMode === 'advanced'
                ? registryByTab.execution
                : registryByTab.execution.filter((item) => new Set(BASIC_KEY_PATHS.execution).has(item.keyPath))
              ).map(renderExecutionRegistryField)}
            </div>
          </div>
        )}

        {viewMode !== 'page' && activeTab === 'conventions' && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 6 }}>Simulation conventions</div>
            <div style={{ opacity: 0.8, marginBottom: 10, fontSize: 13 }}>Fixed modeling conventions used by the UI. These are descriptive, not editable, in this pass.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timingConventions.map((convention) => (
                <div key={convention.id}>
                  <div style={{ fontWeight: 800 }}>{convention.label}</div>
                  <div style={{ opacity: 0.85, fontSize: 13 }}>
                    {convention.description} <span style={{ opacity: 0.85 }}>(Token: {convention.token})</span>
                  </div>
                  {filterUsedByForAssumptionsHub(convention.usedBy).length > 0 && (
                    <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>Used by: {filterUsedByForAssumptionsHub(convention.usedBy).join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode !== 'page' && activeTab === 'preview' && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 8 }}>Preview</div>
            <div style={{ opacity: 0.82, fontSize: 13, marginBottom: 10 }}>Draft changes are shown as current → draft. Execution defaults are shown as default → current.</div>

            <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6 }}>Baseline changes</div>
            {renderDiffCards(assumptionsDiffRows)}

            {selectedSnapshot && selectedSnapshotAssumptions && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                  <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6 }}>Selected snapshot → draft changes</div>
                  <button type="button" onClick={() => setSelectedSnapshotId('')}>Clear snapshot compare</button>
                </div>
                <div style={{ opacity: 0.82, fontSize: 13, marginBottom: 10 }}>
                  Snapshot run <span style={{ fontWeight: 800 }}>{selectedSnapshot.runId}</span> ({new Date(selectedSnapshot.createdAt).toLocaleString()}) → current draft.
                </div>
                {renderDiffCards(snapshotDiffRows)}

                <div style={{ fontWeight: 850, fontSize: 16, marginTop: 14, marginBottom: 6 }}>Selected snapshot → re-run request changes</div>
                {snapshotAdvancedRequestDiffRows.length === 0 ? (
                  <div style={{ opacity: 0.8, fontSize: 13 }}>No re-run request changes.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {snapshotAdvancedRequestDiffRows.map((row) => (
                      <div key={row.keyPath} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                        <div style={{ fontWeight: 800 }}>{row.label}</div>
                        <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2 }}>{formatValue('', row.from)} → {formatValue('', row.to)}</div>
                        <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{row.keyPath}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6, marginTop: 14 }}>Execution overrides</div>
            {renderDiffCards(executionOverridesRows)}

            <div style={{ fontWeight: 850, fontSize: 16, marginTop: 14, marginBottom: 6 }}>Raw draft JSON</div>
            <pre style={{ margin: 0, overflow: 'auto', opacity: 0.92 }}>{JSON.stringify(draftAssumptions, null, 2)}</pre>

            <div style={{ fontWeight: 850, fontSize: 16, marginTop: 14, marginBottom: 6 }}>Recent simulation snapshots</div>
            <div style={{ opacity: 0.82, fontSize: 13, marginBottom: 10 }}>Saved automatically when you start a simulation.</div>
            {simulationSnapshots.length === 0 ? (
              <div style={{ opacity: 0.8, fontSize: 13 }}>No snapshots yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {simulationSnapshots.slice(0, 10).map((snapshot) => (
                  <div key={snapshot.id} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800 }}>Run: {snapshot.runId}</div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>{new Date(snapshot.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ opacity: 0.85, fontSize: 13 }}>
                      Assumptions: {snapshot.assumptions.currency} · Inflation {snapshot.assumptions.inflationPct}% · Fee {snapshot.assumptions.yearlyFeePct}% · Return {snapshot.assumptions.expectedReturnPct}% · SWR {snapshot.assumptions.safeWithdrawalPct}%
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setSelectedSnapshotId(snapshot.id)}>Compare snapshot → draft</button>
                      <button type="button" disabled={baselineLocked} onClick={() => {
                        setDraftAssumptions(normalizeAssumptions(snapshot.assumptions));
                        setActiveTab('income');
                      }}>Use snapshot assumptions as draft</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default AssumptionsHubPage;