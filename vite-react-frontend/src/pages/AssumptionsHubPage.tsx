import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
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
import { computeAssumptionsImpact, computeAssumptionsImpactSensitivity } from '../utils/assumptionsImpact';

type HubTabId =
  | 'overview'
  | 'income'
  | 'deposit'
  | 'passive'
  | 'withdrawal'
  | 'policy'
  | 'milestones'
  | 'goals'
  | 'execution'
  | 'conventions'
  | 'preview';

type HubViewMode = 'basic' | 'advanced' | 'diagnostics';

type DiffRow = {
  keyPath: string;
  label: string;
  unit: string;
  usedBy: string[];
  from: unknown;
  to: unknown;
};

type DiagnosticsTone = 'warning' | 'info';

type DiagnosticsItem = {
  id: string;
  tone: DiagnosticsTone;
  title: string;
  description: string;
  tab: HubTabId | 'overview';
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
  background: 'transparent',
  color: 'inherit',
  boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid var(--fc-card-border)',
  background: 'transparent',
  color: 'inherit',
};

const HUB_TABS: Array<{ id: HubTabId; label: string; isBaseline?: boolean }> = [
  { id: 'overview', label: 'Overview', isBaseline: true },
  { id: 'income', label: 'Income', isBaseline: true },
  { id: 'deposit', label: 'Deposit', isBaseline: true },
  { id: 'passive', label: 'Passive', isBaseline: true },
  { id: 'withdrawal', label: 'Withdrawal', isBaseline: true },
  { id: 'policy', label: 'Policy', isBaseline: true },
  { id: 'milestones', label: 'Milestones', isBaseline: true },
  { id: 'goals', label: 'Goals', isBaseline: true },
  { id: 'execution', label: 'Execution' },
  { id: 'conventions', label: 'Conventions' },
  { id: 'preview', label: 'Preview' },
];

const BASIC_KEY_PATHS: Record<Exclude<HubTabId, 'conventions' | 'preview'>, string[]> = {
  overview: ['currency', 'inflationPct', 'yearlyFeePct', 'expectedReturnPct', 'safeWithdrawalPct'],
  income: [
    'incomeSetupDefaults.incomeModelType',
    'incomeSetupDefaults.payCadence',
    'incomeSetupDefaults.taxRegime',
    'incomeSetupDefaults.bonusFrequency',
    'salaryTaxatorDefaults.defaultMunicipalTaxRatePct',
    'taxExemptionDefaults.stockExemptionTaxRate',
  ],
  deposit: [
    'depositStrategyDefaults.depositTiming',
    'depositStrategyDefaults.contributionCadence',
    'depositStrategyDefaults.escalationMode',
    'depositStrategyDefaults.escalationPct',
    'depositStrategyDefaults.routingPriority',
  ],
  passive: [
    'passiveStrategyDefaults.returnModel',
    'passiveStrategyDefaults.volatilityPct',
    'passiveStrategyDefaults.rebalancing',
    'passiveStrategyDefaults.cashDragPct',
  ],
  withdrawal: [
    'withdrawalStrategyDefaults.withdrawalRule',
    'withdrawalStrategyDefaults.inflationAdjustSpending',
    'withdrawalStrategyDefaults.guardrailFloorPct',
    'withdrawalStrategyDefaults.guardrailCeilingPct',
    'withdrawalStrategyDefaults.cashBufferTargetMonths',
  ],
  policy: [
    'policyBuilderDefaults.evaluationFrequency',
    'policyBuilderDefaults.conflictResolution',
    'policyBuilderDefaults.cooldownMonths',
    'policyBuilderDefaults.maxSpendingCutPctPerYear',
    'policyBuilderDefaults.warnFailureRiskPct',
  ],
  milestones: [
    'fireMilestonesDefaults.confidenceTarget',
    'fireMilestonesDefaults.milestoneStability',
    'fireMilestonesDefaults.sustainedMonths',
    'fireMilestonesDefaults.leanSpendingMonthlyDkk',
    'fireMilestonesDefaults.fatSpendingMonthlyDkk',
  ],
  goals: [
    'goalPlannerDefaults.fundingOrder',
    'goalPlannerDefaults.goalInflationHandling',
    'goalPlannerDefaults.goalRiskHandling',
  ],
  execution: ['executionDefaults.paths', 'executionDefaults.batchSize', 'executionDefaults.seedMode'],
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

const buildDiagnostics = (draft: Assumptions): DiagnosticsItem[] => {
  const out: DiagnosticsItem[] = [];
  const realDrift = Number(draft.expectedReturnPct) - Number(draft.yearlyFeePct) - Number(draft.inflationPct);

  if (realDrift <= 0) {
    out.push({
      id: 'real-drift',
      tone: 'warning',
      title: 'Non-positive real drift',
      description: 'Expected return minus yearly fee is at or below inflation, so long-run real growth is non-positive.',
      tab: 'overview',
    });
  }

  if (draft.safeWithdrawalPct >= draft.expectedReturnPct) {
    out.push({
      id: 'swr-vs-return',
      tone: 'warning',
      title: 'Withdrawal rate is at or above expected return',
      description: 'The safe withdrawal rate is not meaningfully below expected nominal return, which weakens the baseline sustainability signal.',
      tab: 'overview',
    });
  }

  if (draft.withdrawalStrategyDefaults.guardrailFloorPct > draft.withdrawalStrategyDefaults.guardrailCeilingPct) {
    out.push({
      id: 'guardrail-order',
      tone: 'warning',
      title: 'Withdrawal guardrails are inverted',
      description: 'The withdrawal floor is above the ceiling. The rule cannot operate coherently in this state.',
      tab: 'withdrawal',
    });
  }

  if (
    draft.depositStrategyDefaults.escalationMode !== 'none' &&
    draft.depositStrategyDefaults.escalationPct <= 0 &&
    draft.depositStrategyDefaults.escalationDkkPerYear <= 0
  ) {
    out.push({
      id: 'deposit-escalation',
      tone: 'warning',
      title: 'Deposit escalation mode has no growth value',
      description: 'Deposit escalation is enabled, but both the percentage and fixed DKK step-up are zero or negative.',
      tab: 'deposit',
    });
  }

  if (draft.fireMilestonesDefaults.leanSpendingMonthlyDkk >= draft.fireMilestonesDefaults.fatSpendingMonthlyDkk) {
    out.push({
      id: 'milestone-band',
      tone: 'warning',
      title: 'Lean and fat FIRE spending bands overlap',
      description: 'Lean spending is at or above fat spending, so milestone thresholds no longer form a sensible progression.',
      tab: 'milestones',
    });
  }

  if (draft.incomeSetupDefaults.bonusFrequency === 'none' && draft.incomeSetupDefaults.bonusPct > 0) {
    out.push({
      id: 'bonus-frequency',
      tone: 'info',
      title: 'Bonus percentage is set while bonus frequency is none',
      description: 'The percentage is harmless, but it will not take effect until a bonus frequency is enabled.',
      tab: 'income',
    });
  }

  if (
    draft.policyBuilderDefaults.evaluationFrequency === 'monthly' &&
    draft.policyBuilderDefaults.cooldownMonths >= 12
  ) {
    out.push({
      id: 'policy-cadence',
      tone: 'info',
      title: 'Policy cadence is tighter than cooldown behavior',
      description: 'Policies evaluate monthly, but cooldown lasts a year or more, which may make adaptive rules feel unresponsive.',
      tab: 'policy',
    });
  }

  return out;
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

const AssumptionsHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HubTabId>('overview');
  const [viewMode, setViewMode] = useState<HubViewMode>('basic');
  const [showAssumptionsChangeLog, setShowAssumptionsChangeLog] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [profilesRefresh, setProfilesRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [profileName, setProfileName] = useState('');
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
  const diagnostics = useMemo(() => buildDiagnostics(draftAssumptions), [draftAssumptions]);
  const activeDiagnostics = useMemo(
    () => diagnostics.filter((item) => item.tab === 'overview' || item.tab === activeTab),
    [activeTab, diagnostics]
  );

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
      overview: listRegistryByTab('worldModel'),
      income: [
        ...listRegistryByTab('incomeSetup'),
        ...listRegistryByTab('salaryTaxator'),
        ...listRegistryByTab('moneyPerspective'),
        ...listRegistryByTab('simulatorTax'),
      ],
      deposit: listRegistryByTab('depositStrategy'),
      passive: listRegistryByTab('passiveStrategy'),
      withdrawal: listRegistryByTab('withdrawalStrategy'),
      policy: listRegistryByTab('policyBuilder'),
      milestones: listRegistryByTab('milestones'),
      goals: listRegistryByTab('goalPlanner'),
      execution: listRegistryByTab('execution'),
    }),
    []
  );

  const previewRegistryItems = useMemo(
    () => [
      ...registryByTab.overview,
      ...registryByTab.income,
      ...registryByTab.deposit,
      ...registryByTab.passive,
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
  const draftImpactSensitivity = useMemo(() => computeAssumptionsImpactSensitivity(draftAssumptions), [draftAssumptions]);

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
    const seed = seedForMode(executionDefaults.seedMode, snapshotSeedForCustom);
    const next: Record<string, unknown> = { ...base, seed };

    if (base.returnerConfig && typeof base.returnerConfig === 'object') {
      next.returnerConfig = { ...base.returnerConfig, seed };
    }

    if (base.paths !== undefined) next.paths = executionDefaults.paths;
    if (base.batchSize !== undefined) next.batchSize = executionDefaults.batchSize;
    if (base.inflationFactor !== undefined) next.inflationFactor = 1 + (Number(draftAssumptions.inflationPct) || 0) / 100;
    if (base.yearlyFeePercentage !== undefined) next.yearlyFeePercentage = Number(draftAssumptions.yearlyFeePct) || 0;

    return next;
  }, [draftAssumptions.inflationPct, draftAssumptions.yearlyFeePct, executionDefaults.batchSize, executionDefaults.paths, executionDefaults.seedMode, selectedSnapshot]);

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
      updateDraftAssumptions({ [top]: nextTop } as Partial<Assumptions>);
    },
    [baselineLocked, draftAssumptions, updateDraftAssumptions]
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
    if (viewMode === 'advanced') return allItems;
    const allowed = new Set(BASIC_KEY_PATHS[activeTab as keyof typeof BASIC_KEY_PATHS] ?? []);
    return allItems.filter((item) => allowed.has(item.keyPath));
  }, [activeTab, activeTabMeta?.isBaseline, registryByTab, viewMode]);

  const renderBaselineRegistryField = (item: AssumptionRegistryItem) => {
    const inputId = `assumptions-${item.keyPath.replace(/\./g, '-')}`;
    const value = getValueAtKeyPath(draftAssumptions, item.keyPath);
    const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
    const disabled = baselineLocked;
    const labelNode = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div>{item.label}</div>
        {usedBy.length > 0 && <div style={{ fontSize: 12, opacity: 0.75 }}>Used by: {usedBy.join(', ')}</div>}
      </div>
    );

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
              id={inputId}
              aria-label={item.label}
              value={options.includes(selectedValue) ? selectedValue : options[0]}
              disabled={disabled}
              onChange={(event) => updateDraftValueAtKeyPath(item.keyPath, event.target.value)}
              style={inputStyle}
            >
              {options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );
      }
    }

    if (isNumericRegistryUnit(item.unit)) {
      const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : value == null ? '' : Number(value);
      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
          <input
            id={inputId}
            aria-label={item.label}
            type="number"
            step={item.unit === 'pct' ? 0.1 : 1}
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
    const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
    const labelNode = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div>{item.label}</div>
        {usedBy.length > 0 && <div style={{ fontSize: 12, opacity: 0.75 }}>Used by: {usedBy.join(', ')}</div>}
      </div>
    );

    if (item.unit === 'enum') {
      const options = item.keyPath === 'executionDefaults.seedMode' ? ['default', 'custom', 'random'] : getRegistryEnumOptions(item.keyPath) ?? [];
      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>{labelNode}</label>
          <select
            id={inputId}
            aria-label={item.label}
            value={typeof value === 'string' ? value : String(value ?? '')}
            onChange={(event) => updateExecutionValueAtKeyPath(item.keyPath, event.target.value)}
            style={inputStyle}
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
      ? 'Basic view shows the few baseline assumptions that define each tab.'
      : viewMode === 'advanced'
        ? 'Advanced view exposes the full registry-backed baseline editor.'
        : 'Diagnostics view emphasizes contradictions, impact, and draft-vs-current changes.';

  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={cardStyle}>
          <h1 style={{ margin: 0 }}>Assumptions Hub</h1>
          <div style={{ opacity: 0.78, marginTop: 6 }}>
            Single source of truth for the app’s baseline assumptions, with draft editing, diagnostics, and preview tooling stored locally for now.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {(['basic', 'advanced', 'diagnostics'] as HubViewMode[]).map((mode) => {
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

        <div role="tablist" aria-label="Assumptions Hub sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {HUB_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            const warningCount = diagnostics.filter((item) => item.tab === tab.id).length;
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
                {warningCount > 0 ? ` · ${warningCount}` : ''}
              </button>
            );
          })}
        </div>

        {viewMode === 'diagnostics' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontWeight: 850, fontSize: 18 }}>Diagnostics</div>
                <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                  Diagnostics stay deterministic and low-noise. They highlight contradictions in the draft without inventing probabilistic scores.
                </div>
              </div>
              <div style={{ ...chipStyle, fontWeight: 800 }}>{activeDiagnostics.length} active diagnostics</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
              <div style={{ padding: 12, border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.72 }}>Draft nominal net return</div>
                <div style={{ fontWeight: 850, fontSize: 22 }}>{draftImpact.nominalNetReturnPct.toFixed(2)}%</div>
              </div>
              <div style={{ padding: 12, border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.72 }}>Draft approx real return</div>
                <div style={{ fontWeight: 850, fontSize: 22 }}>{draftImpact.approxRealReturnPct.toFixed(2)}%</div>
              </div>
              <div style={{ padding: 12, border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.72 }}>Safe spend per 1M</div>
                <div style={{ fontWeight: 850, fontSize: 22 }}>{Math.round(draftImpact.safeMonthlySpendPer1MDkk).toLocaleString()}</div>
              </div>
              <div style={{ padding: 12, border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.72 }}>FI number</div>
                <div style={{ fontWeight: 850, fontSize: 22 }}>{draftImpact.fiNumberDkk === null ? '—' : Math.round(draftImpact.fiNumberDkk).toLocaleString()}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {activeDiagnostics.length === 0 ? (
                <div style={{ opacity: 0.8, fontSize: 13 }}>No active diagnostics for this tab. The current draft looks internally coherent under the fixed rule set.</div>
              ) : (
                activeDiagnostics.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${item.tone === 'warning' ? '#7b5c19' : '#355b8a'}`,
                      background: item.tone === 'warning' ? 'rgba(184, 129, 19, 0.10)' : 'rgba(53, 91, 138, 0.10)',
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div style={{ opacity: 0.86, fontSize: 13, marginTop: 4 }}>{item.description}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Draft sensitivity</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {draftImpactSensitivity.rows.map((row) => (
                  <div key={row.label} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                    <div style={{ fontWeight: 800 }}>{row.label}</div>
                    <div style={{ fontSize: 13, opacity: 0.82, marginTop: 4 }}>
                      Δ net return {row.deltaFromBase.nominalNetReturnPct.toFixed(2)}pp · Δ real return {row.deltaFromBase.approxRealReturnPct.toFixed(2)}pp · Δ safe spend/1M {Math.round(row.deltaFromBase.safeMonthlySpendPer1MDkk).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTabMeta?.isBaseline && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 850, fontSize: 18 }}>Baseline assumptions</div>
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
                  ? 'Basic mode intentionally keeps this tab narrow. Switch to Advanced when you need the full registry-backed editor.'
                  : viewMode === 'advanced'
                    ? 'Advanced mode exposes the complete registry-backed editor for this tab.'
                    : 'Diagnostics mode is read-mostly. Use Basic or Advanced to edit the draft.'}
            </div>

            {viewMode !== 'diagnostics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {visibleBaselineItems.map(renderBaselineRegistryField)}
              </div>
            )}

            {viewMode === 'diagnostics' && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Draft vs current for this tab</div>
                {renderDiffCards(
                  buildDiffRows(
                    registryByTab[activeTab as keyof typeof registryByTab] ?? [],
                    currentAssumptions,
                    draftAssumptions
                  )
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'overview' && (
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
                  Locking the baseline prevents accidental draft edits and imports. It does not hide diagnostics or preview tooling.
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

        {activeTab === 'execution' && (
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

        {activeTab === 'conventions' && (
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

        {activeTab === 'preview' && (
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
                        setActiveTab('overview');
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