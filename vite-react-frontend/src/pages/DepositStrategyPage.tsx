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

type DepositCadence = 'monthly' | 'yearly';
type DepositMode = 'normal' | 'lean' | 'aggressive' | 'emergency';
type DepositEscalationMode = 'none' | 'pctYearly' | 'fixedDkkYearly';

type OneOffDeposit = {
  id: string;
  label: string;
  yearOffset: number;
  amount: number;
};

type DepositStrategyDraft = {
  title: string;
  description: string;
  mode: DepositMode;
  baseDepositAmount: number;
  cadence: DepositCadence;
  startYearOffset: number;
  durationYears: number;
  pauseMonthsPerYear: number;
  escalationMode: DepositEscalationMode;
  escalationPct: number;
  escalationDkkPerYear: number;
  inflationAdjust: boolean;
  routingPriority: Assumptions['depositStrategyDefaults']['routingPriority'];
  routingCapsNote: string;
  recurringBoostMonth: number;
  recurringBoostAmount: number;
  oneOffs: OneOffDeposit[];
};

type DepositPreviewRow = {
  year: number;
  plannedDeposits: number;
  oneOffs: number;
  total: number;
  mode: string;
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

const buildDepositId = (): string => `deposit-one-off-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const clampInt = (value: unknown, fallback: number, min = 0, max = 10_000): number =>
  Math.min(max, Math.max(min, Math.trunc(asNumber(value, fallback))));

const buildDefaultDepositDraft = (assumptions: Assumptions): DepositStrategyDraft => ({
  title: 'Steady monthly deposits',
  description: 'Baseline contribution plan anchored to the current deposit assumptions.',
  mode: 'normal',
  baseDepositAmount: 6000,
  cadence: assumptions.depositStrategyDefaults.contributionCadence,
  startYearOffset: 0,
  durationYears: 20,
  pauseMonthsPerYear: 0,
  escalationMode: assumptions.depositStrategyDefaults.escalationMode,
  escalationPct: assumptions.depositStrategyDefaults.escalationPct,
  escalationDkkPerYear: assumptions.depositStrategyDefaults.escalationDkkPerYear,
  inflationAdjust: assumptions.depositStrategyDefaults.inflationAdjustContributions,
  routingPriority: assumptions.depositStrategyDefaults.routingPriority,
  routingCapsNote: '',
  recurringBoostMonth: 3,
  recurringBoostAmount: 0,
  oneOffs: [],
});

const normalizeDepositDraft = (value: unknown, assumptions: Assumptions): DepositStrategyDraft => {
  const fallback = buildDefaultDepositDraft(assumptions);
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawOneOffs = Array.isArray(source.oneOffs) ? source.oneOffs : [];

  return {
    title: typeof source.title === 'string' && source.title.trim() ? source.title : fallback.title,
    description: typeof source.description === 'string' ? source.description : fallback.description,
    mode: ['normal', 'lean', 'aggressive', 'emergency'].includes(String(source.mode)) ? (source.mode as DepositMode) : fallback.mode,
    baseDepositAmount: Math.max(0, asNumber(source.baseDepositAmount, fallback.baseDepositAmount)),
    cadence: source.cadence === 'yearly' ? 'yearly' : 'monthly',
    startYearOffset: clampInt(source.startYearOffset, fallback.startYearOffset, 0, 50),
    durationYears: clampInt(source.durationYears, fallback.durationYears, 1, 60),
    pauseMonthsPerYear: clampInt(source.pauseMonthsPerYear, fallback.pauseMonthsPerYear, 0, 11),
    escalationMode: ['none', 'pctYearly', 'fixedDkkYearly'].includes(String(source.escalationMode))
      ? (source.escalationMode as DepositEscalationMode)
      : fallback.escalationMode,
    escalationPct: Math.max(0, asNumber(source.escalationPct, fallback.escalationPct)),
    escalationDkkPerYear: Math.max(0, asNumber(source.escalationDkkPerYear, fallback.escalationDkkPerYear)),
    inflationAdjust: typeof source.inflationAdjust === 'boolean' ? source.inflationAdjust : fallback.inflationAdjust,
    routingPriority: String(source.routingPriority) === 'buffer>goals>debt>wrappers>taxable'
      ? 'buffer>goals>debt>wrappers>taxable'
      : fallback.routingPriority,
    routingCapsNote: typeof source.routingCapsNote === 'string' ? source.routingCapsNote : fallback.routingCapsNote,
    recurringBoostMonth: clampInt(source.recurringBoostMonth, fallback.recurringBoostMonth, 1, 12),
    recurringBoostAmount: Math.max(0, asNumber(source.recurringBoostAmount, fallback.recurringBoostAmount)),
    oneOffs: rawOneOffs.slice(0, 12).map((item) => {
      const oneOff = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        id: typeof oneOff.id === 'string' ? oneOff.id : buildDepositId(),
        label: typeof oneOff.label === 'string' ? oneOff.label : 'One-off deposit',
        yearOffset: clampInt(oneOff.yearOffset, 0, 0, 50),
        amount: Math.max(0, asNumber(oneOff.amount, 0)),
      } satisfies OneOffDeposit;
    }),
  };
};

const toMonthlyDeposit = (draft: DepositStrategyDraft, yearIndex: number, inflationPct: number): number => {
  let base = draft.cadence === 'monthly' ? draft.baseDepositAmount : draft.baseDepositAmount / 12;
  if (draft.escalationMode === 'pctYearly') base *= Math.pow(1 + draft.escalationPct / 100, yearIndex);
  if (draft.escalationMode === 'fixedDkkYearly') base += draft.escalationDkkPerYear * yearIndex / 12;
  if (draft.inflationAdjust) base *= Math.pow(1 + inflationPct / 100, yearIndex);
  return Math.max(0, base);
};

const buildPreview = (draft: DepositStrategyDraft, assumptions: Assumptions): DepositPreviewRow[] => {
  return Array.from({ length: Math.min(draft.durationYears, 8) }).map((_, yearIndex) => {
    const monthly = toMonthlyDeposit(draft, yearIndex, assumptions.inflationPct);
    const activeMonths = Math.max(0, 12 - draft.pauseMonthsPerYear);
    const plannedDeposits = yearIndex < draft.startYearOffset ? 0 : monthly * activeMonths;
    const recurringBoost = yearIndex < draft.startYearOffset ? 0 : draft.recurringBoostAmount;
    const oneOffs = draft.oneOffs.filter((item) => item.yearOffset === yearIndex).reduce((sum, item) => sum + item.amount, 0);
    return {
      year: yearIndex + 1,
      plannedDeposits: Math.round(plannedDeposits + recurringBoost),
      oneOffs: Math.round(oneOffs),
      total: Math.round(plannedDeposits + recurringBoost + oneOffs),
      mode: draft.mode,
    };
  });
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

const DepositStrategyPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const registryItems = useMemo(() => listStrategyRegistryItems('depositStrategy'), []);
  const emptyDraft = useMemo(() => buildDefaultDepositDraft(currentAssumptions), [currentAssumptions]);
  const [profileState, setProfileState] = useState<StrategyProfileState<DepositStrategyDraft>>(() =>
    loadStrategyProfileState('depositStrategy', emptyDraft, (value) => normalizeDepositDraft(value, currentAssumptions))
  );
  const [draft, setDraft] = useState<DepositStrategyDraft>(() => profileState.draft);
  const [selectedProfileId, setSelectedProfileId] = useState(profileState.activeProfileId ?? '');
  const [profileName, setProfileName] = useState(
    () => profileState.profiles.find((profile) => profile.id === profileState.activeProfileId)?.name ?? ''
  );
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    const next = loadStrategyProfileState('depositStrategy', emptyDraft, (value) => normalizeDepositDraft(value, currentAssumptions));
    setProfileState(next);
    setDraft(next.draft);
    setSelectedProfileId(next.activeProfileId ?? '');
    setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
  }, [currentAssumptions, emptyDraft]);

  const persistState = (next: StrategyProfileState<DepositStrategyDraft>) => {
    setProfileState(next);
    saveStrategyProfileState('depositStrategy', next);
  };

  const previewRows = useMemo(() => buildPreview(draft, currentAssumptions), [draft, currentAssumptions]);
  const totalDeposits = previewRows.reduce((sum, row) => sum + row.total, 0);
  const avgMonthly = draft.durationYears > 0 ? Math.round(totalDeposits / (draft.durationYears * 12)) : 0;
  const usedByCount = useMemo(
    () => new Set(registryItems.flatMap((item) => filterUsedByForAssumptionsHub(item.usedBy))).size,
    [registryItems]
  );
  const isDirty = JSON.stringify(draft) !== JSON.stringify(profileState.draft);
  const lastSavedLabel = profileState.draftSavedAt ? new Date(profileState.draftSavedAt).toLocaleString() : 'Not saved yet';

  return (
    <PageLayout variant="wide">
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={chipStyle}>Deposit editor</span>
              <span style={chipStyle}>Defaults tab: {ASSUMPTIONS_TAB_LABELS.depositStrategy}</span>
              <span style={chipStyle}>{isDirty ? 'Unsaved draft' : 'Saved draft'}</span>
              <span style={chipStyle}>Profiles: {profileState.profiles.length}</span>
            </div>
            <h1 style={{ margin: 0 }}>Deposit Strategy</h1>
            <div style={{ opacity: 0.8, maxWidth: 900 }}>
              Build a concrete contribution plan with cadence, escalation, one-offs, routing priorities, and a preview of how deposits accumulate over the first years.
            </div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Local draft persistence: {lastSavedLabel}</div>
          </div>

          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Profile</span>
                <select aria-label="Deposit profile" value={selectedProfileId} onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedProfileId(nextId);
                  setProfileName(profileState.profiles.find((profile) => profile.id === nextId)?.name ?? '');
                }} style={{ minWidth: 220, padding: '8px 10px', borderRadius: 10 }}>
                  <option value="">Scratch draft</option>
                  {profileState.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Profile name</span>
                <input aria-label="Profile name" type="text" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="e.g. Front-load first decade" style={{ minWidth: 220, padding: '8px 10px', borderRadius: 10 }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => persistState(persistStrategyDraft(profileState, draft))} style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}>Save draft</button>
              <button type="button" disabled={!profileName.trim()} onClick={() => {
                const next = saveStrategyProfile(profileState, { id: selectedProfileId || null, name: profileName, data: draft });
                persistState(next);
                setSelectedProfileId(next.activeProfileId ?? '');
                setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? profileName);
              }} style={{ ...chipStyle, cursor: profileName.trim() ? 'pointer' : 'default', background: 'transparent' }}>{selectedProfileId ? 'Update profile' : 'Save as profile'}</button>
              <button type="button" disabled={!selectedProfileId} onClick={() => {
                if (!selectedProfileId) return;
                const next = applyStrategyProfile(profileState, selectedProfileId);
                persistState(next);
                setDraft(next.draft);
                setProfileName(next.profiles.find((profile) => profile.id === selectedProfileId)?.name ?? '');
              }} style={{ ...chipStyle, cursor: selectedProfileId ? 'pointer' : 'default', background: 'transparent' }}>Load selected</button>
              <button type="button" disabled={!selectedProfileId} onClick={() => {
                if (!selectedProfileId) return;
                const next = deleteStrategyProfile(profileState, selectedProfileId);
                persistState(next);
                setSelectedProfileId(next.activeProfileId ?? '');
                setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
              }} style={{ ...chipStyle, cursor: selectedProfileId ? 'pointer' : 'default', background: 'transparent' }}>Delete profile</button>
              <button type="button" onClick={() => exportStrategyProfilesJson('depositStrategy', { ...profileState, draft })} style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}>Export profiles</button>
              <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(event) => {
                  const file = event.target.files && event.target.files.length ? event.target.files[0] : null;
                  void importStrategyProfilesJson(file, emptyDraft, (value) => normalizeDepositDraft(value, currentAssumptions)).then((next) => {
                    if (!next) {
                      setImportStatus('Import failed. The file could not be parsed as valid strategy profile JSON.');
                      return;
                    }
                    persistState(next);
                    setDraft(next.draft);
                    setSelectedProfileId(next.activeProfileId ?? '');
                    setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
                    setImportStatus('Strategy profiles imported into Deposit Strategy.');
                  }).catch(() => {
                    setImportStatus('Import failed. The file could not be parsed as valid strategy profile JSON.');
                  });
                  event.target.value = '';
                }} />
                <span style={{ ...chipStyle, cursor: 'pointer' }}>Import profiles</span>
              </label>
              <button type="button" disabled={!isDirty} onClick={() => setDraft(profileState.draft)} style={{ ...chipStyle, cursor: isDirty ? 'pointer' : 'default', background: 'transparent' }}>Reset to saved</button>
              <button type="button" onClick={() => {
                const next = clearStrategyDraft(profileState, emptyDraft);
                persistState(next);
                setDraft(next.draft);
                setSelectedProfileId('');
                setProfileName('');
              }} style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}>Clear draft</button>
              <Link to="/assumptions" style={{ ...chipStyle, textDecoration: 'none', color: 'inherit' }}>Open Assumptions Hub</Link>
              <Link to="/simulation" style={{ ...chipStyle, textDecoration: 'none', color: 'inherit' }}>Back to simulator</Link>
            </div>
            {importStatus && <div style={{ fontSize: 12, opacity: 0.78 }}>{importStatus}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <div style={cardStyle}><div style={{ fontSize: 12, opacity: 0.75 }}>Avg monthly deposit</div><div style={{ fontSize: 28, fontWeight: 800 }}>{avgMonthly} DKK</div></div>
          <div style={cardStyle}><div style={{ fontSize: 12, opacity: 0.75 }}>Total planned deposits</div><div style={{ fontSize: 28, fontWeight: 800 }}>{totalDeposits} DKK</div></div>
          <div style={cardStyle}><div style={{ fontSize: 12, opacity: 0.75 }}>Pause months / year</div><div style={{ fontSize: 28, fontWeight: 800 }}>{draft.pauseMonthsPerYear}</div></div>
          <div style={cardStyle}><div style={{ fontSize: 12, opacity: 0.75 }}>Connected pages</div><div style={{ fontSize: 28, fontWeight: 800 }}>{usedByCount}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Strategy header</div>
              <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Strategy title</span><input aria-label="Strategy title" type="text" value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
              <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Description</span><textarea aria-label="Strategy description" rows={3} value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} style={{ padding: '10px 12px', borderRadius: 10, resize: 'vertical' }} /></label>
              <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Mode</span><select aria-label="Deposit mode" value={draft.mode} onChange={(event) => setDraft((prev) => ({ ...prev, mode: event.target.value as DepositMode }))} style={{ padding: '10px 12px', borderRadius: 10 }}><option value="normal">Normal</option><option value="lean">Lean</option><option value="aggressive">Aggressive</option><option value="emergency">Emergency</option></select></label>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Deposit schedule</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Base deposit amount</span><input aria-label="Base deposit amount" type="number" value={draft.baseDepositAmount} onChange={(event) => setDraft((prev) => ({ ...prev, baseDepositAmount: Math.max(0, asNumber(event.target.value, prev.baseDepositAmount)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Frequency</span><select aria-label="Deposit frequency" value={draft.cadence} onChange={(event) => setDraft((prev) => ({ ...prev, cadence: event.target.value as DepositCadence }))} style={{ padding: '10px 12px', borderRadius: 10 }}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Start year offset</span><input aria-label="Start year offset" type="number" value={draft.startYearOffset} onChange={(event) => setDraft((prev) => ({ ...prev, startYearOffset: clampInt(event.target.value, prev.startYearOffset, 0, 50) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Duration years</span><input aria-label="Duration years" type="number" value={draft.durationYears} onChange={(event) => setDraft((prev) => ({ ...prev, durationYears: clampInt(event.target.value, prev.durationYears, 1, 60) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
              </div>
              <label style={{ display: 'grid', gap: 6, maxWidth: 240 }}><span style={{ fontWeight: 600 }}>Pause months per year</span><input aria-label="Pause months per year" type="number" value={draft.pauseMonthsPerYear} onChange={(event) => setDraft((prev) => ({ ...prev, pauseMonthsPerYear: clampInt(event.target.value, prev.pauseMonthsPerYear, 0, 11) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Step-ups / escalation</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Escalation mode</span><select aria-label="Escalation mode" value={draft.escalationMode} onChange={(event) => setDraft((prev) => ({ ...prev, escalationMode: event.target.value as DepositEscalationMode }))} style={{ padding: '10px 12px', borderRadius: 10 }}><option value="none">None</option><option value="pctYearly">% per year</option><option value="fixedDkkYearly">Fixed DKK / year</option></select></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Escalation %</span><input aria-label="Escalation percent" type="number" value={draft.escalationPct} onChange={(event) => setDraft((prev) => ({ ...prev, escalationPct: Math.max(0, asNumber(event.target.value, prev.escalationPct)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Escalation DKK / year</span><input aria-label="Escalation amount" type="number" value={draft.escalationDkkPerYear} onChange={(event) => setDraft((prev) => ({ ...prev, escalationDkkPerYear: Math.max(0, asNumber(event.target.value, prev.escalationDkkPerYear)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input aria-label="Inflation adjust contributions" type="checkbox" checked={draft.inflationAdjust} onChange={(event) => setDraft((prev) => ({ ...prev, inflationAdjust: event.target.checked }))} />Inflation adjust</label>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>One-off deposits</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {draft.oneOffs.map((item, index) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 140px auto', gap: 10, alignItems: 'end' }}>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Label</span><input aria-label={`One-off ${index + 1} label`} type="text" value={item.label} onChange={(event) => setDraft((prev) => ({ ...prev, oneOffs: prev.oneOffs.map((row) => row.id === item.id ? { ...row, label: event.target.value } : row) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Year</span><input aria-label={`One-off ${index + 1} year`} type="number" value={item.yearOffset} onChange={(event) => setDraft((prev) => ({ ...prev, oneOffs: prev.oneOffs.map((row) => row.id === item.id ? { ...row, yearOffset: clampInt(event.target.value, row.yearOffset, 0, 50) } : row) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Amount</span><input aria-label={`One-off ${index + 1} amount`} type="number" value={item.amount} onChange={(event) => setDraft((prev) => ({ ...prev, oneOffs: prev.oneOffs.map((row) => row.id === item.id ? { ...row, amount: Math.max(0, asNumber(event.target.value, row.amount)) } : row) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                    <button type="button" onClick={() => setDraft((prev) => ({ ...prev, oneOffs: prev.oneOffs.filter((row) => row.id !== item.id) }))}>Remove</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 160px', gap: 10, alignItems: 'end' }}>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Recurring boost month</span><input aria-label="Recurring boost month" type="number" value={draft.recurringBoostMonth} onChange={(event) => setDraft((prev) => ({ ...prev, recurringBoostMonth: clampInt(event.target.value, prev.recurringBoostMonth, 1, 12) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Recurring boost amount</span><input aria-label="Recurring boost amount" type="number" value={draft.recurringBoostAmount} onChange={(event) => setDraft((prev) => ({ ...prev, recurringBoostAmount: Math.max(0, asNumber(event.target.value, prev.recurringBoostAmount)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
              </div>
              <div><button type="button" onClick={() => setDraft((prev) => ({ ...prev, oneOffs: [...prev.oneOffs, { id: buildDepositId(), label: `One-off ${prev.oneOffs.length + 1}`, yearOffset: 0, amount: 0 }] }))}>Add one-off</button></div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Contribution routing (priorities)</div>
              <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Priority order</span><select aria-label="Priority order" value={draft.routingPriority} onChange={(event) => setDraft((prev) => ({ ...prev, routingPriority: event.target.value as DepositStrategyDraft['routingPriority'] }))} style={{ padding: '10px 12px', borderRadius: 10 }}><option value="buffer>debt>wrappers>taxable">buffer → debt → wrappers → taxable</option><option value="buffer>goals>debt>wrappers>taxable">buffer → goals → debt → wrappers → taxable</option></select></label>
              <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Caps / targets note</span><textarea aria-label="Caps and targets note" rows={2} value={draft.routingCapsNote} onChange={(event) => setDraft((prev) => ({ ...prev, routingCapsNote: event.target.value }))} style={{ padding: '10px 12px', borderRadius: 10, resize: 'vertical' }} /></label>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Preview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72 }}>Avg monthly deposit</div><div style={{ fontWeight: 800 }}>{avgMonthly} DKK</div></div>
                <div style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72 }}>Total deposits</div><div style={{ fontWeight: 800 }}>{totalDeposits} DKK</div></div>
                <div style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72 }}>Pause months count</div><div style={{ fontWeight: 800 }}>{draft.pauseMonthsPerYear * draft.durationYears}</div></div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 120px', gap: 8, fontSize: 12, fontWeight: 700, opacity: 0.78 }}>
                  <div>Year</div><div>Planned deposits</div><div>One-offs</div><div>Total</div><div>Mode</div>
                </div>
                {previewRows.map((row) => (
                  <div key={row.year} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 120px', gap: 8, fontSize: 12 }}>
                    <div>{row.year}</div><div>{row.plannedDeposits}</div><div>{row.oneOffs}</div><div>{row.total}</div><div>{row.mode}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12, position: 'sticky', top: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Inherited defaults from assumptions</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Cadence, escalation defaults, and routing conventions still come from the assumptions authority layer. Deposit profiles hold the page-specific plan on top.</div>
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
                    {usedBy.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{usedBy.map((label) => <span key={label} style={chipStyle}>Used by: {label}</span>)}</div>}
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

export default DepositStrategyPage;
