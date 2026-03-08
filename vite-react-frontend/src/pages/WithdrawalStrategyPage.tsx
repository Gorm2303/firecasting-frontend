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

type WithdrawalRule = 'fixedPct' | 'fixedReal' | 'guardrails';
type RoutingOrder = 'cash>taxable>wrappers>pension' | 'cash>wrappers>taxable>pension';

type PlaybookCard = {
  id: string;
  percentile: 'P10' | 'P25' | 'P50' | 'P75' | 'P90';
  spendingAdjustmentPct: number;
  depositAdjustmentPct: number;
  note: string;
};

type WithdrawalStrategyDraft = {
  title: string;
  description: string;
  withdrawalStartAge: number;
  horizonYears: number;
  withdrawalRule: WithdrawalRule;
  inflationAdjust: boolean;
  baseMonthlySpending: number;
  spendingFloor: number;
  spendingCeiling: number;
  maxCutPerYearPct: number;
  triggerPercentile: number;
  triggerDrawdownPct: number;
  includePension: boolean;
  includePartTime: boolean;
  includeSideHustle: boolean;
  supplementalIncomeMonthly: number;
  routingOrder: RoutingOrder;
  cashBufferTargetMonths: number;
  refillThresholdMonths: number;
  playbook: PlaybookCard[];
};

type PreviewRow = {
  year: number;
  targetSpending: number;
  supplementalIncome: number;
  withdrawals: number;
  bufferMonths: number;
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

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const clampInt = (value: unknown, fallback: number, min = 0, max = 10_000): number =>
  Math.min(max, Math.max(min, Math.trunc(asNumber(value, fallback))));

const buildPlaybookId = (): string => `withdrawal-playbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildDefaultWithdrawalDraft = (assumptions: Assumptions): WithdrawalStrategyDraft => ({
  title: 'Guardrail retirement plan',
  description: 'Baseline withdrawal plan anchored to the current withdrawal assumptions.',
  withdrawalStartAge: 55,
  horizonYears: 35,
  withdrawalRule: assumptions.withdrawalStrategyDefaults.withdrawalRule,
  inflationAdjust: assumptions.withdrawalStrategyDefaults.inflationAdjustSpending,
  baseMonthlySpending: 26000,
  spendingFloor: 18000,
  spendingCeiling: 34000,
  maxCutPerYearPct: assumptions.withdrawalStrategyDefaults.maxCutPctPerYear,
  triggerPercentile: 25,
  triggerDrawdownPct: 20,
  includePension: true,
  includePartTime: false,
  includeSideHustle: false,
  supplementalIncomeMonthly: 8000,
  routingOrder: 'cash>taxable>wrappers>pension',
  cashBufferTargetMonths: assumptions.withdrawalStrategyDefaults.cashBufferTargetMonths,
  refillThresholdMonths: Math.max(1, assumptions.withdrawalStrategyDefaults.cashBufferTargetMonths - 2),
  playbook: [
    { id: buildPlaybookId(), percentile: 'P10', spendingAdjustmentPct: -10, depositAdjustmentPct: 0, note: 'Cut discretionary spending and hold buffer.' },
    { id: buildPlaybookId(), percentile: 'P50', spendingAdjustmentPct: 0, depositAdjustmentPct: 0, note: 'Stay on baseline plan.' },
    { id: buildPlaybookId(), percentile: 'P90', spendingAdjustmentPct: 5, depositAdjustmentPct: 0, note: 'Release some deferred spending.' },
  ],
});

const normalizeWithdrawalDraft = (value: unknown, assumptions: Assumptions): WithdrawalStrategyDraft => {
  const fallback = buildDefaultWithdrawalDraft(assumptions);
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawPlaybook = Array.isArray(source.playbook) ? source.playbook : fallback.playbook;

  return {
    title: typeof source.title === 'string' && source.title.trim() ? source.title : fallback.title,
    description: typeof source.description === 'string' ? source.description : fallback.description,
    withdrawalStartAge: clampInt(source.withdrawalStartAge, fallback.withdrawalStartAge, 18, 90),
    horizonYears: clampInt(source.horizonYears, fallback.horizonYears, 1, 80),
    withdrawalRule: ['fixedPct', 'fixedReal', 'guardrails'].includes(String(source.withdrawalRule)) ? (source.withdrawalRule as WithdrawalRule) : fallback.withdrawalRule,
    inflationAdjust: typeof source.inflationAdjust === 'boolean' ? source.inflationAdjust : fallback.inflationAdjust,
    baseMonthlySpending: Math.max(0, asNumber(source.baseMonthlySpending, fallback.baseMonthlySpending)),
    spendingFloor: Math.max(0, asNumber(source.spendingFloor, fallback.spendingFloor)),
    spendingCeiling: Math.max(0, asNumber(source.spendingCeiling, fallback.spendingCeiling)),
    maxCutPerYearPct: Math.max(0, asNumber(source.maxCutPerYearPct, fallback.maxCutPerYearPct)),
    triggerPercentile: clampInt(source.triggerPercentile, fallback.triggerPercentile, 1, 99),
    triggerDrawdownPct: Math.max(0, asNumber(source.triggerDrawdownPct, fallback.triggerDrawdownPct)),
    includePension: typeof source.includePension === 'boolean' ? source.includePension : fallback.includePension,
    includePartTime: typeof source.includePartTime === 'boolean' ? source.includePartTime : fallback.includePartTime,
    includeSideHustle: typeof source.includeSideHustle === 'boolean' ? source.includeSideHustle : fallback.includeSideHustle,
    supplementalIncomeMonthly: Math.max(0, asNumber(source.supplementalIncomeMonthly, fallback.supplementalIncomeMonthly)),
    routingOrder: String(source.routingOrder) === 'cash>wrappers>taxable>pension' ? 'cash>wrappers>taxable>pension' : fallback.routingOrder,
    cashBufferTargetMonths: clampInt(source.cashBufferTargetMonths, fallback.cashBufferTargetMonths, 0, 36),
    refillThresholdMonths: clampInt(source.refillThresholdMonths, fallback.refillThresholdMonths, 0, 36),
    playbook: rawPlaybook.slice(0, 8).map((item) => {
      const card = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        id: typeof card.id === 'string' ? card.id : buildPlaybookId(),
        percentile: ['P10', 'P25', 'P50', 'P75', 'P90'].includes(String(card.percentile)) ? (card.percentile as PlaybookCard['percentile']) : 'P50',
        spendingAdjustmentPct: asNumber(card.spendingAdjustmentPct, 0),
        depositAdjustmentPct: asNumber(card.depositAdjustmentPct, 0),
        note: typeof card.note === 'string' ? card.note : '',
      } satisfies PlaybookCard;
    }),
  };
};

const buildPreview = (draft: WithdrawalStrategyDraft, assumptions: Assumptions): PreviewRow[] => {
  return Array.from({ length: Math.min(draft.horizonYears, 8) }).map((_, index) => {
    const inflationFactor = draft.inflationAdjust ? Math.pow(1 + assumptions.inflationPct / 100, index) : 1;
    const targetSpending = Math.round(Math.min(draft.spendingCeiling, Math.max(draft.spendingFloor, draft.baseMonthlySpending * inflationFactor)));
    const supplementalIncome = Math.round((draft.includePension || draft.includePartTime || draft.includeSideHustle) ? draft.supplementalIncomeMonthly : 0);
    const withdrawals = Math.max(0, targetSpending - supplementalIncome);
    const bufferMonths = Math.max(draft.refillThresholdMonths, draft.cashBufferTargetMonths - Math.min(index, draft.cashBufferTargetMonths));
    return {
      year: index + 1,
      targetSpending,
      supplementalIncome,
      withdrawals,
      bufferMonths,
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

const WithdrawalStrategyPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const registryItems = useMemo(() => listStrategyRegistryItems('withdrawalStrategy'), []);
  const emptyDraft = useMemo(() => buildDefaultWithdrawalDraft(currentAssumptions), [currentAssumptions]);
  const [profileState, setProfileState] = useState<StrategyProfileState<WithdrawalStrategyDraft>>(() =>
    loadStrategyProfileState('withdrawalStrategy', emptyDraft, (value) => normalizeWithdrawalDraft(value, currentAssumptions))
  );
  const [draft, setDraft] = useState<WithdrawalStrategyDraft>(() => profileState.draft);
  const [selectedProfileId, setSelectedProfileId] = useState(profileState.activeProfileId ?? '');
  const [profileName, setProfileName] = useState(
    () => profileState.profiles.find((profile) => profile.id === profileState.activeProfileId)?.name ?? ''
  );
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    const next = loadStrategyProfileState('withdrawalStrategy', emptyDraft, (value) => normalizeWithdrawalDraft(value, currentAssumptions));
    setProfileState(next);
    setDraft(next.draft);
    setSelectedProfileId(next.activeProfileId ?? '');
    setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
  }, [currentAssumptions, emptyDraft]);

  const persistState = (next: StrategyProfileState<WithdrawalStrategyDraft>) => {
    setProfileState(next);
    saveStrategyProfileState('withdrawalStrategy', next);
  };

  const previewRows = useMemo(() => buildPreview(draft, currentAssumptions), [draft, currentAssumptions]);
  const initialWithdrawal = previewRows[0]?.withdrawals ?? 0;
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
              <span style={chipStyle}>Withdrawal editor</span>
              <span style={chipStyle}>Defaults tab: {ASSUMPTIONS_TAB_LABELS.withdrawalStrategy}</span>
              <span style={chipStyle}>{isDirty ? 'Unsaved draft' : 'Saved draft'}</span>
              <span style={chipStyle}>Profiles: {profileState.profiles.length}</span>
            </div>
            <h1 style={{ margin: 0 }}>Withdrawal Strategy</h1>
            <div style={{ opacity: 0.8, maxWidth: 900 }}>
              Define retirement timing, guardrails, income blending, routing, and bad-year actions with a live preview of withdrawals over the first years.
            </div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Local draft persistence: {lastSavedLabel}</div>
          </div>

          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Profile</span>
                <select aria-label="Withdrawal profile" value={selectedProfileId} onChange={(event) => {
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
                <input aria-label="Profile name" type="text" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="e.g. Guardrails with pension bridge" style={{ minWidth: 220, padding: '8px 10px', borderRadius: 10 }} />
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
              <button type="button" onClick={() => exportStrategyProfilesJson('withdrawalStrategy', { ...profileState, draft })} style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}>Export profiles</button>
              <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(event) => {
                  const file = event.target.files && event.target.files.length ? event.target.files[0] : null;
                  void importStrategyProfilesJson(file, emptyDraft, (value) => normalizeWithdrawalDraft(value, currentAssumptions)).then((next) => {
                    if (!next) {
                      setImportStatus('Import failed. The file could not be parsed as valid strategy profile JSON.');
                      return;
                    }
                    persistState(next);
                    setDraft(next.draft);
                    setSelectedProfileId(next.activeProfileId ?? '');
                    setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
                    setImportStatus('Strategy profiles imported into Withdrawal Strategy.');
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
          <div style={cardStyle}><div style={{ fontSize: 12, opacity: 0.75 }}>Initial withdrawal</div><div style={{ fontSize: 28, fontWeight: 800 }}>{initialWithdrawal} DKK</div></div>
          <div style={cardStyle}><div style={{ fontSize: 12, opacity: 0.75 }}>Floor / ceiling band</div><div style={{ fontSize: 20, fontWeight: 800 }}>{draft.spendingFloor} - {draft.spendingCeiling}</div></div>
          <div style={cardStyle}><div style={{ fontSize: 12, opacity: 0.75 }}>Cash buffer months</div><div style={{ fontSize: 28, fontWeight: 800 }}>{draft.cashBufferTargetMonths}</div></div>
          <div style={cardStyle}><div style={{ fontSize: 12, opacity: 0.75 }}>Connected pages</div><div style={{ fontSize: 28, fontWeight: 800 }}>{usedByCount}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Strategy header</div>
              <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Strategy title</span><input aria-label="Strategy title" type="text" value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
              <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Description</span><textarea aria-label="Strategy description" rows={3} value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} style={{ padding: '10px 12px', borderRadius: 10, resize: 'vertical' }} /></label>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Retirement timing</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Withdrawal start age</span><input aria-label="Withdrawal start age" type="number" value={draft.withdrawalStartAge} onChange={(event) => setDraft((prev) => ({ ...prev, withdrawalStartAge: clampInt(event.target.value, prev.withdrawalStartAge, 18, 90) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Horizon years</span><input aria-label="Horizon years" type="number" value={draft.horizonYears} onChange={(event) => setDraft((prev) => ({ ...prev, horizonYears: clampInt(event.target.value, prev.horizonYears, 1, 80) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Base withdrawal rule</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Rule</span><select aria-label="Withdrawal rule" value={draft.withdrawalRule} onChange={(event) => setDraft((prev) => ({ ...prev, withdrawalRule: event.target.value as WithdrawalRule }))} style={{ padding: '10px 12px', borderRadius: 10 }}><option value="fixedPct">Fixed %</option><option value="fixedReal">Fixed real spending</option><option value="guardrails">Guardrails</option></select></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Base monthly spending</span><input aria-label="Base monthly spending" type="number" value={draft.baseMonthlySpending} onChange={(event) => setDraft((prev) => ({ ...prev, baseMonthlySpending: Math.max(0, asNumber(event.target.value, prev.baseMonthlySpending)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input aria-label="Inflation adjust spending" type="checkbox" checked={draft.inflationAdjust} onChange={(event) => setDraft((prev) => ({ ...prev, inflationAdjust: event.target.checked }))} />Inflation adjust</label>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Guardrails & limits</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Spending floor</span><input aria-label="Spending floor" type="number" value={draft.spendingFloor} onChange={(event) => setDraft((prev) => ({ ...prev, spendingFloor: Math.max(0, asNumber(event.target.value, prev.spendingFloor)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Spending ceiling</span><input aria-label="Spending ceiling" type="number" value={draft.spendingCeiling} onChange={(event) => setDraft((prev) => ({ ...prev, spendingCeiling: Math.max(0, asNumber(event.target.value, prev.spendingCeiling)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Max cut / year %</span><input aria-label="Max cut per year" type="number" value={draft.maxCutPerYearPct} onChange={(event) => setDraft((prev) => ({ ...prev, maxCutPerYearPct: Math.max(0, asNumber(event.target.value, prev.maxCutPerYearPct)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Trigger percentile</span><input aria-label="Trigger percentile" type="number" value={draft.triggerPercentile} onChange={(event) => setDraft((prev) => ({ ...prev, triggerPercentile: clampInt(event.target.value, prev.triggerPercentile, 1, 99) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Trigger drawdown %</span><input aria-label="Trigger drawdown" type="number" value={draft.triggerDrawdownPct} onChange={(event) => setDraft((prev) => ({ ...prev, triggerDrawdownPct: Math.max(0, asNumber(event.target.value, prev.triggerDrawdownPct)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Income blending</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input aria-label="Include pension" type="checkbox" checked={draft.includePension} onChange={(event) => setDraft((prev) => ({ ...prev, includePension: event.target.checked }))} />Include pension</label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input aria-label="Include part-time" type="checkbox" checked={draft.includePartTime} onChange={(event) => setDraft((prev) => ({ ...prev, includePartTime: event.target.checked }))} />Include part-time</label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input aria-label="Include side hustle" type="checkbox" checked={draft.includeSideHustle} onChange={(event) => setDraft((prev) => ({ ...prev, includeSideHustle: event.target.checked }))} />Include side hustle</label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Supplemental monthly income</span><input aria-label="Supplemental monthly income" type="number" value={draft.supplementalIncomeMonthly} onChange={(event) => setDraft((prev) => ({ ...prev, supplementalIncomeMonthly: Math.max(0, asNumber(event.target.value, prev.supplementalIncomeMonthly)) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Withdrawal routing & buffer</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Routing order</span><select aria-label="Routing order" value={draft.routingOrder} onChange={(event) => setDraft((prev) => ({ ...prev, routingOrder: event.target.value as RoutingOrder }))} style={{ padding: '10px 12px', borderRadius: 10 }}><option value="cash>taxable>wrappers>pension">cash → taxable → wrappers → pension</option><option value="cash>wrappers>taxable>pension">cash → wrappers → taxable → pension</option></select></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Cash buffer target</span><input aria-label="Cash buffer target" type="number" value={draft.cashBufferTargetMonths} onChange={(event) => setDraft((prev) => ({ ...prev, cashBufferTargetMonths: clampInt(event.target.value, prev.cashBufferTargetMonths, 0, 36) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Refill threshold</span><input aria-label="Refill threshold" type="number" value={draft.refillThresholdMonths} onChange={(event) => setDraft((prev) => ({ ...prev, refillThresholdMonths: clampInt(event.target.value, prev.refillThresholdMonths, 0, 36) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Bad-year playbook</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {draft.playbook.map((card, index) => (
                  <div key={card.id} style={{ display: 'grid', gridTemplateColumns: '110px 150px 150px minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Percentile</span><select aria-label={`Playbook ${index + 1} percentile`} value={card.percentile} onChange={(event) => setDraft((prev) => ({ ...prev, playbook: prev.playbook.map((item) => item.id === card.id ? { ...item, percentile: event.target.value as PlaybookCard['percentile'] } : item) }))} style={{ padding: '10px 12px', borderRadius: 10 }}><option value="P10">P10</option><option value="P25">P25</option><option value="P50">P50</option><option value="P75">P75</option><option value="P90">P90</option></select></label>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Spending adj. %</span><input aria-label={`Playbook ${index + 1} spending adjustment`} type="number" value={card.spendingAdjustmentPct} onChange={(event) => setDraft((prev) => ({ ...prev, playbook: prev.playbook.map((item) => item.id === card.id ? { ...item, spendingAdjustmentPct: asNumber(event.target.value, item.spendingAdjustmentPct) } : item) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Deposit adj. %</span><input aria-label={`Playbook ${index + 1} deposit adjustment`} type="number" value={card.depositAdjustmentPct} onChange={(event) => setDraft((prev) => ({ ...prev, playbook: prev.playbook.map((item) => item.id === card.id ? { ...item, depositAdjustmentPct: asNumber(event.target.value, item.depositAdjustmentPct) } : item) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                    <label style={{ display: 'grid', gap: 6 }}><span style={{ fontWeight: 600 }}>Note</span><input aria-label={`Playbook ${index + 1} note`} type="text" value={card.note} onChange={(event) => setDraft((prev) => ({ ...prev, playbook: prev.playbook.map((item) => item.id === card.id ? { ...item, note: event.target.value } : item) }))} style={{ padding: '10px 12px', borderRadius: 10 }} /></label>
                    <button type="button" onClick={() => setDraft((prev) => ({ ...prev, playbook: prev.playbook.filter((item) => item.id !== card.id) }))}>Remove</button>
                  </div>
                ))}
              </div>
              <div><button type="button" onClick={() => setDraft((prev) => ({ ...prev, playbook: [...prev.playbook, { id: buildPlaybookId(), percentile: 'P25', spendingAdjustmentPct: -5, depositAdjustmentPct: 0, note: '' }] }))}>Add playbook card</button></div>
            </div>

            <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Preview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72 }}>Initial withdrawal</div><div style={{ fontWeight: 800 }}>{initialWithdrawal} DKK</div></div>
                <div style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72 }}>Floor / ceiling band</div><div style={{ fontWeight: 800 }}>{draft.spendingFloor} / {draft.spendingCeiling}</div></div>
                <div style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, opacity: 0.72 }}>Buffer months</div><div style={{ fontWeight: 800 }}>{draft.cashBufferTargetMonths}</div></div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 120px', gap: 8, fontSize: 12, fontWeight: 700, opacity: 0.78 }}>
                  <div>Year</div><div>Target spending</div><div>Income</div><div>Withdrawals</div><div>Buffer months</div>
                </div>
                {previewRows.map((row) => (
                  <div key={row.year} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr 120px', gap: 8, fontSize: 12 }}>
                    <div>{row.year}</div><div>{row.targetSpending}</div><div>{row.supplementalIncome}</div><div>{row.withdrawals}</div><div>{row.bufferMonths}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12, position: 'sticky', top: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Inherited defaults from assumptions</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Withdrawal profiles sit on top of the assumptions authority layer for guardrails, cash-buffer conventions, and baseline rule defaults.</div>
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

export default WithdrawalStrategyPage;
