import React, { useMemo, useState } from 'react';

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
import { Button, Card, Chip, Input, LinkButton, Select } from '../components/ui';

const formatDuration = (totalMonths: number): string => {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} years, ${months} months`;
  if (years > 0) return `${years} years`;
  return `${months} months`;
};

const formatTaxRule = (rule: string): string => (rule === 'NOTIONAL' ? 'Notional gains' : 'Capital gains');

const fieldLabelClass = 'grid gap-1.5 text-xs';

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
      <div className="mx-auto grid max-w-245 gap-4">
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Chip>FIRE Simulator</Chip>
            <Chip>{isDraftDirty ? 'Unsaved draft assumptions' : 'Saved baseline assumptions'}</Chip>
            <Chip>{request.phases.length} phases</Chip>
            <Chip>{formatDuration(totalMonths)}</Chip>
          </div>
          <h1 className="m-0 text-2xl font-extrabold">FIRE Simulator</h1>
          <div className="max-w-190 opacity-80">
            This simulator runs directly from the shared assumptions draft. General options stay here, while Tax
            Optimizer, Invest, Engine, and Plan pages own the broader setup flow.
          </div>
        </div>

        <div className="grid max-w-160 gap-4">
          <Card className="grid gap-3">
            <div className="text-lg font-extrabold">General Options</div>
            <label className={fieldLabelClass}>
              <span>Template</span>
              <Select
                aria-label="Simulation template"
                value={draftAssumptions.fireSimulatorDefaults.templateId}
                onChange={(event) => updateDraftAssumptions({
                  fireSimulatorDefaults: applyFireSimulatorTemplate(
                    draftAssumptions.fireSimulatorDefaults,
                    event.target.value as SimulationTemplateId
                  ),
                })}
              >
                {SIMULATION_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </Select>
            </label>
            <div className="text-xs opacity-78">Presets now write directly into the shared simulator assumptions.</div>
            <label className={fieldLabelClass}>
              <span>Start Date</span>
              <Input
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
              />
            </label>
          </Card>

          <Card className="grid gap-3">
            <div className="text-lg font-extrabold">Phase list</div>
            {request.phases.length === 0 ? (
              <div className="opacity-80">No phases defined yet. Use the Plan page to add deposit, passive, and withdraw phases.</div>
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
            <div className="flex flex-wrap items-center gap-2">
              <LinkButton to="/simulation-plan">Add phase</LinkButton>
              <span className="text-xs opacity-76">Manage the phase builder and template-free plan editing on the Plan page.</span>
            </div>
          </Card>

          <Card className="grid gap-3">
            <div className="text-lg font-extrabold">Run</div>
            <div className="text-xs opacity-82">
              {formatTaxRule(draftAssumptions.fireSimulatorDefaults.overallTaxRule)} at {draftAssumptions.fireSimulatorDefaults.taxPercentage}% tax · {draftAssumptions.fireSimulatorDefaults.returnEngine.returnType} · {executionDefaults.paths.toLocaleString()} paths · batch {executionDefaults.batchSize.toLocaleString()} · {executionDefaults.seedMode} seed mode{executionDefaults.seedMode === 'custom' ? ` (${executionDefaults.customSeed})` : ''}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={handleRun}>Run Simulation</Button>
              <LinkButton to="/simulation-start-tax">Tax Optimizer</LinkButton>
              <LinkButton to="/simulation-invest">Simulation Invest</LinkButton>
              <LinkButton to="/simulation-engine">Simulation Engine</LinkButton>
              <LinkButton to="/assumptions">Assumptions Hub</LinkButton>
              <LinkButton to="/simulation">Legacy Simulator</LinkButton>
            </div>
            {error ? <div role="alert" className="text-danger">{error}</div> : null}
          </Card>
        </div>

        {simulationId && !stats ? (
          <Card>
            <SimulationProgress simulationId={simulationId} onComplete={(results) => setStats(results)} />
          </Card>
        ) : null}

        {stats ? (
          <Card>
            <MultiPhaseOverview data={stats} timeline={timeline} />
          </Card>
        ) : null}
      </div>
    </PageLayout>
  );
};

export default FireSimulatorPage;
