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

const statPanelClass = 'rounded-xl border border-card-border bg-card p-4';
const fieldLabelClass = 'grid gap-1.5';
const fieldLabelTextClass = 'font-semibold';
const miniStatClass = 'rounded-lg border border-card-border p-3';
const previewGridClass = 'grid grid-cols-[100px_1fr_1fr_1fr_120px] gap-2';

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
      <div className="mx-auto grid max-w-330 gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap gap-2">
              <Chip>Deposit editor</Chip>
              <Chip>Defaults tab: {ASSUMPTIONS_TAB_LABELS.depositStrategy}</Chip>
              <Chip>{isDirty ? 'Unsaved draft' : 'Saved draft'}</Chip>
              <Chip>Profiles: {profileState.profiles.length}</Chip>
            </div>
            <h1 className="m-0 text-2xl font-extrabold">Deposit Strategy</h1>
            <div className="max-w-225 opacity-80">
              Build a concrete contribution plan with cadence, escalation, one-offs, routing priorities, and a preview of how deposits accumulate over the first years.
            </div>
            <div className="text-xs opacity-70">Local draft persistence: {lastSavedLabel}</div>
          </div>

          <div className="grid justify-items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="grid gap-1 text-xs">
                <span>Profile</span>
                <Select aria-label="Deposit profile" value={selectedProfileId} onChange={(event) => {
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
                <Input aria-label="Profile name" type="text" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="e.g. Front-load first decade" className="min-w-55" />
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
              <button type="button" onClick={() => exportStrategyProfilesJson('depositStrategy', { ...profileState, draft })} className={chipButtonClass}>Export profiles</button>
              <label className="inline-flex items-center">
                <input type="file" accept="application/json" className="hidden" onChange={(event) => {
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
          <div className={statPanelClass}><div className="text-xs opacity-75">Avg monthly deposit</div><div className="text-3xl font-extrabold">{avgMonthly} DKK</div></div>
          <div className={statPanelClass}><div className="text-xs opacity-75">Total planned deposits</div><div className="text-3xl font-extrabold">{totalDeposits} DKK</div></div>
          <div className={statPanelClass}><div className="text-xs opacity-75">Pause months / year</div><div className="text-3xl font-extrabold">{draft.pauseMonthsPerYear}</div></div>
          <div className={statPanelClass}><div className="text-xs opacity-75">Connected pages</div><div className="text-3xl font-extrabold">{usedByCount}</div></div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="grid gap-3">
            <Card className="grid gap-3">
              <div className="font-extrabold">Strategy header</div>
              <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Strategy title</span><Input aria-label="Strategy title" type="text" value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} /></label>
              <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Description</span><Textarea aria-label="Strategy description" rows={3} value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} /></label>
              <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Mode</span><Select aria-label="Deposit mode" value={draft.mode} onChange={(event) => setDraft((prev) => ({ ...prev, mode: event.target.value as DepositMode }))}><option value="normal">Normal</option><option value="lean">Lean</option><option value="aggressive">Aggressive</option><option value="emergency">Emergency</option></Select></label>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Deposit schedule</div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Base deposit amount</span><Input aria-label="Base deposit amount" type="number" value={draft.baseDepositAmount} onChange={(event) => setDraft((prev) => ({ ...prev, baseDepositAmount: Math.max(0, asNumber(event.target.value, prev.baseDepositAmount)) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Frequency</span><Select aria-label="Deposit frequency" value={draft.cadence} onChange={(event) => setDraft((prev) => ({ ...prev, cadence: event.target.value as DepositCadence }))}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></Select></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Start year offset</span><Input aria-label="Start year offset" type="number" value={draft.startYearOffset} onChange={(event) => setDraft((prev) => ({ ...prev, startYearOffset: clampInt(event.target.value, prev.startYearOffset, 0, 50) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Duration years</span><Input aria-label="Duration years" type="number" value={draft.durationYears} onChange={(event) => setDraft((prev) => ({ ...prev, durationYears: clampInt(event.target.value, prev.durationYears, 1, 60) }))} /></label>
              </div>
              <label className={fieldLabelClass + ' max-w-60'}><span className={fieldLabelTextClass}>Pause months per year</span><Input aria-label="Pause months per year" type="number" value={draft.pauseMonthsPerYear} onChange={(event) => setDraft((prev) => ({ ...prev, pauseMonthsPerYear: clampInt(event.target.value, prev.pauseMonthsPerYear, 0, 11) }))} /></label>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Step-ups / escalation</div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Escalation mode</span><Select aria-label="Escalation mode" value={draft.escalationMode} onChange={(event) => setDraft((prev) => ({ ...prev, escalationMode: event.target.value as DepositEscalationMode }))}><option value="none">None</option><option value="pctYearly">% per year</option><option value="fixedDkkYearly">Fixed DKK / year</option></Select></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Escalation %</span><Input aria-label="Escalation percent" type="number" value={draft.escalationPct} onChange={(event) => setDraft((prev) => ({ ...prev, escalationPct: Math.max(0, asNumber(event.target.value, prev.escalationPct)) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Escalation DKK / year</span><Input aria-label="Escalation amount" type="number" value={draft.escalationDkkPerYear} onChange={(event) => setDraft((prev) => ({ ...prev, escalationDkkPerYear: Math.max(0, asNumber(event.target.value, prev.escalationDkkPerYear)) }))} /></label>
                <label className="flex items-center gap-2 font-semibold"><input aria-label="Inflation adjust contributions" type="checkbox" checked={draft.inflationAdjust} onChange={(event) => setDraft((prev) => ({ ...prev, inflationAdjust: event.target.checked }))} />Inflation adjust</label>
              </div>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">One-off deposits</div>
              <div className="grid gap-2.5">
                {draft.oneOffs.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_120px_140px_auto] items-end gap-2.5">
                    <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Label</span><Input aria-label={`One-off ${index + 1} label`} type="text" value={item.label} onChange={(event) => setDraft((prev) => ({ ...prev, oneOffs: prev.oneOffs.map((row) => row.id === item.id ? { ...row, label: event.target.value } : row) }))} /></label>
                    <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Year</span><Input aria-label={`One-off ${index + 1} year`} type="number" value={item.yearOffset} onChange={(event) => setDraft((prev) => ({ ...prev, oneOffs: prev.oneOffs.map((row) => row.id === item.id ? { ...row, yearOffset: clampInt(event.target.value, row.yearOffset, 0, 50) } : row) }))} /></label>
                    <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Amount</span><Input aria-label={`One-off ${index + 1} amount`} type="number" value={item.amount} onChange={(event) => setDraft((prev) => ({ ...prev, oneOffs: prev.oneOffs.map((row) => row.id === item.id ? { ...row, amount: Math.max(0, asNumber(event.target.value, row.amount)) } : row) }))} /></label>
                    <button type="button" onClick={() => setDraft((prev) => ({ ...prev, oneOffs: prev.oneOffs.filter((row) => row.id !== item.id) }))} className={chipButtonClass}>Remove</button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[120px_160px] items-end gap-2.5">
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Recurring boost month</span><Input aria-label="Recurring boost month" type="number" value={draft.recurringBoostMonth} onChange={(event) => setDraft((prev) => ({ ...prev, recurringBoostMonth: clampInt(event.target.value, prev.recurringBoostMonth, 1, 12) }))} /></label>
                <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Recurring boost amount</span><Input aria-label="Recurring boost amount" type="number" value={draft.recurringBoostAmount} onChange={(event) => setDraft((prev) => ({ ...prev, recurringBoostAmount: Math.max(0, asNumber(event.target.value, prev.recurringBoostAmount)) }))} /></label>
              </div>
              <div><button type="button" onClick={() => setDraft((prev) => ({ ...prev, oneOffs: [...prev.oneOffs, { id: buildDepositId(), label: `One-off ${prev.oneOffs.length + 1}`, yearOffset: 0, amount: 0 }] }))} className={chipButtonClass}>Add one-off</button></div>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Contribution routing (priorities)</div>
              <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Priority order</span><Select aria-label="Priority order" value={draft.routingPriority} onChange={(event) => setDraft((prev) => ({ ...prev, routingPriority: event.target.value as DepositStrategyDraft['routingPriority'] }))}><option value="buffer>debt>wrappers>taxable">buffer → debt → wrappers → taxable</option><option value="buffer>goals>debt>wrappers>taxable">buffer → goals → debt → wrappers → taxable</option></Select></label>
              <label className={fieldLabelClass}><span className={fieldLabelTextClass}>Caps / targets note</span><Textarea aria-label="Caps and targets note" rows={2} value={draft.routingCapsNote} onChange={(event) => setDraft((prev) => ({ ...prev, routingCapsNote: event.target.value }))} /></label>
            </Card>

            <Card className="grid gap-3">
              <div className="font-extrabold">Preview</div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className={miniStatClass}><div className="text-xs opacity-70">Avg monthly deposit</div><div className="font-extrabold">{avgMonthly} DKK</div></div>
                <div className={miniStatClass}><div className="text-xs opacity-70">Total deposits</div><div className="font-extrabold">{totalDeposits} DKK</div></div>
                <div className={miniStatClass}><div className="text-xs opacity-70">Pause months count</div><div className="font-extrabold">{draft.pauseMonthsPerYear * draft.durationYears}</div></div>
              </div>
              <div className="grid gap-1.5">
                <div className={previewGridClass + ' text-xs font-bold opacity-80'}>
                  <div>Year</div><div>Planned deposits</div><div>One-offs</div><div>Total</div><div>Mode</div>
                </div>
                {previewRows.map((row) => (
                  <div key={row.year} className={previewGridClass + ' text-xs'}>
                    <div>{row.year}</div><div>{row.plannedDeposits}</div><div>{row.oneOffs}</div><div>{row.total}</div><div>{row.mode}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="sticky top-4 grid gap-3">
            <div>
              <div className="font-extrabold">Inherited defaults from assumptions</div>
              <div className="text-xs opacity-75">Cadence, escalation defaults, and routing conventions still come from the assumptions authority layer. Deposit profiles hold the page-specific plan on top.</div>
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

export default DepositStrategyPage;
