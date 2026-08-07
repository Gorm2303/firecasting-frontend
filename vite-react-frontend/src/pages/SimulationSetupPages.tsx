import React from 'react';

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
import { Button, Card, Chip, Input, LinkButton, Select, Textarea } from '../components/ui';

const fieldGridClass = 'grid gap-3';
const sectionLabelClass = 'grid gap-1.5 text-xs';

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
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Chip>{badge}</Chip>
            <Chip>{isDraftDirty ? 'Unsaved draft' : 'Saved draft'}</Chip>
            <LinkButton to="/fire-simulator">Back to FIRE Simulator</LinkButton>
          </div>
          <h1 className="m-0 text-2xl font-extrabold">{title}</h1>
          <div className="opacity-80">{description}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={saveDraft}>Save baseline</Button>
            <Button variant="secondary" onClick={resetDraftToCurrent}>Cancel draft</Button>
            <Button variant="secondary" onClick={resetDraftToDefaults}>Reset to defaults</Button>
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
      <label className={sectionLabelClass}>
        <span>Return engine</span>
        <Select
          aria-label="Simulation return engine"
          value={engine.returnType}
          onChange={(event) => onUpdate({ returnType: event.target.value as FireSimulatorReturnEngine['returnType'] })}
        >
          <option value="dataDrivenReturn">Data-driven return</option>
          <option value="distributionReturn">Distribution return</option>
          <option value="simpleReturn">Simple return</option>
        </Select>
      </label>
      {engine.returnType === 'simpleReturn' ? (
        <label className={sectionLabelClass}>
          <span>Return % / year</span>
          <Input
            aria-label="Return % / year"
            type="number"
            step="0.1"
            value={engine.simpleAveragePercentage}
            onChange={(event) => onUpdate({ simpleAveragePercentage: Number(event.target.value) })}
          />
        </label>
      ) : null}
      {engine.returnType === 'distributionReturn' ? (
        <>
          <label className={sectionLabelClass}>
            <span>Distribution model</span>
            <Select
              aria-label="Distribution model"
              value={engine.distributionType}
              onChange={(event) => onUpdate({ distributionType: event.target.value as FireSimulatorReturnEngine['distributionType'] })}
            >
              <option value="normal">Normal</option>
              <option value="brownianMotion">Brownian motion</option>
              <option value="studentT">Student t</option>
              <option value="regimeBased">Regime-based</option>
            </Select>
          </label>
          {engine.distributionType === 'normal' ? (
            <>
              <label className={sectionLabelClass}>
                <span>Normal mean</span>
                <Input aria-label="Normal mean" type="number" step="0.001" value={engine.normalMean} onChange={(event) => onUpdate({ normalMean: Number(event.target.value) })} />
              </label>
              <label className={sectionLabelClass}>
                <span>Normal std dev</span>
                <Input aria-label="Normal std dev" type="number" step="0.001" value={engine.normalStdDev} onChange={(event) => onUpdate({ normalStdDev: Number(event.target.value) })} />
              </label>
            </>
          ) : null}
          {engine.distributionType === 'brownianMotion' ? (
            <>
              <label className={sectionLabelClass}>
                <span>Brownian drift</span>
                <Input aria-label="Brownian drift" type="number" step="0.001" value={engine.brownianDrift} onChange={(event) => onUpdate({ brownianDrift: Number(event.target.value) })} />
              </label>
              <label className={sectionLabelClass}>
                <span>Brownian volatility</span>
                <Input aria-label="Brownian volatility" type="number" step="0.001" value={engine.brownianVolatility} onChange={(event) => onUpdate({ brownianVolatility: Number(event.target.value) })} />
              </label>
            </>
          ) : null}
          {engine.distributionType === 'studentT' ? (
            <>
              <label className={sectionLabelClass}>
                <span>Student-t mu</span>
                <Input aria-label="Student-t mu" type="number" step="0.001" value={engine.studentMu} onChange={(event) => onUpdate({ studentMu: Number(event.target.value) })} />
              </label>
              <label className={sectionLabelClass}>
                <span>Student-t sigma</span>
                <Input aria-label="Student-t sigma" type="number" step="0.001" value={engine.studentSigma} onChange={(event) => onUpdate({ studentSigma: Number(event.target.value) })} />
              </label>
              <label className={sectionLabelClass}>
                <span>Student-t nu</span>
                <Input aria-label="Student-t nu" type="number" step="0.1" value={engine.studentNu} onChange={(event) => onUpdate({ studentNu: Number(event.target.value) })} />
              </label>
            </>
          ) : null}
          {engine.distributionType === 'regimeBased' ? (
            <>
              <label className={sectionLabelClass}>
                <span>Regime tick months</span>
                <Input aria-label="Regime tick months" type="number" min={1} step={1} value={engine.regimeTickMonths} onChange={(event) => onUpdate({ regimeTickMonths: Number(event.target.value) })} />
              </label>
              <label className={sectionLabelClass + ' col-span-full'}>
                <span>Regimes (JSON)</span>
                <Textarea
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
                  className="min-h-55 font-mono"
                />
                {regimesError ? <span className="text-xs text-danger">{regimesError}</span> : null}
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
      <Card className="grid gap-3.5">
        <div className="font-extrabold">Simulator tax defaults</div>
        <div className={fieldGridClass} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className={sectionLabelClass}>
            <span>Overall tax rule</span>
            <Select
              aria-label="Overall tax rule"
              value={draftAssumptions.fireSimulatorDefaults.overallTaxRule}
              onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'fireSimulatorDefaults', { overallTaxRule: event.target.value as Assumptions['fireSimulatorDefaults']['overallTaxRule'], templateId: 'custom' })}
            >
              <option value="CAPITAL">Capital gains</option>
              <option value="NOTIONAL">Notional gains</option>
            </Select>
          </label>
          <label className={sectionLabelClass}>
            <span>Tax percentage</span>
            <Input
              aria-label="Simulation tax percentage"
              type="number"
              step="0.1"
              value={draftAssumptions.fireSimulatorDefaults.taxPercentage}
              onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'fireSimulatorDefaults', { taxPercentage: Number(event.target.value), templateId: 'custom' })}
            />
          </label>
          <label className={sectionLabelClass}>
            <span>Exemption card limit</span>
            <Input aria-label="Exemption card limit" type="number" value={draftAssumptions.taxExemptionDefaults.exemptionCardLimit} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { exemptionCardLimit: Number(event.target.value) })} />
          </label>
          <label className={sectionLabelClass}>
            <span>Exemption card yearly increase</span>
            <Input aria-label="Exemption card yearly increase" type="number" value={draftAssumptions.taxExemptionDefaults.exemptionCardYearlyIncrease} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { exemptionCardYearlyIncrease: Number(event.target.value) })} />
          </label>
          <label className={sectionLabelClass}>
            <span>Stock exemption tax rate</span>
            <Input aria-label="Stock exemption tax rate" type="number" step="0.1" value={draftAssumptions.taxExemptionDefaults.stockExemptionTaxRate} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { stockExemptionTaxRate: Number(event.target.value) })} />
          </label>
          <label className={sectionLabelClass}>
            <span>Stock exemption limit</span>
            <Input aria-label="Stock exemption limit" type="number" value={draftAssumptions.taxExemptionDefaults.stockExemptionLimit} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { stockExemptionLimit: Number(event.target.value) })} />
          </label>
          <label className={sectionLabelClass}>
            <span>Stock exemption yearly increase</span>
            <Input aria-label="Stock exemption yearly increase" type="number" value={draftAssumptions.taxExemptionDefaults.stockExemptionYearlyIncrease} onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'taxExemptionDefaults', { stockExemptionYearlyIncrease: Number(event.target.value) })} />
          </label>
        </div>
      </Card>
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
      actions={<LinkButton to="/simulation-engine">Engine settings</LinkButton>}
    >
      <Card className="grid gap-3.5">
        <div className="font-extrabold">Return engine</div>
        <div className="text-xs opacity-78">
          This page now owns the simulator's full return engine. The duplicate expected-return and passive-model fields are removed from this flow.
        </div>
        <div className={fieldGridClass} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className={sectionLabelClass}>
            <span>Yearly fee (%/year)</span>
            <Input aria-label="Simulation yearly fee" type="number" step="0.1" value={draftAssumptions.yearlyFeePct} onChange={(event) => updateDraftAssumptions({ yearlyFeePct: Number(event.target.value) })} />
          </label>
          <ReturnEngineFields engine={draftAssumptions.fireSimulatorDefaults.returnEngine} onUpdate={updateReturnEngine} />
        </div>
      </Card>
    </SetupPageShell>
  );
};

export const SimulationEnginePage: React.FC = () => {
  const { executionDefaults, updateExecutionDefaults, resetExecutionDefaults } = useExecutionDefaults();
  const defaults = getDefaultExecutionDefaults();

  return (
    <PageLayout variant="constrained" maxWidthPx={1040}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Chip>Model / Build</Chip>
            <Chip>Saved instantly</Chip>
            <LinkButton to="/fire-simulator">Back to FIRE Simulator</LinkButton>
          </div>
          <h1 className="m-0 text-2xl font-extrabold">Simulation Engine</h1>
          <div className="opacity-80">Execution settings still live in the dedicated execution defaults store, but this page gives them a focused setup surface for the new simulator flow.</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={resetExecutionDefaults}>Reset engine defaults</Button>
          </div>
        </div>

        <Card className="grid gap-3.5">
          <div className="font-extrabold">Execution defaults</div>
          <div className={fieldGridClass} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label className={sectionLabelClass}>
              <span>Paths</span>
              <Input aria-label="Execution paths" type="number" min={1} step={1} value={executionDefaults.paths} onChange={(event) => updateExecutionDefaults({ paths: Number(event.target.value) })} />
            </label>
            <label className={sectionLabelClass}>
              <span>Batch size</span>
              <Input aria-label="Execution batch size" type="number" min={1} step={1} value={executionDefaults.batchSize} onChange={(event) => updateExecutionDefaults({ batchSize: Number(event.target.value) })} />
            </label>
            <label className={sectionLabelClass}>
              <span>Seed mode</span>
              <Select aria-label="Execution seed mode" value={executionDefaults.seedMode} onChange={(event) => updateExecutionDefaults({ seedMode: event.target.value as typeof executionDefaults.seedMode })}>
                <option value="default">default</option>
                <option value="custom">custom</option>
                <option value="random">random</option>
              </Select>
            </label>
            {executionDefaults.seedMode === 'custom' ? (
              <label className={sectionLabelClass}>
                <span>Custom seed</span>
                <Input aria-label="Execution custom seed" type="number" min={1} step={1} value={executionDefaults.customSeed} onChange={(event) => updateExecutionDefaults({ customSeed: Number(event.target.value) })} />
              </label>
            ) : null}
          </div>
          <div className="text-xs opacity-76">
            Defaults: {defaults.paths.toLocaleString()} paths · batch {defaults.batchSize.toLocaleString()} · {defaults.seedMode} seed mode{executionDefaults.seedMode === 'custom' ? ` · seed ${executionDefaults.customSeed}` : ''}.
          </div>
        </Card>
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
      <Card className="grid gap-3.5">
        <div className="font-extrabold">General options</div>
        <div className={fieldGridClass} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className={sectionLabelClass}>
            <span>Template</span>
            <Select aria-label="Simulation template" value={draftAssumptions.fireSimulatorDefaults.templateId} onChange={(event) => applyTemplate(event.target.value as SimulationTemplateId)}>
              {SIMULATION_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{template.label}</option>
              ))}
            </Select>
          </label>
          <label className={sectionLabelClass}>
            <span>Start date</span>
            <Input
              aria-label="Simulation start date"
              type="date"
              value={draftAssumptions.fireSimulatorDefaults.startDate}
              onChange={(event) => updateNestedSection(draftAssumptions, updateDraftAssumptions, 'fireSimulatorDefaults', { startDate: event.target.value, templateId: 'custom' })}
            />
          </label>
        </div>
        <div className="text-xs opacity-78">Templates apply directly to the shared simulator assumptions. Manual edits switch the plan back to Custom.</div>
      </Card>
      <Card className="grid gap-2.5">
        <div className="font-extrabold">Current phase list</div>
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
        <div className="flex justify-start">
          <Button variant="secondary" onClick={handleAddDefaultPhase}>
            Add Phase
          </Button>
        </div>
      </Card>
    </SetupPageShell>
  );
};
