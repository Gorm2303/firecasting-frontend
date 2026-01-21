// src/pages/SimulationPage.tsx
import React, { useState, useEffect } from 'react';
import NormalInputForm from '../components/normalMode/NormalInputForm';
import AdvancedInputForm from '../components/advancedMode/AdvancedInputForm';
import { YearlySummary } from '../models/YearlySummary';
import { SimulationTimelineContext } from '../models/types';
import MultiPhaseOverview from '../MultiPhaseOverview';
import { Link } from 'react-router-dom';
import { exportRunBundle, getReplayStatus, importRunBundle, ReplayStatusResponse } from '../api/simulation';
import SimulationProgress from '../components/SimulationProgress';

type FormMode = 'normal' | 'advanced';

const FORM_MODE_KEY = 'firecasting:formMode';

const getInitialFormMode = (): FormMode => {
  if (typeof window === 'undefined') return 'normal';
  const v = window.localStorage.getItem(FORM_MODE_KEY);
  return v === 'advanced' ? 'advanced' : 'normal';
};

const SimulationPage: React.FC = () => {
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [timeline, setTimeline] = useState<SimulationTimelineContext | null>(null);
  const [lastCompletedSimulationId, setLastCompletedSimulationId] = useState<string | null>(null);
  const [ackSim, setAckSim] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(getInitialFormMode);

  const [importSimulationId, setImportSimulationId] = useState<string | null>(null);
  const [importReplayId, setImportReplayId] = useState<string | null>(null);
  const [replayReport, setReplayReport] = useState<ReplayStatusResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    setStats(null);
    setTimeline(null);
    setLastCompletedSimulationId(null);
    setImportSimulationId(null);
    setImportReplayId(null);
    setReplayReport(null);
    try { window.localStorage.setItem(FORM_MODE_KEY, formMode); } catch {}
  }, [formMode]);

  const handleSimulationComplete = (results: YearlySummary[], ctx?: SimulationTimelineContext, simulationId?: string) => {
    setStats(results);
    setTimeline(ctx ?? null);
    setLastCompletedSimulationId(simulationId ?? null);
  };

  const handleImportComplete = async (results: YearlySummary[]) => {
    setStats(results);
    setTimeline(null);
    setLastCompletedSimulationId(importSimulationId);
    if (importReplayId) {
      try {
        const r = await getReplayStatus(importReplayId);
        setReplayReport(r);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const FormComponent =
    formMode === 'advanced' ? AdvancedInputForm : NormalInputForm;

  const segBtn = (mode: FormMode, label: string) => (
    <button
      key={mode}
      onClick={() => setFormMode(mode)}
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

        <div style={{
          display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center',
          marginBottom: 12,
        }}>
          <label style={{
            padding: '0.4rem 0.8rem', border: '1px solid #444', borderRadius: 8,
            cursor: importBusy ? 'not-allowed' : 'pointer',
            opacity: importBusy ? 0.7 : 1,
          }}>
            Import Run Bundle
            <input
              type="file"
              accept="application/json,.json"
              disabled={importBusy}
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImportBusy(true);
                setStats(null);
                setTimeline(null);
                setReplayReport(null);
                try {
                  const resp = await importRunBundle(f);
                  setImportReplayId(resp.replayId);
                  setImportSimulationId(resp.simulationId);
                } catch (err: any) {
                  console.error(err);
                  alert(err?.message ?? 'Failed to import bundle');
                } finally {
                  setImportBusy(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
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
              onComplete={handleImportComplete}
            />
          </div>
        )}

        <div key={formMode}>
          <FormComponent onSimulationComplete={handleSimulationComplete} />
        </div>
      </div>

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
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => {
                if (!lastCompletedSimulationId) return;
                exportRunBundle(lastCompletedSimulationId, formMode).catch((e) => {
                  console.error(e);
                  alert(e?.message ?? 'Failed to export run bundle');
                });
              }}
              disabled={!lastCompletedSimulationId}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #444',
                backgroundColor: !lastCompletedSimulationId ? 'transparent' : '#2e2e2e',
                color: !lastCompletedSimulationId ? 'inherit' : 'white',
                cursor: !lastCompletedSimulationId ? 'not-allowed' : 'pointer',
              }}
              title={lastCompletedSimulationId ? 'Download a reproducibility bundle (JSON)' : 'No completed run id available'}
            >
              Export Run Bundle
            </button>
          </div>
          <MultiPhaseOverview data={stats} timeline={timeline} />
        </div>
      )}
    </div>
  );
};

export default SimulationPage;
