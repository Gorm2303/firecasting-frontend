import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MultiPhaseOverview from '../MultiPhaseOverview';
import { diffRuns, getRunInput, getRunSummaries, listRuns, type RunDiffResponse, type RunListItem } from '../api/simulation';
import type { YearlySummary } from '../models/YearlySummary';
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

const toScenarioSummary = (input: unknown): ScenarioSummary | null => {
  if (!input || typeof input !== 'object') return null;
  const req: any = input;
  if (!req?.startDate?.date || !Array.isArray(req?.phases)) return null;
  try {
    return summarizeScenario(req);
  } catch {
    return null;
  }
};

const RunDiffPage: React.FC = () => {
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

  const [inputSummaryA, setInputSummaryA] = useState<ScenarioSummary | null>(null);
  const [inputSummaryB, setInputSummaryB] = useState<ScenarioSummary | null>(null);
  const [inputErr, setInputErr] = useState<string | null>(null);

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
            setInputSummaryA(null);
            setInputSummaryB(null);
            setInputErr(null);
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

              const inputResults = await Promise.allSettled([
                getRunInput(aId),
                getRunInput(bId),
              ]);

              if (inputResults[0].status === 'fulfilled') {
                setInputSummaryA(toScenarioSummary(inputResults[0].value));
              } else {
                setInputErr(inputResults[0].reason?.message ?? 'Failed to load input for Run A');
              }

              if (inputResults[1].status === 'fulfilled') {
                setInputSummaryB(toScenarioSummary(inputResults[1].value));
              } else {
                setInputErr((prev) => prev ?? (inputResults[1].reason?.message ?? 'Failed to load input for Run B'));
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

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Inputs</div>

          {inputErr && (
            <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: '1px solid #ff6b6b55', background: 'rgba(255,107,107,0.10)' }}>
              {inputErr}
            </div>
          )}

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
