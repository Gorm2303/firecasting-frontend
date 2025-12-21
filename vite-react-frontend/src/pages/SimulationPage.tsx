// src/pages/SimulationPage.tsx
import React, { useState, useEffect } from 'react';
import NormalInputForm from '../components/normalMode/NormalInputForm';
import AdvancedInputForm from '../components/advancedMode/AdvancedInputForm';
import { YearlySummary } from '../models/YearlySummary';
import YearlySummaryTable from '../YearlySummaryTable';
import YearlySummaryCharts from '../YearlySummaryCharts';
import MultiPhaseOverview from '../MultiPhaseOverview';
import { Link } from 'react-router-dom';

type MainTab = 'table' | 'charts' | 'summary';
type FormMode = 'normal' | 'advanced';

const FORM_MODE_KEY = 'firecasting:formMode';

const getInitialFormMode = (): FormMode => {
  if (typeof window === 'undefined') return 'normal';
  const v = window.localStorage.getItem(FORM_MODE_KEY);
  return v === 'advanced' ? 'advanced' : 'normal';
};

const SimulationPage: React.FC = () => {
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('summary');
  const [ackSim, setAckSim] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(getInitialFormMode);

  useEffect(() => {
    setStats(null);
    setActiveTab('summary');
    try { window.localStorage.setItem(FORM_MODE_KEY, formMode); } catch {}
  }, [formMode]);

  const handleSimulationComplete = (results: YearlySummary[]) => setStats(results);

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

        <div key={formMode}>
          <FormComponent onSimulationComplete={handleSimulationComplete} />
        </div>
      </div>

      {stats && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', marginBottom: '1rem' }}>
            <button onClick={() => setActiveTab('summary')} style={{
              padding: '0.5rem 1rem', marginRight: '1rem',
              backgroundColor: activeTab === 'summary' ? '#8884d8' : '#f0f0f0',
              color: activeTab === 'summary' ? 'white' : 'black', border: 'none', cursor: 'pointer',
            }}>
              Summary
            </button>
            <button onClick={() => setActiveTab('table')} style={{
              padding: '0.5rem 1rem', marginRight: '1rem',
              backgroundColor: activeTab === 'table' ? '#8884d8' : '#f0f0f0',
              color: activeTab === 'table' ? 'white' : 'black', border: 'none', cursor: 'pointer',
            }}>
              Table
            </button>
            <button onClick={() => setActiveTab('charts')} style={{
              padding: '0.5rem 1rem', marginRight: '1rem',
              backgroundColor: activeTab === 'charts' ? '#8884d8' : '#f0f0f0',
              color: activeTab === 'charts' ? 'white' : 'black', border: 'none', cursor: 'pointer',
            }}>
              Charts
            </button>
          </div>

          {activeTab === 'summary' && <MultiPhaseOverview data={stats} />}
          {activeTab === 'table' && <YearlySummaryTable stats={stats} />}
          {activeTab === 'charts' && <YearlySummaryCharts data={stats} />}
        </div>
      )}
    </div>
  );
};

export default SimulationPage;
