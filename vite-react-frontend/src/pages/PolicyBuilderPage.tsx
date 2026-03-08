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

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--fc-card-border)',
  borderRadius: 16,
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  padding: 16,
};

const chipStyle: React.CSSProperties = {
  border: '1px solid var(--fc-card-border)',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 12,
  opacity: 0.9,
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
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={chipStyle}>Policy editor</span>
              <span style={chipStyle}>Defaults tab: {ASSUMPTIONS_TAB_LABELS.policyBuilder}</span>
              <span style={chipStyle}>{isDirty ? 'Unsaved draft' : 'Saved draft'}</span>
              <span style={chipStyle}>Profiles: {profileState.profiles.length}</span>
            </div>
            <h1 style={{ margin: 0 }}>Policy Builder</h1>
            <div style={{ opacity: 0.8, maxWidth: 900 }}>
              Define adaptive IF/THEN guardrails, save named policy profiles, and preview which rules would fire under warning, stress, and recovery conditions.
            </div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Local draft persistence: {lastSavedLabel}</div>
          </div>

          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Profile</span>
                <select
                  aria-label="Policy profile"
                  value={selectedProfileId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setSelectedProfileId(nextId);
                    setProfileName(profileState.profiles.find((profile) => profile.id === nextId)?.name ?? '');
                  }}
                  style={{ minWidth: 220, padding: '8px 10px', borderRadius: 10 }}
                >
                  <option value="">Scratch draft</option>
                  {profileState.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Profile name</span>
                <input
                  aria-label="Profile name"
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="e.g. Tight guardrails"
                  style={{ minWidth: 220, padding: '8px 10px', borderRadius: 10 }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  const next = persistStrategyDraft(profileState, draft);
                  persistState(next);
                }}
                style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}
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
                style={{ ...chipStyle, cursor: profileName.trim() ? 'pointer' : 'default', background: 'transparent' }}
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
                style={{ ...chipStyle, cursor: selectedProfileId ? 'pointer' : 'default', background: 'transparent' }}
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
                style={{ ...chipStyle, cursor: selectedProfileId ? 'pointer' : 'default', background: 'transparent' }}
              >
                Delete profile
              </button>
              <button
                type="button"
                onClick={() => exportStrategyProfilesJson('policyBuilder', { ...profileState, draft })}
                style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}
              >
                Export profiles
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
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
                <span style={{ ...chipStyle, cursor: 'pointer' }}>Import profiles</span>
              </label>
              <button
                type="button"
                disabled={!isDirty}
                onClick={() => setDraft(profileState.draft)}
                style={{ ...chipStyle, cursor: isDirty ? 'pointer' : 'default', background: 'transparent' }}
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
                style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}
              >
                Clear draft
              </button>
              <Link to="/assumptions" style={{ ...chipStyle, textDecoration: 'none', color: 'inherit' }}>Open Assumptions Hub</Link>
              <Link to="/simulation" style={{ ...chipStyle, textDecoration: 'none', color: 'inherit' }}>Back to simulator</Link>
            </div>
            {importStatus && <div style={{ fontSize: 12, opacity: 0.78 }}>{importStatus}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Enabled rules</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{enabledRules.length}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Evaluation frequency</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{currentAssumptions.policyBuilderDefaults.evaluationFrequency}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Conflict resolution</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{currentAssumptions.policyBuilderDefaults.conflictResolution}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Connected pages</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{usedByCount}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Strategy header</div>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Policy title</span>
                <input
                  aria-label="Policy title"
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  style={{ padding: '10px 12px', borderRadius: 10 }}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Description</span>
                <textarea
                  aria-label="Policy description"
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                  style={{ padding: '10px 12px', borderRadius: 10, resize: 'vertical' }}
                />
              </label>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800 }}>Adaptive rules</div>
                <div style={{ fontSize: 13, opacity: 0.78, marginTop: 4 }}>
                  These rules are evaluated against scenario metrics. The simulator below uses the current rule set and the assumptions defaults for warning and critical thresholds.
                </div>
              </div>
              {draft.rules.map((rule, index) => {
                const actionConfig = ACTION_OPTIONS.find((action) => action.value === rule.action) ?? ACTION_OPTIONS[0];
                return (
                  <div key={rule.id} style={{ border: '1px solid var(--fc-card-border)', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>Rule {index + 1}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
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
                        >
                          Remove rule
                        </button>
                      </div>
                    </div>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontWeight: 600 }}>Rule name</span>
                      <input
                        aria-label={`Rule ${index + 1} name`}
                        type="text"
                        value={rule.name}
                        onChange={(event) => setDraft((prev) => ({
                          ...prev,
                          rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, name: event.target.value } : item)),
                        }))}
                        style={{ padding: '10px 12px', borderRadius: 10 }}
                      />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>Metric</span>
                        <select
                          aria-label={`Rule ${index + 1} metric`}
                          value={rule.metric}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, metric: event.target.value as PolicyMetric } : item)),
                          }))}
                          style={{ padding: '10px 12px', borderRadius: 10 }}
                        >
                          {METRIC_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>Operator</span>
                        <select
                          aria-label={`Rule ${index + 1} operator`}
                          value={rule.operator}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, operator: event.target.value as PolicyOperator } : item)),
                          }))}
                          style={{ padding: '10px 12px', borderRadius: 10 }}
                        >
                          <option value=">=">≥</option>
                          <option value=">">&gt;</option>
                          <option value="<=">≤</option>
                          <option value="<">&lt;</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>Threshold</span>
                        <input
                          aria-label={`Rule ${index + 1} threshold`}
                          type="number"
                          value={rule.threshold}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, threshold: asNumber(event.target.value, item.threshold) } : item)),
                          }))}
                          style={{ padding: '10px 12px', borderRadius: 10 }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>Cooldown (months)</span>
                        <input
                          aria-label={`Rule ${index + 1} cooldown`}
                          type="number"
                          value={rule.cooldownMonths}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, cooldownMonths: Math.max(0, Math.trunc(asNumber(event.target.value, item.cooldownMonths))) } : item)),
                          }))}
                          style={{ padding: '10px 12px', borderRadius: 10 }}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: actionConfig.usesValue ? 'minmax(0, 1fr) 180px' : 'minmax(0, 1fr)', gap: 10 }}>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>Action</span>
                        <select
                          aria-label={`Rule ${index + 1} action`}
                          value={rule.action}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev,
                            rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, action: event.target.value as PolicyAction } : item)),
                          }))}
                          style={{ padding: '10px 12px', borderRadius: 10 }}
                        >
                          {ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      {actionConfig.usesValue && (
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>Action value ({actionConfig.unit})</span>
                          <input
                            aria-label={`Rule ${index + 1} action value`}
                            type="number"
                            value={rule.actionValue}
                            onChange={(event) => setDraft((prev) => ({
                              ...prev,
                              rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, actionValue: Math.max(0, asNumber(event.target.value, item.actionValue)) } : item)),
                            }))}
                            style={{ padding: '10px 12px', borderRadius: 10 }}
                          />
                        </label>
                      )}
                    </div>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontWeight: 600 }}>Notes</span>
                      <textarea
                        aria-label={`Rule ${index + 1} notes`}
                        rows={2}
                        value={rule.notes}
                        onChange={(event) => setDraft((prev) => ({
                          ...prev,
                          rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, notes: event.target.value } : item)),
                        }))}
                        style={{ padding: '10px 12px', borderRadius: 10, resize: 'vertical' }}
                      />
                    </label>
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                >
                  Add rule
                </button>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800 }}>Policy simulator</div>
                <div style={{ fontSize: 13, opacity: 0.78, marginTop: 4 }}>
                  A lightweight browser-side preview showing which rules would currently trigger under representative regimes.
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {scenarioEvaluations.map(({ scenario, triggered }) => (
                  <div key={scenario.id} style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{scenario.label}</div>
                      <span style={chipStyle}>{triggered.length} rules trigger</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.74 }}>
                      Failure risk {scenario.values.failureRiskPct}% • Funded ratio {scenario.values.fundedRatio} • Percentile {scenario.values.portfolioPercentile} • Drawdown {scenario.values.drawdownPct}%
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {triggered.length > 0
                        ? triggered.map((rule) => `${rule.name}: ${actionSummary(rule)}`).join(' | ')
                        : 'No rules trigger.'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12, position: 'sticky', top: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Inherited defaults from assumptions</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                The policy editor inherits cadence, conflict handling, and risk limits from the authority layer. Profiles capture strategy-specific rules, not baseline assumptions.
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {registryItems.map((item) => {
                const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
                return (
                  <div key={item.keyPath} style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{item.label}</div>
                      <span style={chipStyle}>{formatValue(getByPath(currentAssumptions, item.keyPath))}</span>
                    </div>
                    {usedBy.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {usedBy.map((label) => (
                          <span key={label} style={chipStyle}>Used by: {label}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 12, opacity: 0.72 }}>{item.keyPath}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default PolicyBuilderPage;
