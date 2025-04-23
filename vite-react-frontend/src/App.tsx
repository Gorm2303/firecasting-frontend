// App.tsx
import React, { useState } from 'react';
import InputForm from './InputForm';
import { YearlySummary } from './models/YearlySummary';
import YearlySummaryTable from './YearlySummaryTable';
import YearlySummaryCharts from './YearlySummaryCharts';
import MultiPhaseOverview from './MultiPhaseOverview';

const App: React.FC = () => {
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'summary'>('summary');

  const handleSimulationComplete = (results: YearlySummary[]) => {
    setStats(results);
  };

  return (
    <div style={{ marginLeft: '2rem' }}>
      <InputForm onSimulationComplete={handleSimulationComplete} />
      {stats && (
        <div style={{ marginTop: '1rem' }}>
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

export default App;
