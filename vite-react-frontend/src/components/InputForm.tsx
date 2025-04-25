import React, { useState } from 'react';
import { YearlySummary } from '../models/YearlySummary';
import { PhaseRequest, SimulationRequest } from '../models/types';
import PhaseForm from './PhaseForm';
import PhaseList from './PhaseList';
import ExportStatisticsButton from './ExportStatisticsButton';
import SimulationProgress from './SimulationProgress';
import { startSimulation, exportSimulationCsv } from '../api/simulation';

interface InputFormProps {
  onSimulationComplete: (stats: YearlySummary[]) => void;
}

const InputForm: React.FC<InputFormProps> = ({ onSimulationComplete }) => {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [taxPercentage, setTaxPercentage] = useState(42);
  const [returnPercentage, setReturnPercentage] = useState(0.07);
  const [phases, setPhases] = useState<PhaseRequest[]>([]);
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [simulateInProgress, setSimulateInProgress] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);

  const handleAddPhase = (phase: PhaseRequest) => {
    setPhases(prev => [...prev, phase]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulateInProgress(true);

    const request: SimulationRequest = { startDate: { date: startDate }, taxPercentage, returnPercentage, phases };
    try {
      const simId = await startSimulation(request);
      setSimulationId(simId);
    } catch (err) {
      alert((err as Error).message);
      setSimulateInProgress(false);
    }
  };

  return (
    <div>
      <h1>Firecasting Simulation</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '450px' }}
      >
        <label>
          Start Date:
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </label>
        <label>
          Tax %:
          <input
            type="number"
            step="0.01"
            value={taxPercentage}
            onChange={e => setTaxPercentage(+e.target.value)}
          />
        </label>

        <PhaseForm onAddPhase={handleAddPhase} />
        <PhaseList phases={phases} />

        <button type="submit">Run Simulation</button>

        {simulateInProgress && simulationId && (
          <SimulationProgress
            simulationId={simulationId}
            onComplete={result => {
              setStats(result);
              onSimulationComplete(result);
              setSimulateInProgress(false);
              setSimulationId(null);
            }}
          />
        )}

        {stats && (
          <div>
            <button type="button" onClick={exportSimulationCsv}>
              Export Simulation CSV
            </button>
            <ExportStatisticsButton data={stats} />
          </div>
        )}
      </form>
    </div>
  );
};

export default InputForm;