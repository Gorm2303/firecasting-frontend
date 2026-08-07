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

const statPanelClass = 'rounded-xl border border-card-border bg-card p-4';
const fieldLabelClass = 'grid gap-1.5';
const fieldLabelTextClass = 'font-semibold';
const miniStatClass = 'rounded-lg border border-card-border p-3';

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
      <div className="mx-auto grid max-w-330 gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap gap-2">
              <Chip>Withdrawal editor</Chip>
              <Chip>Defaults tab: {ASSUMPTIONS_TAB_LABELS.withdrawalStrategy}</Chip>
              <Chip>{isDirty ? 'Unsaved draft' : 'Saved draft'}</Chip>
              <Chip>Profiles: {profileState.profiles.length}</Chip>
            </div>
            <h1 className="m-0 text-2xl font-extrabold">Withdrawal Strategy</h1>
            <div className="max-w-225 opacity-80">
              Define retirement timing, guardrails, income blending, routing, and bad-year actions with a live preview of withdrawals over the first years.
            </div>
            <div className="text-xs opacity-70">Local draft persistence: {lastSavedLabel}</div>
          </div>

          <div className="grid justify-items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="grid gap-1 text-xs">
                <span>Profile</span>
                <Select aria-label="Withdrawal profile" value={selectedProfileId} onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedProfileId(nextId);
                  setProfileName(profileState.profiles.find((profile) => profile.id === nextId)?.name ?? '');
                }} className="min-w-55">
                  <option value="">Scratch draft</option>
                  {profileState.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-xs">
                <span>Profile name</span>
                <Input aria-label="Profile name" type="text" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="e.g. Guardrails with pension bridge" className="min-w-55" />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => persistState(persistStrategyDraft(profileState, draft))} className={chipButtonClass}>Save draft</button>
              <button type="button" disabled={!profileName.trim()} onClick={() => {
                const next = saveStrategyProfile(profileState, { id: selectedProfileId || null, name: profileName, data: draft });
                persistState(next);
                setSelectedProfileId(next.activeProfileId ?? '');
                setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? profileName);
              }} className={chipButtonClass}>{selectedProfileId ? 'Update profile' : 'Save as profile'}</button>
              <button type="button" disabled={!selectedProfileId} onClick={() => {
                if (!selectedProfileId) return;
                const next = applyStrategyProfile(profileState, selectedProfileId);
                persistState(next);
                setDraft(next.draft);
                setProfileName(next.profiles.find((profile) => profile.id === selectedProfileId)?.name ?? '');
              }} className={chipButtonClass}>Load selected</button>
              <button type="button" disabled={!selectedProfileId} onClick={() => {
                if (!selectedProfileId) return;
                const next = deleteStrategyProfile(profileState, selectedProfileId);
                persistState(next);
                setSelectedProfileId(next.activeProfileId ?? '');
                setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
              }} className={chipButtonClass}>Delete profile</button>
              <button type="button" onClick={() => exportStrategyProfilesJson('withdrawalStrategy', { ...profileState, draft })} className={chipButtonClass}>Export profiles</button>
              <label className="inline-flex items-center">
                <input type="file" accept="application/json" className="hidden" onChange={(event) => {
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
                <span className={chipButtonClass}>Import profiles</span>
              </label>
              <button type="button" disabled={!isDirty} onClick={() => setDraft(profileState.draft)} className={chipButtonClass}>Reset to saved</button>
              <button type="button" onClick={() => {
                const next = clearStrategyDraft(profileState, emptyDraft);
                persistState(next);
                setDraft(next.draft);
                setSelectedProfileId('');
                setProfileName('');
              }} className={chipButtonClass}>Clear draft</button>
              <Link to="/assumptions" className={chipButtonClass}>Open Assumptions Hub</Link>
              <Link to="/simulation" className={chipButtonClass}>Back to simulator</Link>
            </div>
            {importStatus && <div className="text-xs opacity-80">{importStatus}</div>}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className={statPanelClass}><div className="text-xs opacity-75">Initial withdrawal</div><div className="text-3xl font-extrabold">{initialWithdrawal} DKK</div></div>
          <div className={statPanelClass}><div className="text-xs opacity-75">Floor / ceiling band</div><div className="text-xl font-extrabold">{draft.spendingFloor} - {draft.spendingCeiling}</div></div>
          <div className={statPanelClass}><div className="text-xs opacity-75">Cash buffer months</div><div className="text-3xl font-extrabold">{draft.cashBufferTargetMonths}</div></div>
          <div className={statPanelClass}><div className="text-xs opacity-75">Connected pages</div><div className="text-3xl font-extrabold">{usedByCount}</div></div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="grid gap-3">
            <Card className="grid gap-3">
              <div className="font-extrabold">Strategy header</div>
              <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Strategy title</span><Input aria-label="Strategy title" type="text" value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} /></label>
              <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Description</span><Textarea aria-label="Strategy description" rows={3} value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} /></label>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Retirement timing</div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Withdrawal start age</span><Input aria-label="Withdrawal start age" type="number" value={draft.withdrawalStartAge} onChange={(event) => setDraft((prev) => ({ ...prev, withdrawalStartAge: clampInt(event.target.value, prev.withdrawalStartAge, 18, 90) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Horizon years</span><Input aria-label="Horizon years" type="number" value={draft.horizonYears} onChange={(event) => setDraft((prev) => ({ ...prev, horizonYears: clampInt(event.target.value, prev.horizonYears, 1, 80) }))} /></label>
              </div>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Base withdrawal rule</div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Rule</span><Select aria-label="Withdrawal rule" value={draft.withdrawalRule} onChange={(event) => setDraft((prev) => ({ ...prev, withdrawalRule: event.target.value as WithdrawalRule }))}><option value="fixedPct">Fixed %</option><option value="fixedReal">Fixed real spending</option><option value="guardrails">Guardrails</option></Select></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Base monthly spending</span><Input aria-label="Base monthly spending" type="number" value={draft.baseMonthlySpending} onChange={(event) => setDraft((prev) => ({ ...prev, baseMonthlySpending: Math.max(0, asNumber(event.target.value, prev.baseMonthlySpending)) }))} /></label>
                <label className="flex items-center gap-2 font-semibold"><input aria-label="Inflation adjust spending" type="checkbox" checked={draft.inflationAdjust} onChange={(event) => setDraft((prev) => ({ ...prev, inflationAdjust: event.target.checked }))} />Inflation adjust</label>
              </div>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Guardrails & limits</div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Spending floor</span><Input aria-label="Spending floor" type="number" value={draft.spendingFloor} onChange={(event) => setDraft((prev) => ({ ...prev, spendingFloor: Math.max(0, asNumber(event.target.value, prev.spendingFloor)) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Spending ceiling</span><Input aria-label="Spending ceiling" type="number" value={draft.spendingCeiling} onChange={(event) => setDraft((prev) => ({ ...prev, spendingCeiling: Math.max(0, asNumber(event.target.value, prev.spendingCeiling)) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Max cut / year %</span><Input aria-label="Max cut per year" type="number" value={draft.maxCutPerYearPct} onChange={(event) => setDraft((prev) => ({ ...prev, maxCutPerYearPct: Math.max(0, asNumber(event.target.value, prev.maxCutPerYearPct)) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Trigger percentile</span><Input aria-label="Trigger percentile" type="number" value={draft.triggerPercentile} onChange={(event) => setDraft((prev) => ({ ...prev, triggerPercentile: clampInt(event.target.value, prev.triggerPercentile, 1, 99) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Trigger drawdown %</span><Input aria-label="Trigger drawdown" type="number" value={draft.triggerDrawdownPct} onChange={(event) => setDraft((prev) => ({ ...prev, triggerDrawdownPct: Math.max(0, asNumber(event.target.value, prev.triggerDrawdownPct)) }))} /></label>
              </div>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Income blending</div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <label className="flex items-center gap-2 font-semibold"><input aria-label="Include pension" type="checkbox" checked={draft.includePension} onChange={(event) => setDraft((prev) => ({ ...prev, includePension: event.target.checked }))} />Include pension</label>
                <label className="flex items-center gap-2 font-semibold"><input aria-label="Include part-time" type="checkbox" checked={draft.includePartTime} onChange={(event) => setDraft((prev) => ({ ...prev, includePartTime: event.target.checked }))} />Include part-time</label>
                <label className="flex items-center gap-2 font-semibold"><input aria-label="Include side hustle" type="checkbox" checked={draft.includeSideHustle} onChange={(event) => setDraft((prev) => ({ ...prev, includeSideHustle: event.target.checked }))} />Include side hustle</label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Supplemental monthly income</span><Input aria-label="Supplemental monthly income" type="number" value={draft.supplementalIncomeMonthly} onChange={(event) => setDraft((prev) => ({ ...prev, supplementalIncomeMonthly: Math.max(0, asNumber(event.target.value, prev.supplementalIncomeMonthly)) }))} /></label>
              </div>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Withdrawal routing & buffer</div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Routing order</span><Select aria-label="Routing order" value={draft.routingOrder} onChange={(event) => setDraft((prev) => ({ ...prev, routingOrder: event.target.value as RoutingOrder }))}><option value="cash>taxable>wrappers>pension">cash → taxable → wrappers → pension</option><option value="cash>wrappers>taxable>pension">cash → wrappers → taxable → pension</option></Select></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Cash buffer target</span><Input aria-label="Cash buffer target" type="number" value={draft.cashBufferTargetMonths} onChange={(event) => setDraft((prev) => ({ ...prev, cashBufferTargetMonths: clampInt(event.target.value, prev.cashBufferTargetMonths, 0, 36) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Refill threshold</span><Input aria-label="Refill threshold" type="number" value={draft.refillThresholdMonths} onChange={(event) => setDraft((prev) => ({ ...prev, refillThresholdMonths: clampInt(event.target.value, prev.refillThresholdMonths, 0, 36) }))} /></label>
              </div>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Bad-year playbook</div>
              <div className="grid gap-2.5">
                {draft.playbook.map((card, index) => (
                  <div key={card.id} className="grid grid-cols-[110px_150px_150px_minmax(0,1fr)_auto] items-end gap-2.5">
                    <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Percentile</span><Select aria-label={`Playbook ${index + 1} percentile`} value={card.percentile} onChange={(event) => setDraft((prev) => ({ ...prev, playbook: prev.playbook.map((item) => item.id === card.id ? { ...item, percentile: event.target.value as PlaybookCard['percentile'] } : item) }))}><option value="P10">P10</option><option value="P25">P25</option><option value="P50">P50</option><option value="P75">P75</option><option value="P90">P90</option></Select></label>
                    <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Spending adj. %</span><Input aria-label={`Playbook ${index + 1} spending adjustment`} type="number" value={card.spendingAdjustmentPct} onChange={(event) => setDraft((prev) => ({ ...prev, playbook: prev.playbook.map((item) => item.id === card.id ? { ...item, spendingAdjustmentPct: asNumber(event.target.value, item.spendingAdjustmentPct) } : item) }))} /></label>
                    <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Deposit adj. %</span><Input aria-label={`Playbook ${index + 1} deposit adjustment`} type="number" value={card.depositAdjustmentPct} onChange={(event) => setDraft((prev) => ({ ...prev, playbook: prev.playbook.map((item) => item.id === card.id ? { ...item, depositAdjustmentPct: asNumber(event.target.value, item.depositAdjustmentPct) } : item) }))} /></label>
                    <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Note</span><Input aria-label={`Playbook ${index + 1} note`} type="text" value={card.note} onChange={(event) => setDraft((prev) => ({ ...prev, playbook: prev.playbook.map((item) => item.id === card.id ? { ...item, note: event.target.value } : item) }))} /></label>
                    <button type="button" onClick={() => setDraft((prev) => ({ ...prev, playbook: prev.playbook.filter((item) => item.id !== card.id) }))} className={chipButtonClass}>Remove</button>
                  </div>
                ))}
              </div>
              <div><button type="button" onClick={() => setDraft((prev) => ({ ...prev, playbook: [...prev.playbook, { id: buildPlaybookId(), percentile: 'P25', spendingAdjustmentPct: -5, depositAdjustmentPct: 0, note: '' }] }))} className={chipButtonClass}>Add playbook card</button></div>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Preview</div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className={miniStatClass}><div className="text-xs opacity-70">Initial withdrawal</div><div className="font-extrabold">{initialWithdrawal} DKK</div></div>
                <div className={miniStatClass}><div className="text-xs opacity-70">Floor / ceiling band</div><div className="font-extrabold">{draft.spendingFloor} / {draft.spendingCeiling}</div></div>
                <div className={miniStatClass}><div className="text-xs opacity-70">Buffer months</div><div className="font-extrabold">{draft.cashBufferTargetMonths}</div></div>
              </div>
              <div className="grid gap-1.5">
                <div className="grid grid-cols-[90px_1fr_1fr_1fr_120px] gap-2 text-xs font-bold opacity-80">
                  <div>Year</div><div>Target spending</div><div>Income</div><div>Withdrawals</div><div>Buffer months</div>
                </div>
                {previewRows.map((row) => (
                  <div key={row.year} className="grid grid-cols-[90px_1fr_1fr_1fr_120px] gap-2 text-xs">
                    <div>{row.year}</div><div>{row.targetSpending}</div><div>{row.supplementalIncome}</div><div>{row.withdrawals}</div><div>{row.bufferMonths}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="sticky top-4 grid gap-3">
            <div>
              <div className="font-extrabold">Inherited defaults from assumptions</div>
              <div className="text-xs opacity-75">Withdrawal profiles sit on top of the assumptions authority layer for guardrails, cash-buffer conventions, and baseline rule defaults.</div>
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
                    {usedBy.length > 0 && <div className="flex flex-wrap gap-1.5">{usedBy.map((label) => <Chip key={label}>Used by: {label}</Chip>)}</div>}
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

export default WithdrawalStrategyPage;
