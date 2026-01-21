// src/pages/SimulationPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import NormalInputForm from '../components/normalMode/NormalInputForm';
import AdvancedInputForm from '../components/advancedMode/AdvancedInputForm';
import { YearlySummary } from '../models/YearlySummary';
import { SimulationRequest, SimulationTimelineContext } from '../models/types';
import MultiPhaseOverview from '../MultiPhaseOverview';
import { Link } from 'react-router-dom';
import ExportStatisticsButton from '../components/ExportStatisticsButton';
import { exportRunBundle, exportSimulationCsv, getCompletedSummaries, getReplayStatus, importRunBundle, ReplayStatusResponse } from '../api/simulation';
import SimulationProgress from '../components/SimulationProgress';

type FormMode = 'normal' | 'advanced';

const FORM_MODE_KEY = 'firecasting:formMode';
const AUTO_EXPORT_SIM_CSV_KEY = 'firecasting:autoExportSimulationCsv';

const toIsoDateString = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v?.date === 'string') return v.date;
  // Backend may persist/echo LocalDate-like objects.
  const y = Number(v?.year);
  const m = Number(v?.month);
  const d = Number(v?.dayOfMonth);
  if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) && y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
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

const getInitialFormMode = (): FormMode => {
  if (typeof window === 'undefined') return 'normal';
  const v = window.localStorage.getItem(FORM_MODE_KEY);
  return v === 'advanced' ? 'advanced' : 'normal';
};

const tryBuildTimelineFromBundle = (bundle: any): SimulationTimelineContext | null => {
  try {
    const explicit = bundle?.timeline;
    if (explicit) {
      const startDate = toIsoDateString(explicit?.startDate) ?? (typeof explicit?.startDate === 'string' ? explicit.startDate : null);
      const phaseTypes: any[] = Array.isArray(explicit?.phaseTypes) ? explicit.phaseTypes : [];
      const phaseDurationsInMonths: number[] = Array.isArray(explicit?.phaseDurationsInMonths)
        ? explicit.phaseDurationsInMonths.map((x: any) => Number(x) || 0)
        : [];
      if (startDate && phaseTypes.length && phaseDurationsInMonths.length) {
        return {
          startDate,
          phaseTypes: phaseTypes.filter(Boolean),
          phaseDurationsInMonths,
          firstPhaseInitialDeposit:
            explicit?.firstPhaseInitialDeposit !== undefined ? Number(explicit.firstPhaseInitialDeposit) : undefined,
        };
      }
    }

    const raw = bundle?.inputs?.raw;
    if (!raw) return null;

    const startDate = toIsoDateString(raw?.startDate);
    const phases: any[] = Array.isArray(raw?.phases) ? raw.phases : [];
    if (!startDate || !phases.length) return null;

    const phaseTypes = phases
      .map((p) => p?.phaseType ?? p?.type)
      .filter(Boolean);
    const phaseDurationsInMonths = phases
      .map((p) => Number(p?.durationInMonths) || 0);

    return {
      startDate: String(startDate),
      phaseTypes,
      phaseDurationsInMonths,
      firstPhaseInitialDeposit:
        phases[0]?.initialDeposit !== undefined ? Number(phases[0]?.initialDeposit) : undefined,
    };
  } catch {
    return null;
  }
};

const SimulationPage: React.FC = () => {
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [timeline, setTimeline] = useState<SimulationTimelineContext | null>(null);
  const [lastCompletedSimulationId, setLastCompletedSimulationId] = useState<string | null>(null);
  const [ackSim, setAckSim] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(getInitialFormMode);

  const [externalNormalLoad, setExternalNormalLoad] = useState<SimulationRequest | null>(null);
  const [externalNormalLoadNonce, setExternalNormalLoadNonce] = useState(0);
  const [externalAdvancedLoad, setExternalAdvancedLoad] = useState<any | null>(null);
  const [externalAdvancedLoadNonce, setExternalAdvancedLoadNonce] = useState(0);

  const [isIoModalOpen, setIsIoModalOpen] = useState(false);
  const [autoExportSimulationCsv, setAutoExportSimulationCsv] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(AUTO_EXPORT_SIM_CSV_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [importSimulationId, setImportSimulationId] = useState<string | null>(null);
  const [importReplayId, setImportReplayId] = useState<string | null>(null);
  const [replayReport, setReplayReport] = useState<ReplayStatusResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(FORM_MODE_KEY, formMode); } catch {}
  }, [formMode]);

  useEffect(() => {
    try { window.localStorage.setItem(AUTO_EXPORT_SIM_CSV_KEY, String(autoExportSimulationCsv)); } catch {}
  }, [autoExportSimulationCsv]);

  const setFormModeByUser = (mode: FormMode) => {
    setStats(null);
    setTimeline(null);
    setLastCompletedSimulationId(null);
    setImportSimulationId(null);
    setImportReplayId(null);
    setReplayReport(null);
    setFormMode(mode);
  };

  const handleSimulationComplete = (results: YearlySummary[], ctx?: SimulationTimelineContext, simulationId?: string) => {
    setStats(results);
    setTimeline(ctx ?? null);
    setLastCompletedSimulationId(simulationId ?? null);

    if (autoExportSimulationCsv) {
      if (!simulationId) {
        console.warn('Auto-export CSV skipped: missing simulationId');
        return;
      }
      exportSimulationCsv(simulationId).catch((e) => {
        console.error(e);
        alert(e?.message ?? 'Failed to export full simulation CSV');
      });
    }
  };

  const handleImportComplete = async (
    results: YearlySummary[],
    simulationId: string | null,
    replayId: string | null,
  ) => {
    setStats(results);
    // Keep timeline derived from the uploaded bundle so visualization matches a normal run.
    setLastCompletedSimulationId(simulationId);
    if (replayId) {
      try {
        const r = await getReplayStatus(replayId);
        setReplayReport(r);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const importControl = (
    <div style={{ flex: '1 1 220px' }}>
      <button
        type="button"
        disabled={importBusy}
        style={{
          flex: 1,
          padding: '0.75rem',
          fontSize: '1rem',
          width: '100%',
          opacity: importBusy ? 0.6 : 1,
          cursor: importBusy ? 'not-allowed' : 'pointer',
        }}
        title="Import a previously exported run bundle (JSON)"
        onClick={() => {
          if (importBusy) return;
          importFileInputRef.current?.click();
        }}
      >
        Import Run Bundle
      </button>
      <input
        ref={importFileInputRef}
        type="file"
        accept="application/json,.json"
        disabled={importBusy}
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;

          // Derive timeline locally from the bundle so MultiPhaseOverview behaves the same
          // as a normal simulation run (calendar boundaries + phase grouping).
          try {
            const text = await f.text();
            const parsed = JSON.parse(text);
            const t = tryBuildTimelineFromBundle(parsed);
            setTimeline(t);

            // Load imported inputs back into the forms (including phases list).
            const kindRaw = String(parsed?.inputs?.kind ?? parsed?.meta?.inputKind ?? parsed?.meta?.uiMode ?? '').toLowerCase();
            const kind: FormMode = kindRaw === 'advanced' ? 'advanced' : 'normal';
            setFormMode(kind);

            const raw = parsed?.inputs?.raw ?? parsed?.inputs?.[kind] ?? null;
            if (raw && kind === 'normal') {
              const start = toIsoDateString(raw?.startDate) ?? '';
              const req: SimulationRequest = {
                startDate: { date: start },
                overallTaxRule: String(raw?.overallTaxRule ?? 'CAPITAL').toUpperCase() === 'NOTIONAL' ? 'NOTIONAL' : 'CAPITAL',
                taxPercentage: Number(raw?.taxPercentage ?? 0),
                phases: Array.isArray(raw?.phases)
                  ? raw.phases.map((p: any) => ({
                      phaseType: String(p?.phaseType ?? 'DEPOSIT').toUpperCase(),
                      durationInMonths: Number(p?.durationInMonths ?? 0),
                      initialDeposit: p?.initialDeposit,
                      monthlyDeposit: p?.monthlyDeposit,
                      yearlyIncreaseInPercentage: p?.yearlyIncreaseInPercentage,
                      withdrawRate: p?.withdrawRate,
                      withdrawAmount: p?.withdrawAmount,
                      lowerVariationPercentage: p?.lowerVariationPercentage,
                      upperVariationPercentage: p?.upperVariationPercentage,
                      taxRules: Array.isArray(p?.taxRules) ? p.taxRules : [],
                    }))
                  : [],
              };
              setExternalNormalLoad(req);
              setExternalNormalLoadNonce((n) => n + 1);
            }

            if (raw && kind === 'advanced') {
              setExternalAdvancedLoad(raw);
              setExternalAdvancedLoadNonce((n) => n + 1);
            }
          } catch {
            setTimeline(null);
          }

          setImportBusy(true);
          setStats(null);
          setReplayReport(null);
          try {
            const resp = await importRunBundle(f);
            setImportReplayId(resp.replayId);
            setImportSimulationId(resp.simulationId);

            // If the backend returns an already-complete simulationId (dedupe), or the run
            // finishes extremely fast, the SSE 'completed' event might not be observed.
            // Opportunistically fetch the JSON summaries to populate the UI.
            try {
              const maybeSummaries = await getCompletedSummaries(resp.simulationId);
              if (maybeSummaries && maybeSummaries.length > 0) {
                await handleImportComplete(maybeSummaries, resp.simulationId, resp.replayId);
              }
            } catch (err) {
              console.warn('Import: failed to eagerly fetch completed summaries', err);
            }
          } catch (err: any) {
            console.error(err);
            alert(err?.message ?? 'Failed to import bundle');
          } finally {
            setImportBusy(false);
            e.target.value = '';
            setIsIoModalOpen(false);
          }
        }}
      />
    </div>
  );

  const exportControl = (
    <div style={{ flex: '1 1 220px' }}>
      <button
        type="button"
        onClick={() => {
          if (!lastCompletedSimulationId) return;
          exportRunBundle(lastCompletedSimulationId).catch((e) => {
            console.error(e);
            alert(e?.message ?? 'Failed to export run bundle');
          });
          setIsIoModalOpen(false);
        }}
        disabled={!lastCompletedSimulationId}
        style={{
          flex: 1,
          padding: '0.75rem',
          fontSize: '1rem',
          width: '100%',
          opacity: !lastCompletedSimulationId ? 0.6 : 1,
          cursor: !lastCompletedSimulationId ? 'not-allowed' : 'pointer',
        }}
        title={lastCompletedSimulationId ? 'Download a reproducibility bundle (JSON)' : 'No completed run id available'}
      >
        Export Run Bundle
      </button>
    </div>
  );


  const ioButton = (
    <button
      type="button"
      onClick={() => setIsIoModalOpen(true)}
      disabled={importBusy}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #444',
        cursor: importBusy ? 'not-allowed' : 'pointer',
        fontSize: 14,
        background: 'transparent',
        color: '#ddd',
        opacity: importBusy ? 0.65 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
      title="Import/export tools"
    >
      <span aria-hidden="true">🔁</span>
      Import/Export
    </button>
  );

  const segBtn = (mode: FormMode, label: string) => (
    <button
      key={mode}
      onClick={() => setFormModeByUser(mode)}
      aria-pressed={formMode === mode}
      style={{
        padding: '0.4rem 0.8rem',
        border: '1px solid #444',
        backgroundColor: formMode === mode ? '#2e2e2e' : 'transparent',
        color: formMode === mode ? 'white' : 'inherit',
        cursor: 'pointer',
        borderRadius: 8,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 1500, margin: '0 auto' }}>
      {!ackSim && (
        <div role="status" style={{ marginBottom: 12, padding: '10px 12px',
          border: '1px solid #ffc10755', background: 'rgba(255,193,7,0.08)', borderRadius: 10 }}>
          <strong>Simulation (beta):</strong> This page is under development…
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setAckSim(true)} style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid #444',
              backgroundColor: '#2e2e2e', color: 'white', cursor: 'pointer',
            }}>
              Got it
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: formMode === 'advanced' ? 960 : 450, margin: '0 auto' }}>
        <h1 style={{ display: 'flex', justifyContent: 'center' }}>Firecasting</h1>

        <div role="group" aria-label="Form mode" style={{
          display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center',
          marginBottom: 12, border: '1px solid #444', borderRadius: 12, padding: 6,
        }}>
          <Link to="/simulation/tutorial" style={{
            padding:'0.4rem 0.8rem', border:'1px solid #444', borderRadius:8,
            textDecoration:'none', color:'inherit',
          }}>
            Tutorial
          </Link>
          {segBtn('normal', 'Normal')}
          {segBtn('advanced', 'Advanced')}
        </div>

        <div key={formMode}>
          {formMode === 'advanced' ? (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                {ioButton}
                {importReplayId && (
                  <span style={{ fontSize: 12, opacity: 0.8 }}>
                    Replay: {importReplayId.slice(0, 8)}…
                  </span>
                )}
              </div>

              {importSimulationId && !stats && (
                <div style={{ maxWidth: 960, margin: '0 auto' }}>
                  <SimulationProgress
                    simulationId={importSimulationId}
                    onComplete={(results) => handleImportComplete(results, importSimulationId, importReplayId)}
                  />
                </div>
              )}

              <AdvancedInputForm
                onSimulationComplete={handleSimulationComplete}
                externalLoadRequest={externalAdvancedLoad}
                externalLoadNonce={externalAdvancedLoadNonce}
              />
            </>
          ) : (
            <>
              <NormalInputForm
                onSimulationComplete={handleSimulationComplete}
                externalLoadRequest={externalNormalLoad}
                externalLoadNonce={externalNormalLoadNonce}
                rightFooterActions={
                  <>
                    {ioButton}
                  </>
                }
                footerBelow={
                  <>
                    {importReplayId && (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, textAlign: 'right' }}>
                        Replay: {importReplayId.slice(0, 8)}…
                      </div>
                    )}
                    {importSimulationId && !stats ? (
                      <div style={{ maxWidth: 960, margin: '0.75rem auto 0' }}>
                        <SimulationProgress
                          simulationId={importSimulationId}
                          onComplete={(results) => handleImportComplete(results, importSimulationId, importReplayId)}
                        />
                      </div>
                    ) : null}
                  </>
                }
              />
            </>
          )}
        </div>
      </div>

      {isIoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Import and export"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsIoModalOpen(false);
          }}
        >
          <div
            style={{
              width: 'min(520px, 92vw)',
              background: '#111',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: 12,
              padding: 14,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Import / Export</div>
              <button
                type="button"
                aria-label="Close import/export"
                title="Close"
                onClick={() => setIsIoModalOpen(false)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid #444',
                  background: 'transparent',
                  color: '#ddd',
                  cursor: 'pointer',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, display: 'inline-block' }}>✕</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 650 }}>Run bundles</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {importControl}
                {exportControl}
              </div>
              {importReplayId && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Latest replay: {importReplayId.slice(0, 8)}…
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 650 }}>Exports</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', opacity: stats?.length ? 1 : 0.6 }}>
                  <ExportStatisticsButton data={stats ?? []} />
                </div>
              </div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 2 }}>
                <input
                  type="checkbox"
                  checked={autoExportSimulationCsv}
                  onChange={(e) => setAutoExportSimulationCsv(e.target.checked)}
                />
                <div style={{ fontSize: 14 }}>
                  <div style={{ fontWeight: 600 }}>Auto-download full simulation CSV after runs</div>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>
                    Large export; kept briefly in backend memory.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div style={{ marginTop: '1rem' }}>
          {replayReport && (
            <div role="status" style={{
              marginBottom: 10,
              padding: '10px 12px',
              border: '1px solid #444',
              borderRadius: 10,
              background: replayReport.exactMatch
                ? 'rgba(16,185,129,0.12)'
                : replayReport.withinTolerance
                ? 'rgba(245,158,11,0.12)'
                : 'rgba(239,68,68,0.10)',
            }}>
              <strong>Replay report:</strong>{' '}
              {replayReport.exactMatch
                ? 'Exact match.'
                : replayReport.withinTolerance
                ? `Within tolerance (max |Δ|=${replayReport.maxAbsDiff}).`
                : `Mismatch (max |Δ|=${replayReport.maxAbsDiff}).`}
              {replayReport.note ? <span> {replayReport.note}</span> : null}
            </div>
          )}
          <MultiPhaseOverview data={stats} timeline={timeline} />
        </div>
      )}
    </div>
  );
};

export default SimulationPage;
