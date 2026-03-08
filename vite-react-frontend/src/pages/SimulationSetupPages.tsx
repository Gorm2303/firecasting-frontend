import React from 'react';
import { Link } from 'react-router-dom';

import NormalPhaseList from '../components/normalMode/NormalPhaseList';
import PageLayout from '../components/PageLayout';
import { SIMULATION_TEMPLATES, type SimulationTemplateId } from '../config/simulationTemplates';
import { createDefaultPhase } from '../config/simulationDefaults';
import {
  applyFireSimulatorTemplate,
  type FireSimulatorReturnEngine,
} from '../lib/fireSimulatorAssumptions';
import type { PhaseRequest } from '../models/types';
import { type Assumptions, useAssumptions } from '../state/assumptions';
import { getDefaultExecutionDefaults, useExecutionDefaults } from '../state/executionDefaults';

const chipStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid var(--fc-card-border)',
  background: 'transparent',
  color: 'inherit',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 14,
  padding: 16,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--fc-card-border)',
  background: 'var(--fc-card-bg)',
  color: 'inherit',
  boxSizing: 'border-box',
};

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const buttonStyle: React.CSSProperties = {
  ...chipStyle,
  cursor: 'pointer',
};

const sectionLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 220,
  fontFamily: 'Consolas, Monaco, monospace',
};

const SetupPageShell: React.FC<{
  title: string;
  description: string;
  badge: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, badge, actions, children }) => {
  const { isDraftDirty, resetDraftToCurrent, resetDraftToDefaults, saveDraft } = useAssumptions();

  return (
    <PageLayout variant="constrained" maxWidthPx={1040}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={chipStyle}>{badge}</span>
            <span style={chipStyle}>{isDraftDirty ? 'Unsaved draft' : 'Saved draft'}</span>
            <Link to="/fire-simulator" style={{ ...chipStyle, textDecoration: 'none' }}>Back to FIRE Simulator</Link>
          </div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <div style={{ opacity: 0.8 }}>{description}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={saveDraft} style={buttonStyle}>Save baseline</button>
            <button type="button" onClick={resetDraftToCurrent} style={buttonStyle}>Cancel draft</button>
            <button type="button" onClick={resetDraftToDefaults} style={buttonStyle}>Reset to defaults</button>
            {actions}
          </div>
        </div>
        {children}
      </div>
    </PageLayout>
  );
};

const updateNestedSection = <K extends keyof Assumptions>(
  draftAssumptions: Assumptions,
  updateDraftAssumptions: (patch: Partial<Assumptions>) => void,
  key: K,
  patch: Partial<Assumptions[K]>
) => {
  updateDraftAssumptions({
    [key]: {
      ...(draftAssumptions[key] as Record<string, unknown>),
      ...(patch as Record<string, unknown>),
    },
  } as Partial<Assumptions>);
};

const ReturnEngineFields: React.FC<{
  engine: FireSimulatorReturnEngine;
  onUpdate: (patch: Partial<FireSimulatorReturnEngine>) => void;
}> = ({ engine, onUpdate }) => {
  const [regimesDraft, setRegimesDraft] = React.useState(() => JSON.stringify(engine.regimes, null, 2));
  const [regimesError, setRegimesError] = React.useState('');

  React.useEffect(() => {
    setRegimesDraft(JSON.stringify(engine.regimes, null, 2));
  }, [engine.regimes]);

  return (
    <>
      <label style={sectionLabelStyle}>
        <span>Return engine</span>
        <select
          aria-label="Simulation return engine"
          value={engine.returnType}
          onChange={(event) => onUpdate({ returnType: event.target.value as FireSimulatorReturnEngine['returnType'] })}
          style={inputStyle}
        >
          <option value="dataDrivenReturn">Data-driven return</option>
          <option value="distributionReturn">Distribution return</option>
          <option value="simpleReturn">Simple return</option>
        </select>
      </label>
      {engine.returnType === 'simpleReturn' ? (
        <label style={sectionLabelStyle}>
          <span>Return % / year</span>
          <input
            aria-label="Return % / year"
            type="number"
            step="0.1"
            value={engine.simpleAveragePercentage}
            onChange={(event) => onUpdate({ simpleAveragePercentage: Number(event.target.value) })}
            style={inputStyle}
          />
        </label>
      ) : null}
      {engine.returnType === 'distributionReturn' ? (
        <>
          <label style={sectionLabelStyle}>
            <span>Distribution model</span>
            <select
              aria-label="Distribution model"
              value={engine.distributionType}
              onChange={(event) => onUpdate({ distributionType: event.target.value as FireSimulatorReturnEngine['distributionType'] })}
              style={inputStyle}
            >
              <option value="normal">Normal</option>
              <option value="brownianMotion">Brownian motion</option>
              <option value="studentT">Student t</option>
              <option value="regimeBased">Regime-based</option>
            </select>
          </label>
          {engine.distributionType === 'normal' ? (
            <>
              <label style={sectionLabelStyle}>
                <span>Normal mean</span>
                <input aria-label="Normal mean" type="number" step="0.001" value={engine.normalMean} onChange={(event) => onUpdate({ normalMean: Number(event.target.value) })} style={inputStyle} />
              </label>
              <label style={sectionLabelStyle}>
                <span>Normal std dev</span>
                <input aria-label="Normal std dev" type="number" step="0.001" value={engine.normalStdDev} onChange={(event) => onUpdate({ normalStdDev: Number(event.target.value) })} style={inputStyle} />
              </label>
            </>
          ) : null}
          {engine.distributionType === 'brownianMotion' ? (
            <>
              <label style={sectionLabelStyle}>
                <span>Brownian drift</span>
                <input aria-label="Brownian drift" type="number" step="0.001" value={engine.brownianDrift} onChange={(event) => onUpdate({ brownianDrift: Number(event.target.value) })} style={inputStyle} />
              </label>
              <label style={sectionLabelStyle}>
                <span>Brownian volatility</span>
                <input aria-label="Brownian volatility" type="number" step="0.001" value={engine.brownianVolatility} onChange={(event) => onUpdate({ brownianVolatility: Number(event.target.value) })} style={inputStyle} />
              </label>
            </>
          ) : null}
          {engine.distributionType === 'studentT' ? (
            <>
              <label style={sectionLabelStyle}>
                <span>Student-t mu</span>
                <input aria-label="Student-t mu" type="number" step="0.001" value={engine.studentMu} onChange={(event) => onUpdate({ studentMu: Number(event.target.value) })} style={inputStyle} />
              </label>
              <label style={sectionLabelStyle}>
                <span>Student-t sigma</span>
                <input aria-label="Student-t sigma" type="number" step="0.001" value={engine.studentSigma} onChange={(event) => onUpdate({ studentSigma: Number(event.target.value) })} style={inputStyle} />
              </label>
              <label style={sectionLabelStyle}>
                <span>Student-t nu</span>
                <input aria-label="Student-t nu" type="number" step="0.1" value={engine.studentNu} onChange={(event) => onUpdate({ studentNu: Number(event.target.value) })} style={inputStyle} />
              </label>
            </>
          ) : null}
          {engine.distributionType === 'regimeBased' ? (
            <>
              <label style={sectionLabelStyle}>
                <span>Regime tick months</span>
                <input aria-label="Regime tick months" type="number" min={1} step={1} value={engine.regimeTickMonths} onChange={(event) => onUpdate({ regimeTickMonths: Number(event.target.value) })} style={inputStyle} />
              </label>
              <label style={{ ...sectionLabelStyle, gridColumn: '1 / -1' }}>
                <span>Regimes (JSON)</span>
                <textarea
                  aria-label="Regimes (JSON)"
                  value={regimesDraft}
                  onChange={(event) => setRegimesDraft(event.target.value)}
                  onBlur={() => {
                    try {
                      onUpdate({ regimes: JSON.parse(regimesDraft) as FireSimulatorReturnEngine['regimes'] });
                      setRegimesError('');
                    } catch {
                      setRegimesError('Invalid JSON. Fix the regimes payload before leaving the field.');
                    }
                  }}
                  style={textareaStyle}
                />
                {regimesError ? <span style={{ color: '#b42318', fontSize: 12 }}>{regimesError}</span> : null}
              </label>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
};

export const SimulationStartTaxPage: React.FC = () => {
  const { draftAssumptions, updateDraftAssumptions } = useAssumptions();

  return (
    <SetupPageShell
      title="Tax Optimizer"
      description="Configure the top-level tax regime and shared exemption defaults used by the new FIRE Simulator."
      badge="Lifestyle"
    >
      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <div style={{ fontWeight: 800 }}>Simulator tax defaults</div>
        <div style={fieldGridStyle}>
          <label style={sectionLabelStyle}>
            <span>Overall tax rule</span>
            <select
              aria-label="Overall tax rule"
              value={draftAssumptions.fireSimulatorDefaults.overallTaxRule}
              onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'fireSimulatorDefaults', { overallTaxRule: event.target.value as Assumptions['fireSimulatorDefaults']['overallTaxRule'], templateId: 'custom' })}
              style={inputStyle}
            >
              <option value="CAPITAL">Capital gains</option>
              <option value="NOTIONAL">Notional gains</option>
            </select>
          </label>
          <label style={sectionLabelStyle}>
            <span>Tax percentage</span>
            <input
              aria-label="Simulation tax percentage"
              type="number"
              step="0.1"
              value={draftAssumptions.fireSimulatorDefaults.taxPercentage}
              onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'fireSimulatorDefaults', { taxPercentage: Number(event.target.value), templateId: 'custom' })}
              style={inputStyle}
            />
          </label>
          <label style={sectionLabelStyle}>
            <span>Exemption card limit</span>
            <input aria-label="Exemption card limit" type="number" value={draftAssumptions.taxExemptionDefaults.exemptionCardLimit} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { exemptionCardLimit: Number(event.target.value) })} style={inputStyle} />
          </label>
          <label style={sectionLabelStyle}>
            <span>Exemption card yearly increase</span>
            <input aria-label="Exemption card yearly increase" type="number" value={draftAssumptions.taxExemptionDefaults.exemptionCardYearlyIncrease} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { exemptionCardYearlyIncrease: Number(event.target.value) })} style={inputStyle} />
          </label>
          <label style={sectionLabelStyle}>
            <span>Stock exemption tax rate</span>
            <input aria-label="Stock exemption tax rate" type="number" step="0.1" value={draftAssumptions.taxExemptionDefaults.stockExemptionTaxRate} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { stockExemptionTaxRate: Number(event.target.value) })} style={inputStyle} />
          </label>
          <label style={sectionLabelStyle}>
            <span>Stock exemption limit</span>
            <input aria-label="Stock exemption limit" type="number" value={draftAssumptions.taxExemptionDefaults.stockExemptionLimit} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { stockExemptionLimit: Number(event.target.value) })} style={inputStyle} />
          </label>
          <label style={sectionLabelStyle}>
            <span>Stock exemption yearly increase</span>
            <input aria-label="Stock exemption yearly increase" type="number" value={draftAssumptions.taxExemptionDefaults.stockExemptionYearlyIncrease} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { stockExemptionYearlyIncrease: Number(event.target.value) })} style={inputStyle} />
          </label>
        </div>
      </div>
    </SetupPageShell>
  );
};

export const SimulationTaxExemptionsPage: React.FC = () => {
  return (
    <SimulationStartTaxPage />
  );
};

export const SimulationInvestPage: React.FC = () => {
  const { draftAssumptions, updateDraftAssumptions } = useAssumptions();
  const updateReturnEngine = (patch: Partial<FireSimulatorReturnEngine>) => {
    updateNestedSection(draftAssumptions, updateDraftAssumptions, 'fireSimulatorDefaults', {
      templateId: 'custom',
      returnEngine: {
        ...draftAssumptions.fireSimulatorDefaults.returnEngine,
        ...patch,
      },
    });
  };

  return (
    <SetupPageShell
      title="Simulation Invest"
      description="Shape the economic backdrop and return engine the new FIRE Simulator will use when it materializes a run from shared assumptions."
      badge="Model / Build"
      actions={<Link to="/simulation-engine" style={{ ...chipStyle, textDecoration: 'none' }}>Engine settings</Link>}
    >
      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <div style={{ fontWeight: 800 }}>Return engine</div>
        <div style={{ opacity: 0.78, fontSize: 13 }}>
          This page now owns the simulator’s full return engine. The duplicate expected-return and passive-model fields are removed from this flow.
        </div>
        <div style={fieldGridStyle}>
          <label style={sectionLabelStyle}>
            <span>Yearly fee (%/year)</span>
            <input aria-label="Simulation yearly fee" type="number" step="0.1" value={draftAssumptions.yearlyFeePct} onChange={(event) => updateDraftAssumptions({ yearlyFeePct: Number(event.target.value) })} style={inputStyle} />
          </label>
          <ReturnEngineFields engine={draftAssumptions.fireSimulatorDefaults.returnEngine} onUpdate={updateReturnEngine} />
        </div>
      </div>
    </SetupPageShell>
  );
};

export const SimulationEnginePage: React.FC = () => {
  const { executionDefaults, updateExecutionDefaults, resetExecutionDefaults } = useExecutionDefaults();
  const defaults = getDefaultExecutionDefaults();

  return (
    <PageLayout variant="constrained" maxWidthPx={1040}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={chipStyle}>Model / Build</span>
            <span style={chipStyle}>Saved instantly</span>
            <Link to="/fire-simulator" style={{ ...chipStyle, textDecoration: 'none' }}>Back to FIRE Simulator</Link>
          </div>
          <h1 style={{ margin: 0 }}>Simulation Engine</h1>
          <div style={{ opacity: 0.8 }}>Execution settings still live in the dedicated execution defaults store, but this page gives them a focused setup surface for the new simulator flow.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={resetExecutionDefaults} style={buttonStyle}>Reset engine defaults</button>
          </div>
        </div>

        <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
          <div style={{ fontWeight: 800 }}>Execution defaults</div>
          <div style={fieldGridStyle}>
            <label style={sectionLabelStyle}>
              <span>Paths</span>
              <input aria-label="Execution paths" type="number" min={1} step={1} value={executionDefaults.paths} onChange={(event) => updateExecutionDefaults({ paths: Number(event.target.value) })} style={inputStyle} />
            </label>
            <label style={sectionLabelStyle}>
              <span>Batch size</span>
              <input aria-label="Execution batch size" type="number" min={1} step={1} value={executionDefaults.batchSize} onChange={(event) => updateExecutionDefaults({ batchSize: Number(event.target.value) })} style={inputStyle} />
            </label>
            <label style={sectionLabelStyle}>
              <span>Seed mode</span>
              <select aria-label="Execution seed mode" value={executionDefaults.seedMode} onChange={(event) => updateExecutionDefaults({ seedMode: event.target.value as typeof executionDefaults.seedMode })} style={inputStyle}>
                <option value="default">default</option>
                <option value="custom">custom</option>
                <option value="random">random</option>
              </select>
            </label>
            {executionDefaults.seedMode === 'custom' ? (
              <label style={sectionLabelStyle}>
                <span>Custom seed</span>
                <input aria-label="Execution custom seed" type="number" min={1} step={1} value={executionDefaults.customSeed} onChange={(event) => updateExecutionDefaults({ customSeed: Number(event.target.value) })} style={inputStyle} />
              </label>
            ) : null}
          </div>
          <div style={{ fontSize: 13, opacity: 0.76 }}>
            Defaults: {defaults.paths.toLocaleString()} paths · batch {defaults.batchSize.toLocaleString()} · {defaults.seedMode} seed mode{executionDefaults.seedMode === 'custom' ? ` · seed ${executionDefaults.customSeed}` : ''}.
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export const SimulationPlanPage: React.FC = () => {
  const { draftAssumptions, setDraftAssumptions, updateDraftAssumptions } = useAssumptions();
  const phases = draftAssumptions.fireSimulatorDefaults.phases;

  const updatePhases = (nextPhases: PhaseRequest[]) => {
    setDraftAssumptions({
      ...draftAssumptions,
      fireSimulatorDefaults: {
        ...draftAssumptions.fireSimulatorDefaults,
        templateId: 'custom',
        phases: nextPhases,
      },
    });
  };

  const applyTemplate = (templateId: SimulationTemplateId) => {
    updateDraftAssumptions({
      fireSimulatorDefaults: applyFireSimulatorTemplate(draftAssumptions.fireSimulatorDefaults, templateId),
    });
  };

  const handleAddDefaultPhase = () => {
    updatePhases([...phases, createDefaultPhase('DEPOSIT')]);
  };

  return (
    <SetupPageShell
      title="Simulation Plan"
      description="Build the ordered phase list that the new FIRE Simulator will run: deposit, passive, and withdraw phases live here now as shared assumptions."
      badge="Plan"
    >
      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <div style={{ fontWeight: 800 }}>General options</div>
        <div style={fieldGridStyle}>
          <label style={sectionLabelStyle}>
            <span>Template</span>
            <select aria-label="Simulation template" value={draftAssumptions.fireSimulatorDefaults.templateId} onChange={(event) => applyTemplate(event.target.value as SimulationTemplateId)} style={inputStyle}>
              {SIMULATION_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{template.label}</option>
              ))}
            </select>
          </label>
          <label style={sectionLabelStyle}>
            <span>Start date</span>
            <input
              aria-label="Simulation start date"
              type="date"
              value={draftAssumptions.fireSimulatorDefaults.startDate}
              onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'fireSimulatorDefaults', { startDate: event.target.value, templateId: 'custom' })}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ fontSize: 13, opacity: 0.78 }}>Templates apply directly to the shared simulator assumptions. Manual edits switch the plan back to Custom.</div>
      </div>
      <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Current phase list</div>
        <NormalPhaseList
          phases={phases}
          onPhaseChange={(index, field, value) => updatePhases(phases.map((phase, phaseIndex) => (phaseIndex === index ? { ...phase, [field]: value as never } : phase)))}
          onPhaseReplace={(index, phase) => updatePhases(phases.map((entry, phaseIndex) => (phaseIndex === index ? { ...phase, taxRules: phase.taxRules ?? [] } : entry)))}
          onPhaseRemove={(index) => updatePhases(phases.filter((_, phaseIndex) => phaseIndex !== index))}
          onToggleTaxRule={(index, rule) => updatePhases(phases.map((phase, phaseIndex) => {
            if (phaseIndex !== index) return phase;
            const currentRules = phase.taxRules ?? [];
            return {
              ...phase,
              taxRules: currentRules.includes(rule) ? currentRules.filter((currentRule) => currentRule !== rule) : [...currentRules, rule],
            };
          }))}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button type="button" onClick={handleAddDefaultPhase} style={buttonStyle}>
            Add Phase
          </button>
        </div>
      </div>
    </SetupPageShell>
  );
};