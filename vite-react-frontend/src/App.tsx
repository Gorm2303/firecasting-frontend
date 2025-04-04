// App.tsx
import React, { useState } from 'react';
import InputForm from './InputForm';
import YearlySummaryTable, {YearlySummary} from './YearlySummaryTable';

const App: React.FC = () => {
  const [stats, setStats] = useState<YearlySummary[] | null>(null);

  const handleSimulationComplete = (results: YearlySummary[]) => {
    setStats(results);
  };

  return (
    <div>
      <InputForm onSimulationComplete={handleSimulationComplete} />
      {stats && <YearlySummaryTable stats={stats} />}
    </div>
  );
};

export default App;
