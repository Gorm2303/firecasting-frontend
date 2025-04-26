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

type OverallTaxRule = 'CAPITAL' | 'NOTIONAL';

const InputForm: React.FC<InputFormProps> = ({ onSimulationComplete }) => {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [overallTaxRule, setOverallTaxRule] = useState<OverallTaxRule>('CAPITAL');
  const [taxPercentage, setTaxPercentage] = useState(42);
  const [returnPercentage, setReturnPercentage] = useState(7);
  const [phases, setPhases] = useState<PhaseRequest[]>([]);
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [simulateInProgress, setSimulateInProgress] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);

  const handleAddPhase = (phase: PhaseRequest) => {
    // initialize taxRules on new phase
    setPhases(prev => [...prev, { ...phase, taxRules: phase.taxRules || [] }]);
  };

  const handlePhaseChange = (
    index: number,
    field: keyof PhaseRequest,
    value: number | string | (('CAPITAL' | 'NOTIONAL' | 'EXEMPTIONCARD' | 'STOCKEXEMPTION')[])
  ) => {
    setPhases(phs =>
      phs.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      )
    );
  };

  const handlePhaseToggleRule = (
    index: number,
    rule: 'EXEMPTIONCARD' | 'STOCKEXEMPTION'
  ) => {
    setPhases(phs =>
      phs.map((p, i) => {
        if (i !== index) return p;
        const current = p.taxRules ?? [];
        const has = current.includes(rule);
        const updated = has
          ? current.filter(r => r !== rule)
          : [...current, rule];
        return { ...p, taxRules: updated };
      })
    );
  };

  const handlePhaseRemove = (index: number) => {
    setPhases(phs => phs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulateInProgress(true);

    const request: SimulationRequest & { overallTaxRule: OverallTaxRule } = {
      startDate: { date: startDate },
      overallTaxRule,
      taxPercentage,
      returnPercentage,
      phases,
    };

    try {
      const simId = await startSimulation(request as SimulationRequest);
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
          Tax Rule:
          <select
            value={overallTaxRule}
            onChange={e => setOverallTaxRule(e.target.value as OverallTaxRule)}
          >
            <option value="CAPITAL">Capital Gains</option>
            <option value="NOTIONAL">Notional Gains</option>
          </select>
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
        <PhaseList
          phases={phases}
          onPhaseChange={handlePhaseChange}
          onPhaseRemove={handlePhaseRemove}
          onToggleTaxRule={handlePhaseToggleRule}
        />

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
