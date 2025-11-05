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
  const [phases, setPhases] = useState<PhaseRequest[]>([]);

  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [simulateInProgress, setSimulateInProgress] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);

  const MAX_MONTHS = 1200;
  const totalMonths = phases.reduce((s, p) => s + (Number(p.durationInMonths) || 0), 0);
  const overLimit = totalMonths > MAX_MONTHS;

  const handleAddPhase = (phase: PhaseRequest) => {
    setPhases(prev => [...prev, { ...phase, taxRules: phase.taxRules || [] }]);
  };

  const handlePhaseChange = (
    index: number,
    field: keyof PhaseRequest,
    value: number | string | (('CAPITAL' | 'NOTIONAL' | 'EXEMPTIONCARD' | 'STOCKEXEMPTION')[])
  ) => {
    setPhases(phs => phs.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const handlePhaseToggleRule = (index: number, rule: 'EXEMPTIONCARD' | 'STOCKEXEMPTION') => {
    setPhases(phs =>
      phs.map((p, i) => {
        if (i !== index) return p;
        const current = p.taxRules ?? [];
        const has = current.includes(rule);
        const updated = has ? current.filter(r => r !== rule) : [...current, rule];
        return { ...p, taxRules: updated };
      })
    );
  };

  const handlePhaseRemove = (index: number) => {
    setPhases(phs => phs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalMonths > MAX_MONTHS) {
      alert(`Total duration must be ≤ ${MAX_MONTHS} months (you have ${totalMonths}).`);
      return;
    }

    setSimulateInProgress(true);
    setStats(null);
    setSimulationId(null);

    const request: SimulationRequest = {
      startDate: { date: startDate },
      overallTaxRule,
      taxPercentage,
      phases,
    };

    try {
      const id = await startSimulation(request);   // <-- server owns the id
      setSimulationId(id);                         // mount <SimulationProgress/> after we have id
    } catch (err) {
      alert((err as Error).message);
      setSimulateInProgress(false);
    }
  };

  return (
    <div>
      <div style={{ maxWidth: 450, margin: '0 auto' }}>
        <h1 style={{ display: 'flex', justifyContent: 'center'}}>Firecasting</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxWidth: 450 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'stretch' }}>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.1rem' }}>Start Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.3rem' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.1rem' }}>Tax Rule:</span>
                <select
                  value={overallTaxRule}
                  onChange={e => setOverallTaxRule(e.target.value as OverallTaxRule)}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.3rem' }}
                >
                  <option value="CAPITAL">Capital Gains</option>
                  <option value="NOTIONAL">Notional Gains</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.1rem' }}>Tax %:</span>
                <input
                  type="number"
                  step="0.01"
                  value={taxPercentage}
                  onChange={e => setTaxPercentage(+e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.3rem' }}
                />
              </label>
            </div>
          </div>

          <PhaseForm onAddPhase={handleAddPhase} />
          <PhaseList
            phases={phases}
            onPhaseChange={handlePhaseChange}
            onPhaseRemove={handlePhaseRemove}
            onToggleTaxRule={handlePhaseToggleRule}
          />
          <div style={{ margin: '0.5rem 0', fontWeight: 600 }}>
            Total duration: {totalMonths}/{MAX_MONTHS} months
            {overLimit && <span style={{ color: 'crimson' }}> — exceeds limit</span>}
          </div>


          <button
            type="submit"
            disabled={simulateInProgress}
            style={{ padding: '0.75rem', fontSize: '1.1rem', opacity: simulateInProgress ? 0.65 : 1 }}
          >
            {simulateInProgress ? 'Running…' : 'Run Simulation'}
          </button>

          {/* Live progress (subscribed before server starts) */}
          {simulateInProgress && simulationId && (
            <SimulationProgress
              simulationId={simulationId}
              onComplete={(result) => {
                setStats(result);
                onSimulationComplete(result);
                setSimulateInProgress(false);
                setSimulationId(null);
              }}
            />
          )}

          {/* Results actions */}
          {stats && (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={exportSimulationCsv}
                style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', width: '100%' }}
              >
                Export Simulation CSV
              </button>
              <div style={{ flex: 1 }}>
                <ExportStatisticsButton data={stats} />
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default InputForm;
