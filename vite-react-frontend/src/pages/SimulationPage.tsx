import React, { useState } from 'react';
import InputForm from '../components/InputForm';
import { YearlySummary } from '../models/YearlySummary';
import YearlySummaryTable from '../YearlySummaryTable';
import YearlySummaryCharts from '../YearlySummaryCharts';
import MultiPhaseOverview from '../MultiPhaseOverview';

type MainTab = 'table' | 'charts' | 'summary';

const SimulationPage: React.FC = () => {
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('summary');
  const [ackSim, setAckSim] = useState(false); // <-- dismissible beta banner

  const handleSimulationComplete = (results: YearlySummary[]) => setStats(results);

  return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 1500, margin: '0 auto' }}>
      {/* Simulation (beta) disclaimer */}
      {!ackSim && (
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
          <strong>Simulation (beta):</strong> This page is under development.
          Results, tax handling, charts, and CSV export may change.
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setAckSim(true)}
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

      <InputForm onSimulationComplete={handleSimulationComplete} />

      {stats && (
        <div style={{ marginTop: '1rem' }}>
          {/* Keep your existing Summary/Table/Charts buttons exactly as-is */}
          <div style={{ display: 'flex', marginBottom: '1rem' }}>
            <button
              onClick={() => setActiveTab('summary')}
              style={{
                padding: '0.5rem 1rem',
                marginRight: '1rem',
                backgroundColor: activeTab === 'summary' ? '#8884d8' : '#f0f0f0',
                color: activeTab === 'summary' ? 'white' : 'black',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('table')}
              style={{
                padding: '0.5rem 1rem',
                marginRight: '1rem',
                backgroundColor: activeTab === 'table' ? '#8884d8' : '#f0f0f0',
                color: activeTab === 'table' ? 'white' : 'black',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Table
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              style={{
                padding: '0.5rem 1rem',
                marginRight: '1rem',
                backgroundColor: activeTab === 'charts' ? '#8884d8' : '#f0f0f0',
                color: activeTab === 'charts' ? 'white' : 'black',
                border: 'none',
                cursor: 'pointer',
              }}
            >
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
