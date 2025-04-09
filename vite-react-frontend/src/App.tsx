// App.tsx
import React, { useState } from 'react';
import InputForm from './InputForm';
import { YearlySummary } from './models/YearlySummary';
import YearlySummaryTable from './YearlySummaryTable';
import YearlySummaryCharts from './YearlySummaryCharts';

const App: React.FC = () => {
  const [stats, setStats] = useState<YearlySummary[] | null>(null);

  const handleSimulationComplete = (results: YearlySummary[]) => {
    setStats(results);
  };

  return (
    <div style={{ margin: '2rem' }}>
      <InputForm onSimulationComplete={handleSimulationComplete} />
      {stats && 
      <div>
        <YearlySummaryTable stats={stats} /> 
        <YearlySummaryCharts data={stats} />
      </div>}
    </div>
  );
};

export default App;
