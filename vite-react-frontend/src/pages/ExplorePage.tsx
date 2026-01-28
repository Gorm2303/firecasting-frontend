// src/pages/ExplorePage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { YearlySummary } from '../models/YearlySummary';
import type { SimulationTimelineContext } from '../models/types';
import type { AdvancedSimulationRequest } from '../models/advancedSimulation';
import { advancedToNormalRequest } from '../models/advancedSimulation';
import { encodeScenarioToShareParam } from '../utils/shareScenarioLink';
import { saveScenario } from '../config/savedScenarios';
import MultiPhaseOverview from '../MultiPhaseOverview';
import {
  exportSimulationCsv,
  getRunInput,
  getRunSummaries,
  listRuns,
  type RunListItem,
} from '../api/simulation';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const toIsoDateString = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v?.date === 'string') return v.date;

  // Backend may persist/echo LocalDate-like objects.
  const y = Number(v?.year);
  const m = Number(v?.month);
  const d = Number(v?.dayOfMonth);
  if (
    Number.isFinite(y) &&
    Number.isFinite(m) &&
    Number.isFinite(d) &&
    y > 0 &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= 31
  ) {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  const epochDay = Number(v?.epochDay);
  if (Number.isFinite(epochDay)) {
    const base = Date.UTC(1970, 0, 1);
    const dt = new Date(base + epochDay * 24 * 60 * 60 * 1000);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  return null;
};

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
      startDate: String(startDate),
      phaseTypes,
      phaseDurationsInMonths,
      firstPhaseInitialDeposit:
        phases[0]?.initialDeposit !== undefined ? Number(phases[0]?.initialDeposit) : undefined,
      inflationFactorPerYear:
        req?.inflationFactor !== undefined ? Number(req?.inflationFactor) : undefined,
    };
  } catch {
    return null;
  }
};

const thBase: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid #3a3a3a',
  position: 'sticky',
  top: 0,
  background: 'inherit',
};

const tdBase: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #3a3a3a',
  verticalAlign: 'top',
};

const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ display: 'inline-block', fontSize: 12, opacity: 0.75 }}>{children}</span>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      border: '1px solid #444',
      fontSize: 12,
      marginRight: 6,
      marginBottom: 4,
    }}
  >
    {children}
  </span>
);

const money = (v?: number) =>
  typeof v === 'number'
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v)
    : '—';

const pct = (v?: number) =>
  typeof v === 'number'
    ? `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    : '—';

const pctVal = (v?: number) =>
  typeof v === 'number'
    ? `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    : '—';


const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
};

const sumMonths = (phases: any[]) =>
  phases.reduce((s, p) => s + (Number(p?.durationInMonths) || 0), 0);

/** ---------- Inputs cell (from advanced request) ---------- */
const PhaseBlock: React.FC<{ p: any }> = ({ p }) => {
  const type = String(p?.phaseType ?? p?.type ?? '—');
  const taxRules: any[] = Array.isArray(p?.taxRules) ? p.taxRules : [];
  return (
  <div
    style={{
      border: '1px solid #3a3a3a',
      borderRadius: 10,
      padding: '8px 10px',
      marginBottom: 8,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <strong style={{ fontSize: 14 }}>{type} - {Number(p?.durationInMonths) || 0} months</strong>
    </div>

    <div style={{ marginTop: 6 }}>
      {type === 'DEPOSIT' && (
        <>
          <div style={{ marginTop: 6 }}>
            <Em>Initial Deposit:</Em> {money(p?.initialDeposit)}
          </div>
          <div style={{ marginTop: 6 }}>
            <Em>Monthly Deposit:</Em> {money(p?.monthlyDeposit)}
          </div>
          <div style={{ marginTop: 6 }}>
            <Em>Yearly Increase %:</Em> {pct(p?.yearlyIncreaseInPercentage)}
          </div>
        </>
      )}

      {type === 'WITHDRAW' && (
        <>
          <div style={{ marginTop: 6 }}>
            <Em>Withdraw Amount:</Em> {money(p?.withdrawAmount)}
          </div>
          <div style={{ marginTop: 6 }}>
            <Em>Lower Variation %:</Em> {pct(p?.lowerVariationPercentage)}
          </div>
          <div style={{ marginTop: 6 }}>
            <Em>Upper Variation %:</Em> {pct(p?.upperVariationPercentage)}
          </div>
        </>
      )}

      <div style={{ marginTop: 8 }}>
        <Em>Tax Exemptions</Em>
        <div style={{ marginTop: 4 }}>
          {taxRules?.includes('EXEMPTIONCARD') && <Chip>Exemption Card</Chip>}
          {taxRules?.includes('STOCKEXEMPTION') && <Chip>Stock Exemption</Chip>}
          {!taxRules?.length && <span style={{ opacity: 0.7 }}>None</span>}
        </div>
      </div>
    </div>
  </div>
  );
};

const InputsCell: React.FC<{ input: AdvancedSimulationRequest }> = ({ input }) => {
  const start = toIsoDateString((input as any)?.startDate) ?? '—';
  const phases = Array.isArray((input as any)?.phases) ? (input as any).phases : [];
  const total = sumMonths(phases);

  const overallTaxRule = String((input as any)?.overallTaxRule ?? '—');
  const taxPercentage = Number((input as any)?.taxPercentage);
  const inflationFactor = (input as any)?.inflationFactor;
  const paths = (input as any)?.paths;
  const batchSize = (input as any)?.batchSize;

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <Em>Start Date:</Em>
        <div>{start ? fmtDate(start) : '—'}</div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <Em>Tax Rule:</Em>
        <div>{overallTaxRule === 'CAPITAL' ? 'Capital Gains' : overallTaxRule === 'NOTIONAL' ? 'Notional Gains' : overallTaxRule}</div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <Em>Tax %:</Em>
        <div>{Number.isFinite(taxPercentage) ? pct(taxPercentage) : '—'}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 8px' }}>
        {inflationFactor !== undefined ? <Chip>Inflation: {String(inflationFactor)}</Chip> : null}
        {paths !== undefined ? <Chip>Paths: {String(paths)}</Chip> : null}
        {batchSize !== undefined ? <Chip>Batch: {String(batchSize)}</Chip> : null}
      </div>

      <div style={{ margin: '10px 0 6px', fontWeight: 600 }}>Phases</div>
      {phases.map((p: any, idx: number) => (
        <PhaseBlock key={idx} p={p} />
      ))}

      <div style={{ marginTop: 6, fontWeight: 600 }}>
        Total duration: {total}/1200 months
      </div>
    </div>
  );
};

/** ---------- Outputs cell ---------- */
const OutputsCell: React.FC<{ summaries: YearlySummary[] }> = ({ summaries }) => {
  const byPhase = useMemo(() => {
    const map: Record<string, YearlySummary[]> = {};
    summaries.forEach((o) => {
      const key = String(o.phaseName ?? 'UNKNOWN');
      map[key] ??= [];
      map[key].push(o);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.year - b.year));
    return map;
  }, [summaries]);

  const snapshot = Object.entries(byPhase).map(([phase, arr]) => {
    const last = arr[arr.length - 1];
    return { phase, last };
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {snapshot.map((s) => (
          <div
            key={s.phase}
            style={{
              border: '1px solid #3a3a3a',
              borderRadius: 10,
              padding: '8px 10px',
              minWidth: 220,
              flex: '1 1 260px',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {s.phase} - {s.last.year}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 10, rowGap: 4 }}>
              <Em>Median:</Em>
              <div>{money(s.last.medianCapital)}</div>
              <Em>Avg:</Em>
              <div>{money(s.last.averageCapital)}</div>
              <Em>Q25–Q75:</Em>
              <div>
                {money(s.last.quantile25)}–{money(s.last.quantile75)}
              </div>
              <Em>Q5–Q95:</Em>
              <div>
                {money(s.last.quantile5)}–{money(s.last.quantile95)}
              </div>
              <Em>Min/Max:</Em>
              <div>
                {money(s.last.minCapital)} / {money(s.last.maxCapital)}
              </div>
              <Em>Neg:</Em>
              <div>{pctVal(s.last.negativeCapitalPercentage)}</div>
              <Em>VaR(5%):</Em>
              <div>{money(s.last.var)}</div>
              <Em>CVaR:</Em>
              <div>{money(s.last.cvar)}</div>
            </div>
          </div>
        ))}
      </div>

      <details>
        <summary style={{ cursor: 'pointer' }}>Show raw yearly summaries (JSON)</summary>
        <pre
          style={{
            marginTop: 8,
            maxHeight: 260,
            overflow: 'auto',
            border: '1px solid #3a3a3a',
            borderRadius: 10,
            padding: 8,
          }}
        >
{JSON.stringify(summaries, null, 2)}
        </pre>
      </details>
    </div>
  );
};

const ExplorePage: React.FC = () => {
  const navigate = useNavigate();

  // Under development banner
  const [ack, setAck] = useState(false);

  const [query, setQuery] = useState('');
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [runsState, setRunsState] = useState<LoadState>('idle');
  const [runsError, setRunsError] = useState<string | null>(null);

  const [expandedRunId, setExpandedRunId] = useState<string>('');

  const [inputByRunId, setInputByRunId] = useState<Record<string, AdvancedSimulationRequest | null>>({});
  const [summariesByRunId, setSummariesByRunId] = useState<Record<string, YearlySummary[] | null>>({});
  const [rowStateByRunId, setRowStateByRunId] = useState<Record<string, LoadState>>({});
  const [rowErrorByRunId, setRowErrorByRunId] = useState<Record<string, string | null>>({});

  const refreshRuns = useCallback(async () => {
    setRunsState('loading');
    setRunsError(null);
    try {
      const data = await listRuns();
      // Most recent first when createdAt exists.
      const sorted = [...data].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
      setRuns(sorted);
      setRunsState('ready');
    } catch (e: any) {
      setRunsState('error');
      setRunsError(String(e?.message ?? e ?? 'Failed to load runs'));
    }
  }, []);

  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  const filteredRuns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) => {
      const blob = [
        r.id,
        r.createdAt ?? '',
        r.rngSeedText ?? '',
        r.rngSeed ?? '',
        r.modelAppVersion ?? '',
        r.modelJavaVersion ?? '',
        r.modelSpringBootVersion ?? '',
        r.inputHash ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [query, runs]);

  const ensureRowLoaded = useCallback(
    async (runId: string) => {
      setRowStateByRunId((prev) => ({ ...prev, [runId]: 'loading' }));
      setRowErrorByRunId((prev) => ({ ...prev, [runId]: null }));
      try {
        const [inputRaw, summaries] = await Promise.all([
          inputByRunId[runId] ? Promise.resolve(inputByRunId[runId]) : getRunInput(runId),
          summariesByRunId[runId] ? Promise.resolve(summariesByRunId[runId]) : getRunSummaries(runId),
        ]);

        const input = inputRaw as AdvancedSimulationRequest;
        setInputByRunId((prev) => ({ ...prev, [runId]: input }));
        setSummariesByRunId((prev) => ({ ...prev, [runId]: summaries as YearlySummary[] }));
        setRowStateByRunId((prev) => ({ ...prev, [runId]: 'ready' }));
      } catch (e: any) {
        setRowStateByRunId((prev) => ({ ...prev, [runId]: 'error' }));
        setRowErrorByRunId((prev) => ({ ...prev, [runId]: String(e?.message ?? e ?? 'Failed to load run') }));
      }
    },
    [inputByRunId, summariesByRunId]
  );

  const handleView = useCallback(
    async (runId: string) => {
      setExpandedRunId((prev) => (prev === runId ? '' : runId));
      // Load details when opening.
      const nextOpen = expandedRunId !== runId;
      if (nextOpen && (!inputByRunId[runId] || !summariesByRunId[runId])) {
        await ensureRowLoaded(runId);
      }
    },
    [ensureRowLoaded, expandedRunId, inputByRunId, summariesByRunId]
  );

  const handleClone = useCallback(
    async (run: RunListItem) => {
      const runId = run.id;
      if (!inputByRunId[runId]) {
        await ensureRowLoaded(runId);
      }
      const input = inputByRunId[runId];
      if (!input) throw new Error('Missing run input');

      // Clone into the Simulation form via the existing share-link mechanism.
      const normalReq = advancedToNormalRequest(input);
      const param = encodeScenarioToShareParam(normalReq);
      const search = new URLSearchParams({ scenario: param }).toString();
      navigate(`/simulation?${search}`);
    },
    [ensureRowLoaded, inputByRunId, navigate]
  );

  const handleSaveScenario = useCallback(
    async (run: RunListItem) => {
      const runId = run.id;
      if (!inputByRunId[runId]) {
        await ensureRowLoaded(runId);
      }
      const input = inputByRunId[runId];
      if (!input) throw new Error('Missing run input');

      const defaultName = `Run ${runId}${run.createdAt ? ` (${fmtDateTime(run.createdAt)})` : ''}`;
      const name = window.prompt('Save scenario as…', defaultName) ?? '';
      if (!name.trim()) return;

      saveScenario(
        name,
        input,
        undefined,
        runId,
        {
          id: runId,
          createdAt: run.createdAt,
          rngSeed: run.rngSeed ?? undefined,
          rngSeedText: run.rngSeedText ?? undefined,
          modelAppVersion: run.modelAppVersion ?? undefined,
          modelBuildTime: run.modelBuildTime ?? undefined,
          modelSpringBootVersion: run.modelSpringBootVersion ?? undefined,
          modelJavaVersion: run.modelJavaVersion ?? undefined,
        }
      );
      window.alert('Saved to Scenarios.');
    },
    [ensureRowLoaded, inputByRunId]
  );

  const handleCsv = useCallback(async (runId: string) => {
    await exportSimulationCsv(runId);
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 1500, margin: '0 auto' }}>
      {/* Under development disclaimer */}
      {!ack && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            border: '1px solid #ffc10755',
            background: 'linear-gradient(0deg, rgba(255,193,7,0.08), rgba(255,193,7,0.08))',
            borderRadius: 10,
          }}
        >
          <strong>Explore (beta):</strong> This page is under development. Data is sample-only;
          filters, pagination, downloads, and “clone to form” are not final.
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setAck(true)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #444',
                backgroundColor: '#2e2e2e',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <h2 style={{ margin: '8px 0 12px' }}>Explore Simulations</h2>

      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <details open style={{ border: '1px solid #3a3a3a', borderRadius: 12, overflow: 'hidden' }}>
          <summary
            style={{
              cursor: 'pointer',
              padding: '10px 12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              background: 'linear-gradient(0deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span>What is Explore?</span>
            <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>Beta</span>
          </summary>
          <div style={{ padding: '10px 12px', lineHeight: 1.5, opacity: 0.92 }}>
            <p style={{ margin: 0 }}>
              <strong>Explore</strong> is a browsing page for inspecting example/curated simulation scenarios and their
              outputs. It’s meant for <strong>learning</strong> and <strong>sanity-checking</strong> how inputs affect
              outcomes — without having to start from a blank form every time.
            </p>
            <ul style={{ margin: '10px 0 0 18px' }}>
              <li>
                Use it to spot patterns: how deposits vs passive growth vs withdrawals change the distribution over time.
              </li>
              <li>
                Use it as a starting point for new scenarios (Clone is coming soon).
              </li>
              <li>
                Use it alongside <Link to="/simulation">Simulation</Link> and <Link to="/diff">Diff</Link> to iterate.
              </li>
            </ul>
          </div>
        </details>

        <details style={{ border: '1px solid #3a3a3a', borderRadius: 12, overflow: 'hidden' }}>
          <summary
            style={{
              cursor: 'pointer',
              padding: '10px 12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              background: 'linear-gradient(0deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span>How to read the table</span>
            <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>Inputs → Outputs</span>
          </summary>
          <div style={{ padding: '10px 12px', lineHeight: 1.5, opacity: 0.92 }}>
            <p style={{ margin: 0 }}>
              Each row contains a full scenario definition (<strong>Inputs</strong>) and a compact summary of outcomes
              (<strong>Outputs</strong>). The outputs shown are not “one prediction” — they’re statistical summaries
              across many Monte Carlo paths.
            </p>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 750, marginBottom: 6 }}>Inputs</div>
              <ul style={{ margin: '0 0 0 18px' }}>
                <li>
                  <strong>Start Date</strong> anchors the calendar. It matters for partial first years and phase boundaries.
                </li>
                <li>
                  <strong>Tax Rule</strong> + <strong>Tax %</strong> describe how gains are taxed.
                </li>
                <li>
                  <strong>Phases</strong> are the lifecycle: DEPOSIT → PASSIVE → WITHDRAW (but you can mix/extend them).
                </li>
              </ul>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 750, marginBottom: 6 }}>Outputs (distribution snapshot)</div>
              <ul style={{ margin: '0 0 0 18px' }}>
                <li>
                  <strong>Median</strong> is the 50th percentile outcome.
                </li>
                <li>
                  <strong>Q25–Q75</strong> is the “middle half” (interquartile range).
                </li>
                <li>
                  <strong>Q5–Q95</strong> shows tail spread (stress vs upside).
                </li>
                <li>
                  <strong>Neg %</strong> is the estimated failure rate (ending below zero) for that year.
                </li>
                <li>
                  <strong>VaR/CVaR</strong> describe loss-risk in the left tail (5% worst-case region).
                </li>
              </ul>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78 }}>
                Tip: open “Show raw outputs (JSON)” to inspect the full per-year series.
              </div>
            </div>
          </div>
        </details>

        <details style={{ border: '1px solid #3a3a3a', borderRadius: 12, overflow: 'hidden' }}>
          <summary
            style={{
              cursor: 'pointer',
              padding: '10px 12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              background: 'linear-gradient(0deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span>How Explore fits into your workflow</span>
            <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 12 }}>Run → Save → Diff</span>
          </summary>
          <div style={{ padding: '10px 12px', lineHeight: 1.5, opacity: 0.92 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                <Link to="/simulation">Run a simulation</Link> (Normal or Advanced mode) when you want full control and charts.
              </li>
              <li>
                Save scenarios so you can rerun them later with identical inputs (important for reproducibility).
              </li>
              <li>
                Use <Link to="/diff">Diff</Link> to compare two scenarios or two runs and see exactly what changed.
              </li>
            </ol>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78 }}>
              Explore will grow into a faster entry point for this loop (view/clone/export buttons are placeholders today).
            </div>
          </div>
        </details>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search runs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            minWidth: 260,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #444',
            background: 'transparent',
            color: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={() => refreshRuns()}
          disabled={runsState === 'loading'}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #444', background: 'transparent', color: 'inherit' }}
        >
          {runsState === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8 }}>
          {filteredRuns.length} run{filteredRuns.length === 1 ? '' : 's'}
        </div>
      </div>

      {runsState === 'error' && runsError && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            border: '1px solid rgba(255,0,0,0.35)',
            background: 'linear-gradient(0deg, rgba(255,0,0,0.10), rgba(255,0,0,0.06))',
            borderRadius: 10,
          }}
        >
          <strong>Failed to load runs:</strong>
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{runsError}</div>
        </div>
      )}

      {/* Table: Inputs | Outputs | Actions */}
      <div style={{ overflow: 'auto', border: '1px solid #3a3a3a', borderRadius: 10, maxHeight: '70vh' }}>
        <table role="grid" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '36%' }} />
            <col style={{ width: '34%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thBase}>Run</th>
              <th style={thBase}>Inputs</th>
              <th style={thBase}>Outputs</th>
              <th style={thBase}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run) => {
              const runId = run.id;
              const rowState = rowStateByRunId[runId] ?? 'idle';
              const rowErr = rowErrorByRunId[runId] ?? null;
              const input = inputByRunId[runId] ?? null;
              const summaries = summariesByRunId[runId] ?? null;
              const open = expandedRunId === runId;

              const timeline = input ? buildTimelineFromAdvancedRequest(input) : null;

              return (
                <React.Fragment key={runId}>
                  <tr>
                    <td style={tdBase}>
                      <div style={{ fontWeight: 800, marginBottom: 6, wordBreak: 'break-word' }}>{runId}</div>
                      <div style={{ fontSize: 12, opacity: 0.8, display: 'grid', rowGap: 4 }}>
                        <div>
                          <Em>Created:</Em> {fmtDateTime(run.createdAt)}
                        </div>
                        <div>
                          <Em>Seed:</Em> {run.rngSeedText ?? (run.rngSeed ?? '—')}
                        </div>
                        <div>
                          <Em>App:</Em> {run.modelAppVersion ?? '—'}
                        </div>
                      </div>
                    </td>

                    <td style={tdBase}>
                      {input ? (
                        <InputsCell input={input} />
                      ) : (
                        <div style={{ opacity: 0.75 }}>
                          {rowState === 'loading' ? 'Loading…' : 'Not loaded yet.'}
                        </div>
                      )}
                    </td>

                    <td style={tdBase}>
                      {summaries ? (
                        <OutputsCell summaries={summaries} />
                      ) : (
                        <div style={{ opacity: 0.75 }}>
                          {rowState === 'loading' ? 'Loading…' : 'Not loaded yet.'}
                        </div>
                      )}
                    </td>

                    <td style={{ ...tdBase, width: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleView(runId)}
                          style={{ padding: '6px 8px' }}
                        >
                          {open ? 'Hide' : 'View'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleClone(run).catch((e) => window.alert(String(e?.message ?? e)))}
                          style={{ padding: '6px 8px' }}
                        >
                          Clone
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveScenario(run).catch((e) => window.alert(String(e?.message ?? e)))}
                          style={{ padding: '6px 8px' }}
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCsv(runId).catch((e) => window.alert(String(e?.message ?? e)))}
                          style={{ padding: '6px 8px' }}
                        >
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>

                  {open && (
                    <tr>
                      <td style={{ ...tdBase, paddingTop: 0 }} colSpan={4}>
                        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: 10 }}>
                          {rowState === 'loading' ? (
                            <div style={{ opacity: 0.85 }}>Loading run details…</div>
                          ) : rowState === 'error' ? (
                            <div style={{ color: '#ffb4b4', whiteSpace: 'pre-wrap' }}>{rowErr}</div>
                          ) : input && summaries ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ fontWeight: 800 }}>Charts</div>
                                <div style={{ fontSize: 12, opacity: 0.8 }}>
                                  Tip: use <Link to="/diff">Diff</Link> to compare saved scenarios.
                                </div>
                              </div>
                              <div style={{ marginTop: 10 }}>
                                <MultiPhaseOverview data={summaries} timeline={timeline} />
                              </div>
                              <details style={{ marginTop: 10 }}>
                                <summary style={{ cursor: 'pointer' }}>Show raw input (JSON)</summary>
                                <pre style={{ marginTop: 8, maxHeight: 320, overflow: 'auto', border: '1px solid #3a3a3a', borderRadius: 10, padding: 8 }}>
{JSON.stringify(input, null, 2)}
                                </pre>
                              </details>
                            </>
                          ) : (
                            <div style={{ opacity: 0.85 }}>No details available.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {filteredRuns.length === 0 && runsState !== 'loading' && (
              <tr>
                <td style={{ ...tdBase, textAlign: 'center' }} colSpan={4}>
                  No persisted runs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        This list shows runs persisted by the backend (DB). Use Save to pin a run as a Scenario.
      </div>
    </div>
  );
};

export default ExplorePage;
