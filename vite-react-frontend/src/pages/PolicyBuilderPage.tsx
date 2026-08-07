import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageLayout from '../components/PageLayout';
import { useAssumptions, type Assumptions } from '../state/assumptions';
import {
  ASSUMPTIONS_TAB_LABELS,
  filterUsedByForAssumptionsHub,
  listStrategyRegistryItems,
} from '../state/assumptionsRegistry';
import {
  applyStrategyProfile,
  clearStrategyDraft,
  deleteStrategyProfile,
  exportStrategyProfilesJson,
  importStrategyProfilesJson,
  loadStrategyProfileState,
  persistStrategyDraft,
  saveStrategyProfile,
  saveStrategyProfileState,
  type StrategyProfileState,
} from './strategy/strategyProfiles';
import { Card, Chip, Input, Select, Textarea, chipButtonClass } from '../components/ui';

type PolicyMetric = 'failureRiskPct' | 'fundedRatio' | 'portfolioPercentile' | 'drawdownPct';
type PolicyOperator = '<=' | '<' | '>=' | '>';
type PolicyAction = 'cutSpendingPct' | 'increaseDepositsPct' | 'pauseDiscretionary' | 'rebalance' | 'guardrailWithdrawals';

type PolicyRule = {
  id: string;
  name: string;
  enabled: boolean;
  metric: PolicyMetric;
  operator: PolicyOperator;
  threshold: number;
  action: PolicyAction;
  actionValue: number;
  cooldownMonths: number;
  notes: string;
};

type PolicyBuilderDraft = {
  title: string;
  description: string;
  rules: PolicyRule[];
};

type ScenarioSample = {
  id: string;
  label: string;
  values: Record<PolicyMetric, number>;
};

const METRIC_OPTIONS: Array<{ value: PolicyMetric; label: string }> = [
  { value: 'failureRiskPct', label: 'Failure risk %' },
  { value: 'fundedRatio', label: 'Funded ratio' },
  { value: 'portfolioPercentile', label: 'Portfolio percentile' },
  { value: 'drawdownPct', label: 'Drawdown %' },
];

const ACTION_OPTIONS: Array<{ value: PolicyAction; label: string; usesValue: boolean; unit: string }> = [
  { value: 'cutSpendingPct', label: 'Cut spending %', usesValue: true, unit: '%' },
  { value: 'increaseDepositsPct', label: 'Increase deposits %', usesValue: true, unit: '%' },
  { value: 'pauseDiscretionary', label: 'Pause discretionary spending', usesValue: false, unit: '' },
  { value: 'rebalance', label: 'Rebalance portfolio', usesValue: false, unit: '' },
  { value: 'guardrailWithdrawals', label: 'Switch to guardrail withdrawals', usesValue: false, unit: '' },
];

const asEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const buildRuleId = (): string => `policy-rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildStarterRule = (
  assumptions: Assumptions,
  input?: Partial<PolicyRule>
): PolicyRule => ({
  id: input?.id ?? buildRuleId(),
  name: input?.name ?? 'New policy rule',
  enabled: input?.enabled ?? true,
  metric: input?.metric ?? 'failureRiskPct',
  operator: input?.operator ?? '>=',
  threshold: input?.threshold ?? assumptions.policyBuilderDefaults.warnFailureRiskPct,
  action: input?.action ?? 'cutSpendingPct',
  actionValue: input?.actionValue ?? assumptions.policyBuilderDefaults.maxSpendingCutPctPerYear / 2,
  cooldownMonths: input?.cooldownMonths ?? assumptions.policyBuilderDefaults.cooldownMonths,
  notes: input?.notes ?? '',
});

const buildDefaultPolicyDraft = (assumptions: Assumptions): PolicyBuilderDraft => ({
  title: 'Baseline adaptive policy',
  description: 'A starter rule set anchored to the current assumptions defaults.',
  rules: [
    buildStarterRule(assumptions, {
      name: 'Warn on rising failure risk',
      threshold: assumptions.policyBuilderDefaults.warnFailureRiskPct,
      action: 'cutSpendingPct',
      actionValue: assumptions.policyBuilderDefaults.maxSpendingCutPctPerYear / 2,
    }),
    buildStarterRule(assumptions, {
      name: 'Critical failure response',
      threshold: assumptions.policyBuilderDefaults.criticalFailureRiskPct,
      action: 'pauseDiscretionary',
      actionValue: 0,
      cooldownMonths: assumptions.policyBuilderDefaults.cooldownMonths * 2,
    }),
  ],
});

const normalizePolicyDraft = (value: unknown, assumptions: Assumptions): PolicyBuilderDraft => {
  const fallback = buildDefaultPolicyDraft(assumptions);
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawRules = Array.isArray(source.rules) ? source.rules : fallback.rules;

  return {
    title: typeof source.title === 'string' && source.title.trim() ? source.title : fallback.title,
    description: typeof source.description === 'string' ? source.description : fallback.description,
    rules: rawRules.slice(0, 12).map((item) => {
      const rule = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const normalized = buildStarterRule(assumptions, {
        id: typeof rule.id === 'string' ? rule.id : buildRuleId(),
        name: typeof rule.name === 'string' ? rule.name : fallback.rules[0]?.name,
        enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
        metric: asEnum(rule.metric, ['failureRiskPct', 'fundedRatio', 'portfolioPercentile', 'drawdownPct'] as const, 'failureRiskPct'),
        operator: asEnum(rule.operator, ['<=', '<', '>=', '>'] as const, '>='),
        threshold: asNumber(rule.threshold, assumptions.policyBuilderDefaults.warnFailureRiskPct),
        action: asEnum(rule.action, ['cutSpendingPct', 'increaseDepositsPct', 'pauseDiscretionary', 'rebalance', 'guardrailWithdrawals'] as const, 'cutSpendingPct'),
        actionValue: asNumber(rule.actionValue, assumptions.policyBuilderDefaults.maxSpendingCutPctPerYear / 2),
        cooldownMonths: Math.max(0, Math.trunc(asNumber(rule.cooldownMonths, assumptions.policyBuilderDefaults.cooldownMonths))),
        notes: typeof rule.notes === 'string' ? rule.notes : '',
      });
      return normalized;
    }),
  };
};

const evaluateRule = (rule: PolicyRule, scenario: ScenarioSample): boolean => {
  if (!rule.enabled) return false;
  const value = scenario.values[rule.metric];
  switch (rule.operator) {
    case '<=':
      return value <= rule.threshold;
    case '<':
      return value < rule.threshold;
    case '>=':
      return value >= rule.threshold;
    case '>':
      return value > rule.threshold;
    default:
      return false;
  }
};

const getByPath = (obj: unknown, keyPath: string): unknown => {
  let cur: any = obj;
  for (const segment of keyPath.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[segment];
  }
  return cur;
};

const formatValue = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
};

const actionSummary = (rule: PolicyRule): string => {
  const config = ACTION_OPTIONS.find((action) => action.value === rule.action);
  if (!config) return rule.action;
  return config.usesValue ? `${config.label} by ${rule.actionValue}${config.unit}` : config.label;
};

const statPanelClass = 'rounded-xl border border-card-border bg-card p-4';
const fieldLabelClass = 'grid gap-1.5';
const fieldLabelTextClass = 'font-semibold';

const PolicyBuilderPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const registryItems = useMemo(() => listStrategyRegistryItems('policyBuilder'), []);
  const emptyDraft = useMemo(() => buildDefaultPolicyDraft(currentAssumptions), [currentAssumptions]);
  const [profileState, setProfileState] = useState<StrategyProfileState<PolicyBuilderDraft>>(() =>
    loadStrategyProfileState('policyBuilder', emptyDraft, (value) => normalizePolicyDraft(value, currentAssumptions))
  );
  const [draft, setDraft] = useState<PolicyBuilderDraft>(() => profileState.draft);
  const [selectedProfileId, setSelectedProfileId] = useState(profileState.activeProfileId ?? '');
  const [profileName, setProfileName] = useState(
    () => profileState.profiles.find((profile) => profile.id === profileState.activeProfileId)?.name ?? ''
  );
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    const next = loadStrategyProfileState('policyBuilder', emptyDraft, (value) => normalizePolicyDraft(value, currentAssumptions));
    setProfileState(next);
    setDraft(next.draft);
    setSelectedProfileId(next.activeProfileId ?? '');
    setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
  }, [currentAssumptions, emptyDraft]);

  const persistState = (next: StrategyProfileState<PolicyBuilderDraft>) => {
    setProfileState(next);
    saveStrategyProfileState('policyBuilder', next);
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(profileState.draft);
  const lastSavedLabel = profileState.draftSavedAt ? new Date(profileState.draftSavedAt).toLocaleString() : 'Not saved yet';
  const enabledRules = draft.rules.filter((rule) => rule.enabled);
  const sampleScenarios = useMemo<ScenarioSample[]>(() => [
    {
      id: 'warning',
      label: 'Warning regime',
      values: {
        failureRiskPct: currentAssumptions.policyBuilderDefaults.warnFailureRiskPct + 2,
        fundedRatio: 0.9,
        portfolioPercentile: 24,
        drawdownPct: 14,
      },
    },
    {
      id: 'stress',
      label: 'Severe stress',
      values: {
        failureRiskPct: currentAssumptions.policyBuilderDefaults.criticalFailureRiskPct + 5,
        fundedRatio: 0.74,
        portfolioPercentile: 9,
        drawdownPct: 28,
      },
    },
    {
      id: 'recovery',
      label: 'Recovery',
      values: {
        failureRiskPct: 4,
        fundedRatio: 1.08,
        portfolioPercentile: 77,
        drawdownPct: 6,
      },
    },
  ], [currentAssumptions]);

  const scenarioEvaluations = useMemo(
    () => sampleScenarios.map((scenario) => ({
      scenario,
      triggered: draft.rules.filter((rule) => evaluateRule(rule, scenario)),
    })),
    [draft.rules, sampleScenarios]
  );
  const usedByCount = useMemo(
    () => new Set(registryItems.flatMap((item) => filterUsedByForAssumptionsHub(item.usedBy))).size,
    [registryItems]
  );

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap gap-2">
              <Chip>Policy editor</Chip>
              <Chip>Defaults tab: {ASSUMPTIONS_TAB_LABELS.policyBuilder}</Chip>
              <Chip>{isDirty ? 'Unsaved draft' : 'Saved draft'}</Chip>
              <Chip>Profiles: {profileState.profiles.length}</Chip>
            </div>
            <h1 className="m-0 text-2xl font-extrabold">Policy Builder</h1>
            <div className="max-w-225 opacity-80">
              Define adaptive IF/THEN guardrails, save named policy profiles, and preview which rules would fire under warning, stress, and recovery conditions.
            </div>
            <div className="text-xs opacity-70">Local draft persistence: {lastSavedLabel}</div>
          </div>

          <div className="grid justify-items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="grid gap-1 text-xs">
                <span>Profile</span>
                <Select
                  aria-label="Policy profile"
                  value={selectedProfileId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setSelectedProfileId(nextId);
                    setProfileName(profileState.profiles.find((profile) => profile.id === nextId)?.name ?? '');
                  }}
                  className="min-w-55"
                >
                  <option value="">Scratch draft</option>
                  {profileState.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-xs">
                <span>Profile name</span>
                <Input
                  aria-label="Profile name"
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="e.g. Tight guardrails"
                  className="min-w-55"
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = persistStrategyDraft(profileState, draft);
                  persistState(next);
                }}
                className={chipButtonClass}
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={!profileName.trim()}
                onClick={() => {
                  const next = saveStrategyProfile(profileState, {
                    id: selectedProfileId || null,
                    name: profileName,
                    data: draft,
                  });
                  persistState(next);
                  setSelectedProfileId(next.activeProfileId ?? '');
                  setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? profileName);
                }}
                className={chipButtonClass}
              >
                {selectedProfileId ? 'Update profile' : 'Save as profile'}
              </button>
              <button
                type="button"
                disabled={!selectedProfileId}
                onClick={() => {
                  if (!selectedProfileId) return;
                  const next = applyStrategyProfile(profileState, selectedProfileId);
                  persistState(next);
                  setDraft(next.draft);
                  setProfileName(next.profiles.find((profile) => profile.id === selectedProfileId)?.name ?? '');
                }}
                className={chipButtonClass}
              >
                Load selected
              </button>
              <button
                type="button"
                disabled={!selectedProfileId}
                onClick={() => {
                  if (!selectedProfileId) return;
                  const next = deleteStrategyProfile(profileState, selectedProfileId);
                  persistState(next);
                  setSelectedProfileId(next.activeProfileId ?? '');
                  setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
                }}
                className={chipButtonClass}
              >
                Delete profile
              </button>
              <button
                type="button"
                onClick={() => exportStrategyProfilesJson('policyBuilder', { ...profileState, draft })}
                className={chipButtonClass}
              >
                Export profiles
              </button>
              <label className="inline-flex items-center">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files && event.target.files.length ? event.target.files[0] : null;
                    void importStrategyProfilesJson(file, emptyDraft, (value) => normalizePolicyDraft(value, currentAssumptions)).then((next) => {
                      if (!next) {
                        setImportStatus('Import failed. The file could not be parsed as valid strategy profile JSON.');
                        return;
                      }
                      persistState(next);
                      setDraft(next.draft);
                      setSelectedProfileId(next.activeProfileId ?? '');
                      setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
                      setImportStatus('Strategy profiles imported into Policy Builder.');
                    }).catch(() => {
                      setImportStatus('Import failed. The file could not be parsed as valid strategy profile JSON.');
                    });
                    event.target.value = '';
                  }}
                />
                <span className={chipButtonClass}>Import profiles</span>
              </label>
              <button
                type="button"
                disabled={!isDirty}
                onClick={() => setDraft(profileState.draft)}
                className={chipButtonClass}
              >
                Reset to saved
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = clearStrategyDraft(profileState, emptyDraft);
                  persistState(next);
                  setDraft(next.draft);
                  setSelectedProfileId('');
                  setProfileName('');
                }}
                className={chipButtonClass}
              >
                Clear draft
              </button>
              <Link to="/assumptions" className={chipButtonClass}>Open Assumptions Hub</Link>
              <Link to="/simulation" className={chipButtonClass}>Back to simulator</Link>
            </div>
            {importStatus && <div className="text-xs opacity-80">{importStatus}</div>}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className={statPanelClass}>
            <div className="text-xs opacity-75">Enabled rules</div>
            <div className="text-3xl font-extrabold">{enabledRules.length}</div>
          </div>
          <div className={statPanelClass}>
            <div className="text-xs opacity-75">Evaluation frequency</div>
            <div className="text-xl font-extrabold">{currentAssumptions.policyBuilderDefaults.evaluationFrequency}</div>
          </div>
          <div className={statPanelClass}>
            <div className="text-xs opacity-75">Conflict resolution</div>
            <div className="text-xl font-extrabold">{currentAssumptions.policyBuilderDefaults.conflictResolution}</div>
          </div>
          <div className={statPanelClass}>
            <div className="text-xs opacity-75">Connected pages</div>
            <div className="text-3xl font-extrabold">{usedByCount}</div>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="grid gap-3">
            <Card className="grid gap-3">
              <div className="font-extrabold">Strategy header</div>
              <label className={fieldLabelClass}>
                <span className={fieldLabelTextClass}>Policy title</span>
                <Input
                  aria-label="Policy title"
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label className={fieldLabelClass}>
                <span className={fieldLabelTextClass}>Description</span>
                <Textarea
                  aria-label="Policy description"
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                />
              </label>
            </Card>

            <Card className="grid gap-3">
              <div>
                <div className="font-extrabold">Adaptive rules</div>
                <div className="mt-1 text-xs opacity-80">
                  These rules are evaluated against scenario metrics. The simulator below uses the current rule set and the assumptions defaults for warning and critical thresholds.
                </div>
              </div>
              {draft.rules.map((rule, index) => {
                const actionConfig = ACTION_OPTIONS.find((action) => action.value === rule.action) ?? ACTION_OPTIONS[0];
                return (
                  <div key={rule.id} className="grid gap-2.5 rounded-xl border border-card-border p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold">Rule {index + 1}</div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            aria-label={`Enable ${rule.name}`}
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(event) => setDraft((prev) => ({
                              ...prev,
                              rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, enabled: event.target.checked } : item)),
                            }))}
                          />
                          Enabled
                        </label>
                        <button
                          type="button"
                          onClick={() => setDraft((prev) => ({ ...prev, rules: prev.rules.filter((item) => item.id !== rule.id) }))}
                          disabled={draft.rules.length <= 1}
                          className={chipButtonClass}
                        >
                          Remove rule
                        </button>
                      </div>
                    </div>

                    <label className={fieldLabelClass}>
                      <span className={fieldLabelTextClass}>Rule name</span>
                      <Input
                        aria-label={`Rule ${index + 1} name`}
                        type="text"
                        value={rule.name}
                        onChange={(event) => setDraft((prev) => ({
                          ...prev,
                          rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, name: event.target.value } : item)),
                        }))}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <label className={fieldLabelClass}>
                        <span className={fieldLabelTextClass}>Metric</span>
                        <Select
                          aria-label={`Rule ${index + 1} metric`}
                          value={rule.metric}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, metric: event.target.value as PolicyMetric } : item)),
                          }))}
                        >
                          {METRIC_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </label>
                      <label className={fieldLabelClass}>
                        <span className={fieldLabelTextClass}>Operator</span>
                        <Select
                          aria-label={`Rule ${index + 1} operator`}
                          value={rule.operator}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, operator: event.target.value as PolicyOperator } : item)),
                          }))}
                        >
                          <option value=">=">≥</option>
                          <option value=">">&gt;</option>
                          <option value="<=">≤</option>
                          <option value="<">&lt;</option>
                        </Select>
                      </label>
                      <label className={fieldLabelClass}>
                        <span className={fieldLabelTextClass}>Threshold</span>
                        <Input
                          aria-label={`Rule ${index + 1} threshold`}
                          type="number"
                          value={rule.threshold}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, threshold: asNumber(event.target.value, item.threshold) } : item)),
                          }))}
                        />
                      </label>
                      <label className={fieldLabelClass}>
                        <span className={fieldLabelTextClass}>Cooldown (months)</span>
                        <Input
                          aria-label={`Rule ${index + 1} cooldown`}
                          type="number"
                          value={rule.cooldownMonths}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, cooldownMonths: Math.max(0, Math.trunc(asNumber(event.target.value, item.cooldownMonths))) } : item)),
                          }))}
                        />
                      </label>
                    </div>

                    <div className={`grid gap-2.5 ${actionConfig.usesValue ? 'sm:grid-cols-[minmax(0,1fr)_180px]' : ''}`}>
                      <label className={fieldLabelClass}>
                        <span className={fieldLabelTextClass}>Action</span>
                        <Select
                          aria-label={`Rule ${index + 1} action`}
                          value={rule.action}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, action: event.target.value as PolicyAction } : item)),
                          }))}
                        >
                          {ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </label>
                      {actionConfig.usesValue && (
                        <label className={fieldLabelClass}>
                          <span className={fieldLabelTextClass}>Action value ({actionConfig.unit})</span>
                          <Input
                            aria-label={`Rule ${index + 1} action value`}
                            type="number"
                            value={rule.actionValue}
                            onChange={(event) => setDraft((prev) => ({
                              ...prev,
                              rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, actionValue: Math.max(0, asNumber(event.target.value, item.actionValue)) } : item)),
                            }))}
                          />
                        </label>
                      )}
                    </div>

                    <label className={fieldLabelClass}>
                      <span className={fieldLabelTextClass}>Notes</span>
                      <Textarea
                        aria-label={`Rule ${index + 1} notes`}
                        rows={2}
                        value={rule.notes}
                        onChange={(event) => setDraft((prev) => ({
                          ...prev,
                          rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, notes: event.target.value } : item)),
                        }))}
                      />
                    </label>
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({
                    ...prev,
                    rules: [
                      ...prev.rules,
                      buildStarterRule(currentAssumptions, {
                        name: `Rule ${prev.rules.length + 1}`,
                        threshold: currentAssumptions.policyBuilderDefaults.warnFailureRiskPct,
                      }),
                    ],
                  }))}
                  className={chipButtonClass}
                >
                  Add rule
                </button>
              </div>
            </Card>

            <Card className="grid gap-3">
              <div>
                <div className="font-extrabold">Policy simulator</div>
                <div className="mt-1 text-xs opacity-80">
                  A lightweight browser-side preview showing which rules would currently trigger under representative regimes.
                </div>
              </div>

              <div className="grid gap-2.5">
                {scenarioEvaluations.map(({ scenario, triggered }) => (
                  <div key={scenario.id} className="grid gap-1.5 rounded-lg border border-card-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold">{scenario.label}</div>
                      <Chip>{triggered.length} rules trigger</Chip>
                    </div>
                    <div className="text-xs opacity-75">
                      Failure risk {scenario.values.failureRiskPct}% • Funded ratio {scenario.values.fundedRatio} • Percentile {scenario.values.portfolioPercentile} • Drawdown {scenario.values.drawdownPct}%
                    </div>
                    <div className="text-sm">
                      {triggered.length > 0
                        ? triggered.map((rule) => `${rule.name}: ${actionSummary(rule)}`).join(' | ')
                        : 'No rules trigger.'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="sticky top-4 grid gap-3">
            <div>
              <div className="font-extrabold">Inherited defaults from assumptions</div>
              <div className="text-xs opacity-75">
                The policy editor inherits cadence, conflict handling, and risk limits from the authority layer. Profiles capture strategy-specific rules, not baseline assumptions.
              </div>
            </div>
            <div className="grid gap-2.5">
              {registryItems.map((item) => {
                const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
                return (
                  <div key={item.keyPath} className="grid gap-1.5 rounded-lg border border-card-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold">{item.label}</div>
                      <Chip>{formatValue(getByPath(currentAssumptions, item.keyPath))}</Chip>
                    </div>
                    {usedBy.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {usedBy.map((label) => (
                          <Chip key={label}>Used by: {label}</Chip>
                        ))}
                      </div>
                    )}
                    <div className="text-xs opacity-70">{item.keyPath}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default PolicyBuilderPage;
