import React, { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MultiPhaseOverview from '../MultiPhaseOverview';
import { diffRuns, findRunForInput, getCompletedSummaries, getRunInput, getRunSummaries, listRuns, startAdvancedSimulation, type RunDiffResponse, type RunListItem, type StartRunResponse } from '../api/simulation';
import SimulationProgress from '../components/SimulationProgress';
import { isRandomSeedRequested, listSavedScenarios, materializeRandomSeedIfNeeded, saveScenario, updateScenarioRunMeta, type SavedScenario } from '../config/savedScenarios';
import type { YearlySummary } from '../models/YearlySummary';
import { deepEqual } from '../utils/deepEqual';
import { summarizeScenario, type ScenarioSummary } from '../utils/summarizeScenario';

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

const formatMoney0 = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
};

const formatPct2 = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return '—';
  return `${Number(v).toFixed(2)}%`;
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

const formatDeltaMonths = (months: number | null | undefined): string => {
  if (months === null || months === undefined) return '';
  const prefix = months >= 0 ? '+' : '';
  return `${prefix}${months}m`;
};

const formatTaxExemptionsActive = (phase?: ScenarioSummary['phases'][number]): string => {
  if (!phase?.taxExemptionsActive) return '—';
  const parts: string[] = [];
  if (phase.taxExemptionsActive.card) parts.push('Card');
  if (phase.taxExemptionsActive.stock) parts.push('Stock');
  return parts.length ? parts.join(', ') : 'None';
};

const toScenarioSummary = (scenario: SavedScenario | null): ScenarioSummary | null => {
  try {
    if (!scenario?.advancedRequest) return null;
    // Always summarize from advancedRequest so returnType/seed/inflation/yearlyFee/etc are present.
    return summarizeScenario(scenario.advancedRequest);
  } catch {
    return null;
  }
};

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

const isRandomRequested = (scenario: SavedScenario): boolean => isRandomSeedRequested(scenario.advancedRequest);

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

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => listSavedScenarios());
  const refreshSavedScenarios = useCallback(() => setSavedScenarios(listSavedScenarios()), []);
  const scenarioAFromQuery = searchParams.get('scenarioA') ?? '';
  const scenarioBFromQuery = searchParams.get('scenarioB') ?? '';

  const [scenarioAId, setScenarioAId] = useState<string>(() => scenarioAFromQuery || '');
  const [scenarioBId, setScenarioBId] = useState<string>(() => scenarioBFromQuery || '');

  const scenarioA = useMemo(() => savedScenarios.find((s) => s.id === scenarioAId) ?? null, [savedScenarios, scenarioAId]);
  const scenarioB = useMemo(() => savedScenarios.find((s) => s.id === scenarioBId) ?? null, [savedScenarios, scenarioBId]);


  const [diff, setDiff] = useState<RunDiffResponse | null>(null);
  const [diffErr, setDiffErr] = useState<string | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);

  const [runSummariesA, setRunSummariesA] = useState<YearlySummary[] | null>(null);
  const [runSummariesB, setRunSummariesB] = useState<YearlySummary[] | null>(null);

  const [inputSummaryA, setInputSummaryA] = useState<ScenarioSummary | null>(null);
  const [inputSummaryB, setInputSummaryB] = useState<ScenarioSummary | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  const [rerunAId, setRerunAId] = useState<string | null>(null);
  const [rerunBId, setRerunBId] = useState<string | null>(null);

  const canDiff = Boolean(scenarioA && scenarioB && scenarioA.id !== scenarioB.id && !diffBusy);

  const attributionLine = (d: RunDiffResponse | null): string | null => {
    const s = d?.attribution?.summary;
    return s ? String(s) : null;
  };

  const ensureDeterministicScenario = useCallback((scenario: SavedScenario): SavedScenario => {
    if (!isRandomSeedRequested(scenario.advancedRequest)) return scenario;

    const pinnedReq = materializeRandomSeedIfNeeded(
      scenario.advancedRequest,
      scenario.lastRunMeta?.rngSeed ?? null
    );

    const pinnedSeed = (pinnedReq as any)?.seed ?? (pinnedReq as any)?.returnerConfig?.seed;
    const nextMeta =
      scenario.lastRunMeta && pinnedSeed != null
        ? { ...scenario.lastRunMeta, rngSeed: Number(pinnedSeed) }
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
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Simulation diff</h2>
        <Link to="/simulation" style={{ textDecoration: 'none' }}>← Back</Link>
      </div>

      <p style={{ opacity: 0.85, marginTop: 10 }}>
        Pick two saved scenarios. If their persisted runs aren’t found, we re-run them from the saved scenario footprint.
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
          >
            <option value="">Select…</option>
            {savedScenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
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
              <div style={{ fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>Scenario A re-run progress</div>
              <SimulationProgress
                simulationId={rerunAId}
                onDismiss={() => setRerunAId(null)}
                onComplete={() => { /* handled by polling */ }}
              />
            </div>
          )}
          {rerunBId && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>Scenario B re-run progress</div>
              <SimulationProgress
                simulationId={rerunBId}
                onDismiss={() => setRerunBId(null)}
                onComplete={() => { /* handled by polling */ }}
              />
            </div>
          )}
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

              // Inputs: always summarize from the saved advancedRequest so advanced parameters are present.
              setInputSummaryA(toScenarioSummary(scenarioAStable));
              setInputSummaryB(toScenarioSummary(scenarioBStable));

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
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #444',
            cursor: canDiff ? 'pointer' : 'not-allowed',
            opacity: canDiff ? 1 : 0.6,
          }}
        >
          {diffBusy ? 'Diffing…' : 'Diff'}
        </button>
        {scenarioAId && scenarioBId && scenarioAId === scenarioBId && (
          <div style={{ fontSize: 13, opacity: 0.85 }}>Select two different scenarios.</div>
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

          <div style={{ marginTop: 10, border: '1px solid #333', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr', gap: 10, padding: '8px 10px', background: '#1a1a1a', fontWeight: 700, fontSize: 12 }}>
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
                const effective = (requested !== null && requested !== undefined && Number(requested) < 0)
                  ? diff?.a?.rngSeed
                  : requested;
                return effective !== null && effective !== undefined ? String(effective) : '—';
              })()}
              b={(() => {
                const requested = inputSummaryB?.advancedMode?.seed;
                const effective = (requested !== null && requested !== undefined && Number(requested) < 0)
                  ? diff?.b?.rngSeed
                  : requested;
                return effective !== null && effective !== undefined ? String(effective) : '—';
              })()}
              delta={(() => {
                const ra = inputSummaryA?.advancedMode?.seed;
                const rb = inputSummaryB?.advancedMode?.seed;
                const a = (ra !== null && ra !== undefined && Number(ra) < 0) ? diff?.a?.rngSeed : ra;
                const b = (rb !== null && rb !== undefined && Number(rb) < 0) ? diff?.b?.rngSeed : rb;
                if (a === null || a === undefined || b === null || b === undefined) return '';
                const na = Number(a);
                const nb = Number(b);
                if (!Number.isFinite(na) || !Number.isFinite(nb)) return '';
                return String(nb - na);
              })()}
              different={(() => {
                const ra = inputSummaryA?.advancedMode?.seed;
                const rb = inputSummaryB?.advancedMode?.seed;
                const a = (ra !== null && ra !== undefined && Number(ra) < 0) ? diff?.a?.rngSeed : ra;
                const b = (rb !== null && rb !== undefined && Number(rb) < 0) ? diff?.b?.rngSeed : rb;
                return Boolean(a !== b);
              })()}
            />
          </div>

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Inputs</div>

          {(inputSummaryA || inputSummaryB) ? (
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
                a={inputSummaryA ? String(inputSummaryA.totalMonths) : '—'}
                b={inputSummaryB ? String(inputSummaryB.totalMonths) : '—'}
                delta={inputSummaryA && inputSummaryB ? String(inputSummaryB.totalMonths - inputSummaryA.totalMonths) : ''}
                different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.totalMonths !== inputSummaryB.totalMonths)}
              />
              <MetricRow
                label="Phase pattern"
                a={inputSummaryA?.phasePattern || '—'}
                b={inputSummaryB?.phasePattern || '—'}
                different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.phasePattern !== inputSummaryB.phasePattern)}
              />
              <MetricRow
                label="Total initial deposit"
                a={formatMoney0(inputSummaryA?.totalInitialDeposit)}
                b={formatMoney0(inputSummaryB?.totalInitialDeposit)}
                delta={inputSummaryA && inputSummaryB ? formatDeltaMoney0(inputSummaryB.totalInitialDeposit - inputSummaryA.totalInitialDeposit) : ''}
                different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.totalInitialDeposit !== inputSummaryB.totalInitialDeposit)}
              />
              <MetricRow
                label="Total monthly deposits"
                a={formatMoney0(inputSummaryA?.totalMonthlyDeposits)}
                b={formatMoney0(inputSummaryB?.totalMonthlyDeposits)}
                delta={inputSummaryA && inputSummaryB ? formatDeltaMoney0(inputSummaryB.totalMonthlyDeposits - inputSummaryA.totalMonthlyDeposits) : ''}
                different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.totalMonthlyDeposits !== inputSummaryB.totalMonthlyDeposits)}
              />
              <MetricRow
                label="Total withdrawals"
                a={formatMoney0(inputSummaryA?.totalWithdrawAmount)}
                b={formatMoney0(inputSummaryB?.totalWithdrawAmount)}
                delta={inputSummaryA && inputSummaryB ? formatDeltaMoney0(inputSummaryB.totalWithdrawAmount - inputSummaryA.totalWithdrawAmount) : ''}
                different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.totalWithdrawAmount !== inputSummaryB.totalWithdrawAmount)}
              />
              <MetricRow
                label="Withdraw-rate phases"
                a={inputSummaryA ? String(inputSummaryA.withdrawRatePhaseCount) : '—'}
                b={inputSummaryB ? String(inputSummaryB.withdrawRatePhaseCount) : '—'}
                delta={inputSummaryA && inputSummaryB ? String(inputSummaryB.withdrawRatePhaseCount - inputSummaryA.withdrawRatePhaseCount) : ''}
                different={Boolean(inputSummaryA && inputSummaryB && inputSummaryA.withdrawRatePhaseCount !== inputSummaryB.withdrawRatePhaseCount)}
              />

              {/* Advanced mode details */}
              {(inputSummaryA?.advancedMode || inputSummaryB?.advancedMode) && (
                <>
                  <div style={{ padding: '10px', background: '#1a1a1a', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Advanced Mode Details
                  </div>
                  
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
                        label="  Exemption Card limit"
                        a={inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== undefined ? formatMoney0(inputSummaryA.advancedMode.taxExemptionConfig.exemptionCard.limit) : '—'}
                        b={inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== undefined ? formatMoney0(inputSummaryB.advancedMode.taxExemptionConfig.exemptionCard.limit) : '—'}
                        delta={inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== undefined && inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== undefined ? formatDeltaMoney0(inputSummaryB.advancedMode.taxExemptionConfig.exemptionCard.limit - inputSummaryA.advancedMode.taxExemptionConfig.exemptionCard.limit) : ''}
                        different={Boolean(inputSummaryA?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit !== inputSummaryB?.advancedMode?.taxExemptionConfig?.exemptionCard?.limit)}
                      />
                      <MetricRow
                        label="  Stock exemption tax rate"
                        a={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== undefined ? formatPct2(inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.taxRate) : '—'}
                        b={inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== undefined ? formatPct2(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.taxRate) : '—'}
                        delta={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== undefined && inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== undefined ? formatDeltaPct2(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.taxRate - inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.taxRate) : ''}
                        different={Boolean(inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate !== inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.taxRate)}
                      />
                      <MetricRow
                        label="  Stock exemption limit"
                        a={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== undefined ? formatMoney0(inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.limit) : '—'}
                        b={inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== undefined ? formatMoney0(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.limit) : '—'}
                        delta={inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== undefined && inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== undefined ? formatDeltaMoney0(inputSummaryB.advancedMode.taxExemptionConfig.stockExemption.limit - inputSummaryA.advancedMode.taxExemptionConfig.stockExemption.limit) : ''}
                        different={Boolean(inputSummaryA?.advancedMode?.taxExemptionConfig?.stockExemption?.limit !== inputSummaryB?.advancedMode?.taxExemptionConfig?.stockExemption?.limit)}
                      />
                    </>
                  )}
                </>
              )}

              {/* Phase-by-phase breakdown */}
              {(inputSummaryA?.phases ?? []).length > 0 || (inputSummaryB?.phases ?? []).length > 0 ? (
                <>
                  <div style={{ padding: '10px', background: '#1a1a1a', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Per-Phase Details
                  </div>
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
                          delta={phaseA && phaseB ? formatDeltaMonths(phaseB.durationInMonths - phaseA.durationInMonths) : ''}
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

                        {/* Tax exemptions for this phase */}
                        {(phaseA?.taxExemptions || phaseB?.taxExemptions) && (
                          <>
                            {(phaseA?.taxExemptions?.exemptionCard || phaseB?.taxExemptions?.exemptionCard) && (
                              <>
                                <MetricRow
                                  label="  Tax exemption: Card limit"
                                  a={phaseA?.taxExemptions?.exemptionCard?.limit ? `$${formatMoney0(phaseA.taxExemptions.exemptionCard.limit)}` : '—'}
                                  b={phaseB?.taxExemptions?.exemptionCard?.limit ? `$${formatMoney0(phaseB.taxExemptions.exemptionCard.limit)}` : '—'}
                                  delta={phaseA?.taxExemptions?.exemptionCard?.limit && phaseB?.taxExemptions?.exemptionCard?.limit ? formatDeltaMoney0(phaseB.taxExemptions.exemptionCard.limit - phaseA.taxExemptions.exemptionCard.limit) : ''}
                                  different={phaseA?.taxExemptions?.exemptionCard?.limit !== phaseB?.taxExemptions?.exemptionCard?.limit}
                                />
                                <MetricRow
                                  label="  Tax exemption: Card yearly increase %"
                                  a={phaseA?.taxExemptions?.exemptionCard?.yearlyIncrease ? formatPct2(phaseA.taxExemptions.exemptionCard.yearlyIncrease) : '—'}
                                  b={phaseB?.taxExemptions?.exemptionCard?.yearlyIncrease ? formatPct2(phaseB.taxExemptions.exemptionCard.yearlyIncrease) : '—'}
                                  delta={phaseA?.taxExemptions?.exemptionCard?.yearlyIncrease && phaseB?.taxExemptions?.exemptionCard?.yearlyIncrease ? formatDeltaPct2(phaseB.taxExemptions.exemptionCard.yearlyIncrease - phaseA.taxExemptions.exemptionCard.yearlyIncrease) : ''}
                                  different={phaseA?.taxExemptions?.exemptionCard?.yearlyIncrease !== phaseB?.taxExemptions?.exemptionCard?.yearlyIncrease}
                                />
                              </>
                            )}
                            {(phaseA?.taxExemptions?.stockExemption || phaseB?.taxExemptions?.stockExemption) && (
                              <>
                                <MetricRow
                                  label="  Tax exemption: Stock tax rate %"
                                  a={phaseA?.taxExemptions?.stockExemption?.taxRate ? formatPct2(phaseA.taxExemptions.stockExemption.taxRate) : '—'}
                                  b={phaseB?.taxExemptions?.stockExemption?.taxRate ? formatPct2(phaseB.taxExemptions.stockExemption.taxRate) : '—'}
                                  delta={phaseA?.taxExemptions?.stockExemption?.taxRate && phaseB?.taxExemptions?.stockExemption?.taxRate ? formatDeltaPct2(phaseB.taxExemptions.stockExemption.taxRate - phaseA.taxExemptions.stockExemption.taxRate) : ''}
                                  different={phaseA?.taxExemptions?.stockExemption?.taxRate !== phaseB?.taxExemptions?.stockExemption?.taxRate}
                                />
                                <MetricRow
                                  label="  Tax exemption: Stock limit"
                                  a={phaseA?.taxExemptions?.stockExemption?.limit ? `$${formatMoney0(phaseA.taxExemptions.stockExemption.limit)}` : '—'}
                                  b={phaseB?.taxExemptions?.stockExemption?.limit ? `$${formatMoney0(phaseB.taxExemptions.stockExemption.limit)}` : '—'}
                                  delta={phaseA?.taxExemptions?.stockExemption?.limit && phaseB?.taxExemptions?.stockExemption?.limit ? formatDeltaMoney0(phaseB.taxExemptions.stockExemption.limit - phaseA.taxExemptions.stockExemption.limit) : ''}
                                  different={phaseA?.taxExemptions?.stockExemption?.limit !== phaseB?.taxExemptions?.stockExemption?.limit}
                                />
                                <MetricRow
                                  label="  Tax exemption: Stock yearly increase %"
                                  a={phaseA?.taxExemptions?.stockExemption?.yearlyIncrease ? formatPct2(phaseA.taxExemptions.stockExemption.yearlyIncrease) : '—'}
                                  b={phaseB?.taxExemptions?.stockExemption?.yearlyIncrease ? formatPct2(phaseB.taxExemptions.stockExemption.yearlyIncrease) : '—'}
                                  delta={phaseA?.taxExemptions?.stockExemption?.yearlyIncrease && phaseB?.taxExemptions?.stockExemption?.yearlyIncrease ? formatDeltaPct2(phaseB.taxExemptions.stockExemption.yearlyIncrease - phaseA.taxExemptions.stockExemption.yearlyIncrease) : ''}
                                  different={phaseA?.taxExemptions?.stockExemption?.yearlyIncrease !== phaseB?.taxExemptions?.stockExemption?.yearlyIncrease}
                                />
                              </>
                            )}
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
                </>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.85 }}>Input summary unavailable.</div>
          )}

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
                      a={formatMoney0(avgA)}
                      b={formatMoney0(avgB)}
                      delta={formatDeltaMoney0(dAvg)}
                      different={Boolean(dAvg && Math.abs(dAvg) > 1e-6)}
                    />
                    <MetricRow
                      label="End median capital"
                      a={formatMoney0(medA)}
                      b={formatMoney0(medB)}
                      delta={formatDeltaMoney0(dMed)}
                      different={Boolean(dMed && Math.abs(dMed) > 1e-6)}
                    />
                    <MetricRow
                      label="End worst-case (5th percentile)"
                      a={formatMoney0(q05A)}
                      b={formatMoney0(q05B)}
                      delta={formatDeltaMoney0(dQ05)}
                      different={Boolean(dQ05 && Math.abs(dQ05) > 1e-6)}
                    />
                    <MetricRow
                      label="End best-case (95th percentile)"
                      a={formatMoney0(q95A)}
                      b={formatMoney0(q95B)}
                      delta={formatDeltaMoney0(dQ95)}
                      different={Boolean(dQ95 && Math.abs(dQ95) > 1e-6)}
                    />
                    <MetricRow
                      label="End VaR"
                      a={formatMoney0(varA)}
                      b={formatMoney0(varB)}
                      delta={formatDeltaMoney0(dVar)}
                      different={Boolean(dVar && Math.abs(dVar) > 1e-6)}
                    />
                    <MetricRow
                      label="End CVaR"
                      a={formatMoney0(cvarA)}
                      b={formatMoney0(cvarB)}
                      delta={formatDeltaMoney0(dCvar)}
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
    </div>
  );
};

export default RunDiffPage;
