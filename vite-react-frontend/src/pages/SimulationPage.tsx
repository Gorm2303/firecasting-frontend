// src/pages/SimulationPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import NormalInputForm, { type AdvancedFeatureFlags, type NormalInputFormHandle, type NormalInputFormMode } from '../components/normalMode/NormalInputForm';
import { YearlySummary } from '../models/YearlySummary';
import { SimulationRequest, SimulationTimelineContext } from '../models/types';
import { toIsoDateString } from '../utils/backendDate';
import MultiPhaseOverview from '../MultiPhaseOverview';
import ExportStatisticsButton from '../components/ExportStatisticsButton';
import { exportRunBundle, exportSimulationCsv, getCompletedSummaries, getReplayStatus, importRunBundle, ReplayStatusResponse } from '../api/simulation';
import SimulationProgress from '../components/SimulationProgress';
import PageLayout from '../components/PageLayout';

type BundleKind = 'normal' | 'advanced';
const AUTO_EXPORT_SIM_CSV_KEY = 'firecasting:autoExportSimulationCsv';
const ADVANCED_FEATURE_FLAGS_KEY = 'firecasting:simulation:advancedFeatureFlags:v1';
const ADVANCED_MODE_ENABLED_KEY = 'firecasting:simulation:advancedModeEnabled:v1';

const DEFAULT_ADVANCED_FEATURE_FLAGS: AdvancedFeatureFlags = {
  execution: true,
  inflation: true,
  fee: true,
  exemptions: true,
  returnModel: true,
};

// NOTE: `toIsoDateString` is imported from ../utils/backendDate to ensure we
// interpret backend epochDay correctly (days since 1900-01-01).

type ExternalAdvancedLoad = {
  enabled?: boolean;
  paths?: number | string;
  batchSize?: number | string;
  inflationAveragePct?: number;
  yearlyFeePercentage?: number;
  taxExemptionConfig?: any;
  returnType?: any;
  seed?: any;
  returnerConfig?: any;
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
          phaseInitialDeposits: Array.isArray(explicit?.phaseInitialDeposits)
            ? explicit.phaseInitialDeposits.map((x: any) => (x === null || x === undefined ? undefined : Number(x)))
            : undefined,
          firstPhaseInitialDeposit:
            explicit?.firstPhaseInitialDeposit !== undefined ? Number(explicit.firstPhaseInitialDeposit) : undefined,
          inflationFactorPerYear:
            explicit?.inflationFactorPerYear !== undefined
              ? Number(explicit.inflationFactorPerYear)
              : undefined,
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
      phaseInitialDeposits: phases.map((p) => (p?.initialDeposit !== undefined ? Number(p.initialDeposit) : undefined)),
      firstPhaseInitialDeposit:
        phases[0]?.initialDeposit !== undefined ? Number(phases[0]?.initialDeposit) : undefined,
      inflationFactorPerYear:
        raw?.inflationFactor !== undefined
          ? Number(raw.inflationFactor)
          : undefined,
    };
  } catch {
    return null;
  }
};

const SimulationPage: React.FC = () => {
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [timeline, setTimeline] = useState<SimulationTimelineContext | null>(null);
  const [lastCompletedSimulationId, setLastCompletedSimulationId] = useState<string | null>(null);

  const [externalNormalLoad, setExternalNormalLoad] = useState<SimulationRequest | null>(null);
  const [externalNormalLoadNonce, setExternalNormalLoadNonce] = useState(0);
  const [externalAdvancedLoad, setExternalAdvancedLoad] = useState<ExternalAdvancedLoad | null>(null);
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
  const [importError, setImportError] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const formRef = useRef<NormalInputFormHandle | null>(null);
  const [mode, setMode] = useState<NormalInputFormMode>(() => {
    try {
      const raw = window.localStorage.getItem('firecasting:simulation:mode');
      return raw === 'advanced' ? 'advanced' : 'normal';
    } catch {
      return 'normal';
    }
  });

  const [advancedModeEnabled, setAdvancedModeEnabled] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(ADVANCED_MODE_ENABLED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [advancedFeatureFlags, setAdvancedFeatureFlags] = useState<AdvancedFeatureFlags>(() => {
    try {
      const raw = window.localStorage.getItem(ADVANCED_FEATURE_FLAGS_KEY);
      if (!raw) return DEFAULT_ADVANCED_FEATURE_FLAGS;
      const parsed = JSON.parse(raw);
      return {
        execution: Boolean(parsed?.execution ?? false),
        inflation: Boolean(parsed?.inflation ?? true),
        fee: Boolean(parsed?.fee ?? true),
        exemptions: Boolean(parsed?.exemptions ?? true),
        returnModel: Boolean(parsed?.returnModel ?? true),
      };
    } catch {
      return DEFAULT_ADVANCED_FEATURE_FLAGS;
    }
  });

  const [isAdvancedPickerOpen, setIsAdvancedPickerOpen] = useState(false);
  const [pendingAdvancedFeatureFlags, setPendingAdvancedFeatureFlags] = useState<AdvancedFeatureFlags>(advancedFeatureFlags);
  const [pendingAdvancedModeEnabled, setPendingAdvancedModeEnabled] = useState<boolean>(advancedModeEnabled);
  const advancedPickerOverlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem('firecasting:simulation:mode', mode); } catch { /* ignore localStorage failures */ }
  }, [mode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ADVANCED_MODE_ENABLED_KEY, String(advancedModeEnabled));
    } catch {
      // ignore
    }
  }, [advancedModeEnabled]);

  // Safety: if advanced mode is disabled in settings, force normal mode.
  useEffect(() => {
    if (!advancedModeEnabled && mode === 'advanced') setMode('normal');
  }, [advancedModeEnabled, mode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ADVANCED_FEATURE_FLAGS_KEY, JSON.stringify(advancedFeatureFlags));
    } catch {
      // ignore
    }
  }, [advancedFeatureFlags]);

  useEffect(() => {
    try { window.localStorage.setItem(AUTO_EXPORT_SIM_CSV_KEY, String(autoExportSimulationCsv)); } catch { /* ignore localStorage failures */ }
  }, [autoExportSimulationCsv]);

  useEffect(() => {
    if (!isAdvancedPickerOpen) return;
    advancedPickerOverlayRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAdvancedPickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAdvancedPickerOpen]);

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

          setImportError(null);

          // Derive timeline locally from the bundle so MultiPhaseOverview behaves the same
          // as a normal simulation run (calendar boundaries + phase grouping).
          try {
            const text = await f.text();
            const parsed = JSON.parse(text);
            const t = tryBuildTimelineFromBundle(parsed);
            setTimeline(t);

            // Load imported inputs back into the forms (including phases list).
            const kindRaw = String(parsed?.inputs?.kind ?? parsed?.meta?.inputKind ?? parsed?.meta?.uiMode ?? '').toLowerCase();
            const kind: BundleKind = kindRaw === 'advanced' ? 'advanced' : 'normal';

            // Importing an advanced bundle is an explicit user action. Ensure advanced mode
            // is enabled so the UI (and safety effect) doesn't force us back to normal.
            if (kind === 'advanced') {
              setAdvancedModeEnabled(true);
            }

            setMode(kind === 'advanced' ? 'advanced' : 'normal');

            const raw = parsed?.inputs?.raw ?? parsed?.inputs?.[kind] ?? null;
            if (raw) {
              const start = toIsoDateString(raw?.startDate) ?? '';
              const ruleStr = String(raw?.overallTaxRule ?? raw?.taxRule ?? 'CAPITAL');
              const isNotional = ruleStr.toUpperCase() === 'NOTIONAL' || ruleStr.toLowerCase() === 'notional';
              const req: SimulationRequest = {
                startDate: { date: start },
                overallTaxRule: isNotional ? 'NOTIONAL' : 'CAPITAL',
                taxPercentage: Number(raw?.taxPercentage ?? raw?.tax?.percentage ?? 0),
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
                      taxRules: Array.isArray(p?.taxRules)
                        ? p.taxRules
                        : Array.isArray(p?.taxExemptions)
                          ? p.taxExemptions
                          : [],
                    }))
                  : [],
              };
              setExternalNormalLoad(req);
              setExternalNormalLoadNonce((n) => n + 1);

              if (kind === 'advanced') {
                const inflationFactor = Number(raw?.inflationFactor);
                const inflationAveragePct = Number.isFinite(inflationFactor) ? (inflationFactor - 1) * 100 : undefined;
                const yearlyFeePercentage = Number(raw?.yearlyFeePercentage);
                setExternalAdvancedLoad({
                  enabled: true,
                  paths: raw?.paths,
                  batchSize: raw?.batchSize,
                  inflationAveragePct,
                  yearlyFeePercentage: Number.isFinite(yearlyFeePercentage) ? yearlyFeePercentage : undefined,
                  taxExemptionConfig: raw?.taxExemptionConfig,
                  returnType: raw?.returnType,
                  seed: raw?.seed,
                  returnerConfig: raw?.returnerConfig,
                });
                setExternalAdvancedLoadNonce((n) => n + 1);
              } else {
                setExternalAdvancedLoad(null);
              }
            }
          } catch {
            setTimeline(null);
          }

          setImportBusy(true);
          setStats(null);
          setReplayReport(null);
          let ok = false;
          try {
            const resp = await importRunBundle(f);
            setImportReplayId(resp.replayId);
            setImportSimulationId(resp.simulationId);
            ok = true;

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
            setImportError(String(err?.message ?? err ?? 'Failed to import bundle'));
          } finally {
            setImportBusy(false);
            e.target.value = '';
            if (ok) setIsIoModalOpen(false);
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
        color: 'inherit',
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

  const modeButton = (label: 'Normal' | 'Advanced', value: NormalInputFormMode, onClick?: () => void) => {
    const isActive = mode === value;
    return (
      <button
        type="button"
        onClick={onClick ?? (() => setMode(value))}
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: `1px solid ${isActive ? 'var(--fc-card-border)' : '#444'}`,
          cursor: 'pointer',
          fontSize: 14,
          background: isActive ? 'var(--fc-subtle-bg)' : 'transparent',
          color: 'inherit',
          fontWeight: isActive ? 700 : 500,
        }}
        aria-pressed={isActive}
      >
        {label}
      </button>
    );
  };

  const savedScenariosButton = (
    <button
      type="button"
      onClick={() => formRef.current?.openSavedScenarios()}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #444',
        cursor: 'pointer',
        fontSize: 14,
        background: 'transparent',
        color: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
      title="Saved scenarios"
      aria-label="Saved scenarios"
    >
      <span aria-hidden="true">📂</span>
      Saved scenarios
    </button>
  );

  const settingsButton = (
    <button
      type="button"
      onClick={() => {
        setPendingAdvancedModeEnabled(advancedModeEnabled);
        setPendingAdvancedFeatureFlags(advancedFeatureFlags);
        setIsAdvancedPickerOpen(true);
      }}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #444',
        cursor: 'pointer',
        fontSize: 14,
        background: 'transparent',
        color: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
      title="Settings"
      aria-label="Settings"
    >
      <span aria-hidden="true">⚙️</span>
      Settings
    </button>
  );

  return (
    <PageLayout variant="wide">
    <div style={{ maxWidth: 1500, margin: '0 auto' }}>
      <PageLayout variant="constrained" maxWidthPx={980} paddingPx={0}>
        <h1 style={{ textAlign: "center" }}>FIRE Simulator</h1>

        <div role="group" aria-label="Simulation tools" className="fc-sim-tools" style={{
          display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 12, border: '1px solid #444', borderRadius: 12, padding: 6,
        }}>
          <div role="group" aria-label="Mode" className="fc-sim-mode" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {modeButton('Normal', 'normal', () => {
              setMode('normal');
              setIsAdvancedPickerOpen(false);
            })}
            {advancedModeEnabled
              ? modeButton('Advanced', 'advanced', () => {
                  setMode('advanced');
                  setIsAdvancedPickerOpen(false);
                })
              : null}
          </div>
          {settingsButton}
          {ioButton}
          {savedScenariosButton}
        </div>

        {isAdvancedPickerOpen && (
          <div
            ref={advancedPickerOverlayRef}
            role="dialog"
            aria-modal="true"
            aria-label="Advanced feature selection"
            onClick={() => setIsAdvancedPickerOpen(false)}
            tabIndex={-1}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(520px, 100%)',
                marginTop: 72,
                background: 'var(--fc-card-bg)',
                border: '1px solid var(--fc-card-border)',
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 800 }}>Settings</div>
                <button
                  type="button"
                  onClick={() => setIsAdvancedPickerOpen(false)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: '1px solid #444',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                Advanced mode is hidden by default. Enable it here if you want the extra controls.
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={pendingAdvancedModeEnabled}
                    onChange={(e) => setPendingAdvancedModeEnabled(e.target.checked)}
                  />
                  <span style={{ fontWeight: 700 }}>Enable advanced mode</span>
                </label>

                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                  When enabled, the Advanced button appears next to Normal.
                </div>
              </div>

              <fieldset
                disabled={!pendingAdvancedModeEnabled}
                style={{
                  border: '1px solid var(--fc-subtle-border)',
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 12,
                  opacity: pendingAdvancedModeEnabled ? 1 : 0.55,
                }}
              >
                <legend style={{ padding: '0 6px', fontWeight: 750 }}>Advanced sections</legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={pendingAdvancedFeatureFlags.execution}
                      onChange={(e) => setPendingAdvancedFeatureFlags((p) => ({ ...p, execution: e.target.checked }))}
                    />
                    <span>Engine settings (paths & batch size)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={pendingAdvancedFeatureFlags.inflation}
                      onChange={(e) => setPendingAdvancedFeatureFlags((p) => ({ ...p, inflation: e.target.checked }))}
                    />
                    <span>Inflation</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={pendingAdvancedFeatureFlags.fee}
                      onChange={(e) => setPendingAdvancedFeatureFlags((p) => ({ ...p, fee: e.target.checked }))}
                    />
                    <span>Fee</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={pendingAdvancedFeatureFlags.exemptions}
                      onChange={(e) => setPendingAdvancedFeatureFlags((p) => ({ ...p, exemptions: e.target.checked }))}
                    />
                    <span>Exemptions</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={pendingAdvancedFeatureFlags.returnModel}
                      onChange={(e) => setPendingAdvancedFeatureFlags((p) => ({ ...p, returnModel: e.target.checked }))}
                    />
                    <span>Return model</span>
                  </label>
                </div>

                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
                  Tip: hiding a section only hides the UI — the backend still uses defaults for missing fields.
                </div>
              </fieldset>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setPendingAdvancedFeatureFlags(DEFAULT_ADVANCED_FEATURE_FLAGS)}
                  disabled={!pendingAdvancedModeEnabled}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #444',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: pendingAdvancedModeEnabled ? 'pointer' : 'not-allowed',
                    opacity: pendingAdvancedModeEnabled ? 1 : 0.6,
                  }}
                >
                  Enable all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdvancedPickerOpen(false);
                    setPendingAdvancedModeEnabled(advancedModeEnabled);
                    setPendingAdvancedFeatureFlags(advancedFeatureFlags);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #444',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdvancedModeEnabled(pendingAdvancedModeEnabled);
                    setAdvancedFeatureFlags(pendingAdvancedFeatureFlags);
                    if (!pendingAdvancedModeEnabled) setMode('normal');
                    setIsAdvancedPickerOpen(false);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--fc-card-border)',
                    background: 'var(--fc-subtle-bg)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        <NormalInputForm
          ref={formRef}
          onSimulationComplete={handleSimulationComplete}
          externalLoadRequest={externalNormalLoad}
          externalLoadNonce={externalNormalLoadNonce}
          externalLoadAdvanced={externalAdvancedLoad}
          externalLoadAdvancedNonce={externalAdvancedLoadNonce}
          mode={mode}
          advancedFeatureFlags={advancedFeatureFlags}
          rightFooterActions={null}
          footerBelow={
            <>
              {importReplayId && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, textAlign: 'right' }}>
                  Replay: {importReplayId.slice(0, 8)}…
                </div>
              )}
              {importSimulationId && !stats ? (
                <div style={{ maxWidth: 980, margin: '0.75rem auto 0' }}>
                  <SimulationProgress
                    simulationId={importSimulationId}
                    onComplete={(results) => handleImportComplete(results, importSimulationId, importReplayId)}
                  />
                </div>
              ) : null}
            </>
          }
        />
      </PageLayout>

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
              {importError && (
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontSize: 12,
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid rgba(255,80,80,0.45)',
                    background: 'rgba(255,80,80,0.08)',
                    color: '#ffd2d2',
                  }}
                >
                  {importError}
                </pre>
              )}
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
    </PageLayout>
  );
};

export default SimulationPage;
