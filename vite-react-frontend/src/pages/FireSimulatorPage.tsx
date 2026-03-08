import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import MultiPhaseOverview from '../MultiPhaseOverview';
import { startAdvancedSimulation } from '../api/simulation';
import NormalPhaseList from '../components/normalMode/NormalPhaseList';
import PageLayout from '../components/PageLayout';
import SimulationProgress from '../components/SimulationProgress';
import { SIMULATION_TEMPLATES, type SimulationTemplateId } from '../config/simulationTemplates';
import {
  applyFireSimulatorTemplate,
  buildAdvancedSimulationRequestFromAssumptions,
  buildSimulationRequestFromAssumptions,
  buildSimulationTimelineFromRequest,
} from '../lib/fireSimulatorAssumptions';
import type { PhaseRequest } from '../models/types';
import type { YearlySummary } from '../models/YearlySummary';
import { useAssumptions } from '../state/assumptions';
import { useExecutionDefaults } from '../state/executionDefaults';
import { appendSimulationSnapshot } from '../state/simulationSnapshots';

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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const actionLinkStyle: React.CSSProperties = {
  ...chipStyle,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const primaryButtonStyle: React.CSSProperties = {
  ...chipStyle,
  background: 'var(--fc-card-text)',
  color: 'var(--fc-card-bg)',
  cursor: 'pointer',
  fontWeight: 700,
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
};

const formatDuration = (totalMonths: number): string => {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} years, ${months} months`;
  if (years > 0) return `${years} years`;
  return `${months} months`;
};

const formatTaxRule = (rule: string): string => (rule === 'NOTIONAL' ? 'Notional gains' : 'Capital gains');

const FireSimulatorPage: React.FC = () => {
  const { draftAssumptions, isDraftDirty, updateDraftAssumptions, setDraftAssumptions } = useAssumptions();
  const { executionDefaults } = useExecutionDefaults();
  const [stats, setStats] = useState<YearlySummary[] | null>(null);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useMemo(() => buildSimulationRequestFromAssumptions(draftAssumptions), [draftAssumptions]);
  const advancedRequest = useMemo(
    () => buildAdvancedSimulationRequestFromAssumptions(draftAssumptions, executionDefaults),
    [draftAssumptions, executionDefaults]
  );
  const timeline = useMemo(
    () => buildSimulationTimelineFromRequest(request, draftAssumptions.inflationPct),
    [draftAssumptions.inflationPct, request]
  );

  const totalMonths = request.phases.reduce((sum, phase) => sum + (Number(phase.durationInMonths) || 0), 0);

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

  const handleRun = async () => {
    if (request.phases.length === 0) {
      setError('Add at least one phase in Simulation Plan before running the simulator.');
      return;
    }

    setError(null);
    setStats(null);
    setSimulationId(null);

    try {
      const started = await startAdvancedSimulation(advancedRequest);
      appendSimulationSnapshot({
        runId: started.id,
        createdAt: started.createdAt ?? new Date().toISOString(),
        assumptions: draftAssumptions,
        advancedRequest,
      });
      setSimulationId(started.id);
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to start simulation.');
    }
  };

  return (
    <PageLayout variant="constrained">
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={chipStyle}>FIRE Simulator</span>
            <span style={chipStyle}>{isDraftDirty ? 'Unsaved draft assumptions' : 'Saved baseline assumptions'}</span>
            <span style={chipStyle}>{request.phases.length} phases</span>
            <span style={chipStyle}>{formatDuration(totalMonths)}</span>
          </div>
          <h1 style={{ margin: 0 }}>FIRE Simulator</h1>
          <div style={{ opacity: 0.8, maxWidth: 760 }}>
            This simulator runs directly from the shared assumptions draft. General options stay here, while Tax Optimizer, Invest, Engine, and Plan pages own the broader setup flow.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>General Options</div>
            <label style={fieldLabelStyle}>
              <span>Template</span>
              <select
                aria-label="Simulation template"
                value={draftAssumptions.fireSimulatorDefaults.templateId}
                onChange={(event) => updateDraftAssumptions({
                  fireSimulatorDefaults: applyFireSimulatorTemplate(
                    draftAssumptions.fireSimulatorDefaults,
                    event.target.value as SimulationTemplateId
                  ),
                })}
                style={inputStyle}
              >
                {SIMULATION_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: 13, opacity: 0.78 }}>Presets now write directly into the shared simulator assumptions.</div>
            <label style={fieldLabelStyle}>
              <span>Start Date</span>
              <input
                aria-label="Simulation start date"
                type="date"
                value={draftAssumptions.fireSimulatorDefaults.startDate}
                onChange={(event) => updateDraftAssumptions({
                  fireSimulatorDefaults: {
                    ...draftAssumptions.fireSimulatorDefaults,
                    templateId: 'custom',
                    startDate: event.target.value,
                  },
                })}
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Phase list</div>
            {request.phases.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No phases defined yet. Use the Plan page to add deposit, passive, and withdraw phases.</div>
            ) : (
              <NormalPhaseList
                phases={request.phases}
                onPhaseChange={(index, field, value) => updatePhases(request.phases.map((phase, phaseIndex) => (phaseIndex === index ? { ...phase, [field]: value as never } : phase)))}
                onPhaseReplace={(index, phase) => updatePhases(request.phases.map((entry, phaseIndex) => (phaseIndex === index ? { ...phase, taxRules: phase.taxRules ?? [] } : entry)))}
                onPhaseRemove={(index) => updatePhases(request.phases.filter((_, phaseIndex) => phaseIndex !== index))}
                onToggleTaxRule={(index, rule) => updatePhases(request.phases.map((phase, phaseIndex) => {
                  if (phaseIndex !== index) return phase;
                  const currentRules = phase.taxRules ?? [];
                  return {
                    ...phase,
                    taxRules: currentRules.includes(rule) ? currentRules.filter((currentRule) => currentRule !== rule) : [...currentRules, rule],
                  };
                }))}
              />
            )}
            <div style={rowStyle}>
              <Link to="/simulation-plan" style={actionLinkStyle}>Add phase</Link>
              <span style={{ fontSize: 13, opacity: 0.76 }}>Manage the phase builder and template-free plan editing on the Plan page.</span>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Run</div>
            <div style={{ fontSize: 13, opacity: 0.82 }}>
              {formatTaxRule(draftAssumptions.fireSimulatorDefaults.overallTaxRule)} at {draftAssumptions.fireSimulatorDefaults.taxPercentage}% tax · {draftAssumptions.fireSimulatorDefaults.returnEngine.returnType} · {executionDefaults.paths.toLocaleString()} paths · batch {executionDefaults.batchSize.toLocaleString()} · {executionDefaults.seedMode} seed mode{executionDefaults.seedMode === 'custom' ? ` (${executionDefaults.customSeed})` : ''}
            </div>
            <div style={rowStyle}>
              <button type="button" onClick={handleRun} style={primaryButtonStyle}>Run Simulation</button>
              <Link to="/simulation-start-tax" style={actionLinkStyle}>Tax Optimizer</Link>
              <Link to="/simulation-invest" style={actionLinkStyle}>Simulation Invest</Link>
              <Link to="/simulation-engine" style={actionLinkStyle}>Simulation Engine</Link>
              <Link to="/assumptions" style={actionLinkStyle}>Assumptions Hub</Link>
              <Link to="/simulation" style={actionLinkStyle}>Legacy Simulator</Link>
            </div>
            {error ? <div role="alert" style={{ color: '#b42318' }}>{error}</div> : null}
          </div>
        </div>

        {simulationId && !stats ? (
          <div style={cardStyle}>
            <SimulationProgress simulationId={simulationId} onComplete={(results) => setStats(results)} />
          </div>
        ) : null}

        {stats ? (
          <div style={cardStyle}>
            <MultiPhaseOverview data={stats} timeline={timeline} />
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
};

export default FireSimulatorPage;