import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import MultiPhaseOverview from '../MultiPhaseOverview';
import SimulationProgress from '../components/SimulationProgress';
import { diffRuns, getRunSummaries, listRuns, startSimulation, type RunDiffResponse, type RunListItem } from '../api/simulation';
import { findScenarioById, listSavedScenarios, type SavedScenario } from '../config/savedScenarios';
import type { SimulationTimelineContext } from '../models/types';
import type { YearlySummary } from '../models/YearlySummary';

const fmt = (v: any): string => {
  if (v === null || v === undefined) return '';
  return String(v);
};

type Mode = 'runs' | 'scenarios';

const computeTimelineFromScenario = (s: SavedScenario | null): SimulationTimelineContext | null => {
  const req = s?.request;
  if (!req?.startDate?.date) return null;
  const types = (req.phases ?? []).map((p) => p.phaseType);
  const months = (req.phases ?? []).map((p) => Number(p.durationInMonths) || 0);
  const firstDeposit = req.phases?.[0]?.phaseType === 'DEPOSIT' ? Number(req.phases?.[0]?.initialDeposit) : undefined;
  return {
    startDate: req.startDate.date,
    phaseTypes: types,
    phaseDurationsInMonths: months,
    firstPhaseInitialDeposit: Number.isFinite(firstDeposit) ? firstDeposit : undefined,
  };
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

const MetricRow: React.FC<{ label: string; a?: string; b?: string; delta?: string; different?: boolean }> = ({
  label,
  a,
  b,
  delta,
  different,
}) => {
  return (
    <div
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

const RunDiffPage: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ----------------
  // Scenario compare (saved scenarios)
  // ----------------

  const savedScenarios = useMemo(() => listSavedScenarios(), []);

  const scenarioFromNavState = (location.state as any) ?? null;
  const scenarioAFromState: SavedScenario | null = scenarioFromNavState?.scenarioA ?? null;
  const scenarioBFromState: SavedScenario | null = scenarioFromNavState?.scenarioB ?? null;

  const scenarioAIdFromQuery = searchParams.get('scenarioA') ?? '';
  const scenarioBIdFromQuery = searchParams.get('scenarioB') ?? '';

  const scenarioAResolved = scenarioAFromState ?? (scenarioAIdFromQuery ? findScenarioById(scenarioAIdFromQuery) ?? null : null);
  const scenarioBResolved = scenarioBFromState ?? (scenarioBIdFromQuery ? findScenarioById(scenarioBIdFromQuery) ?? null : null);

  const [scenarioAId, setScenarioAId] = useState<string>(scenarioAResolved?.id ?? '');
  const [scenarioBId, setScenarioBId] = useState<string>(scenarioBResolved?.id ?? '');

  const scenarioA = useMemo(() => savedScenarios.find((s) => s.id === scenarioAId) ?? null, [savedScenarios, scenarioAId]);
  const scenarioB = useMemo(() => savedScenarios.find((s) => s.id === scenarioBId) ?? null, [savedScenarios, scenarioBId]);

  const timelineA = useMemo(() => computeTimelineFromScenario(scenarioA), [scenarioA]);
  const timelineB = useMemo(() => computeTimelineFromScenario(scenarioB), [scenarioB]);

  const [scenarioSimAId, setScenarioSimAId] = useState<string>('');
  const [scenarioSimBId, setScenarioSimBId] = useState<string>('');
  const [scenarioSummariesA, setScenarioSummariesA] = useState<YearlySummary[] | null>(null);
  const [scenarioSummariesB, setScenarioSummariesB] = useState<YearlySummary[] | null>(null);
  const [scenarioErr, setScenarioErr] = useState<string | null>(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);

  useEffect(() => {
    if (!scenarioBusy) return;
    if (scenarioSummariesA && scenarioSummariesB) setScenarioBusy(false);
  }, [scenarioBusy, scenarioSummariesA, scenarioSummariesB]);

  const canCompareScenarios = Boolean(scenarioA && scenarioB && scenarioA.id !== scenarioB.id && !scenarioBusy);

  const startScenarioCompare = useCallback(async () => {
    if (!scenarioA || !scenarioB) return;
    setScenarioErr(null);
    setScenarioBusy(true);
    setScenarioSummariesA(null);
    setScenarioSummariesB(null);

    try {
      const [idA, idB] = await Promise.all([
        startSimulation(scenarioA.request),
        startSimulation(scenarioB.request),
      ]);
      setScenarioSimAId(idA);
      setScenarioSimBId(idB);
    } catch (e: any) {
      setScenarioErr(e?.message ?? 'Failed to start scenario comparison');
      setScenarioBusy(false);
    }
  }, [scenarioA, scenarioB]);

  // Auto-start if we arrived here via the Saved scenarios Compare button.
  useEffect(() => {
    const cameFromCompare = Boolean(scenarioAResolved && scenarioBResolved);
    if (!cameFromCompare) return;
    if (!scenarioAResolved || !scenarioBResolved) return;
    // Only auto-start once.
    if (scenarioSimAId || scenarioSimBId || scenarioSummariesA || scenarioSummariesB) return;
    startScenarioCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------
  // Run diff (persisted runs)
  // ----------------

  const [mode, setMode] = useState<Mode>(() => (scenarioAResolved && scenarioBResolved ? 'scenarios' : 'runs'));

  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');

  const [diff, setDiff] = useState<RunDiffResponse | null>(null);
  const [diffErr, setDiffErr] = useState<string | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);

  const [runSummariesA, setRunSummariesA] = useState<YearlySummary[] | null>(null);
  const [runSummariesB, setRunSummariesB] = useState<YearlySummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadErr(null);
    listRuns()
      .then((data) => {
        if (!alive) return;
        setRuns(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadErr(e?.message ?? 'Failed to load runs');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, RunListItem>();
    for (const r of runs) {
      if (r?.id) m.set(r.id, r);
    }
    return m;
  }, [runs]);

  const aInfo = aId ? byId.get(aId) : undefined;
  const bInfo = bId ? byId.get(bId) : undefined;

  const canDiff = aId && bId && aId !== bId && !diffBusy;

  const attributionLine = (d: RunDiffResponse | null): string | null => {
    const s = d?.attribution?.summary;
    return s ? String(s) : null;
  };

  return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Simulation diff</h2>
        <Link to="/simulation" style={{ textDecoration: 'none' }}>← Back</Link>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setMode('runs')}
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #444',
            background: mode === 'runs' ? '#2e2e2e' : 'transparent',
            color: '#ddd',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 650,
          }}
          aria-pressed={mode === 'runs'}
        >
          Two runs
        </button>
        <button
          type="button"
          onClick={() => setMode('scenarios')}
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #444',
            background: mode === 'scenarios' ? '#2e2e2e' : 'transparent',
            color: '#ddd',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 650,
          }}
          aria-pressed={mode === 'scenarios'}
        >
          Two saved scenarios
        </button>
      </div>

      {mode === 'scenarios' ? (
        <>
          <p style={{ opacity: 0.85, marginTop: 10 }}>
            Select two saved scenarios and click <strong>Compare</strong>. You’ll see key metrics and charts side-by-side.
          </p>

          <div style={{
            border: '1px solid #444', borderRadius: 12, padding: 12,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Scenario A</div>
              <select
                value={scenarioAId}
                onChange={(e) => setScenarioAId(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
                disabled={scenarioBusy}
              >
                <option value="">Select…</option>
                {savedScenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Scenario B</div>
              <select
                value={scenarioBId}
                onChange={(e) => setScenarioBId(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
                disabled={scenarioBusy}
              >
                <option value="">Select…</option>
                {savedScenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {scenarioErr && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid #ff6b6b55', background: 'rgba(255,107,107,0.10)' }}>
              {scenarioErr}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button
              type="button"
              disabled={!canCompareScenarios}
              onClick={startScenarioCompare}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #444',
                cursor: canCompareScenarios ? 'pointer' : 'not-allowed',
                opacity: canCompareScenarios ? 1 : 0.6,
              }}
            >
              {scenarioBusy ? 'Starting…' : 'Compare'}
            </button>
            {scenarioAId && scenarioBId && scenarioAId === scenarioBId && (
              <div style={{ fontSize: 13, opacity: 0.85 }}>Select two different scenarios.</div>
            )}
          </div>

          {(scenarioSimAId || scenarioSimBId) && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ border: '1px solid #444', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{scenarioA?.name ?? 'Scenario A'}</div>
                {scenarioSimAId && !scenarioSummariesA && (
                  <SimulationProgress
                    simulationId={scenarioSimAId}
                    onComplete={(result) => {
                      setScenarioSummariesA(result);
                    }}
                  />
                )}
                {scenarioSummariesA && (
                  <MultiPhaseOverview data={scenarioSummariesA} timeline={timelineA} />
                )}
              </div>
              <div style={{ border: '1px solid #444', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{scenarioB?.name ?? 'Scenario B'}</div>
                {scenarioSimBId && !scenarioSummariesB && (
                  <SimulationProgress
                    simulationId={scenarioSimBId}
                    onComplete={(result) => {
                      setScenarioSummariesB(result);
                    }}
                  />
                )}
                {scenarioSummariesB && (
                  <MultiPhaseOverview data={scenarioSummariesB} timeline={timelineB} />
                )}
              </div>
            </div>
          )}

          {scenarioSummariesA && scenarioSummariesB && (
            <div style={{ marginTop: 12, border: '1px solid #444', borderRadius: 12, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 12, fontWeight: 800 }}>Key metrics</div>

              {(() => {
                const lastPhaseA = scenarioA?.request?.phases?.at(-1)?.phaseType;
                const lastPhaseB = scenarioB?.request?.phases?.at(-1)?.phaseType;
                const lastA = pickLastEntry(scenarioSummariesA, lastPhaseA ?? undefined);
                const lastB = pickLastEntry(scenarioSummariesB, lastPhaseB ?? undefined);

                const medA = lastA ? lastA.medianCapital : null;
                const medB = lastB ? lastB.medianCapital : null;
                const failA = lastA ? lastA.negativeCapitalPercentage : null;
                const failB = lastB ? lastB.negativeCapitalPercentage : null;

                const dMed = medA !== null && medB !== null ? medB - medA : null;
                const dFail = failA !== null && failB !== null ? failB - failA : null;

                const fmtMoney = (v: number | null) => (v === null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v));
                const fmtPct = (v: number | null) => (v === null ? '—' : `${Number(v).toFixed(2)}%`);
                const fmtDeltaMoney = (v: number | null) => (v === null ? '' : `${v >= 0 ? '+' : ''}${fmtMoney(v)}`);
                const fmtDeltaPct = (v: number | null) => (v === null ? '' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`);

                return (
                  <>
                    <MetricRow
                      label="End-of-sim median capital"
                      a={fmtMoney(medA)}
                      b={fmtMoney(medB)}
                      delta={fmtDeltaMoney(dMed)}
                      different={Boolean(dMed && Math.abs(dMed) > 1e-6)}
                    />
                    <MetricRow
                      label="End-of-sim failure rate (negative capital %)"
                      a={fmtPct(failA)}
                      b={fmtPct(failB)}
                      delta={fmtDeltaPct(dFail)}
                      different={Boolean(dFail && Math.abs(dFail) > 1e-9)}
                    />
                  </>
                );
              })()}
            </div>
          )}
        </>
      ) : (
        <>
          <p style={{ opacity: 0.85, marginTop: 10 }}>
            Pick two completed (persisted) runs. The diff attributes output differences to <strong>inputs</strong>,
            <strong> model version</strong>, and/or <strong>randomness</strong>.
          </p>

      <div style={{
        border: '1px solid #444', borderRadius: 12, padding: 12,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Run A</div>
          <select
            value={aId}
            onChange={(e) => setAId(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
            disabled={loading}
          >
            <option value="">Select…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} {r.createdAt ? `(${r.createdAt})` : ''}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            Version: {fmt(aInfo?.modelAppVersion) || 'unknown'}
            <br />
            Seed: {aInfo?.rngSeed ?? '—'}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Run B</div>
          <select
            value={bId}
            onChange={(e) => setBId(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
            disabled={loading}
          >
            <option value="">Select…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} {r.createdAt ? `(${r.createdAt})` : ''}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            Version: {fmt(bInfo?.modelAppVersion) || 'unknown'}
            <br />
            Seed: {bInfo?.rngSeed ?? '—'}
          </div>
        </div>
      </div>

      {loadErr && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid #ff6b6b55', background: 'rgba(255,107,107,0.10)' }}>
          {loadErr}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <button
          type="button"
          disabled={!canDiff}
          onClick={async () => {
            setDiffErr(null);
            setDiff(null);
            setRunSummariesA(null);
            setRunSummariesB(null);
            setDiffBusy(true);
            try {
              const [d, sa, sb] = await Promise.all([
                diffRuns(aId, bId),
                getRunSummaries(aId),
                getRunSummaries(bId),
              ]);
              setDiff(d);
              setRunSummariesA(sa);
              setRunSummariesB(sb);
            } catch (e: any) {
              setDiffErr(e?.message ?? 'Diff failed');
            } finally {
              setDiffBusy(false);
            }
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #444',
            cursor: canDiff ? 'pointer' : 'not-allowed',
            opacity: canDiff ? 1 : 0.6,
          }}
        >
          {diffBusy ? 'Diffing…' : 'Diff'}
        </button>
        {aId && bId && aId === bId && (
          <div style={{ fontSize: 13, opacity: 0.85 }}>Select two different runs.</div>
        )}
      </div>

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
            <span>inputsChanged: {String(Boolean(diff.attribution?.inputsChanged))}</span>
            <span>randomnessChanged: {String(Boolean(diff.attribution?.randomnessChanged))}</span>
            <span>modelVersionChanged: {String(Boolean(diff.attribution?.modelVersionChanged))}</span>
          </div>

          <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #444' }} />

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Outputs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>exactMatch</div>
              <div style={{ fontWeight: 700 }}>{String(Boolean(diff.output?.exactMatch))}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>withinTolerance</div>
              <div style={{ fontWeight: 700 }}>{String(Boolean(diff.output?.withinTolerance))}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>mismatches</div>
              <div style={{ fontWeight: 700 }}>{fmt(diff.output?.mismatches) || '0'}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>max |Δ|</div>
              <div style={{ fontWeight: 700 }}>{fmt(diff.output?.maxAbsDiff) || '0'}</div>
            </div>
          </div>

          {(runSummariesA && runSummariesB) && (
            <>
              <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #444' }} />
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Charts</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 750, marginBottom: 6 }}>Run A</div>
                  <MultiPhaseOverview data={runSummariesA} timeline={null} />
                </div>
                <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 750, marginBottom: 6 }}>Run B</div>
                  <MultiPhaseOverview data={runSummariesB} timeline={null} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default RunDiffPage;
