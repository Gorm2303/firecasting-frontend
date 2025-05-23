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
    <div style={{ display: 'flex', justifyContent: 'center'}}>
      <div style={{ maxWidth: '450px'}}>
        <h1 style={{ display: 'flex', justifyContent: 'center'}}>Firecasting</h1>
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', maxWidth: '450px' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '250px',            
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                alignItems: 'stretch',
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.1rem' }}>Start Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',    
                    padding: '0.3rem',      
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.1rem' }}>Tax Rule:</span>
                <select
                  value={overallTaxRule}
                  onChange={e => setOverallTaxRule(e.target.value as OverallTaxRule)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',   
                    padding: '0.3rem',
                  }}
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
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',    
                    padding: '0.3rem',
                  }}
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

          <button 
          type="submit" 
          style={{
          padding: '0.75rem',
          fontSize: '1.1rem',
        }}
        >Run Simulation</button>

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
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={exportSimulationCsv}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  width: '100%',
                }}
              >
                Export Simulation CSV
              </button>

              {/* wrap in a div so it also gets flex: 1 */}
              <div style={{ flex: 1 }}>
                <ExportStatisticsButton
                  data={stats}
                  // if this component accepts a style prop, you can also do:
                  // style={{ flex: 1, width: '100%' }}
                />
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default InputForm;
