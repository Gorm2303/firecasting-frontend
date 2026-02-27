import React, { useCallback, useEffect, useMemo, useState, useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MultiPhaseOverview from '../MultiPhaseOverview';
import { diffRuns, findRunForInput, getCompletedSummaries, getRunInput, getRunSummaries, getStandardResultsV3, listRuns, startAdvancedSimulation, type MetricSummary, type MetricSummaryScope, type RunDiffResponse, type RunListItem, type StartRunResponse } from '../api/simulation';
import CompareMetricExplorer from '../components/CompareMetricExplorer';
import SimulationProgress from '../components/SimulationProgress';
import PageLayout from '../components/PageLayout';
import { isRandomSeedRequested, listSavedScenarios, materializeRandomSeedIfNeeded, saveScenario, updateScenarioRunMeta, type SavedScenario } from '../config/savedScenarios';
import type { YearlySummary } from '../models/YearlySummary';
import type { SimulationTimelineContext } from '../models/types';
import { deepEqual } from '../utils/deepEqual';
import { toIsoDateString } from '../utils/backendDate';
import { summarizeScenario, type ScenarioSummary } from '../utils/summarizeScenario';
import { metricColor, moneyStoryStepColor, type MoneyStoryStepKey } from '../utils/metricColors';
import { useAssumptions, type Assumptions } from '../state/assumptions';

const fmt = (v: any): string => {
  if (v === null || v === undefined) return '';
  return String(v);
};

const pickLastEntry = (data: YearlySummary[], preferredPhase?: string): YearlySummary | null => {
  if (!Array.isArray(data) || data.length === 0) return null;
  const normPreferred = preferredPhase ? String(preferredPhase).toUpperCase() : null;
  const candidates = normPreferred
    ? data.filter((d) => String(d.phaseName ?? '').toUpperCase() === normPreferred)
    : data;

  const list = candidates.length ? candidates : data;
  // best-effort: highest year, tie-break by phaseName
  return (
    [...list].sort((a, b) => {
      const ya = Number(a.year) || 0;
      const yb = Number(b.year) || 0;
      if (ya !== yb) return ya - yb;
      return String(a.phaseName ?? '').localeCompare(String(b.phaseName ?? ''));
    }).at(-1) ?? null
  );
};

const MetricRow: React.FC<{ label: string; a?: React.ReactNode; b?: React.ReactNode; delta?: React.ReactNode; different?: boolean }> = ({
  label,
  a,
  b,
  delta,
  different,
}) => {
  return (
    <div
      className="metric-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr',
        gap: 10,
        padding: '8px 10px',
        borderBottom: '1px solid #333',
        background: different ? 'rgba(255, 193, 7, 0.08)' : 'transparent',
      }}
    >
      <div style={{ fontWeight: 650 }}>{label}</div>
      <div style={{ opacity: 0.92 }}>{a ?? '—'}</div>
      <div style={{ opacity: 0.92 }}>{b ?? '—'}</div>
      <div style={{ opacity: 0.92, fontWeight: 650 }}>{delta ?? ''}</div>
    </div>
  );
};

const coloredValue = (metricName: string, value: React.ReactNode, opts: { bold?: boolean } = {}): React.ReactNode => {
  const c = metricColor(metricName);
  if (!c) return value;
  return (
    <span style={{ color: c, fontWeight: opts.bold ? 900 : 700 }}>
      {value}
    </span>
  );
};

const formatMoney0 = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
};

const formatMoneyCompact = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  // Produces 1.2K / 3.4M / 5.6B
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(n);
};

const formatInflation = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  // Inflation is a multiplier/factor; always show decimals.
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
};

const formatPct2 = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  return `${Number(v).toFixed(2)}%`;
};

// Detailed yearly metrics are money-like; hide decimals.
const formatMetricValue = (metricName: string, v: number | null | undefined): string => {
  const m = String(metricName || '').toLowerCase();
  if (m === 'inflation') return formatInflation(v);
  return formatMoney0(v);
};

const formatMetricDelta = (metricName: string, v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const prefix = n >= 0 ? '+' : '';
  return `${prefix}${formatMetricValue(metricName, n)}`;
};

const percentileOrder: Array<keyof MetricSummary> = ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'];

type SummaryPercentile = 'p5' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p95';
const summaryPercentiles: SummaryPercentile[] = ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'];

const getPercentileValue = (m: MetricSummary | null | undefined, p: keyof MetricSummary): number | null => {
  if (!m) return null;
  const v: any = (m as any)[p];
  return v === null || v === undefined ? null : Number(v);
};

const metricLabel = (m: MetricSummary): string => {
  const scope = String(m?.scope ?? '');
  const parts: string[] = [];
  if (scope) parts.push(scope);
  if (m?.phaseName) parts.push(String(m.phaseName));
  if (m?.year !== null && m?.year !== undefined) parts.push(`year ${m.year}`);
  if (m?.metric) parts.push(String(m.metric));
  return parts.length ? parts.join(' / ') : 'Metric';
};

type Band = { p5: number | null; p50: number | null; p95: number | null };

const normPhaseName = (v: any): string | null => {
  const s = v === null || v === undefined ? '' : String(v);
  const t = s.trim();
  return t ? t.toLowerCase() : null;
};

const getMetric = (
  metrics: MetricSummary[] | null,
  scope: MetricSummaryScope,
  metric: string,
  opts: { phaseName?: string | null } = {}
): MetricSummary | null => {
  const arr = metrics ?? [];
  const mKey = String(metric || '').toLowerCase();
  const phaseKey = normPhaseName(opts.phaseName);
  for (const m of arr) {
    if (!m) continue;
    if (String(m.scope ?? '') !== scope) continue;
    if (String(m.metric ?? '').toLowerCase() !== mKey) continue;
    if (scope === 'PHASE_TOTAL') {
      if (normPhaseName(m.phaseName) !== phaseKey) continue;
    }
    return m;
  }
  return null;
};

const getBand = (m: MetricSummary | null): Band => ({
  p5: getPercentileValue(m, 'p5'),
  p50: getPercentileValue(m, 'p50'),
  p95: getPercentileValue(m, 'p95'),
});

const bandText = (metricName: string, b: Band): { main: string; band: string } => {
  const main = formatMetricValue(metricName, b.p50);
  const band = b.p5 !== null && b.p95 !== null ? `${formatMetricValue(metricName, b.p5)}–${formatMetricValue(metricName, b.p95)}` : '—';
  return { main, band };
};

type WaterfallStep = {
  key: MoneyStoryStepKey;
  label: string;
  value: number;
  color: string;
  hint?: string;
};

const withYearlySumMetrics = (metrics: MetricSummary[]): MetricSummary[] => {
  const flows = new Set(['deposit', 'return', 'withdraw', 'tax', 'fee']);
  const byPhaseMetric = new Map<string, Map<string, MetricSummary[]>>();

  for (const m of metrics) {
    if (!m) continue;
    if (String(m.scope ?? '') !== 'YEARLY') continue;
    const y = m.year === null || m.year === undefined ? null : Number(m.year);
    if (y === null || !Number.isFinite(y) || y < 0) continue;
    const metric = String(m.metric ?? '').toLowerCase();
    if (!flows.has(metric)) continue;
    const phase = String(m.phaseName ?? '');
    const mm = byPhaseMetric.get(phase) ?? new Map<string, MetricSummary[]>();
    const arr = mm.get(metric) ?? [];
    arr.push(m);
    mm.set(metric, arr);
    byPhaseMetric.set(phase, mm);
  }

  const synthetic: MetricSummary[] = [];
  for (const [phase, mm] of byPhaseMetric.entries()) {
    for (const [metric, arr] of mm.entries()) {
      const s: MetricSummary = {
        metric,
        scope: 'YEARLY',
        phaseName: phase || null,
        year: -1,
      };

      for (const p of percentileOrder) {
        let any = false;
        let total = 0;
        for (const it of arr) {
          const v: any = (it as any)[p];
          if (v === null || v === undefined) continue;
          const n = Number(v);
          if (!Number.isFinite(n)) continue;
          any = true;
          total += n;
        }
        (s as any)[p] = any ? total : null;
      }

      synthetic.push(s);
    }
  }

  return synthetic.length ? [...metrics, ...synthetic] : metrics;
};

const WaterfallChart: React.FC<{ title?: string; steps: WaterfallStep[]; height?: number }> = ({ title, steps, height = 220 }) => {
  // Waterfall: first and last steps are treated as totals.
  if (!steps.length) return null;

  const ariaTitle = title && title.trim() ? title : 'Waterfall chart';

  const w = 520;
  const h = height;
  const padL = 48;
  const padR = 12;
  const padT = 26;
  const padB = 46;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const totals = steps;
  const cum: number[] = [];
  let running = 0;
  for (let i = 0; i < totals.length; i++) {
    const s = totals[i];
    if (i === 0) {
      running = s.value;
      cum.push(running);
      continue;
    }
    if (i === totals.length - 1) {
      running = s.value;
      cum.push(running);
      continue;
    }
    running += s.value;
    cum.push(running);
  }

  let minY = Math.min(0, ...cum);
  let maxY = Math.max(0, ...cum);

  // Add a little breathing room.
  const range = Math.max(1, maxY - minY);
  minY -= range * 0.08;
  maxY += range * 0.08;

  const y = (v: number) => {
    const t = (v - minY) / (maxY - minY);
    return padT + (1 - t) * innerH;
  };

  const n = totals.length;
  const colW = innerW / Math.max(1, n);
  const barW = Math.min(42, colW * 0.72);

  const axisY = y(0);

  const bars = totals.map((s, i) => {
    const x0 = padL + i * colW + (colW - barW) / 2;

    if (i === 0 || i === n - 1) {
      // Total bar: from 0 to value.
      const y0 = y(0);
      const y1 = y(s.value);
      const top = Math.min(y0, y1);
      const bh = Math.max(1, Math.abs(y0 - y1));
      return { x: x0, y: top, w: barW, h: bh, color: s.color, label: s.label, value: s.value, hint: s.hint };
    }

    const prev = cum[i - 1];
    const next = cum[i];
    const y0 = y(prev);
    const y1 = y(next);
    const top = Math.min(y0, y1);
    const bh = Math.max(1, Math.abs(y0 - y1));
    return { x: x0, y: top, w: barW, h: bh, color: s.color, label: s.label, value: s.value, hint: s.hint };
  });

  const valueLabel = (value: number, isTotal: boolean): string => {
    if (isTotal) return formatMoneyCompact(value);
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${formatMoneyCompact(value)}`;
  };

  return (
    <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10, background: 'rgba(0,0,0,0.15)' }}>
      {title && title.trim() ? <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div> : null}
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaTitle}>
        {title && title.trim() ? <text x={padL} y={18} fontSize={12} fill="#cfcfcf" fontWeight={700}>{title}</text> : null}
        <line x1={padL} x2={w - padR} y1={axisY} y2={axisY} stroke="#3a3a3a" strokeWidth={1} />
        {bars.map((b, i) => (
          <g key={String(i)}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.color} rx={6}>
              <title>
                {`${b.label}: ${formatMoney0(b.value)}${b.hint ? `\n\n${b.hint}` : ''}`}
              </title>
            </rect>
            {(() => {
              const isTotal = i === 0 || i === bars.length - 1;
              const isUp = b.value >= 0;
              const yy = isUp ? Math.max(12, b.y - 4) : Math.min(h - 52, b.y + b.h + 12);
              return (
                <text x={b.x + b.w / 2} y={yy} fontSize={10} fill="#e5e5e5" textAnchor="middle" style={{ opacity: 0.92 }}>
                  {valueLabel(b.value, isTotal)}
                </text>
              );
            })()}
            <text x={b.x + b.w / 2} y={h - 18} fontSize={10} fill="#cfcfcf" textAnchor="middle">
              {b.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const formatDeltaMoney0 = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  const prefix = v >= 0 ? '+' : '';
  return `${prefix}${formatMoney0(v)}`;
};

const formatDeltaPct2 = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '';
  const prefix = v >= 0 ? '+' : '';
  return `${prefix}${Number(v).toFixed(2)}%`;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZoneName: 'short',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    // Fallback for environments with limited Intl options.
    return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
  }
};

const formatDurationYM = (months: number | null | undefined): string => {
  if (months === null || months === undefined) return '—';
  const total = Math.max(0, Math.floor(months));
  const years = Math.floor(total / 12);
  const rem = total % 12;
  return `${years}y ${rem}m`;
};

const tryParseBigInt = (value: unknown): bigint | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    if (!Number.isSafeInteger(value)) return null;
    return BigInt(value);
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!/^-?\d+$/.test(s)) return null;
    try {
      return BigInt(s);
    } catch {
      return null;
    }
  }
  return null;
};

const tryParseSafeInteger = (value: unknown): number | null => {
  const bi = tryParseBigInt(value);
  if (bi === null) return null;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = -max;
  if (bi > max || bi < min) return null;
  return Number(bi);
};

const formatDeltaDurationYM = (months: number | null | undefined): string => {
  if (months === null || months === undefined) return '';
  if (!Number.isFinite(months)) return '';
  const sign = months >= 0 ? '+' : '−';
  const abs = Math.abs(Math.trunc(months));
  const years = Math.floor(abs / 12);
  const rem = abs % 12;
  return `${sign}${years}y ${rem}m`;
};

const rngSeedValue = (info: any): unknown => {
  if (!info) return null;
  return info.rngSeedText ?? info.rngSeed;
};

const formatTaxExemptionsActive = (phase?: ScenarioSummary['phases'][number]): string => {
  if (!phase?.taxExemptionsActive) return '—';
  const parts: string[] = [];
  if (phase.taxExemptionsActive.card) parts.push('Card');
  if (phase.taxExemptionsActive.stock) parts.push('Stock');
  return parts.length ? parts.join(', ') : 'None';
};

const toScenarioSummary = (scenario: SavedScenario | null, assumptions: Assumptions): ScenarioSummary | null => {
  try {
    if (!scenario?.advancedRequest) return null;
    // Always summarize from advancedRequest so returnType/seed/inflation/yearlyFee/etc are present.
    return summarizeScenario(scenario.advancedRequest, assumptions);
  } catch {
    return null;
  }
};

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

const isRandomRequested = (scenario: SavedScenario): boolean => isRandomSeedRequested(scenario.advancedRequest);

// NOTE: `toIsoDateString` is imported from ../utils/backendDate to ensure we
// interpret backend epochDay correctly (days since 1900-01-01).

const buildTimelineFromAdvancedRequest = (req: any): SimulationTimelineContext | null => {
  try {
    const startDate = toIsoDateString(req?.startDate);
    const phases: any[] = Array.isArray(req?.phases) ? req.phases : [];
    if (!startDate || phases.length === 0) return null;

    const phaseTypes = phases
      .map((p) => p?.phaseType ?? p?.type)
      .filter(Boolean);
    const phaseDurationsInMonths = phases.map((p) => Number(p?.durationInMonths) || 0);

    return {
      startDate,
      phaseTypes,
      phaseDurationsInMonths,
      phaseInitialDeposits: phases.map((p) => (p?.initialDeposit !== undefined ? Number(p.initialDeposit) : undefined)),
      firstPhaseInitialDeposit:
        phases[0]?.initialDeposit !== undefined ? Number(phases[0]?.initialDeposit) : undefined,
      inflationFactorPerYear:
        req?.inflationFactor !== undefined ? Number(req?.inflationFactor) : undefined,
    };
  } catch {
    return null;
  }
};

const waitForSummaries = async (simulationId: string, timeoutMs = 180_000): Promise<YearlySummary[]> => {
  const started = Date.now();
  // /progress returns 404 until completed.
  for (;;) {
    const summaries = await getCompletedSummaries(simulationId);
    if (summaries) return summaries;
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for simulation to complete.');
    await sleep(750);
  }
};

type ResolvedRun = {
  runId: string | null;
  simulationId: string;
  summaries: YearlySummary[];
  persisted: boolean;
  meta?: RunListItem | null;
};

const resolveOrRerun = async (
  scenario: SavedScenario,
  opts: {
    onRerunStarted?: (simulationId: string, started: StartRunResponse) => void;
    getMetaForPersistedRun?: (runId: string) => Promise<RunListItem | null>;
  } = {}
): Promise<ResolvedRun> => {
  const random = isRandomRequested(scenario);

  // A saved scenario can be overwritten while still carrying an old runId.
  // Prefer the persisted run that matches the *current* scenario footprint.
  const lookupId = await findRunForInput(scenario.advancedRequest).catch(() => null);

  let maybePersistedId: string | null = scenario.runId ? String(scenario.runId) : null;
  if (lookupId) {
    // If lookup finds a run for these inputs, use it (even if the stored runId differs).
    maybePersistedId = lookupId;
  } else if (maybePersistedId) {
    // No lookup match found: only trust the stored runId if its persisted input matches.
    try {
      const persistedInput = await getRunInput(maybePersistedId);
      if (!deepEqual(persistedInput, scenario.advancedRequest)) {
        maybePersistedId = null;
      }
    } catch {
      maybePersistedId = null;
    }
  }

  if (maybePersistedId) {
    try {
      const summaries = await getRunSummaries(maybePersistedId);
      const meta = opts.getMetaForPersistedRun ? await opts.getMetaForPersistedRun(maybePersistedId).catch(() => null) : null;
      return { runId: maybePersistedId, simulationId: maybePersistedId, summaries, persisted: true, meta };
    } catch {
      // Might be a non-persisted run id (random mode) or an old id.
    }
  }

  const started = await startAdvancedSimulation(scenario.advancedRequest);
  opts.onRerunStarted?.(started.id, started);
  const summaries = await waitForSummaries(started.id);
  const meta: RunListItem = {
    id: started.id,
    ...(started.createdAt ? { createdAt: started.createdAt } : {}),
    ...(started.rngSeed !== undefined ? { rngSeed: started.rngSeed } : {}),
    ...(started.rngSeedText !== undefined ? { rngSeedText: started.rngSeedText } : {}),
    ...(started.modelAppVersion !== undefined ? { modelAppVersion: started.modelAppVersion } : {}),
    ...(started.modelBuildTime !== undefined ? { modelBuildTime: started.modelBuildTime } : {}),
    ...(started.modelSpringBootVersion !== undefined ? { modelSpringBootVersion: started.modelSpringBootVersion } : {}),
    ...(started.modelJavaVersion !== undefined ? { modelJavaVersion: started.modelJavaVersion } : {}),
  };

  // Backend guarantees: random-requested runs are never persisted.
  if (random) return { runId: null, simulationId: started.id, summaries, persisted: false, meta };

  return { runId: started.id, simulationId: started.id, summaries, persisted: true, meta };
};

const compareOutputs = (a: YearlySummary[], b: YearlySummary[]): { exactMatch: boolean; maxAbsDiff: number; mismatches: number } => {
  const key = (x: YearlySummary) => `${String(x.phaseName ?? '')}::${Number(x.year) || 0}`;
  const mapA = new Map(a.map((x) => [key(x), x] as const));
  const mapB = new Map(b.map((x) => [key(x), x] as const));

  const keys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
  let mismatches = 0;
  let maxAbsDiff = 0;

  const fields: Array<keyof YearlySummary> = [
    'averageCapital', 'medianCapital', 'quantile5', 'quantile95', 'var', 'cvar', 'negativeCapitalPercentage',
  ];

  for (const k of keys) {
    const xa = mapA.get(k);
    const xb = mapB.get(k);
    if (!xa || !xb) {
      mismatches++;
      continue;
    }
    for (const f of fields) {
      const va = (xa as any)[f];
      const vb = (xb as any)[f];
      if (va === undefined || vb === undefined) continue;
      const da = Number(va);
      const db = Number(vb);
      if (!Number.isFinite(da) || !Number.isFinite(db)) continue;
      const d = Math.abs(db - da);
      if (d > maxAbsDiff) maxAbsDiff = d;
      if (d > 1e-9) mismatches++;
    }
  }

  return { exactMatch: mismatches === 0, maxAbsDiff, mismatches };
};

const RunDiffPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const chartsSyncId = useId();

  const { currentAssumptions } = useAssumptions();

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => listSavedScenarios());
  const refreshSavedScenarios = useCallback(() => setSavedScenarios(listSavedScenarios()), []);
  const scenarioAFromQuery = searchParams.get('scenarioA') ?? '';
  const scenarioBFromQuery = searchParams.get('scenarioB') ?? '';

  const [scenarioAId, setScenarioAId] = useState<string>(() => scenarioAFromQuery || '');
  const [scenarioBId, setScenarioBId] = useState<string>(() => scenarioBFromQuery || '');

  const scenarioA = useMemo(() => savedScenarios.find((s) => s.id === scenarioAId) ?? null, [savedScenarios, scenarioAId]);
  const scenarioB = useMemo(() => savedScenarios.find((s) => s.id === scenarioBId) ?? null, [savedScenarios, scenarioBId]);

  const timelineA = useMemo(
    () => (scenarioA ? buildTimelineFromAdvancedRequest(scenarioA.advancedRequest) : null),
    [scenarioA]
  );
  const timelineB = useMemo(
    () => (scenarioB ? buildTimelineFromAdvancedRequest(scenarioB.advancedRequest) : null),
    [scenarioB]
  );


  const [diff, setDiff] = useState<RunDiffResponse | null>(null);
  const [diffErr, setDiffErr] = useState<string | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);

  const [runSummariesA, setRunSummariesA] = useState<YearlySummary[] | null>(null);
  const [runSummariesB, setRunSummariesB] = useState<YearlySummary[] | null>(null);

  const [metricSummariesA, setMetricSummariesA] = useState<MetricSummary[] | null>(null);
  const [metricSummariesB, setMetricSummariesB] = useState<MetricSummary[] | null>(null);

  const [selectedMetricGroupId, setSelectedMetricGroupId] = useState<string>('');

  const [summaryPercentile, setSummaryPercentile] = useState<SummaryPercentile>('p50');

  const [inputSummaryA, setInputSummaryA] = useState<ScenarioSummary | null>(null);
  const [inputSummaryB, setInputSummaryB] = useState<ScenarioSummary | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  const [rerunAId, setRerunAId] = useState<string | null>(null);
  const [rerunBId, setRerunBId] = useState<string | null>(null);

  type MetricPair = { a?: MetricSummary; b?: MetricSummary };
  type MetricGroup = {
    id: string;
    title: string;
    scope: string;
    scopeOrder: number;
    sortPhase: string;
    sortYear: number;
    metrics: Map<string, MetricPair>;
  };

  const detailedMetricGroups = useMemo((): { groups: MetricGroup[]; byId: Map<string, MetricGroup> } => {
    const a = withYearlySumMetrics(metricSummariesA ?? []);
    const b = withYearlySumMetrics(metricSummariesB ?? []);

    const groupIdFor = (m: MetricSummary): Omit<MetricGroup, 'metrics'> => {
      const scope = String(m?.scope ?? '');
      const phase = String(m?.phaseName ?? '');
      const year = m?.year === null || m?.year === undefined ? '' : String(m.year);

      if (scope === 'OVERALL_TOTAL') {
        return { id: 'OVERALL_TOTAL', title: 'OVERALL_TOTAL', scope, scopeOrder: 0, sortPhase: '', sortYear: 0 };
      }
      if (scope === 'PHASE_TOTAL') {
        const t = phase ? `PHASE_TOTAL / ${phase}` : 'PHASE_TOTAL';
        return { id: `PHASE_TOTAL|${phase}`, title: t, scope, scopeOrder: 1, sortPhase: phase, sortYear: 0 };
      }
      if (scope === 'YEARLY') {
        const y = Number(year || 0);
        if (y === -1) {
          const t = phase ? `YEARLY / ${phase} / all years (sum)` : 'YEARLY / all years (sum)';
          return { id: `YEARLY|${phase}|ALL`, title: t, scope, scopeOrder: 2, sortPhase: phase, sortYear: -1 };
        }
        const t = phase ? `YEARLY / ${phase} / year ${y || year || '—'}` : `YEARLY / year ${y || year || '—'}`;
        return { id: `YEARLY|${phase}|${year}`, title: t, scope, scopeOrder: 2, sortPhase: phase, sortYear: y };
      }

      return { id: `${scope}|${phase}|${year}`, title: metricLabel(m), scope, scopeOrder: 9, sortPhase: phase, sortYear: Number(year || 0) };
    };

    const groups = new Map<string, MetricGroup>();
    const ensureGroup = (m: MetricSummary): MetricGroup => {
      const gi = groupIdFor(m);
      const existing = groups.get(gi.id);
      if (existing) return existing;
      const g: MetricGroup = { ...gi, metrics: new Map() };
      groups.set(gi.id, g);
      return g;
    };

    for (const m of a) {
      const g = ensureGroup(m);
      const metricName = String(m.metric ?? '');
      const pair = g.metrics.get(metricName) ?? {};
      pair.a = m;
      g.metrics.set(metricName, pair);
    }
    for (const m of b) {
      const g = ensureGroup(m);
      const metricName = String(m.metric ?? '');
      const pair = g.metrics.get(metricName) ?? {};
      pair.b = m;
      g.metrics.set(metricName, pair);
    }

    const sorted = Array.from(groups.values()).sort((x, y) => {
      if (x.scopeOrder !== y.scopeOrder) return x.scopeOrder - y.scopeOrder;
      if (x.sortPhase !== y.sortPhase) return x.sortPhase.localeCompare(y.sortPhase);
      if (x.sortYear !== y.sortYear) return x.sortYear - y.sortYear;
      return x.id.localeCompare(y.id);
    });

    return { groups: sorted, byId: groups };
  }, [metricSummariesA, metricSummariesB]);

  useEffect(() => {
    if (detailedMetricGroups.groups.length === 0) return;
    if (!selectedMetricGroupId || !detailedMetricGroups.byId.has(selectedMetricGroupId)) {
      setSelectedMetricGroupId(detailedMetricGroups.groups[0].id);
    }
  }, [detailedMetricGroups, selectedMetricGroupId]);

  const canDiff = Boolean(scenarioA && scenarioB && scenarioA.id !== scenarioB.id && !diffBusy);
  const canViewA = Boolean(scenarioA && !diffBusy);

  const canViewB = Boolean(scenarioB && !diffBusy);

  const singleModeSide: 'A' | 'B' | null =
    diff && !diff.output
      ? diff.b?.id === '—'
        ? 'A'
        : diff.a?.id === '—'
          ? 'B'
          : null
      : null;
  const singleMode = Boolean(singleModeSide);

  const showAttributionFlags = !singleMode;

  const attributionLine = (d: RunDiffResponse | null): string | null => {
    const s = d?.attribution?.summary;
    return s ? String(s) : null;
  };

  const emptyRun: RunListItem = {
    id: '—',
    createdAt: undefined,
    rngSeed: null,
    rngSeedText: null,
    modelAppVersion: null,
    modelBuildTime: null,
    modelSpringBootVersion: null,
    modelJavaVersion: null,
    inputHash: null,
  };

  const ensureDeterministicScenario = useCallback((scenario: SavedScenario): SavedScenario => {
    if (!isRandomSeedRequested(scenario.advancedRequest)) return scenario;

    // Only pin to a *safe* integer seed; browser JS cannot round-trip 64-bit seeds.
    const preferredSeed =
      tryParseSafeInteger(scenario.lastRunMeta?.rngSeedText) ??
      (Number.isSafeInteger(scenario.lastRunMeta?.rngSeed) ? (scenario.lastRunMeta?.rngSeed ?? null) : null);

    const pinnedReq = materializeRandomSeedIfNeeded(
      scenario.advancedRequest,
      preferredSeed
    );

    const pinnedSeed = (pinnedReq as any)?.seed ?? (pinnedReq as any)?.returnerConfig?.seed;
    const nextMeta =
      scenario.lastRunMeta && pinnedSeed != null
        ? { ...scenario.lastRunMeta, rngSeed: Number(pinnedSeed), rngSeedText: String(pinnedSeed) }
        : scenario.lastRunMeta;

    try {
      saveScenario(
        scenario.name,
        pinnedReq,
        scenario.id,
        scenario.runId ?? undefined,
        nextMeta
      );
    } catch {
      // ignore
    }

    const refreshed = listSavedScenarios().find((s) => s.id === scenario.id);
    refreshSavedScenarios();
    return refreshed ?? { ...scenario, advancedRequest: pinnedReq, ...(nextMeta ? { lastRunMeta: nextMeta } : {}) };
  }, [refreshSavedScenarios]);

  return (
    <PageLayout variant="wide">
    <div
      className={singleModeSide === 'A' ? 'single-mode-a' : singleModeSide === 'B' ? 'single-mode-b' : ''}
      style={{ maxWidth: 1500, margin: '0 auto' }}
    >
      <style>{`
        /* Match the /info collapsible-card look */
        details.info-section {
          border: 1px solid #3a3a3a;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(255,255,255,0.02);
          margin: 12px 0;
        }
        details.info-section > summary.info-section-summary {
          list-style: none;
          cursor: pointer;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          position: relative;
          padding-right: 40px; /* room for the arrow */
          background: linear-gradient(0deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-weight: 800;
        }
        details.info-section > summary.info-section-summary.metric-table-summary {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 0.9fr;
          align-items: center;
          justify-content: initial;
          gap: 10px;
          white-space: nowrap;
        }
        details.info-section > summary.info-section-summary.metric-table-summary > div {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        details.info-section > summary.info-section-summary::-webkit-details-marker {
          display: none;
        }
        details.info-section > summary.info-section-summary::after {
          content: '▸';
          opacity: 0.8;
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%) rotate(0deg);
          transition: transform 140ms ease-out;
        }
        details.info-section[open] > summary.info-section-summary::after {
          transform: translateY(-50%) rotate(90deg);
        }
        .info-section-body {
          padding: 10px 14px 14px 14px;
        }

        .summary-kpis {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 1100px) {
          .summary-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .summary-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        .kpi-tile {
          border: 1px solid #333;
          border-radius: 12px;
          padding: 10px;
          background: rgba(0,0,0,0.16);
        }
        .kpi-label { font-size: 12px; opacity: 0.85; font-weight: 700; }
        .kpi-value { font-size: 18px; font-weight: 900; margin-top: 4px; }
        .kpi-sub { font-size: 12px; opacity: 0.75; margin-top: 2px; }

        .summary-kpis-sides {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          align-items: start;
        }
        @media (max-width: 980px) {
          .summary-kpis-sides { grid-template-columns: 1fr; }
        }
        .summary-kpis-side {
          border: 1px solid #333;
          border-radius: 14px;
          padding: 10px;
          background: rgba(0,0,0,0.10);
        }
        .summary-kpis-side-title {
          font-weight: 900;
          margin-bottom: 10px;
        }

        .summary-waterfalls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        @media (max-width: 980px) {
          .summary-waterfalls { grid-template-columns: 1fr; }
        }

        .phase-cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        .phase-card {
          border: 1px solid #333;
          border-radius: 14px;
          padding: 12px;
          background: rgba(0,0,0,0.16);
          cursor: pointer;
          transition: border-color 120ms ease-out, transform 120ms ease-out;
        }
        .phase-card:hover {
          border-color: #555;
          transform: translateY(-1px);
        }

        /* Single-scenario mode: hide Run A/Run B + Δ columns and disable highlight */
        .single-mode-a details.info-section > summary.info-section-summary.metric-table-summary {
          grid-template-columns: 1.4fr 1fr;
        }
        .single-mode-a details.info-section > summary.info-section-summary.metric-table-summary > div:nth-child(3),
        .single-mode-a details.info-section > summary.info-section-summary.metric-table-summary > div:nth-child(4) {
          display: none;
        }

        .single-mode-b details.info-section > summary.info-section-summary.metric-table-summary {
          grid-template-columns: 1.4fr 1fr;
        }
        .single-mode-b details.info-section > summary.info-section-summary.metric-table-summary > div:nth-child(2),
        .single-mode-b details.info-section > summary.info-section-summary.metric-table-summary > div:nth-child(4) {
          display: none;
        }

        .single-mode-a .metric-header,
        .single-mode-b .metric-header {
          grid-template-columns: 1.4fr 1fr !important;
        }
        .single-mode-a .metric-header > div:nth-child(3),
        .single-mode-a .metric-header > div:nth-child(4) {
          display: none;
        }
        .single-mode-b .metric-header > div:nth-child(2),
        .single-mode-b .metric-header > div:nth-child(4) {
          display: none;
        }

        .single-mode-a .metric-row,
        .single-mode-b .metric-row {
          grid-template-columns: 1.4fr 1fr !important;
          background: transparent !important;
        }
        .single-mode-a .metric-row > div:nth-child(3),
        .single-mode-a .metric-row > div:nth-child(4) {
          display: none;
        }
        .single-mode-b .metric-row > div:nth-child(2),
        .single-mode-b .metric-row > div:nth-child(4) {
          display: none;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h1>Comparator</h1>
        <Link to="/simulation" style={{ textDecoration: 'none' }}>← Back</Link>
      </div>

      <div style={{
        border: '1px solid #444', borderRadius: 12, padding: 12,
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12,
        alignItems: 'end',
      }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Scenario A</div>
          <select
            value={scenarioAId}
            onChange={(e) => setScenarioAId(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
          >
            <option value="">Select…</option>
            {savedScenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              disabled={!canViewA}
              onClick={async () => {
                setDiffErr(null);
                setDiff(null);
                setRunSummariesA(null);
                setRunSummariesB([]);
                setMetricSummariesA(null);
                setMetricSummariesB([]);
                setInputSummaryA(null);
                setInputSummaryB(null);
                setLookupErr(null);
                setRerunAId(null);
                setRerunBId(null);
                setDiffBusy(true);

                try {
                  if (!scenarioA) throw new Error('Select a saved scenario to preview.');

                  const scenarioAStable = ensureDeterministicScenario(scenarioA);

                  const runsIndex = await listRuns().catch(() => [] as RunListItem[]);
                  const metaForRun = async (runId: string): Promise<RunListItem | null> => {
                    const found = runsIndex.find((r) => String(r.id) === String(runId));
                    return found ?? null;
                  };

                  const ra = await resolveOrRerun(scenarioAStable, {
                    onRerunStarted: (id, started) => {
                      setRerunAId(id);
                      updateScenarioRunMeta(scenarioAStable.id, {
                        id: started.id,
                        createdAt: started.createdAt,
                        rngSeed: started.rngSeed ?? null,
                        rngSeedText: started.rngSeedText ?? (started.rngSeed !== null && started.rngSeed !== undefined ? String(started.rngSeed) : null),
                        modelAppVersion: started.modelAppVersion ?? null,
                        modelBuildTime: started.modelBuildTime ?? null,
                        modelSpringBootVersion: started.modelSpringBootVersion ?? null,
                        modelJavaVersion: started.modelJavaVersion ?? null,
                      });
                      refreshSavedScenarios();
                    },
                    getMetaForPersistedRun: metaForRun,
                  });

                  setRunSummariesA(ra.summaries);
                  setInputSummaryA(toScenarioSummary(scenarioAStable, currentAssumptions));

                  try {
                    const idA = ra.runId ?? ra.simulationId;
                    const rA = await getStandardResultsV3(idA).catch(() => null);
                    setMetricSummariesA(Array.isArray(rA?.metricSummaries) ? rA!.metricSummaries! : []);
                  } catch {
                    // ignore
                  }

                  try {
                    if (ra.runId && !scenarioAStable.runId) {
                      saveScenario(
                        scenarioAStable.name,
                        scenarioAStable.advancedRequest,
                        scenarioAStable.id,
                        ra.runId,
                        ra.meta
                          ? {
                              id: ra.meta.id,
                              createdAt: ra.meta.createdAt,
                              rngSeed: ra.meta.rngSeed ?? null,
                              modelAppVersion: ra.meta.modelAppVersion ?? null,
                              modelBuildTime: ra.meta.modelBuildTime ?? null,
                              modelSpringBootVersion: ra.meta.modelSpringBootVersion ?? null,
                              modelJavaVersion: ra.meta.modelJavaVersion ?? null,
                            }
                          : scenarioAStable.lastRunMeta
                      );
                      refreshSavedScenarios();
                    }
                  } catch {
                    // ignore
                  }

                  // Render the existing diff UI in a single-scenario mode:
                  // - Run A is populated
                  // - Run B is an explicit placeholder
                  // - No output comparison is shown
                  setDiff({
                    a: ra.meta ?? (await metaForRun(ra.runId ?? ra.simulationId).catch(() => null)) ?? { id: ra.runId ?? ra.simulationId },
                    b: emptyRun,
                    attribution: {
                      inputsChanged: false,
                      randomnessChanged: false,
                      modelVersionChanged: false,
                      summary: 'Single scenario view (no diff computed).',
                    },
                  });
                } catch (e: any) {
                  setDiffErr(e?.message ?? 'Preview failed');
                } finally {
                  setDiffBusy(false);
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #444',
                cursor: canViewA ? 'pointer' : 'not-allowed',
                opacity: canViewA ? 1 : 0.6,
              }}
            >
              {diffBusy ? 'Loading…' : 'View A'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 2 }}>
          <button
            type="button"
            disabled={!canDiff}
            onClick={async () => {
              setDiffErr(null);
              setDiff(null);
              setRunSummariesA(null);
              setRunSummariesB(null);
              setMetricSummariesA(null);
              setMetricSummariesB(null);
              setInputSummaryA(null);
              setInputSummaryB(null);
              setLookupErr(null);
              setRerunAId(null);
              setRerunBId(null);
              setDiffBusy(true);
              try {
                if (!scenarioA || !scenarioB) throw new Error('Select two saved scenarios.');

                const scenarioAStable = ensureDeterministicScenario(scenarioA);
                const scenarioBStable = ensureDeterministicScenario(scenarioB);

                const runsIndex = await listRuns().catch(() => [] as RunListItem[]);
                const metaForRun = async (runId: string): Promise<RunListItem | null> => {
                  const found = runsIndex.find((r) => String(r.id) === String(runId));
                  return found ?? null;
                };

                const [ra, rb] = await Promise.all([
                  resolveOrRerun(scenarioAStable, {
                    onRerunStarted: (id, started) => {
                      setRerunAId(id);
                      // Store best-effort meta locally so future diffs can display it.
                      updateScenarioRunMeta(scenarioAStable.id, {
                        id: started.id,
                        createdAt: started.createdAt,
                        rngSeed: started.rngSeed ?? null,
                        rngSeedText: started.rngSeedText ?? (started.rngSeed !== null && started.rngSeed !== undefined ? String(started.rngSeed) : null),
                        modelAppVersion: started.modelAppVersion ?? null,
                        modelBuildTime: started.modelBuildTime ?? null,
                        modelSpringBootVersion: started.modelSpringBootVersion ?? null,
                        modelJavaVersion: started.modelJavaVersion ?? null,
                      });
                      refreshSavedScenarios();
                    },
                    getMetaForPersistedRun: metaForRun,
                  }),
                  resolveOrRerun(scenarioBStable, {
                    onRerunStarted: (id, started) => {
                      setRerunBId(id);
                      updateScenarioRunMeta(scenarioBStable.id, {
                        id: started.id,
                        createdAt: started.createdAt,
                        rngSeed: started.rngSeed ?? null,
                        rngSeedText: started.rngSeedText ?? (started.rngSeed !== null && started.rngSeed !== undefined ? String(started.rngSeed) : null),
                        modelAppVersion: started.modelAppVersion ?? null,
                        modelBuildTime: started.modelBuildTime ?? null,
                        modelSpringBootVersion: started.modelSpringBootVersion ?? null,
                        modelJavaVersion: started.modelJavaVersion ?? null,
                      });
                      refreshSavedScenarios();
                    },
                    getMetaForPersistedRun: metaForRun,
                  }),
                ]);

                setRunSummariesA(ra.summaries);
                setRunSummariesB(rb.summaries);

                // Post-simulation metrics (v3 results payload): best-effort.
                // Uses runId when available (persisted), else falls back to the transient simulationId.
                try {
                  const idA = ra.runId ?? ra.simulationId;
                  const idB = rb.runId ?? rb.simulationId;
                  const [rA, rB] = await Promise.all([
                    getStandardResultsV3(idA).catch(() => null),
                    getStandardResultsV3(idB).catch(() => null),
                  ]);
                  setMetricSummariesA(Array.isArray(rA?.metricSummaries) ? rA!.metricSummaries! : []);
                  setMetricSummariesB(Array.isArray(rB?.metricSummaries) ? rB!.metricSummaries! : []);
                } catch {
                  // ignore
                }

                // Inputs: always summarize from the saved advancedRequest so advanced parameters are present.
                setInputSummaryA(toScenarioSummary(scenarioAStable, currentAssumptions));
                setInputSummaryB(toScenarioSummary(scenarioBStable, currentAssumptions));

                // Persist deterministic reruns back into local saved scenarios so future diffs are instant.
                if (ra.runId && !scenarioAStable.runId) {
                  try {
                    saveScenario(
                      scenarioAStable.name,
                      scenarioAStable.advancedRequest,
                      scenarioAStable.id,
                      ra.runId,
                      ra.meta
                        ? {
                            id: ra.meta.id,
                            createdAt: ra.meta.createdAt,
                            rngSeed: ra.meta.rngSeed ?? null,
                            modelAppVersion: ra.meta.modelAppVersion ?? null,
                            modelBuildTime: ra.meta.modelBuildTime ?? null,
                            modelSpringBootVersion: ra.meta.modelSpringBootVersion ?? null,
                            modelJavaVersion: ra.meta.modelJavaVersion ?? null,
                          }
                        : scenarioAStable.lastRunMeta
                    );
                    refreshSavedScenarios();
                  } catch {
                    // ignore
                  }
                }
                if (rb.runId && !scenarioBStable.runId) {
                  try {
                    saveScenario(
                      scenarioBStable.name,
                      scenarioBStable.advancedRequest,
                      scenarioBStable.id,
                      rb.runId,
                      rb.meta
                        ? {
                            id: rb.meta.id,
                            createdAt: rb.meta.createdAt,
                            rngSeed: rb.meta.rngSeed ?? null,
                            modelAppVersion: rb.meta.modelAppVersion ?? null,
                            modelBuildTime: rb.meta.modelBuildTime ?? null,
                            modelSpringBootVersion: rb.meta.modelSpringBootVersion ?? null,
                            modelJavaVersion: rb.meta.modelJavaVersion ?? null,
                          }
                        : scenarioBStable.lastRunMeta
                    );
                    refreshSavedScenarios();
                  } catch {
                    // ignore
                  }
                }

                if (ra.runId && rb.runId) {
                  const d = await diffRuns(ra.runId, rb.runId);
                  setDiff(d);
                } else {
                  const cmp = compareOutputs(ra.summaries, rb.summaries);
                  const note = 'Compared outputs by re-running one or both scenarios.';

                  const aMeta = ra.meta ?? metaForRun(ra.runId ?? ra.simulationId).catch(() => null);
                  const bMeta = rb.meta ?? metaForRun(rb.runId ?? rb.simulationId).catch(() => null);
                  const [metaA, metaB] = await Promise.all([aMeta, bMeta]);

                  setDiff({
                    a: { id: ra.runId ?? ra.simulationId, ...(metaA ?? {}) },
                    b: { id: rb.runId ?? rb.simulationId, ...(metaB ?? {}) },
                    attribution: {
                      inputsChanged: true,
                      randomnessChanged: true,
                      modelVersionChanged: false,
                      summary: note,
                    },
                    output: {
                      exactMatch: cmp.exactMatch,
                      withinTolerance: cmp.maxAbsDiff < 1e-6,
                      mismatches: cmp.mismatches,
                      maxAbsDiff: cmp.maxAbsDiff,
                    },
                  });
                }
              } catch (e: any) {
                setDiffErr(e?.message ?? 'Diff failed');
              } finally {
                setDiffBusy(false);
              }
            }}
            style={{
              padding: '10px 14px',
              borderRadius: 999,
              border: '1px solid #444',
              cursor: canDiff ? 'pointer' : 'not-allowed',
              opacity: canDiff ? 1 : 0.6,
              fontWeight: 800,
              minWidth: 90,
            }}
          >
            {diffBusy ? 'Diffing…' : 'Diff'}
          </button>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Scenario B</div>
          <select
            value={scenarioBId}
            onChange={(e) => setScenarioBId(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
          >
            <option value="">Select…</option>
            {savedScenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              disabled={!canViewB}
              onClick={async () => {
                setDiffErr(null);
                setDiff(null);
                setRunSummariesA([]);
                setRunSummariesB(null);
                setMetricSummariesA([]);
                setMetricSummariesB(null);
                setInputSummaryA(null);
                setInputSummaryB(null);
                setLookupErr(null);
                setRerunAId(null);
                setRerunBId(null);
                setDiffBusy(true);

                try {
                  if (!scenarioB) throw new Error('Select a saved scenario to preview.');

                  const scenarioBStable = ensureDeterministicScenario(scenarioB);

                  const runsIndex = await listRuns().catch(() => [] as RunListItem[]);
                  const metaForRun = async (runId: string): Promise<RunListItem | null> => {
                    const found = runsIndex.find((r) => String(r.id) === String(runId));
                    return found ?? null;
                  };

                  const rb = await resolveOrRerun(scenarioBStable, {
                    onRerunStarted: (id, started) => {
                      setRerunBId(id);
                      updateScenarioRunMeta(scenarioBStable.id, {
                        id: started.id,
                        createdAt: started.createdAt,
                        rngSeed: started.rngSeed ?? null,
                        rngSeedText: started.rngSeedText ?? (started.rngSeed !== null && started.rngSeed !== undefined ? String(started.rngSeed) : null),
                        modelAppVersion: started.modelAppVersion ?? null,
                        modelBuildTime: started.modelBuildTime ?? null,
                        modelSpringBootVersion: started.modelSpringBootVersion ?? null,
                        modelJavaVersion: started.modelJavaVersion ?? null,
                      });
                      refreshSavedScenarios();
                    },
                    getMetaForPersistedRun: metaForRun,
                  });

                  setRunSummariesB(rb.summaries);
                  setInputSummaryB(toScenarioSummary(scenarioBStable, currentAssumptions));

                  try {
                    const idB = rb.runId ?? rb.simulationId;
                    const rB = await getStandardResultsV3(idB).catch(() => null);
                    setMetricSummariesB(Array.isArray(rB?.metricSummaries) ? rB!.metricSummaries! : []);
                  } catch {
                    // ignore
                  }

                  try {
                    if (rb.runId && !scenarioBStable.runId) {
                      saveScenario(
                        scenarioBStable.name,
                        scenarioBStable.advancedRequest,
                        scenarioBStable.id,
                        rb.runId,
                        rb.meta
                          ? {
                              id: rb.meta.id,
                              createdAt: rb.meta.createdAt,
                              rngSeed: rb.meta.rngSeed ?? null,
                              modelAppVersion: rb.meta.modelAppVersion ?? null,
                              modelBuildTime: rb.meta.modelBuildTime ?? null,
                              modelSpringBootVersion: rb.meta.modelSpringBootVersion ?? null,
                              modelJavaVersion: rb.meta.modelJavaVersion ?? null,
                            }
                          : scenarioBStable.lastRunMeta
                      );
                      refreshSavedScenarios();
                    }
                  } catch {
                    // ignore
                  }

                  setDiff({
                    a: emptyRun,
                    b: rb.meta ?? (await metaForRun(rb.runId ?? rb.simulationId).catch(() => null)) ?? { id: rb.runId ?? rb.simulationId },
                    attribution: {
                      inputsChanged: false,
                      randomnessChanged: false,
                      modelVersionChanged: false,
                      summary: 'Single scenario view (no diff computed).',
                    },
                  });
                } catch (e: any) {
                  setDiffErr(e?.message ?? 'Preview failed');
                } finally {
                  setDiffBusy(false);
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #444',
                cursor: canViewB ? 'pointer' : 'not-allowed',
                opacity: canViewB ? 1 : 0.6,
              }}
            >
              {diffBusy ? 'Loading…' : 'View B'}
            </button>
          </div>
        </div>
      </div>

      {savedScenarios.length === 0 && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          No saved scenarios yet. Save a scenario first, then run it to persist a run.
        </div>
      )}

      {lookupErr && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid #ff6b6b55', background: 'rgba(255,107,107,0.10)' }}>
          {lookupErr}
        </div>
      )}

      {(rerunAId || rerunBId) && (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {rerunAId && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>Scenario A</div>
              <SimulationProgress
                simulationId={rerunAId}
                onComplete={() => { /* handled by polling */ }}
              />
            </div>
          )}
          {rerunBId && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>Scenario B</div>
              <SimulationProgress
                simulationId={rerunBId}
                onComplete={() => { /* handled by polling */ }}
              />
            </div>
          )}
        </div>
      )}

      {scenarioAId && scenarioBId && scenarioAId === scenarioBId && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>Select two different scenarios.</div>
      )}

      {diffErr && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid #ff6b6b55', background: 'rgba(255,107,107,0.10)' }}>
          {diffErr}
        </div>
      )}

      {diff && (
        <div style={{ marginTop: 12, border: '1px solid #444', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Attribution</div>
          <div style={{ marginBottom: 10 }}>
            {attributionLine(diff) ?? 'No attribution summary.'}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13, opacity: 0.9 }}>
            {showAttributionFlags && (
              <>
                <span>inputsChanged: {String(Boolean(diff.attribution?.inputsChanged))}</span>
                <span>randomnessChanged: {String(Boolean(diff.attribution?.randomnessChanged))}</span>
                <span>modelVersionChanged: {String(Boolean(diff.attribution?.modelVersionChanged))}</span>
              </>
            )}
            {diff.output && (
              <>
                <span>exactMatch: {String(Boolean(diff.output?.exactMatch))}</span>
                <span>withinTolerance: {String(Boolean(diff.output?.withinTolerance))}</span>
                <span>mismatches: {fmt(diff.output?.mismatches) || '0'}</span>
                <span>max|Δ|: {fmt(diff.output?.maxAbsDiff) || '0'}</span>
              </>
            )}
          </div>

          {/* Summary */}
          {(() => {
            const capAS = getMetric(metricSummariesA, 'OVERALL_TOTAL', 'capital');
            const capBS = getMetric(metricSummariesB, 'OVERALL_TOTAL', 'capital');
            const depAS = getMetric(metricSummariesA, 'OVERALL_TOTAL', 'deposit');
            const depBS = getMetric(metricSummariesB, 'OVERALL_TOTAL', 'deposit');
            const retAS = getMetric(metricSummariesA, 'OVERALL_TOTAL', 'return');
            const retBS = getMetric(metricSummariesB, 'OVERALL_TOTAL', 'return');
            const wAS = getMetric(metricSummariesA, 'OVERALL_TOTAL', 'withdraw');
            const wBS = getMetric(metricSummariesB, 'OVERALL_TOTAL', 'withdraw');
            const taxAS = getMetric(metricSummariesA, 'OVERALL_TOTAL', 'tax');
            const taxBS = getMetric(metricSummariesB, 'OVERALL_TOTAL', 'tax');
            const feeAS = getMetric(metricSummariesA, 'OVERALL_TOTAL', 'fee');
            const feeBS = getMetric(metricSummariesB, 'OVERALL_TOTAL', 'fee');

            const capA = getBand(capAS);
            const capB = getBand(capBS);
            const depA = getBand(depAS);
            const depB = getBand(depBS);
            const wA = getBand(wAS);
            const wB = getBand(wBS);

            const startA = Number(inputSummaryA?.totalInitialDeposit ?? 0);
            const startB = Number(inputSummaryB?.totalInitialDeposit ?? 0);

            const endA = Number(getPercentileValue(capAS, summaryPercentile) ?? 0);
            const endB = Number(getPercentileValue(capBS, summaryPercentile) ?? 0);

            const impliedEndA =
              startA +
              Number(getPercentileValue(depAS, summaryPercentile) ?? 0) +
              Number(getPercentileValue(retAS, summaryPercentile) ?? 0) -
              Number(getPercentileValue(wAS, summaryPercentile) ?? 0) -
              Number(getPercentileValue(taxAS, summaryPercentile) ?? 0) -
              Number(getPercentileValue(feeAS, summaryPercentile) ?? 0);
            const impliedEndB =
              startB +
              Number(getPercentileValue(depBS, summaryPercentile) ?? 0) +
              Number(getPercentileValue(retBS, summaryPercentile) ?? 0) -
              Number(getPercentileValue(wBS, summaryPercentile) ?? 0) -
              Number(getPercentileValue(taxBS, summaryPercentile) ?? 0) -
              Number(getPercentileValue(feeBS, summaryPercentile) ?? 0);

            const residualA = endA - impliedEndA;
            const residualB = endB - impliedEndB;

            const mkStorySteps = (start: number, dep: number, ret: number, wd: number, tax: number, fee: number, residual: number, end: number): WaterfallStep[] => {
              const otherHint = 'This leftover happens because we’re adding separate percentile values (numbers from different runs and not one single “end = start + …” number).';
              const steps: WaterfallStep[] = [
                { key: 'start', label: 'Start', value: start, color: moneyStoryStepColor('start') },
                { key: 'deposit', label: 'Deposits', value: dep, color: moneyStoryStepColor('deposit') },
                { key: 'return', label: 'Returns', value: ret, color: moneyStoryStepColor('return') },
                { key: 'withdraw', label: 'Withdraw', value: -Math.abs(wd), color: moneyStoryStepColor('withdraw') },
                { key: 'tax', label: 'Taxes', value: -Math.abs(tax), color: moneyStoryStepColor('tax') },
                { key: 'fee', label: 'Fees', value: -Math.abs(fee), color: moneyStoryStepColor('fee') },
              ];
              if (Math.abs(residual) > 1e-6) steps.push({ key: 'other', label: 'Other', value: residual, color: moneyStoryStepColor('other'), hint: otherHint });
              steps.push({ key: 'end', label: 'End', value: end, color: moneyStoryStepColor('end') });
              return steps;
            };

            const stepsA = mkStorySteps(
              startA,
              Number(getPercentileValue(depAS, summaryPercentile) ?? 0),
              Number(getPercentileValue(retAS, summaryPercentile) ?? 0),
              Number(getPercentileValue(wAS, summaryPercentile) ?? 0),
              Number(getPercentileValue(taxAS, summaryPercentile) ?? 0),
              Number(getPercentileValue(feeAS, summaryPercentile) ?? 0),
              residualA,
              endA
            );
            const stepsB = mkStorySteps(
              startB,
              Number(getPercentileValue(depBS, summaryPercentile) ?? 0),
              Number(getPercentileValue(retBS, summaryPercentile) ?? 0),
              Number(getPercentileValue(wBS, summaryPercentile) ?? 0),
              Number(getPercentileValue(taxBS, summaryPercentile) ?? 0),
              Number(getPercentileValue(feeBS, summaryPercentile) ?? 0),
              residualB,
              endB
            );

            const terminalA = { main: formatMetricValue('capital', getPercentileValue(capAS, summaryPercentile)), band: bandText('capital', capA).band };
            const terminalB = { main: formatMetricValue('capital', getPercentileValue(capBS, summaryPercentile)), band: bandText('capital', capB).band };
            const returnsA = { main: formatMetricValue('return', getPercentileValue(retAS, summaryPercentile)), band: '' };
            const returnsB = { main: formatMetricValue('return', getPercentileValue(retBS, summaryPercentile)), band: '' };
            const withdrawA = { main: formatMetricValue('withdraw', getPercentileValue(wAS, summaryPercentile)), band: bandText('withdraw', wA).band };
            const withdrawB = { main: formatMetricValue('withdraw', getPercentileValue(wBS, summaryPercentile)), band: bandText('withdraw', wB).band };
            const depAT = { main: formatMetricValue('deposit', getPercentileValue(depAS, summaryPercentile)), band: bandText('deposit', depA).band };
            const depBT = { main: formatMetricValue('deposit', getPercentileValue(depBS, summaryPercentile)), band: bandText('deposit', depB).band };

            const taxAVal = Number(getPercentileValue(taxAS, summaryPercentile) ?? 0);
            const feeAVal = Number(getPercentileValue(feeAS, summaryPercentile) ?? 0);
            const taxBVal = Number(getPercentileValue(taxBS, summaryPercentile) ?? 0);
            const feeBVal = Number(getPercentileValue(feeBS, summaryPercentile) ?? 0);

            const taxFeesA = formatMoney0(taxAVal + feeAVal);
            const taxFeesB = formatMoney0(taxBVal + feeBVal);

            const taxesPlusFeesMainA = (
              <span>
                {coloredValue('tax', formatMoney0(taxAVal), { bold: true })}
                <span style={{ opacity: 0.75 }}> + </span>
                {coloredValue('fee', formatMoney0(feeAVal), { bold: true })}
              </span>
            );
            const taxesPlusFeesMainB = (
              <span>
                {coloredValue('tax', formatMoney0(taxBVal), { bold: true })}
                <span style={{ opacity: 0.75 }}> + </span>
                {coloredValue('fee', formatMoney0(feeBVal), { bold: true })}
              </span>
            );

            const uncWidthA = capA.p5 !== null && capA.p95 !== null ? capA.p95 - capA.p5 : null;
            const uncWidthB = capB.p5 !== null && capB.p95 !== null ? capB.p95 - capB.p5 : null;

            const phaseDefs: Array<{ key: string; label: string; metricPhase: string }> = [
              { key: 'deposit', label: 'Deposit phase', metricPhase: 'deposit' },
              { key: 'passive', label: 'Passive phase', metricPhase: 'passive' },
              { key: 'withdraw', label: 'Withdraw phase', metricPhase: 'withdraw' },
            ];

            const getPhaseValue = (metrics: MetricSummary[] | null, metric: string, phase: string): number => {
              const m = getMetric(metrics, 'PHASE_TOTAL', metric, { phaseName: phase });
              return Number(getPercentileValue(m, summaryPercentile) ?? 0);
            };

            const getPhaseEndCapital = (metrics: MetricSummary[] | null, phase: string): number | null => {
              const m = getMetric(metrics, 'PHASE_TOTAL', 'capital', { phaseName: phase });
              const v = getPercentileValue(m, summaryPercentile);
              return v === null ? null : Number(v);
            };

            const phasesA = phaseDefs.map((pd) => ({
              label: pd.label,
              dep: getPhaseValue(metricSummariesA, 'deposit', pd.metricPhase),
              ret: getPhaseValue(metricSummariesA, 'return', pd.metricPhase),
              wd: getPhaseValue(metricSummariesA, 'withdraw', pd.metricPhase),
              tax: getPhaseValue(metricSummariesA, 'tax', pd.metricPhase),
              fee: getPhaseValue(metricSummariesA, 'fee', pd.metricPhase),
            }));

            const phasesB = phaseDefs.map((pd) => ({
              label: pd.label,
              dep: getPhaseValue(metricSummariesB, 'deposit', pd.metricPhase),
              ret: getPhaseValue(metricSummariesB, 'return', pd.metricPhase),
              wd: getPhaseValue(metricSummariesB, 'withdraw', pd.metricPhase),
              tax: getPhaseValue(metricSummariesB, 'tax', pd.metricPhase),
              fee: getPhaseValue(metricSummariesB, 'fee', pd.metricPhase),
            }));

            const phaseStories = (() => {
              let runningA = startA;
              let runningB = startB;
              const stories = phaseDefs.map((pd, idx) => {
                const phA = phasesA[idx];
                const phB = phasesB[idx];

                const startA0 = runningA;
                const endAFromCapital = getPhaseEndCapital(metricSummariesA, pd.metricPhase);
                const endA0 = endAFromCapital ?? (startA0 + phA.dep + phA.ret - Math.abs(phA.wd) - Math.abs(phA.tax) - Math.abs(phA.fee));
                runningA = endA0;

                const startB0 = runningB;
                const endBFromCapital = getPhaseEndCapital(metricSummariesB, pd.metricPhase);
                const endB0 = endBFromCapital ?? (startB0 + phB.dep + phB.ret - Math.abs(phB.wd) - Math.abs(phB.tax) - Math.abs(phB.fee));
                runningB = endB0;

                return {
                  pd,
                  a: { start: startA0, end: endA0, dep: phA.dep, ret: phA.ret, wd: phA.wd, tax: phA.tax, fee: phA.fee },
                  b: { start: startB0, end: endB0, dep: phB.dep, ret: phB.ret, wd: phB.wd, tax: phB.tax, fee: phB.fee },
                };
              });

              return stories.map((s) => {
                const aImplied = s.a.start + s.a.dep + s.a.ret - Math.abs(s.a.wd) - Math.abs(s.a.tax) - Math.abs(s.a.fee);
                const bImplied = s.b.start + s.b.dep + s.b.ret - Math.abs(s.b.wd) - Math.abs(s.b.tax) - Math.abs(s.b.fee);
                const aResidual = s.a.end - aImplied;
                const bResidual = s.b.end - bImplied;
                const aSteps = mkStorySteps(s.a.start, s.a.dep, s.a.ret, s.a.wd, s.a.tax, s.a.fee, aResidual, s.a.end);
                const bSteps = mkStorySteps(s.b.start, s.b.dep, s.b.ret, s.b.wd, s.b.tax, s.b.fee, bResidual, s.b.end);
                return {
                  pd: s.pd,
                  a: { start: s.a.start, end: s.a.end, steps: aSteps },
                  b: { start: s.b.start, end: s.b.end, steps: bSteps },
                };
              });
            })();


            const kpiTile = (label: string, main: React.ReactNode, sub: string) => (
              <div className="kpi-tile">
                <div className="kpi-label">{label}</div>
                <div className="kpi-value">{main}</div>
                {sub ? <div className="kpi-sub">{sub}</div> : null}
              </div>
            );

            const showA = singleModeSide === null || singleModeSide === 'A';
            const showB = singleModeSide === null || singleModeSide === 'B';

            return (
              <details open className="info-section">
                <summary className="info-section-summary">Summary</summary>
                <div className="info-section-body">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ fontWeight: 800 }}>What’s going on?</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700 }}>Percentile</div>
                      <select
                        value={summaryPercentile}
                        onChange={(e) => setSummaryPercentile(e.target.value as SummaryPercentile)}
                        style={{ padding: '6px 8px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff' }}
                      >
                        {summaryPercentiles.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {singleModeSide ? (
                      <div className="summary-kpis">
                        {singleModeSide === 'A' ? (
                          <>
                            {kpiTile(`Total deposits (${summaryPercentile})`, coloredValue('deposit', depAT.main, { bold: true }), '')}
                            {kpiTile(`Total returns (${summaryPercentile})`, coloredValue('return', returnsA.main, { bold: true }), '')}
                            {kpiTile(`Total withdrawals (${summaryPercentile})`, coloredValue('withdraw', withdrawA.main, { bold: true }), '')}
                            {kpiTile(`Total taxes + fees (${summaryPercentile})`, taxesPlusFeesMainA, `Total: ${taxFeesA}`)}
                            {kpiTile(`End capital (${summaryPercentile})`, coloredValue('capital', terminalA.main, { bold: true }), '')}
                            {kpiTile('Uncertainty width', coloredValue('capital', formatMoney0(uncWidthA), { bold: true }), 'p95–p5 of terminal capital')}
                          </>
                        ) : (
                          <>
                            {kpiTile(`Total deposits (${summaryPercentile})`, coloredValue('deposit', depBT.main, { bold: true }), '')}
                            {kpiTile(`Total returns (${summaryPercentile})`, coloredValue('return', returnsB.main, { bold: true }), '')}
                            {kpiTile(`Total withdrawals (${summaryPercentile})`, coloredValue('withdraw', withdrawB.main, { bold: true }), '')}
                            {kpiTile(`Total taxes + fees (${summaryPercentile})`, taxesPlusFeesMainB, `Total: ${taxFeesB}`)}
                            {kpiTile(`End capital (${summaryPercentile})`, coloredValue('capital', terminalB.main, { bold: true }), '')}
                            {kpiTile('Uncertainty width', coloredValue('capital', formatMoney0(uncWidthB), { bold: true }), 'p95–p5 of terminal capital')}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="summary-kpis-sides">
                        <div className="summary-kpis-side">
                          <div className="summary-kpis-side-title">Run A</div>
                          <div className="summary-kpis" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            {kpiTile(`Deposits (${summaryPercentile})`, coloredValue('deposit', depAT.main, { bold: true }), '')}
                            {kpiTile(`Returns (${summaryPercentile})`, coloredValue('return', returnsA.main, { bold: true }), '')}
                            {kpiTile(`Withdrawals (${summaryPercentile})`, coloredValue('withdraw', withdrawA.main, { bold: true }), '')}
                            {kpiTile(`Taxes + fees (${summaryPercentile})`, taxesPlusFeesMainA, `Total: ${taxFeesA}`)}
                            {kpiTile(`End capital (${summaryPercentile})`, coloredValue('capital', terminalA.main, { bold: true }), '')}
                            {kpiTile('Uncertainty width', coloredValue('capital', formatMoney0(uncWidthA), { bold: true }), 'p95–p5 terminal capital')}
                          </div>
                        </div>
                        <div className="summary-kpis-side">
                          <div className="summary-kpis-side-title">Run B</div>
                          <div className="summary-kpis" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            {kpiTile(`Deposits (${summaryPercentile})`, coloredValue('deposit', depBT.main, { bold: true }), '')}
                            {kpiTile(`Returns (${summaryPercentile})`, coloredValue('return', returnsB.main, { bold: true }), '')}
                            {kpiTile(`Withdrawals (${summaryPercentile})`, coloredValue('withdraw', withdrawB.main, { bold: true }), '')}
                            {kpiTile(`Taxes + fees (${summaryPercentile})`, taxesPlusFeesMainB, `Total: ${taxFeesB}`)}
                            {kpiTile(`End capital (${summaryPercentile})`, coloredValue('capital', terminalB.main, { bold: true }), '')}
                            {kpiTile('Uncertainty width', coloredValue('capital', formatMoney0(uncWidthB), { bold: true }), 'p95–p5 terminal capital')}
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Money story</div>
                      <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 8 }}>
                        Start + deposits + returns − withdrawals − taxes − fees = end. “Other” is whatever amount is needed to make the chart land exactly on the End value.
                        This leftover happens because we’re adding separate percentile values (numbers from different runs and not one single “end = start + …” number).
                      </div>

                      <div className="summary-waterfalls" style={{ gridTemplateColumns: showA && showB ? '1fr 1fr' : '1fr' }}>
                        {showA && <WaterfallChart title={`Run A (${summaryPercentile})`} steps={stepsA} height={260} />}
                        {showB && <WaterfallChart title={`Run B (${summaryPercentile})`} steps={stepsB} height={260} />}
                      </div>
                    </div>

                    {(!singleModeSide && metricSummariesA && metricSummariesB) && (
                      <>
                        <div style={{ marginTop: 8, fontWeight: 800 }}>Phases breakdown</div>
                        <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 8 }}>
                          Phase starts/ends are chained (end of a phase becomes the next phase start).
                        </div>

                        <div className="phase-cards">
                          {phaseStories.map(({ pd, a, b }) => {
                            return (
                              <details key={pd.key} className="phase-card">
                                <summary
                                  style={{
                                    cursor: 'pointer',
                                    listStyle: 'none',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                                    <div style={{ fontWeight: 900 }}>{pd.label}</div>
                                    <div style={{ fontSize: 12, opacity: 0.75 }} />
                                  </div>
                                </summary>

                                <div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>Run A</div>
                                    <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800 }}>Run B</div>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                                    <div>
                                      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>Start → End ({summaryPercentile})</div>
                                      <div style={{ fontWeight: 900, fontSize: 14 }}>
                                        {coloredValue('capital', `${formatMetricValue('capital', a.start)} → ${formatMetricValue('capital', a.end)}`, { bold: true })}
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>Start → End ({summaryPercentile})</div>
                                      <div style={{ fontWeight: 900, fontSize: 14 }}>
                                        {coloredValue('capital', `${formatMetricValue('capital', b.start)} → ${formatMetricValue('capital', b.end)}`, { bold: true })}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <WaterfallChart title="" steps={a.steps} height={220} />
                                    <WaterfallChart title="" steps={b.steps} height={220} />
                                  </div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </details>
            );
          })()}

          <div style={{ marginTop: 10, border: '1px solid #333', borderRadius: 12, overflow: 'hidden' }}>
            <div className="metric-header" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr', gap: 10, padding: '8px 10px', background: '#1a1a1a', fontWeight: 700, fontSize: 12 }}>
              <div>Signature</div>
              <div>Run A</div>
              <div>Run B</div>
              <div></div>
            </div>
            <MetricRow
              label="ID"
              a={diff.a?.id ?? '—'}
              b={diff.b?.id ?? '—'}
              different={Boolean(diff.a?.id !== diff.b?.id)}
            />
            <MetricRow
              label="Created"
              a={formatDateTime(diff.a?.createdAt)}
              b={formatDateTime(diff.b?.createdAt)}
              different={Boolean(diff.a?.createdAt !== diff.b?.createdAt)}
            />
            <MetricRow
              label="Model app version"
              a={diff.a?.modelAppVersion ?? '—'}
              b={diff.b?.modelAppVersion ?? '—'}
              different={Boolean(diff.a?.modelAppVersion !== diff.b?.modelAppVersion)}
            />
            <MetricRow
              label="Model build time"
              a={formatDateTime(diff.a?.modelBuildTime)}
              b={formatDateTime(diff.b?.modelBuildTime)}
              different={Boolean(diff.a?.modelBuildTime !== diff.b?.modelBuildTime)}
            />
            <MetricRow
              label="Spring Boot version"
              a={diff.a?.modelSpringBootVersion ?? '—'}
              b={diff.b?.modelSpringBootVersion ?? '—'}
              different={Boolean(diff.a?.modelSpringBootVersion !== diff.b?.modelSpringBootVersion)}
            />
            <MetricRow
              label="Java version"
              a={diff.a?.modelJavaVersion ?? '—'}
              b={diff.b?.modelJavaVersion ?? '—'}
              different={Boolean(diff.a?.modelJavaVersion !== diff.b?.modelJavaVersion)}
            />
            <MetricRow
              label="Paths (runs)"
              a={inputSummaryA?.paths !== undefined ? String(inputSummaryA.paths) : '—'}
              b={inputSummaryB?.paths !== undefined ? String(inputSummaryB.paths) : '—'}
              delta={
                inputSummaryA?.paths !== undefined && inputSummaryB?.paths !== undefined
                  ? String(inputSummaryB.paths - inputSummaryA.paths)
                  : ''
              }
              different={Boolean(
                inputSummaryA?.paths !== undefined &&
                  inputSummaryB?.paths !== undefined &&
                  inputSummaryA.paths !== inputSummaryB.paths
              )}
            />
            <MetricRow
              label="Batch size"
              a={inputSummaryA?.batchSize !== undefined ? String(inputSummaryA.batchSize) : '—'}
              b={inputSummaryB?.batchSize !== undefined ? String(inputSummaryB.batchSize) : '—'}
              delta={
                inputSummaryA?.batchSize !== undefined && inputSummaryB?.batchSize !== undefined
                  ? String(inputSummaryB.batchSize - inputSummaryA.batchSize)
                  : ''
              }
              different={Boolean(
                inputSummaryA?.batchSize !== undefined &&
                  inputSummaryB?.batchSize !== undefined &&
                  inputSummaryA.batchSize !== inputSummaryB.batchSize
              )}
            />
            <MetricRow
              label="Master seed"
              a={(() => {
                const requested = inputSummaryA?.advancedMode?.seed;
                const requestedBi = tryParseBigInt(requested);
                const requestedIsNegative = requestedBi !== null ? requestedBi < 0n : (requested !== null && requested !== undefined && Number(requested) < 0);
                const effective = requestedIsNegative
                  ? rngSeedValue(diff?.a)
                  : requested;
                if (effective === null || effective === undefined) return '—';
                const bi = tryParseBigInt(effective);
                return bi !== null ? bi.toString() : String(effective);
              })()}
              b={(() => {
                const requested = inputSummaryB?.advancedMode?.seed;
                const requestedBi = tryParseBigInt(requested);
                const requestedIsNegative = requestedBi !== null ? requestedBi < 0n : (requested !== null && requested !== undefined && Number(requested) < 0);
                const effective = requestedIsNegative
                  ? rngSeedValue(diff?.b)
                  : requested;
                if (effective === null || effective === undefined) return '—';
                const bi = tryParseBigInt(effective);
                return bi !== null ? bi.toString() : String(effective);
              })()}
              delta={(() => {
                const ra = inputSummaryA?.advancedMode?.seed;
                const rb = inputSummaryB?.advancedMode?.seed;
                const raBi = tryParseBigInt(ra);
                const rbBi = tryParseBigInt(rb);
                const a = (raBi !== null ? raBi < 0n : (ra !== null && ra !== undefined && Number(ra) < 0)) ? rngSeedValue(diff?.a) : ra;
                const b = (rbBi !== null ? rbBi < 0n : (rb !== null && rb !== undefined && Number(rb) < 0)) ? rngSeedValue(diff?.b) : rb;
                if (a === null || a === undefined || b === null || b === undefined) return '';
                const ba = tryParseBigInt(a);
                const bb = tryParseBigInt(b);
                if (ba !== null && bb !== null) return (bb - ba).toString();
                const na = Number(a);
                const nb = Number(b);
                if (!Number.isFinite(na) || !Number.isFinite(nb)) return '';
                return String(nb - na);
              })()}
              different={(() => {
                const ra = inputSummaryA?.advancedMode?.seed;
                const rb = inputSummaryB?.advancedMode?.seed;
                const raBi = tryParseBigInt(ra);
                const rbBi = tryParseBigInt(rb);
                const a = (raBi !== null ? raBi < 0n : (ra !== null && ra !== undefined && Number(ra) < 0)) ? rngSeedValue(diff?.a) : ra;
                const b = (rbBi !== null ? rbBi < 0n : (rb !== null && rb !== undefined && Number(rb) < 0)) ? rngSeedValue(diff?.b) : rb;
                return Boolean(a !== b);
              })()}
            />
          </div>

          {(inputSummaryA || inputSummaryB) ? (
            <>
              <details open className="info-section">
                <summary className="info-section-summary metric-table-summary">
                  <div>Inputs overview</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Run A</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Run B</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Δ</div>
                </summary>
                <div className="info-section-body">
                  <div style={{ border: '1px solid #333', borderRadius: 12, padding: 0, overflow: 'hidden' }}>
                  <MetricRow
                    label="Start date"
                    a={inputSummaryA?.startDate || '—'}
                    b={inputSummaryB?.startDate || '—'}
                    different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.startDate !== inputSummaryB.startDate)}
                  />
                  <MetricRow
                    label="Tax rule"
                    a={inputSummaryA?.overallTaxRule || '—'}
                    b={inputSummaryB?.overallTaxRule || '—'}
                    different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.overallTaxRule !== inputSummaryB.overallTaxRule)}
                  />
                  <MetricRow
                    label="Tax %"
                    a={formatPct2(inputSummaryA?.taxPercentage)}
                    b={formatPct2(inputSummaryB?.taxPercentage)}
                    delta={inputSummaryA && inputSummaryB ? formatDeltaPct2(inputSummaryB.taxPercentage - inputSummaryA.taxPercentage) : ''}
                    different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.taxPercentage !== inputSummaryB.taxPercentage)}
                  />
                  <MetricRow
                    label="Phase count"
                    a={inputSummaryA ? String(inputSummaryA.phaseCount) : '—'}
                    b={inputSummaryB ? String(inputSummaryB.phaseCount) : '—'}
                    delta={inputSummaryA && inputSummaryB ? String(inputSummaryB.phaseCount - inputSummaryA.phaseCount) : ''}
                    different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.phaseCount !== inputSummaryB.phaseCount)}
                  />
                  <MetricRow
                    label="Total months"
                    a={formatDurationYM(inputSummaryA?.totalMonths)}
                    b={formatDurationYM(inputSummaryB?.totalMonths)}
                    delta={inputSummaryA && inputSummaryB ? formatDeltaDurationYM(inputSummaryB.totalMonths - inputSummaryA.totalMonths) : ''}
                    different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.totalMonths !== inputSummaryB.totalMonths)}
                  />
                  <MetricRow
                    label="Phase pattern"
                    a={inputSummaryA?.phasePattern || '—'}
                    b={inputSummaryB?.phasePattern || '—'}
                    different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.phasePattern !== inputSummaryB.phasePattern)}
                  />
                  <MetricRow
                    label="Total deposits (approx)"
                    a={(() => {
                      if (!inputSummaryA) return '—';
                      return formatMoney0((inputSummaryA.totalInitialDeposit ?? 0) + (inputSummaryA.totalMonthlyDeposits ?? 0));
                    })()}
                    b={(() => {
                      if (!inputSummaryB) return '—';
                      return formatMoney0((inputSummaryB.totalInitialDeposit ?? 0) + (inputSummaryB.totalMonthlyDeposits ?? 0));
                    })()}
                    delta={(() => {
                      if (!inputSummaryA || !inputSummaryB) return '';
                      const a = (inputSummaryA.totalInitialDeposit ?? 0) + (inputSummaryA.totalMonthlyDeposits ?? 0);
                      const b = (inputSummaryB.totalInitialDeposit ?? 0) + (inputSummaryB.totalMonthlyDeposits ?? 0);
                      return formatDeltaMoney0(b - a);
                    })()}
                    different={Boolean(
                      inputSummaryA &&
                        inputSummaryB &&
                        ((inputSummaryA.totalInitialDeposit ?? 0) + (inputSummaryA.totalMonthlyDeposits ?? 0)) !==
                          ((inputSummaryB.totalInitialDeposit ?? 0) + (inputSummaryB.totalMonthlyDeposits ?? 0))
                    )}
                  />
                  <MetricRow
                    label="Total withdrawals (approx)"
                    a={formatMoney0(inputSummaryA?.totalWithdrawAmount)}
                    b={formatMoney0(inputSummaryB?.totalWithdrawAmount)}
                    delta={inputSummaryA && inputSummaryB ? formatDeltaMoney0(inputSummaryB.totalWithdrawAmount - inputSummaryA.totalWithdrawAmount) : ''}
                    different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.totalWithdrawAmount !== inputSummaryB.totalWithdrawAmount)}
                  />
                </div>
                </div>
              </details>

              {(inputSummaryA?.advancedMode || inputSummaryB?.advancedMode) && (
                <details open className="info-section">
                  <summary className="info-section-summary metric-table-summary">
                    <div>Advanced mode details</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Run A</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Run B</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Δ</div>
                  </summary>
                  <div className="info-section-body">
                    <div style={{ border: '1px solid #333', borderRadius: 12, padding: 0, overflow: 'hidden' }}>
                      {/* Return type */}
                      <MetricRow
                        label="Return type"
                        a={inputSummaryA?.advancedMode?.returnType || '—'}
                        b={inputSummaryB?.advancedMode?.returnType || '—'}
                        different={Boolean(inputSummaryA?.advancedMode?.returnType !== inputSummaryB?.advancedMode?.returnType)}
                      />

                      {/* Inflation and fees */}
                      {(inputSummaryA?.advancedMode?.inflationFactor !== undefined || inputSummaryB?.advancedMode?.inflationFactor !== undefined) && (
                        <MetricRow
                          label="Inflation factor"
                          a={inputSummaryA?.advancedMode?.inflationFactor !== undefined ? String(inputSummaryA.advancedMode.inflationFactor.toFixed(4)) : '—'}
                          b={inputSummaryB?.advancedMode?.inflationFactor !== undefined ? String(inputSummaryB.advancedMode.inflationFactor.toFixed(4)) : '—'}
                          delta={inputSummaryA?.advancedMode?.inflationFactor !== undefined && inputSummaryB?.advancedMode?.inflationFactor !== undefined ? String((inputSummaryB.advancedMode.inflationFactor - inputSummaryA.advancedMode.inflationFactor).toFixed(4)) : ''}
                          different={Boolean(inputSummaryA?.advancedMode?.inflationFactor !== inputSummaryB?.advancedMode?.inflationFactor)}
                        />
                      )}
                      {(inputSummaryA?.advancedMode?.yearlyFeePercentage !== undefined || inputSummaryB?.advancedMode?.yearlyFeePercentage !== undefined) && (
                        <MetricRow
                          label="Yearly fee %"
                          a={inputSummaryA?.advancedMode?.yearlyFeePercentage !== undefined ? formatPct2(inputSummaryA.advancedMode.yearlyFeePercentage) : '—'}
                          b={inputSummaryB?.advancedMode?.yearlyFeePercentage !== undefined ? formatPct2(inputSummaryB.advancedMode.yearlyFeePercentage) : '—'}
                          delta={inputSummaryA?.advancedMode?.yearlyFeePercentage !== undefined && inputSummaryB?.advancedMode?.yearlyFeePercentage !== undefined ? formatDeltaPct2(inputSummaryB.advancedMode.yearlyFeePercentage - inputSummaryA.advancedMode.yearlyFeePercentage) : ''}
                          different={Boolean(inputSummaryA?.advancedMode?.yearlyFeePercentage !== inputSummaryB?.advancedMode?.yearlyFeePercentage)}
                        />
                      )}

                      {/* Distribution details */}
                      {(inputSummaryA?.advancedMode?.distributionType || inputSummaryB?.advancedMode?.distributionType) && (
                        <>
                          <MetricRow
                            label="Distribution type"
                            a={inputSummaryA?.advancedMode?.distributionType || '—'}
                            b={inputSummaryB?.advancedMode?.distributionType || '—'}
                            different={Boolean(inputSummaryA?.advancedMode?.distributionType !== inputSummaryB?.advancedMode?.distributionType)}
                          />

                          {/* Normal distribution params */}
                          {(inputSummaryA?.advancedMode?.normalMean !== undefined || inputSummaryB?.advancedMode?.normalMean !== undefined) && (
                            <>
                              <MetricRow
                                label="  Normal mean"
                                a={inputSummaryA?.advancedMode?.normalMean !== undefined ? String(inputSummaryA.advancedMode.normalMean.toFixed(4)) : '—'}
                                b={inputSummaryB?.advancedMode?.normalMean !== undefined ? String(inputSummaryB.advancedMode.normalMean.toFixed(4)) : '—'}
                                delta={inputSummaryA?.advancedMode?.normalMean !== undefined && inputSummaryB?.advancedMode?.normalMean !== undefined ? String((inputSummaryB.advancedMode.normalMean - inputSummaryA.advancedMode.normalMean).toFixed(4)) : ''}
                                different={Boolean(inputSummaryA?.advancedMode?.normalMean !== inputSummaryB?.advancedMode?.normalMean)}
                              />
                              <MetricRow
                                label="  Normal std dev"
                                a={inputSummaryA?.advancedMode?.normalStdDev !== undefined ? String(inputSummaryA.advancedMode.normalStdDev.toFixed(4)) : '—'}
                                b={inputSummaryB?.advancedMode?.normalStdDev !== undefined ? String(inputSummaryB.advancedMode.normalStdDev.toFixed(4)) : '—'}
                                delta={inputSummaryA?.advancedMode?.normalStdDev !== undefined && inputSummaryB?.advancedMode?.normalStdDev !== undefined ? String((inputSummaryB.advancedMode.normalStdDev - inputSummaryA.advancedMode.normalStdDev).toFixed(4)) : ''}
                                different={Boolean(inputSummaryA?.advancedMode?.normalStdDev !== inputSummaryB?.advancedMode?.normalStdDev)}
                              />
                            </>
                          )}

                          {/* Brownian motion params */}
                          {(inputSummaryA?.advancedMode?.brownianDrift !== undefined || inputSummaryB?.advancedMode?.brownianDrift !== undefined) && (
                            <>
                              <MetricRow
                                label="  Brownian drift"
                                a={inputSummaryA?.advancedMode?.brownianDrift !== undefined ? String(inputSummaryA.advancedMode.brownianDrift.toFixed(4)) : '—'}
                                b={inputSummaryB?.advancedMode?.brownianDrift !== undefined ? String(inputSummaryB.advancedMode.brownianDrift.toFixed(4)) : '—'}
                                delta={inputSummaryA?.advancedMode?.brownianDrift !== undefined && inputSummaryB?.advancedMode?.brownianDrift !== undefined ? String((inputSummaryB.advancedMode.brownianDrift - inputSummaryA.advancedMode.brownianDrift).toFixed(4)) : ''}
                                different={Boolean(inputSummaryA?.advancedMode?.brownianDrift !== inputSummaryB?.advancedMode?.brownianDrift)}
                              />
                              <MetricRow
                                label="  Brownian volatility"
                                a={inputSummaryA?.advancedMode?.brownianVolatility !== undefined ? String(inputSummaryA.advancedMode.brownianVolatility.toFixed(4)) : '—'}
                                b={inputSummaryB?.advancedMode?.brownianVolatility !== undefined ? String(inputSummaryB.advancedMode.brownianVolatility.toFixed(4)) : '—'}
                                delta={inputSummaryA?.advancedMode?.brownianVolatility !== undefined && inputSummaryB?.advancedMode?.brownianVolatility !== undefined ? String((inputSummaryB.advancedMode.brownianVolatility - inputSummaryA.advancedMode.brownianVolatility).toFixed(4)) : ''}
                                different={Boolean(inputSummaryA?.advancedMode?.brownianVolatility !== inputSummaryB?.advancedMode?.brownianVolatility)}
                              />
                            </>
                          )}

                      {/* Student-t params */}
                      {(inputSummaryA?.advancedMode?.studentMu !== undefined || inputSummaryB?.advancedMode?.studentMu !== undefined) && (
                        <>
                          <MetricRow
                            label="  Student-t μ"
                            a={inputSummaryA?.advancedMode?.studentMu !== undefined ? String(inputSummaryA.advancedMode.studentMu.toFixed(4)) : '—'}
                            b={inputSummaryB?.advancedMode?.studentMu !== undefined ? String(inputSummaryB.advancedMode.studentMu.toFixed(4)) : '—'}
                            delta={inputSummaryA?.advancedMode?.studentMu !== undefined && inputSummaryB?.advancedMode?.studentMu !== undefined ? String((inputSummaryB.advancedMode.studentMu - inputSummaryA.advancedMode.studentMu).toFixed(4)) : ''}
                            different={Boolean(inputSummaryA?.advancedMode?.studentMu !== inputSummaryB?.advancedMode?.studentMu)}
                          />
                          <MetricRow
                            label="  Student-t σ"
                            a={inputSummaryA?.advancedMode?.studentSigma !== undefined ? String(inputSummaryA.advancedMode.studentSigma.toFixed(4)) : '—'}
                            b={inputSummaryB?.advancedMode?.studentSigma !== undefined ? String(inputSummaryB.advancedMode.studentSigma.toFixed(4)) : '—'}
                            delta={inputSummaryA?.advancedMode?.studentSigma !== undefined && inputSummaryB?.advancedMode?.studentSigma !== undefined ? String((inputSummaryB.advancedMode.studentSigma - inputSummaryA.advancedMode.studentSigma).toFixed(4)) : ''}
                            different={Boolean(inputSummaryA?.advancedMode?.studentSigma !== inputSummaryB?.advancedMode?.studentSigma)}
                          />
                          <MetricRow
                            label="  Student-t ν"
                            a={inputSummaryA?.advancedMode?.studentNu !== undefined ? String(inputSummaryA.advancedMode.studentNu.toFixed(4)) : '—'}
                            b={inputSummaryB?.advancedMode?.studentNu !== undefined ? String(inputSummaryB.advancedMode.studentNu.toFixed(4)) : '—'}
                            delta={inputSummaryA?.advancedMode?.studentNu !== undefined && inputSummaryB?.advancedMode?.studentNu !== undefined ? String((inputSummaryB.advancedMode.studentNu - inputSummaryA.advancedMode.studentNu).toFixed(4)) : ''}
                            different={Boolean(inputSummaryA?.advancedMode?.studentNu !== inputSummaryB?.advancedMode?.studentNu)}
                          />
                        </>
                      )}

                      {/* Regime-based params */}
                      {(inputSummaryA?.advancedMode?.regimeTickMonths !== undefined || inputSummaryB?.advancedMode?.regimeTickMonths !== undefined) && (
                        <MetricRow
                          label="  Regime tick months"
                          a={inputSummaryA?.advancedMode?.regimeTickMonths !== undefined ? String(inputSummaryA.advancedMode.regimeTickMonths) : '—'}
                          b={inputSummaryB?.advancedMode?.regimeTickMonths !== undefined ? String(inputSummaryB.advancedMode.regimeTickMonths) : '—'}
                          delta={inputSummaryA?.advancedMode?.regimeTickMonths !== undefined && inputSummaryB?.advancedMode?.regimeTickMonths !== undefined ? String(inputSummaryB.advancedMode.regimeTickMonths - inputSummaryA.advancedMode.regimeTickMonths) : ''}
                          different={Boolean(inputSummaryA?.advancedMode?.regimeTickMonths !== inputSummaryB?.advancedMode?.regimeTickMonths)}
                        />
                      )}

                      {/* Simple average percentage */}
                      {(inputSummaryA?.advancedMode?.simpleAveragePercentage !== undefined || inputSummaryB?.advancedMode?.simpleAveragePercentage !== undefined) && (
                        <MetricRow
                          label="  Simple average %"
                          a={inputSummaryA?.advancedMode?.simpleAveragePercentage !== undefined ? formatPct2(inputSummaryA.advancedMode.simpleAveragePercentage) : '—'}
                          b={inputSummaryB?.advancedMode?.simpleAveragePercentage !== undefined ? formatPct2(inputSummaryB.advancedMode.simpleAveragePercentage) : '—'}
                          delta={inputSummaryA?.advancedMode?.simpleAveragePercentage !== undefined && inputSummaryB?.advancedMode?.simpleAveragePercentage !== undefined ? formatDeltaPct2(inputSummaryB.advancedMode.simpleAveragePercentage - inputSummaryA.advancedMode.simpleAveragePercentage) : ''}
                          different={Boolean(inputSummaryA?.advancedMode?.simpleAveragePercentage !== inputSummaryB?.advancedMode?.simpleAveragePercentage)}
                        />
                      )}
                    </>
                  )}

                  {/* Tax exemption config */}
                  {(inputSummaryA?.advancedMode?.taxExemptionConfig || inputSummaryB?.advancedMode?.taxExemptionConfig) && (
                    <>
                      <div style={{ padding: '8px 10px', background: 'rgba(100, 150, 255, 0.05)', fontSize: 12, fontWeight: 700 }}>
                        Tax Exemptions
                      </div>
                      <MetricRow
                        label="Card limit"
                        a={inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== undefined ? `${formatMoney0(inputSummaryA.advancedMode.taxExemptionConfig.exemptionCard.limit)}` : '—'}
                        b={inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== undefined ? `${formatMoney0(inputSummaryB.advancedMode.taxExemptionConfig.exemptionCard.limit)}` : '—'}
                        delta={inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== undefined && inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== undefined ? formatDeltaMoney0(inputSummaryB.advancedMode.taxExemptionConfig.exemptionCard.limit - inputSummaryA.advancedMode.taxExemptionConfig.exemptionCard.limit) : ''}
                        different={Boolean(inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit)}
                      />
                      <MetricRow
                        label="Card yearly increase"
                        a={inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.yearlyIncrease !== undefined ? `${formatMoney0(inputSummaryA.advancedMode.taxExemptionConfig.exemptionCard.yearlyIncrease)}` : '—'}
                        b={inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.yearlyIncrease !== undefined ? `${formatMoney0(inputSummaryB.advancedMode.taxExemptionConfig.exemptionCard.yearlyIncrease)}` : '—'}
                        delta={inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.yearlyIncrease !== undefined && inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.yearlyIncrease !== undefined ? formatDeltaMoney0(inputSummaryB.advancedMode.taxExemptionConfig.exemptionCard.yearlyIncrease - inputSummaryA.advancedMode.taxExemptionConfig.exemptionCard.yearlyIncrease) : ''}
                        different={Boolean(inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.yearlyIncrease !== inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.yearlyIncrease)}
                      />
                      <MetricRow
                        label="Stock tax rate %"
                        a={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== undefined ? formatPct2(inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.taxRate) : '—'}
                        b={inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== undefined ? formatPct2(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.taxRate) : '—'}
                        delta={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== undefined && inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== undefined ? formatDeltaPct2(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.taxRate - inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.taxRate) : ''}
                        different={Boolean(inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate)}
                      />
                      <MetricRow
                        label="Stock limit"
                        a={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== undefined ? `${formatMoney0(inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.limit)}` : '—'}
                        b={inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== undefined ? `${formatMoney0(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.limit)}` : '—'}
                        delta={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== undefined && inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== undefined ? formatDeltaMoney0(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.limit - inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.limit) : ''}
                        different={Boolean(inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.limit)}
                      />
                      <MetricRow
                        label="Stock yearly increase"
                        a={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.yearlyIncrease !== undefined ? `${formatMoney0(inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.yearlyIncrease)}` : '—'}
                        b={inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.yearlyIncrease !== undefined ? `${formatMoney0(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.yearlyIncrease)}` : '—'}
                        delta={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.yearlyIncrease !== undefined && inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.yearlyIncrease !== undefined ? formatDeltaMoney0(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.yearlyIncrease - inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.yearlyIncrease) : ''}
                        different={Boolean(inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.yearlyIncrease !== inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.yearlyIncrease)}
                      />
                    </>
                  )}

                          </div>
                        </div>
                      </details>
                    )}

            {/* Phase-by-phase breakdown */}
              {(inputSummaryA?.phases ?? []).length > 0 || (inputSummaryB?.phases ?? []).length > 0 ? (
                <details open className="info-section">
                  <summary className="info-section-summary metric-table-summary">
                    <div>Per-phase details</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Run A</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Run B</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Δ</div>
                  </summary>
                  <div className="info-section-body">
                    <div style={{ border: '1px solid #333', borderRadius: 12, padding: 0, overflow: 'hidden' }}>
                  {Array.from({ length: Math.max(inputSummaryA?.phases.length ?? 0, inputSummaryB?.phases.length ?? 0) }).map((_, phaseIdx) => {
                    const phaseA = inputSummaryA?.phases[phaseIdx];
                    const phaseB = inputSummaryB?.phases[phaseIdx];
                    const typeDiff = phaseA?.phaseType !== phaseB?.phaseType;
                    const durationDiff = phaseA?.durationInMonths !== phaseB?.durationInMonths;
                    
                    // Create label showing phase type(s)
                    const typeLabel = phaseA?.phaseType || phaseB?.phaseType || 'Unknown';
                    const typeALabel = phaseA?.phaseType === 'DEPOSIT' ? 'DEPOSIT' : phaseA?.phaseType === 'WITHDRAW' ? 'WITHDRAW' : 'PASSIVE';
                    const typeBLabel = phaseB?.phaseType === 'DEPOSIT' ? 'DEPOSIT' : phaseB?.phaseType === 'WITHDRAW' ? 'WITHDRAW' : 'PASSIVE';

                    return (
                      <div key={phaseIdx} style={{ borderTop: '1px solid #222' }}>
                        <div style={{ padding: '8px 10px', background: 'rgba(100, 150, 255, 0.05)', fontSize: 12, fontWeight: 700 }}>
                          Phase {phaseIdx + 1}: {typeLabel}
                        </div>
                        <MetricRow
                          label="  Type"
                          a={typeALabel}
                          b={typeBLabel}
                          different={typeDiff}
                        />
                        <MetricRow
                          label="  Duration (years, months)"
                          a={phaseA ? formatDurationYM(phaseA.durationInMonths) : '—'}
                          b={phaseB ? formatDurationYM(phaseB.durationInMonths) : '—'}
                          delta={phaseA && phaseB ? formatDeltaDurationYM(phaseB.durationInMonths - phaseA.durationInMonths) : ''}
                          different={durationDiff}
                        />

                        <MetricRow
                          label="  Tax exemptions active"
                          a={formatTaxExemptionsActive(phaseA)}
                          b={formatTaxExemptionsActive(phaseB)}
                          different={Boolean(phaseA?.taxExemptionsActive?.any !== phaseB?.taxExemptionsActive?.any || phaseA?.taxExemptionsActive?.card !== phaseB?.taxExemptionsActive?.card || phaseA?.taxExemptionsActive?.stock !== phaseB?.taxExemptionsActive?.stock)}
                        />

                        {/* DEPOSIT phase details */}
                        {(phaseA?.phaseType === 'DEPOSIT' || phaseB?.phaseType === 'DEPOSIT') && (
                          <>
                            <MetricRow
                              label="  Initial deposit"
                              a={phaseA?.phaseType === 'DEPOSIT' ? formatMoney0(phaseA?.initialDeposit) : '—'}
                              b={phaseB?.phaseType === 'DEPOSIT' ? formatMoney0(phaseB?.initialDeposit) : '—'}
                              delta={phaseA?.phaseType === 'DEPOSIT' && phaseB?.phaseType === 'DEPOSIT' && phaseA && phaseB ? formatDeltaMoney0(phaseB.initialDeposit! - phaseA.initialDeposit!) : ''}
                              different={phaseA?.phaseType === 'DEPOSIT' && phaseB?.phaseType === 'DEPOSIT' && phaseA?.initialDeposit !== phaseB?.initialDeposit}
                            />
                            <MetricRow
                              label="  Monthly deposit"
                              a={phaseA?.phaseType === 'DEPOSIT' ? formatMoney0(phaseA?.monthlyDeposit) : '—'}
                              b={phaseB?.phaseType === 'DEPOSIT' ? formatMoney0(phaseB?.monthlyDeposit) : '—'}
                              delta={phaseA?.phaseType === 'DEPOSIT' && phaseB?.phaseType === 'DEPOSIT' && phaseA && phaseB ? formatDeltaMoney0(phaseB.monthlyDeposit! - phaseA.monthlyDeposit!) : ''}
                              different={phaseA?.phaseType === 'DEPOSIT' && phaseB?.phaseType === 'DEPOSIT' && phaseA?.monthlyDeposit !== phaseB?.monthlyDeposit}
                            />
                            <MetricRow
                              label="  Yearly increase %"
                              a={phaseA?.phaseType === 'DEPOSIT' ? formatPct2(phaseA?.yearlyIncreaseInPercentage) : '—'}
                              b={phaseB?.phaseType === 'DEPOSIT' ? formatPct2(phaseB?.yearlyIncreaseInPercentage) : '—'}
                              delta={phaseA?.phaseType === 'DEPOSIT' && phaseB?.phaseType === 'DEPOSIT' && phaseA && phaseB ? formatDeltaPct2(phaseB.yearlyIncreaseInPercentage! - phaseA.yearlyIncreaseInPercentage!) : ''}
                              different={phaseA?.phaseType === 'DEPOSIT' && phaseB?.phaseType === 'DEPOSIT' && phaseA?.yearlyIncreaseInPercentage !== phaseB?.yearlyIncreaseInPercentage}
                            />
                            <MetricRow
                              label="  Total deposits (approx)"
                              a={phaseA?.phaseType === 'DEPOSIT' ? formatMoney0(phaseA?.depositTotal) : '—'}
                              b={phaseB?.phaseType === 'DEPOSIT' ? formatMoney0(phaseB?.depositTotal) : '—'}
                              delta={phaseA?.phaseType === 'DEPOSIT' && phaseB?.phaseType === 'DEPOSIT' && phaseA && phaseB ? formatDeltaMoney0(phaseB.depositTotal! - phaseA.depositTotal!) : ''}
                              different={phaseA?.phaseType === 'DEPOSIT' && phaseB?.phaseType === 'DEPOSIT' && phaseA?.depositTotal !== phaseB?.depositTotal}
                            />
                          </>
                        )}

                        {/* WITHDRAW phase details */}
                        {(phaseA?.phaseType === 'WITHDRAW' || phaseB?.phaseType === 'WITHDRAW') && (
                          <>
                            <MetricRow
                              label="  Withdraw amount"
                              a={phaseA?.phaseType === 'WITHDRAW' ? formatMoney0(phaseA?.withdrawAmount) : '—'}
                              b={phaseB?.phaseType === 'WITHDRAW' ? formatMoney0(phaseB?.withdrawAmount) : '—'}
                              delta={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA && phaseB ? formatDeltaMoney0(phaseB.withdrawAmount! - phaseA.withdrawAmount!) : ''}
                              different={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA?.withdrawAmount !== phaseB?.withdrawAmount}
                            />
                            <MetricRow
                              label="  Withdraw rate"
                              a={phaseA?.phaseType === 'WITHDRAW' ? formatPct2(phaseA?.withdrawRate) : '—'}
                              b={phaseB?.phaseType === 'WITHDRAW' ? formatPct2(phaseB?.withdrawRate) : '—'}
                              delta={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA && phaseB ? formatDeltaPct2(phaseB.withdrawRate! - phaseA.withdrawRate!) : ''}
                              different={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA?.withdrawRate !== phaseB?.withdrawRate}
                            />
                            <MetricRow
                              label="  Variation (lower %)"
                              a={phaseA?.phaseType === 'WITHDRAW' ? formatPct2(phaseA?.lowerVariationPercentage) : '—'}
                              b={phaseB?.phaseType === 'WITHDRAW' ? formatPct2(phaseB?.lowerVariationPercentage) : '—'}
                              delta={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA && phaseB ? formatDeltaPct2(phaseB.lowerVariationPercentage! - phaseA.lowerVariationPercentage!) : ''}
                              different={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA?.lowerVariationPercentage !== phaseB?.lowerVariationPercentage}
                            />
                            <MetricRow
                              label="  Variation (upper %)"
                              a={phaseA?.phaseType === 'WITHDRAW' ? formatPct2(phaseA?.upperVariationPercentage) : '—'}
                              b={phaseB?.phaseType === 'WITHDRAW' ? formatPct2(phaseB?.upperVariationPercentage) : '—'}
                              delta={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA && phaseB ? formatDeltaPct2(phaseB.upperVariationPercentage! - phaseA.upperVariationPercentage!) : ''}
                              different={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA?.upperVariationPercentage !== phaseB?.upperVariationPercentage}
                            />
                            <MetricRow
                              label="  Total withdrawals (approx)"
                              a={phaseA?.phaseType === 'WITHDRAW' ? formatMoney0(phaseA?.withdrawTotal) : '—'}
                              b={phaseB?.phaseType === 'WITHDRAW' ? formatMoney0(phaseB?.withdrawTotal) : '—'}
                              delta={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA && phaseB ? formatDeltaMoney0(phaseB.withdrawTotal! - phaseA.withdrawTotal!) : ''}
                              different={phaseA?.phaseType === 'WITHDRAW' && phaseB?.phaseType === 'WITHDRAW' && phaseA?.withdrawTotal !== phaseB?.withdrawTotal}
                            />
                          </>
                        )}

                        {/* PASSIVE phase - minimal fields */}
                        {(phaseA?.phaseType === 'PASSIVE' || phaseB?.phaseType === 'PASSIVE') && (
                          <div style={{ padding: '8px 10px', fontSize: 13, opacity: 0.75, fontStyle: 'italic' }}>
                            Passive phase (no action)
                          </div>
                        )}
                      </div>
                    );
                  })}
                    </div>
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.85 }}>Input summary unavailable.</div>
          )}

          {(runSummariesA && runSummariesB) && (
            <>
              <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #444' }} />
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Key metrics</div>

              {(() => {
                const lastA = pickLastEntry(runSummariesA);
                const lastB = pickLastEntry(runSummariesB);

                const aEnd = lastA ? `${lastA.phaseName} / year ${lastA.year}` : '—';
                const bEnd = lastB ? `${lastB.phaseName} / year ${lastB.year}` : '—';
                const endDifferent = Boolean(lastA && lastB && (lastA.phaseName !== lastB.phaseName || lastA.year !== lastB.year));

                const avgA = lastA?.averageCapital;
                const avgB = lastB?.averageCapital;
                const medA = lastA?.medianCapital;
                const medB = lastB?.medianCapital;
                const q05A = lastA?.quantile5;
                const q05B = lastB?.quantile5;
                const q95A = lastA?.quantile95;
                const q95B = lastB?.quantile95;
                const varA = lastA?.var;
                const varB = lastB?.var;
                const cvarA = lastA?.cvar;
                const cvarB = lastB?.cvar;
                const failA = lastA?.negativeCapitalPercentage;
                const failB = lastB?.negativeCapitalPercentage;

                const dAvg = avgA !== undefined && avgB !== undefined ? avgB - avgA : null;
                const dMed = medA !== undefined && medB !== undefined ? medB - medA : null;
                const dQ05 = q05A !== undefined && q05B !== undefined ? q05B - q05A : null;
                const dQ95 = q95A !== undefined && q95B !== undefined ? q95B - q95A : null;
                const dVar = varA !== undefined && varB !== undefined ? varB - varA : null;
                const dCvar = cvarA !== undefined && cvarB !== undefined ? cvarB - cvarA : null;
                const dFail = failA !== undefined && failB !== undefined ? failB - failA : null;

                return (
                  <div style={{ border: '1px solid #333', borderRadius: 12, padding: 0, overflow: 'hidden' }}>
                    <MetricRow label="End point (phase/year)" a={aEnd} b={bEnd} different={endDifferent} />
                    <MetricRow
                      label="End average capital"
                      a={coloredValue('capital', formatMoney0(avgA))}
                      b={coloredValue('capital', formatMoney0(avgB))}
                      delta={coloredValue('capital', formatDeltaMoney0(dAvg), { bold: true })}
                      different={Boolean(dAvg && Math.abs(dAvg) > 1e-6)}
                    />
                    <MetricRow
                      label="End median capital"
                      a={coloredValue('capital', formatMoney0(medA))}
                      b={coloredValue('capital', formatMoney0(medB))}
                      delta={coloredValue('capital', formatDeltaMoney0(dMed), { bold: true })}
                      different={Boolean(dMed && Math.abs(dMed) > 1e-6)}
                    />
                    <MetricRow
                      label="End worst-case (5th percentile)"
                      a={coloredValue('capital', formatMoney0(q05A))}
                      b={coloredValue('capital', formatMoney0(q05B))}
                      delta={coloredValue('capital', formatDeltaMoney0(dQ05), { bold: true })}
                      different={Boolean(dQ05 && Math.abs(dQ05) > 1e-6)}
                    />
                    <MetricRow
                      label="End best-case (95th percentile)"
                      a={coloredValue('capital', formatMoney0(q95A))}
                      b={coloredValue('capital', formatMoney0(q95B))}
                      delta={coloredValue('capital', formatDeltaMoney0(dQ95), { bold: true })}
                      different={Boolean(dQ95 && Math.abs(dQ95) > 1e-6)}
                    />
                    <MetricRow
                      label="End VaR"
                      a={coloredValue('capital', formatMoney0(varA))}
                      b={coloredValue('capital', formatMoney0(varB))}
                      delta={coloredValue('capital', formatDeltaMoney0(dVar), { bold: true })}
                      different={Boolean(dVar && Math.abs(dVar) > 1e-6)}
                    />
                    <MetricRow
                      label="End CVaR"
                      a={coloredValue('capital', formatMoney0(cvarA))}
                      b={coloredValue('capital', formatMoney0(cvarB))}
                      delta={coloredValue('capital', formatDeltaMoney0(dCvar), { bold: true })}
                      different={Boolean(dCvar && Math.abs(dCvar) > 1e-6)}
                    />
                    <MetricRow
                      label="End failure rate (negative capital %)"
                      a={formatPct2(failA)}
                      b={formatPct2(failB)}
                      delta={formatDeltaPct2(dFail)}
                      different={Boolean(dFail && Math.abs(dFail) > 1e-9)}
                    />
                  </div>
                );
              })()}
            </>
          )}

          {(runSummariesA && runSummariesB) && (
            <>
              <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #444' }} />
              <div id="detailed-metrics" style={{ fontWeight: 800, marginBottom: 8 }}>Detailed Yearly Metrics</div>

              {(metricSummariesA || metricSummariesB) && (
                <details open className="info-section">
                  <summary className="info-section-summary">Compare</summary>
                  <div className="info-section-body">
                    {(() => {
                      const a = singleModeSide === 'B' ? (metricSummariesB ?? []) : (metricSummariesA ?? []);
                      const b = singleModeSide ? null : (metricSummariesB ?? []);
                      const aLabel = singleModeSide === 'B' ? 'Run B' : (singleModeSide === 'A' ? 'Run A' : 'Run A');
                      const bLabel = 'Run B';

                      return (
                        <CompareMetricExplorer
                          a={a}
                          b={b}
                          mode={singleModeSide ? 'single' : 'diff'}
                          aLabel={aLabel}
                          bLabel={bLabel}
                          onOpenGroup={(groupId) => {
                            setSelectedMetricGroupId(groupId);
                            const el = document.getElementById('detailed-metrics');
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                        />
                      );
                    })()}
                  </div>
                </details>
              )}

              {(() => {
                const groups = detailedMetricGroups.groups;
                if (groups.length === 0) {
                  return <div style={{ fontSize: 13, opacity: 0.85 }}>No detailed metrics available for one or both runs.</div>;
                }

                const activeGroup = detailedMetricGroups.byId.get(selectedMetricGroupId) ?? groups[0];
                const metricNames = Array.from(activeGroup.metrics.keys()).sort((x, y) => x.localeCompare(y));

                const renderPercentileRows = (metricName: string, ma?: MetricSummary, mb?: MetricSummary) => {
                  return (
                    <div style={{ border: '1px solid #333', borderRadius: 10, overflow: 'hidden' }}>
                      <div className="metric-header" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr', gap: 10, padding: '8px 10px', background: '#1a1a1a', fontWeight: 700, fontSize: 12 }}>
                        <div>Percentile</div>
                        <div>Run A</div>
                        <div>Run B</div>
                        <div>Δ</div>
                      </div>
                      {percentileOrder.map((p) => {
                        const va = getPercentileValue(ma, p);
                        const vb = getPercentileValue(mb, p);
                        const d = va !== null && vb !== null ? vb - va : null;
                        return (
                          <MetricRow
                            key={String(p)}
                            label={String(p)}
                            a={coloredValue(metricName, formatMetricValue(metricName, va))}
                            b={coloredValue(metricName, formatMetricValue(metricName, vb))}
                            delta={coloredValue(metricName, formatMetricDelta(metricName, d), { bold: true })}
                            different={Boolean(d && Math.abs(d) > 1e-9)}
                          />
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <details key={activeGroup.id} className="info-section">
                      <summary className="info-section-summary" style={{ fontWeight: 750 }}>
                        {activeGroup.title}
                        <span style={{ opacity: 0.7, fontSize: 12, marginLeft: 8 }}>({metricNames.length})</span>
                      </summary>

                      <div className="info-section-body" style={{ marginTop: 0, display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                          <div style={{ fontWeight: 650, opacity: 0.9 }}>Show:</div>
                          <select
                            value={activeGroup.id}
                            onChange={(e) => setSelectedMetricGroupId(String(e.target.value))}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 10,
                              border: '1px solid #444',
                              background: '#111',
                              color: '#fff',
                              minWidth: 320,
                            }}
                          >
                            {groups.map((g) => {
                              const count = g.metrics.size;
                              const label = `${g.title} (${count})`;
                              return (
                                <option key={g.id} value={g.id}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {metricNames.map((name) => {
                          const pair = activeGroup.metrics.get(name) ?? {};
                          return (
                            <div key={name} style={{ borderTop: '1px solid #2a2a2a', paddingTop: 10 }}>
                              <div style={{ fontWeight: 700, marginBottom: 8 }}>{name || 'Metric'}</div>
                              {renderPercentileRows(name, pair.a, pair.b)}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                );
              })()}
            </>
          )}

          {runSummariesA && (singleMode || (runSummariesB && runSummariesB.length > 0)) && (
            <>
              <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #444' }} />
              <details open className="info-section">
                <summary className="info-section-summary">Charts</summary>
                <div className="info-section-body">
                  {singleModeSide === 'A' ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10 }}>
                        <div style={{ fontWeight: 750, marginBottom: 6 }}>Run A</div>
                        <MultiPhaseOverview data={runSummariesA} timeline={timelineA} syncId={chartsSyncId} />
                      </div>
                    </div>
                  ) : singleModeSide === 'B' ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10 }}>
                        <div style={{ fontWeight: 750, marginBottom: 6 }}>Run B</div>
                        <MultiPhaseOverview data={runSummariesB!} timeline={timelineB} syncId={chartsSyncId} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                      <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10 }}>
                        <div style={{ fontWeight: 750, marginBottom: 6 }}>Run A</div>
                        <MultiPhaseOverview data={runSummariesA} timeline={timelineA} syncId={chartsSyncId} />
                      </div>
                      <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10 }}>
                        <div style={{ fontWeight: 750, marginBottom: 6 }}>Run B</div>
                        <MultiPhaseOverview data={runSummariesB!} timeline={timelineB} syncId={chartsSyncId} />
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
    </PageLayout>
  );
};

export default RunDiffPage;
