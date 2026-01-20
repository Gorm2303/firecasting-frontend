// src/features/simulation/SimulationForm.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { YearlySummary } from '../../models/YearlySummary';
import { PhaseRequest, SimulationRequest, SimulationTimelineContext } from '../../models/types';
import NormalPhaseList from '../../components/normalMode/NormalPhaseList';
import ExportStatisticsButton from '../../components/ExportStatisticsButton';
import SimulationProgress from '../../components/SimulationProgress';
import { startSimulation, exportSimulationCsv } from '../../api/simulation';
import { createDefaultSimulationRequest, createDefaultPhase } from '../../config/simulationDefaults';
import { getTemplateById, resolveTemplateToRequest, SIMULATION_TEMPLATES, type SimulationTemplateId } from '../../config/simulationTemplates';
import {
  deleteScenario,
  findScenarioById,
  findScenarioByName,
  listSavedScenarios,
  saveScenario,
  type SavedScenario,
} from '../../config/savedScenarios';
import { deepEqual } from '../../utils/deepEqual';

type OverallTaxRule = 'CAPITAL' | 'NOTIONAL';

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  selector?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  waitFor?: number;
};

const btn = (variant: 'primary' | 'ghost' | 'disabled'): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #444',
    cursor: 'pointer',
    fontSize: 14,
  };
  if (variant === 'primary') return { ...base, background: '#2e2e2e', color: '#fff' };
  if (variant === 'disabled') return { ...base, opacity: 0.5, background: '#222', color: '#bbb', cursor: 'not-allowed' };
  return { ...base, background: 'transparent', color: '#ddd' };
};

// Tiny in-file coachmark (same as you had)
const Coachmark: React.FC<{
  step: TutorialStep;
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
  isFirst: boolean;
  isLast: boolean;
}> = ({ step, onNext, onBack, onExit, isFirst, isLast }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback(() => {
    if (!step.selector) { setRect(null); return; }
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    setRect(el.getBoundingClientRect());
  }, [step]);

  useEffect(() => {
    let t: number | undefined;
    const doMeasure = () => measure();
    if (step.waitFor && step.waitFor > 0) t = window.setTimeout(doMeasure, step.waitFor);
    else doMeasure();
    window.addEventListener('resize', doMeasure);
    window.addEventListener('scroll', doMeasure, true);
    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener('resize', doMeasure);
      window.removeEventListener('scroll', doMeasure, true);
    };
  }, [step, measure]);

  const tooltipBase: React.CSSProperties = {
    position: 'fixed', zIndex: 999999, maxWidth: 320,
    background: '#111', color: '#fff', border: '1px solid #333',
    borderRadius: 12, padding: '12px 14px', boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
  };

  const tooltipStyle: React.CSSProperties = (() => {
    if (!rect) return { ...tooltipBase, top: '20%', left: '50%', transform: 'translateX(-50%)' };
    const gap = 10;
    switch (step.placement) {
      case 'bottom': return { ...tooltipBase, top: rect.bottom + gap, left: rect.left };
      case 'left':   return { ...tooltipBase, top: rect.top, left: rect.left - 340 };
      case 'right':  return { ...tooltipBase, top: rect.top, left: rect.right + gap };
      case 'top':
      default:       return { ...tooltipBase, top: rect.top - 140, left: rect.left };
    }
  })();

  const spotlightStyle: React.CSSProperties = rect
    ? { position: 'fixed', top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: 8, border: '2px solid #6ea8fe', boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)', pointerEvents: 'none', zIndex: 999998 }
    : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 999998, pointerEvents: 'none' };

  return (
    <>
      <div style={spotlightStyle} />
      <div style={tooltipStyle} role="dialog" aria-live="polite">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 14, opacity: 0.95, lineHeight: 1.35 }}>{step.body}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onExit} style={btn('ghost')}>Exit</button>
          <button type="button" onClick={onBack} disabled={isFirst} style={btn(isFirst ? 'disabled' : 'ghost')}>Back</button>
          <button type="button" onClick={onNext} style={btn('primary')}>{isLast ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    </>
  );
};

// --- helpers for duration display ---
const MAX_YEARS = 100;
const MAX_MONTHS = MAX_YEARS * 12;

const formatYearsMonths = (months: number) => {
  const safe = Math.max(0, Number(months) || 0);
  const years = Math.floor(safe / 12);
  const leftoverMonths = safe % 12;

  if (years === 0 && leftoverMonths === 0) return '0 years';
  if (leftoverMonths === 0) return `${years} year${years === 1 ? '' : 's'}`;
  if (years === 0) return `${leftoverMonths} month${leftoverMonths === 1 ? '' : 's'}`;
  return `${years} year${years === 1 ? '' : 's'} ${leftoverMonths} month${leftoverMonths === 1 ? '' : 's'}`;
};

export default function SimulationForm({
  onSimulationComplete,
  tutorialSteps,
  onExitTutorial, // optional
}: {
  onSimulationComplete?: (stats: YearlySummary[], timeline?: SimulationTimelineContext) => void;
  tutorialSteps?: TutorialStep[];
  onExitTutorial?: () => void;
}) {
  const initialDefaults = useMemo(() => createDefaultSimulationRequest(), []);

  const [startDate, setStartDate] = useState(initialDefaults.startDate.date);
  const [overallTaxRule, setOverallTaxRule] = useState<OverallTaxRule>(initialDefaults.overallTaxRule);
  const [taxPercentage, setTaxPercentage] = useState(initialDefaults.taxPercentage);
  const [phases, setPhases] = useState<PhaseRequest[]>(initialDefaults.phases);

  const [selectedTemplateId, setSelectedTemplateId] = useState<SimulationTemplateId>('custom');
  const [baselineRequest, setBaselineRequest] = useState<SimulationRequest>(() => ({
    ...initialDefaults,
    startDate: { date: initialDefaults.startDate.date },
    phases: initialDefaults.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
  }));

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => listSavedScenarios());
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [simulateInProgress, setSimulateInProgress] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [stats, setStats] = useState<YearlySummary[] | null>(null);

  const handleAddPhase = (phase: PhaseRequest) => setPhases(prev => [...prev, { ...phase, taxRules: phase.taxRules || [] }]);
  const handlePhaseChange = (index: number, field: keyof PhaseRequest, value: number | string | undefined) =>
    setPhases(phs => phs.map((p, i) => (i === index ? { ...p, [field]: value as any } : p)));
  const handlePhaseReplace = (index: number, phase: PhaseRequest) =>
    setPhases(phs => phs.map((p, i) => (i === index ? { ...phase, taxRules: phase.taxRules ?? [] } : p)));
  const handlePhaseRemove = (index: number) => setPhases(phs => phs.filter((_, i) => i !== index));
  const handlePhaseToggleRule = (index: number, rule: 'EXEMPTIONCARD' | 'STOCKEXEMPTION') =>
    setPhases(phs =>
      phs.map((p, i) => {
        if (i !== index) return p;
        const current = p.taxRules ?? [];
        const has = current.includes(rule);
        const updated = has ? current.filter(r => r !== rule) : [...current, rule];
        return { ...p, taxRules: updated };
      })
    );

  const totalMonths = phases.reduce((s, p) => s + (Number(p.durationInMonths) || 0), 0);
  const overLimit = totalMonths > MAX_MONTHS;

  const currentRequest = useMemo<SimulationRequest>(() => {
    return {
      startDate: { date: startDate },
      overallTaxRule,
      taxPercentage,
      phases: phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
    };
  }, [startDate, overallTaxRule, taxPercentage, phases]);

  const isDirty = useMemo(() => !deepEqual(currentRequest, baselineRequest), [currentRequest, baselineRequest]);

  const applyRequestToForm = useCallback((req: SimulationRequest) => {
    setStartDate(req.startDate.date);
    setOverallTaxRule(req.overallTaxRule);
    setTaxPercentage(req.taxPercentage);
    setPhases(req.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })));
    setBaselineRequest({
      ...req,
      startDate: { date: req.startDate.date },
      phases: req.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
    });
    setSelectedTemplateId('custom');
  }, []);

  const refreshSavedScenarios = useCallback(() => {
    setSavedScenarios(listSavedScenarios());
  }, []);

  const handleSaveScenario = useCallback(() => {
    const name = window.prompt('Scenario name?');
    if (!name) return;

    const existing = findScenarioByName(name);
    if (existing) {
      const ok = window.confirm(`Overwrite existing scenario "${existing.name}"?`);
      if (!ok) return;
      const saved = saveScenario(existing.name, currentRequest, existing.id);
      refreshSavedScenarios();
      setSelectedScenarioId(saved.id);
      return;
    }

    const saved = saveScenario(name, currentRequest);
    refreshSavedScenarios();
    setSelectedScenarioId(saved.id);
  }, [currentRequest, refreshSavedScenarios]);

  const handleLoadScenario = useCallback((scenarioId: string) => {
    if (!scenarioId) return;
    const scenario = findScenarioById(scenarioId);
    if (!scenario) return;
    if (isDirty) {
      const ok = window.confirm('Loading a scenario will overwrite your current inputs. Continue?');
      if (!ok) return;
    }
    applyRequestToForm(scenario.request);
    setSelectedScenarioId(scenario.id);
  }, [applyRequestToForm, isDirty]);

  const handleDeleteScenario = useCallback(() => {
    if (!selectedScenarioId) return;
    const scenario = findScenarioById(selectedScenarioId);
    const ok = window.confirm(`Delete scenario "${scenario?.name ?? 'this scenario'}"?`);
    if (!ok) return;
    deleteScenario(selectedScenarioId);
    refreshSavedScenarios();
    setSelectedScenarioId('');
  }, [refreshSavedScenarios, selectedScenarioId]);

  const selectedTemplate = useMemo(() => getTemplateById(selectedTemplateId), [selectedTemplateId]);

  useEffect(() => {
    if (selectedTemplateId !== 'custom' && isDirty) {
      setSelectedTemplateId('custom');
    }
  }, [isDirty, selectedTemplateId]);

  const applyTemplate = useCallback((templateId: SimulationTemplateId) => {
    const template = getTemplateById(templateId);

    if (templateId !== 'custom' && isDirty) {
      const ok = window.confirm('Applying a template will overwrite your current inputs. Continue?');
      if (!ok) return;
    }

    setSelectedTemplateId(templateId);

    if (templateId === 'custom') {
      return;
    }

    const resolved = resolveTemplateToRequest(template);
    setStartDate(resolved.startDate.date);
    setOverallTaxRule(resolved.overallTaxRule);
    setTaxPercentage(resolved.taxPercentage);
    setPhases(resolved.phases);
    setBaselineRequest(resolved);
  }, [isDirty]);

  useEffect(() => {
    applyTemplate(selectedTemplateId); // Apply starter template on first load
  }, []);

  const handleAddDefaultPhase = () => {
    handleAddPhase(createDefaultPhase('DEPOSIT'));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (overLimit) {
      alert(`Total duration must be ≤ ${MAX_YEARS} years (you have ${formatYearsMonths(totalMonths)}).`);
      return;
    }
    setSimulateInProgress(true);
    setStats(null);
    setSimulationId(null);
    try {
      const id = await startSimulation({
        startDate: { date: startDate },
        overallTaxRule,
        taxPercentage,
        phases,
      } as SimulationRequest);
      setSimulationId(id);
    } catch (err) {
      alert((err as Error).message);
      setSimulateInProgress(false);
    }
  };

  // --- tutorial stepper (only if steps provided) ---
  const [idx, setIdx] = useState(0);
  const steps = tutorialSteps ?? [];
  const current = steps[idx];
  const isFirst = idx === 0;
  const isLast = idx === steps.length - 1;
  const next = () => setIdx(i => {
    if (!steps.length) return i;
    if (i + 1 >= steps.length) { onExitTutorial?.(); return i; } // Finish -> back to /simulation
    return i + 1;
  });  
  const back = () => setIdx(i => Math.max(i - 1, 0));
  const exit = () => onExitTutorial?.(); // Exit -> back to /simulation

  // Optional: give stable anchors for selectors
  // Add data attributes to key controls to avoid fragile text-based selectors
  const inputWrapperStyle = { width: 250, display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'stretch' } as const;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxWidth: 450, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={inputWrapperStyle}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.1rem' }}>Template:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => applyTemplate(e.target.value as SimulationTemplateId)}
              disabled={simulateInProgress}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.3rem' }}
            >
              {SIMULATION_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 4 }} role="note">
              {selectedTemplate.description}
            </div>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.1rem' }}>Saved scenario:</span>
              <select
                value={selectedScenarioId}
                onChange={(e) => setSelectedScenarioId(e.target.value)}
                disabled={simulateInProgress}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.3rem' }}
              >
                <option value="">— Select —</option>
                {savedScenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleLoadScenario(selectedScenarioId)}
                disabled={!selectedScenarioId || simulateInProgress}
                style={btn(!selectedScenarioId || simulateInProgress ? 'disabled' : 'ghost')}
              >
                Load
              </button>
              <button
                type="button"
                onClick={handleSaveScenario}
                disabled={simulateInProgress}
                style={btn(simulateInProgress ? 'disabled' : 'ghost')}
              >
                Save scenario
              </button>
              <button
                type="button"
                onClick={handleDeleteScenario}
                disabled={!selectedScenarioId || simulateInProgress}
                style={btn(!selectedScenarioId || simulateInProgress ? 'disabled' : 'ghost')}
              >
                Delete
              </button>
            </div>
          </div>

          <label data-tour="start-date" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.1rem' }}>Start Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.3rem' }}
            />
          </label>

          <label data-tour="tax-rule" style={{ display: 'flex', flexDirection: 'column' }}>
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

          <label data-tour="tax-percent" style={{ display: 'flex', flexDirection: 'column' }}>
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

      <div data-tour="phase-list">
        <NormalPhaseList
          phases={phases}
          onPhaseChange={handlePhaseChange}
          onPhaseReplace={handlePhaseReplace}
          onPhaseRemove={handlePhaseRemove}
          onToggleTaxRule={handlePhaseToggleRule}
        />
      </div>

      <button
        data-tour="add-phase"
        type="button"
        onClick={handleAddDefaultPhase}
        disabled={simulateInProgress}
        style={{ padding: '0.75rem', fontSize: '1.1rem', marginTop: '0.25rem', opacity: simulateInProgress ? 0.65 : 1 }}
      >
        Add Phase
      </button>

      <div style={{ margin: '0.5rem 0', fontWeight: 600 }}>
        Total duration: {formatYearsMonths(totalMonths)} (max {MAX_YEARS} years)
        {overLimit && <span style={{ color: 'crimson' }}> — exceeds limit</span>}
      </div>

      <button
        data-tour="run"
        type="submit"
        disabled={simulateInProgress}
        style={{ padding: '0.75rem', fontSize: '1.1rem', opacity: simulateInProgress ? 0.65 : 1 }}
      >
        {simulateInProgress ? 'Running…' : 'Run Simulation'}
      </button>

      {simulateInProgress && simulationId && (
        <SimulationProgress
          simulationId={simulationId}
          onComplete={(result) => {
            setStats(result);
            setSimulateInProgress(false);
            setSimulationId(null);
            const timeline: SimulationTimelineContext = {
              startDate,
              phaseTypes: phases.map((p) => p.phaseType),
              phaseDurationsInMonths: phases.map((p) => Number(p.durationInMonths) || 0),
              firstPhaseInitialDeposit: phases[0]?.initialDeposit !== undefined ? Number(phases[0]?.initialDeposit) : undefined,
            };
            onSimulationComplete?.(result, timeline);
          }}
        />
      )}

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

      {/* Coachmarks only when steps are provided */}
      {current && (
        <Coachmark
          step={current}
          onNext={next}
          onBack={back}
          onExit={exit}
          isFirst={isFirst}
          isLast={isLast}
        />
      )}
    </form>
  );
}
