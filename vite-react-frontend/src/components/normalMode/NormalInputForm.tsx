// src/features/simulation/SimulationForm.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { YearlySummary } from '../../models/YearlySummary';
import { PhaseRequest, SimulationRequest, SimulationTimelineContext } from '../../models/types';
import NormalPhaseList from '../../components/normalMode/NormalPhaseList';
import SimulationProgress from '../../components/SimulationProgress';
import { findRunForInput, startAdvancedSimulation, startSimulation, type AdvancedSimulationRequest } from '../../api/simulation';
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
import { decodeScenarioFromShareParam, encodeScenarioToShareParam } from '../../utils/shareScenarioLink';
import { getTimelineSegments, summarizeScenario } from '../../utils/summarizeScenario';
import { QRCodeSVG } from 'qrcode.react';
import InfoTooltip from '../InfoTooltip';

const ADVANCED_OPTIONS_KEY = 'firecasting:advancedOptions:v1';

type OverallTaxRule = 'CAPITAL' | 'NOTIONAL';

type ReturnType = 'dataDrivenReturn' | 'distributionReturn' | 'simpleReturn';

type DistributionType = 'normal' | 'brownianMotion' | 'studentT' | 'regimeBased';

type AdvancedOptionsLoad = {
  enabled?: boolean;
  inflationAveragePct?: number;
  yearlyFeePercentage?: number;
  returnType?: ReturnType;
  seed?: number | string;
  simpleAveragePercentage?: number | string;
  distributionType?: DistributionType;
  normalMean?: number | string;
  normalStdDev?: number | string;
  brownianDrift?: number | string;
  brownianVolatility?: number | string;
  studentMu?: number | string;
  studentSigma?: number | string;
  studentNu?: number | string;
  regimeTickMonths?: number | string;
  regimes?: Array<{
    distributionType?: 'normal' | 'studentT';
    expectedDurationMonths?: number | string;
    toRegime0?: number | string;
    toRegime1?: number | string;
    toRegime2?: number | string;
    normalMean?: number | string;
    normalStdDev?: number | string;
    studentMu?: number | string;
    studentSigma?: number | string;
    studentNu?: number | string;
  }>;
  returnerConfig?: AdvancedSimulationRequest['returnerConfig'];
  taxExemptionConfig?: AdvancedSimulationRequest['taxExemptionConfig'];
  exemptionCardLimit?: number | string;
  exemptionCardYearlyIncrease?: number | string;
  stockExemptionTaxRate?: number | string;
  stockExemptionLimit?: number | string;
  stockExemptionYearlyIncrease?: number | string;
};

const mapOverallTaxRuleForAdvanced = (rule: OverallTaxRule): string => (rule === 'NOTIONAL' ? 'notional' : 'capital');

const toNumOrUndef = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const parseReturnType = (v: any): ReturnType => {
  const s = String(v ?? '').trim();
  if (s === 'distributionReturn' || s === 'dataDrivenReturn' || s === 'simpleReturn') return s;
  // Keep backward/forward compatibility (backend defaults SimpleDailyReturn for unknown).
  return 'dataDrivenReturn';
};

const parseDistributionType = (v: any): DistributionType => {
  const s = String(v ?? '').trim();
  if (s === 'normal' || s === 'brownianMotion' || s === 'studentT' || s === 'regimeBased') return s;
  return 'normal';
};

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  selector?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  waitFor?: number;
};

export type NormalInputFormMode = 'normal' | 'advanced';

export type AdvancedFeatureFlags = {
  inflation: boolean;
  fee: boolean;
  exemptions: boolean;
  returnModel: boolean;
};

export type NormalInputFormHandle = {
  openSavedScenarios: () => void;
};

export type NormalInputFormProps = {
  onSimulationComplete?: (stats: YearlySummary[], timeline?: SimulationTimelineContext, simulationId?: string) => void;
  rightFooterActions?: React.ReactNode;
  footerBelow?: React.ReactNode;
  tutorialSteps?: TutorialStep[];
  onExitTutorial?: () => void;
  externalLoadRequest?: SimulationRequest | null;
  externalLoadNonce?: number;
  externalLoadAdvanced?: AdvancedOptionsLoad | null;
  externalLoadAdvancedNonce?: number;
  mode?: NormalInputFormMode;
  advancedFeatureFlags?: AdvancedFeatureFlags;
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

const NormalInputForm = React.forwardRef<NormalInputFormHandle, NormalInputFormProps>(function NormalInputForm(
{
  onSimulationComplete,
  rightFooterActions,
  footerBelow,
  tutorialSteps,
  onExitTutorial, // optional
  externalLoadRequest,
  externalLoadNonce,
  externalLoadAdvanced,
  externalLoadAdvancedNonce,
  mode = 'normal',
  advancedFeatureFlags,
},
ref
) {
  const navigate = useNavigate();
  const initialDefaults = useMemo(() => createDefaultSimulationRequest(), []);

  const [startDate, setStartDate] = useState(initialDefaults.startDate.date);
  const [overallTaxRule, setOverallTaxRule] = useState<OverallTaxRule>(initialDefaults.overallTaxRule);
  const [taxPercentage, setTaxPercentage] = useState(initialDefaults.taxPercentage);
  const [phases, setPhases] = useState<PhaseRequest[]>(initialDefaults.phases);

  const initialAdvancedState = useMemo<{
    enabled: boolean;
    inflationAveragePct: number;
    yearlyFeePercentage: number;
    returnType: ReturnType;
    seed: string;
    simpleAveragePercentage: string;
    distributionType: DistributionType;
    normalMean: string;
    normalStdDev: string;
    brownianDrift: string;
    brownianVolatility: string;
    studentMu: string;
    studentSigma: string;
    studentNu: string;
    regimeTickMonths: string;
    regimes: Array<{
      distributionType: 'normal' | 'studentT';
      expectedDurationMonths: string;
      toRegime0: string;
      toRegime1: string;
      toRegime2: string;
      normalMean: string;
      normalStdDev: string;
      studentMu: string;
      studentSigma: string;
      studentNu: string;
    }>;
    exemptionCardLimit: string;
    exemptionCardYearlyIncrease: string;
    stockExemptionTaxRate: string;
    stockExemptionLimit: string;
    stockExemptionYearlyIncrease: string;
  }>(() => {
    const fallbackDefaults = {
      enabled: false,
      inflationAveragePct: 2,
      yearlyFeePercentage: 0.5,

      // Returner
      returnType: 'dataDrivenReturn' as ReturnType,
      seed: '1',
      simpleAveragePercentage: '7',
      distributionType: 'normal' as DistributionType,
      normalMean: '0.07',
      normalStdDev: '0.20',
      brownianDrift: '0.07',
      brownianVolatility: '0.20',
      studentMu: '0.042',
      studentSigma: '0.609',
      studentNu: '3.60',

      // Regime-based
      regimeTickMonths: '1',
      regimes: Array.from({ length: 3 }).map((_, i) => {
        // Switch weights are relative weights (normalized by backend). Provide a sensible default.
        const weights = i === 0 ? { toRegime0: '0', toRegime1: '1', toRegime2: '1' }
          : i === 1 ? { toRegime0: '1', toRegime1: '0', toRegime2: '1' }
          : { toRegime0: '1', toRegime1: '1', toRegime2: '0' };

        return {
          distributionType: 'normal' as 'normal' | 'studentT',
          expectedDurationMonths: '12',
          ...weights,
          normalMean: '0.07',
          normalStdDev: '0.20',
          studentMu: '0.042',
          studentSigma: '0.609',
          studentNu: '3.60',
        };
      }),

      // Tax (defaults only; exemptions must still be enabled per-phase)
      exemptionCardLimit: '51600',
      exemptionCardYearlyIncrease: '1000',
      stockExemptionTaxRate: '27',
      stockExemptionLimit: '67500',
      stockExemptionYearlyIncrease: '1000',
    };

    try {
      const raw = window.localStorage.getItem(ADVANCED_OPTIONS_KEY);
      if (!raw) {
        return fallbackDefaults;
      }
      const parsed = JSON.parse(raw);
      const enabled = Boolean(parsed?.enabled);
      const inflationAveragePct = Number.isFinite(Number(parsed?.inflationAveragePct)) ? Number(parsed.inflationAveragePct) : 2;
      const yearlyFeePercentage = Number.isFinite(Number(parsed?.yearlyFeePercentage)) ? Number(parsed.yearlyFeePercentage) : 0.5;
      const returnType = parseReturnType(parsed?.returnType);
      const distributionType = parseDistributionType(parsed?.distributionType);
      const seed = parsed?.seed ?? fallbackDefaults.seed;
      const simpleAveragePercentage = parsed?.simpleAveragePercentage ?? fallbackDefaults.simpleAveragePercentage;

      const regimesInput: any[] = Array.isArray(parsed?.regimes) ? parsed.regimes : [];
      const regimes: Array<{
        distributionType: 'normal' | 'studentT';
        expectedDurationMonths: string;
        toRegime0: string;
        toRegime1: string;
        toRegime2: string;
        normalMean: string;
        normalStdDev: string;
        studentMu: string;
        studentSigma: string;
        studentNu: string;
      }> = Array.from({ length: 3 }).map((_, i) => {
        const r = regimesInput[i] ?? {};
        const dt = String(r?.distributionType ?? 'normal');
        const fallbackReg = (fallbackDefaults.regimes as any[])[i] ?? (fallbackDefaults.regimes as any[])[0];
        return {
          distributionType: dt === 'studentT' ? 'studentT' : 'normal',
          expectedDurationMonths: r?.expectedDurationMonths ?? fallbackReg.expectedDurationMonths,
          toRegime0: r?.toRegime0 ?? fallbackReg.toRegime0,
          toRegime1: r?.toRegime1 ?? fallbackReg.toRegime1,
          toRegime2: r?.toRegime2 ?? fallbackReg.toRegime2,
          normalMean: r?.normalMean ?? fallbackReg.normalMean,
          normalStdDev: r?.normalStdDev ?? fallbackReg.normalStdDev,
          studentMu: r?.studentMu ?? fallbackReg.studentMu,
          studentSigma: r?.studentSigma ?? fallbackReg.studentSigma,
          studentNu: r?.studentNu ?? fallbackReg.studentNu,
        };
      });

      return {
        enabled,
        inflationAveragePct,
        yearlyFeePercentage,
        returnType,
        distributionType,
        seed: String(seed),
        simpleAveragePercentage: String(simpleAveragePercentage),
        normalMean: parsed?.normalMean ?? fallbackDefaults.normalMean,
        normalStdDev: parsed?.normalStdDev ?? fallbackDefaults.normalStdDev,
        brownianDrift: parsed?.brownianDrift ?? fallbackDefaults.brownianDrift,
        brownianVolatility: parsed?.brownianVolatility ?? fallbackDefaults.brownianVolatility,
        studentMu: parsed?.studentMu ?? fallbackDefaults.studentMu,
        studentSigma: parsed?.studentSigma ?? fallbackDefaults.studentSigma,
        studentNu: parsed?.studentNu ?? fallbackDefaults.studentNu,
        regimeTickMonths: parsed?.regimeTickMonths ?? fallbackDefaults.regimeTickMonths,
        regimes,
        exemptionCardLimit: parsed?.exemptionCardLimit ?? fallbackDefaults.exemptionCardLimit,
        exemptionCardYearlyIncrease: parsed?.exemptionCardYearlyIncrease ?? fallbackDefaults.exemptionCardYearlyIncrease,
        stockExemptionTaxRate: parsed?.stockExemptionTaxRate ?? fallbackDefaults.stockExemptionTaxRate,
        stockExemptionLimit: parsed?.stockExemptionLimit ?? fallbackDefaults.stockExemptionLimit,
        stockExemptionYearlyIncrease: parsed?.stockExemptionYearlyIncrease ?? fallbackDefaults.stockExemptionYearlyIncrease,
      };
    } catch {
      return fallbackDefaults;
    }
  }, []);

  const [advancedEnabled, setAdvancedEnabled] = useState<boolean>(initialAdvancedState.enabled);
  const [inflationAveragePct, setInflationAveragePct] = useState<number>(initialAdvancedState.inflationAveragePct);
  const [yearlyFeePercentage, setYearlyFeePercentage] = useState<number>(initialAdvancedState.yearlyFeePercentage);

  const [exemptionCardLimit, setExemptionCardLimit] = useState<string>(String(initialAdvancedState.exemptionCardLimit));
  const [exemptionCardYearlyIncrease, setExemptionCardYearlyIncrease] = useState<string>(String(initialAdvancedState.exemptionCardYearlyIncrease));
  const [stockExemptionTaxRate, setStockExemptionTaxRate] = useState<string>(String(initialAdvancedState.stockExemptionTaxRate));
  const [stockExemptionLimit, setStockExemptionLimit] = useState<string>(String(initialAdvancedState.stockExemptionLimit));
  const [stockExemptionYearlyIncrease, setStockExemptionYearlyIncrease] = useState<string>(String(initialAdvancedState.stockExemptionYearlyIncrease));

  const [returnType, setReturnType] = useState<ReturnType>(initialAdvancedState.returnType);
  const [seed, setSeed] = useState<string>(String(initialAdvancedState.seed ?? ''));
  const [simpleAveragePercentage, setSimpleAveragePercentage] = useState<string>(String(initialAdvancedState.simpleAveragePercentage ?? ''));

  const [distributionType, setDistributionType] = useState<DistributionType>(initialAdvancedState.distributionType);
  const [normalMean, setNormalMean] = useState<string>(String(initialAdvancedState.normalMean ?? ''));
  const [normalStdDev, setNormalStdDev] = useState<string>(String(initialAdvancedState.normalStdDev ?? ''));
  const [brownianDrift, setBrownianDrift] = useState<string>(String(initialAdvancedState.brownianDrift ?? ''));
  const [brownianVolatility, setBrownianVolatility] = useState<string>(String(initialAdvancedState.brownianVolatility ?? ''));
  const [studentMu, setStudentMu] = useState<string>(String(initialAdvancedState.studentMu ?? ''));
  const [studentSigma, setStudentSigma] = useState<string>(String(initialAdvancedState.studentSigma ?? ''));
  const [studentNu, setStudentNu] = useState<string>(String(initialAdvancedState.studentNu ?? ''));

  const [regimeTickMonths, setRegimeTickMonths] = useState<string>(String(initialAdvancedState.regimeTickMonths ?? ''));
  const [regimes, setRegimes] = useState<
    Array<{
      distributionType: 'normal' | 'studentT';
      expectedDurationMonths: string;
      toRegime0: string;
      toRegime1: string;
      toRegime2: string;
      normalMean: string;
      normalStdDev: string;
      studentMu: string;
      studentSigma: string;
      studentNu: string;
    }>
  >(initialAdvancedState.regimes);

  const [selectedTemplateId, setSelectedTemplateId] = useState<SimulationTemplateId>('starter');
  const [baselineRequest, setBaselineRequest] = useState<SimulationRequest>(() => ({
    ...initialDefaults,
    startDate: { date: initialDefaults.startDate.date },
    phases: initialDefaults.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
  }));

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => listSavedScenarios());
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [compareScenarioId, setCompareScenarioId] = useState<string>('');
  const [showScenarioCompare, setShowScenarioCompare] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [didCopyShareUrl, setDidCopyShareUrl] = useState(false);
  const [simulateInProgress, setSimulateInProgress] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [lastCompletedRun, setLastCompletedRun] = useState<{ id: string; request: SimulationRequest } | null>(null);
  const lastRunRequestRef = useRef<SimulationRequest | null>(null);
  const lastRunWasNormalRef = useRef<boolean>(false);

  const advancedMode = mode === 'advanced';

  const effectiveAdvancedFeatureFlags = useMemo<AdvancedFeatureFlags>(
    () => advancedFeatureFlags ?? { inflation: true, exemptions: true, returnModel: true, fee: true },
    [advancedFeatureFlags]
  );

  const inflationFeatureOn = effectiveAdvancedFeatureFlags.inflation;
  const feeFeatureOn = effectiveAdvancedFeatureFlags.fee;
  const exemptionsFeatureOn = effectiveAdvancedFeatureFlags.exemptions;
  const returnModelFeatureOn = effectiveAdvancedFeatureFlags.returnModel;

  // Mode buttons (SimulationPage) are authoritative.
  useEffect(() => {
    setAdvancedEnabled(advancedMode);
  }, [advancedMode]);

  const scenarioParamOnLoad = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('scenario');
    } catch {
      return null;
    }
  }, []);

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

  // External load hook (used by run-bundle import).
  useEffect(() => {
    if (!externalLoadRequest) return;
    applyRequestToForm(externalLoadRequest);
  }, [applyRequestToForm, externalLoadNonce, externalLoadRequest]);

  // External advanced-load hook (used by advanced run-bundle import).
  useEffect(() => {
    if (!externalLoadAdvanced) return;

    // If the import doesn't specify enabled, assume advanced inputs imply enabled.
    setAdvancedEnabled(externalLoadAdvanced.enabled ?? true);

    if (externalLoadAdvanced.inflationAveragePct !== undefined) {
      const pct = Number(externalLoadAdvanced.inflationAveragePct);
      if (Number.isFinite(pct)) setInflationAveragePct(pct);
    }

    if (externalLoadAdvanced.yearlyFeePercentage !== undefined) {
      const pct = Number(externalLoadAdvanced.yearlyFeePercentage);
      if (Number.isFinite(pct)) setYearlyFeePercentage(pct);
    }

    const taxCfg = externalLoadAdvanced.taxExemptionConfig;
    if (taxCfg?.exemptionCard) {
      if (taxCfg.exemptionCard.limit !== undefined) setExemptionCardLimit(String(taxCfg.exemptionCard.limit));
      if (taxCfg.exemptionCard.yearlyIncrease !== undefined) setExemptionCardYearlyIncrease(String(taxCfg.exemptionCard.yearlyIncrease));
    }
    if (taxCfg?.stockExemption) {
      if (taxCfg.stockExemption.taxRate !== undefined) setStockExemptionTaxRate(String(taxCfg.stockExemption.taxRate));
      if (taxCfg.stockExemption.limit !== undefined) setStockExemptionLimit(String(taxCfg.stockExemption.limit));
      if (taxCfg.stockExemption.yearlyIncrease !== undefined) setStockExemptionYearlyIncrease(String(taxCfg.stockExemption.yearlyIncrease));
    }

    const rt = externalLoadAdvanced.returnType;
    if (rt) setReturnType(parseReturnType(rt));

    if (externalLoadAdvanced.seed !== undefined) setSeed(String(externalLoadAdvanced.seed));

    const rc = externalLoadAdvanced.returnerConfig;
    if (rc?.seed !== undefined) setSeed(String(rc.seed));
    if (rc?.simpleAveragePercentage !== undefined) setSimpleAveragePercentage(String(rc.simpleAveragePercentage));

    const dist = rc?.distribution;
    if (dist?.type) setDistributionType(parseDistributionType(dist.type));

    if (dist?.normal) {
      if (dist.normal.mean !== undefined) setNormalMean(String(dist.normal.mean));
      if (dist.normal.standardDeviation !== undefined) setNormalStdDev(String(dist.normal.standardDeviation));
    }
    if (dist?.brownianMotion) {
      if (dist.brownianMotion.drift !== undefined) setBrownianDrift(String(dist.brownianMotion.drift));
      if (dist.brownianMotion.volatility !== undefined) setBrownianVolatility(String(dist.brownianMotion.volatility));
    }
    if (dist?.studentT) {
      if (dist.studentT.mu !== undefined) setStudentMu(String(dist.studentT.mu));
      if (dist.studentT.sigma !== undefined) setStudentSigma(String(dist.studentT.sigma));
      if (dist.studentT.nu !== undefined) setStudentNu(String(dist.studentT.nu));
    }
    if (dist?.regimeBased) {
      if (dist.regimeBased.tickMonths !== undefined) setRegimeTickMonths(String(dist.regimeBased.tickMonths));
      const regs = Array.isArray(dist.regimeBased.regimes) ? dist.regimeBased.regimes : [];
      setRegimes((prev) => {
        return prev.map((p, i) => {
          const r: any = regs[i] ?? {};
          const dt = String(r?.distributionType ?? p.distributionType);
          return {
            ...p,
            distributionType: dt === 'studentT' ? 'studentT' : 'normal',
            expectedDurationMonths: r?.expectedDurationMonths !== undefined ? String(r.expectedDurationMonths) : p.expectedDurationMonths,
            toRegime0: r?.switchWeights?.toRegime0 !== undefined ? String(r.switchWeights.toRegime0) : p.toRegime0,
            toRegime1: r?.switchWeights?.toRegime1 !== undefined ? String(r.switchWeights.toRegime1) : p.toRegime1,
            toRegime2: r?.switchWeights?.toRegime2 !== undefined ? String(r.switchWeights.toRegime2) : p.toRegime2,
            normalMean: r?.normal?.mean !== undefined ? String(r.normal.mean) : p.normalMean,
            normalStdDev: r?.normal?.standardDeviation !== undefined ? String(r.normal.standardDeviation) : p.normalStdDev,
            studentMu: r?.studentT?.mu !== undefined ? String(r.studentT.mu) : p.studentMu,
            studentSigma: r?.studentT?.sigma !== undefined ? String(r.studentT.sigma) : p.studentSigma,
            studentNu: r?.studentT?.nu !== undefined ? String(r.studentT.nu) : p.studentNu,
          };
        });
      });
    }
  }, [
    externalLoadAdvanced,
    externalLoadAdvancedNonce,
    setAdvancedEnabled,
    setInflationAveragePct,
    setYearlyFeePercentage,
    setExemptionCardLimit,
    setExemptionCardYearlyIncrease,
    setStockExemptionTaxRate,
    setStockExemptionLimit,
    setStockExemptionYearlyIncrease,
    setReturnType,
    setSeed,
    setSimpleAveragePercentage,
    setDistributionType,
    setNormalMean,
    setNormalStdDev,
    setBrownianDrift,
    setBrownianVolatility,
    setStudentMu,
    setStudentSigma,
    setStudentNu,
    setRegimeTickMonths,
    setRegimes,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ADVANCED_OPTIONS_KEY,
        JSON.stringify({
          enabled: advancedEnabled,
          inflationAveragePct,
          yearlyFeePercentage,
          returnType,
          seed,
          simpleAveragePercentage,
          distributionType,
          normalMean,
          normalStdDev,
          brownianDrift,
          brownianVolatility,
          studentMu,
          studentSigma,
          studentNu,
          regimeTickMonths,
          regimes,
          exemptionCardLimit,
          exemptionCardYearlyIncrease,
          stockExemptionTaxRate,
          stockExemptionLimit,
          stockExemptionYearlyIncrease,
        })
      );
    } catch {
      // ignore
    }
  }, [
    advancedEnabled,
    inflationAveragePct,
    yearlyFeePercentage,
    returnType,
    seed,
    simpleAveragePercentage,
    distributionType,
    normalMean,
    normalStdDev,
    brownianDrift,
    brownianVolatility,
    studentMu,
    studentSigma,
    studentNu,
    regimeTickMonths,
    regimes,
    exemptionCardLimit,
    exemptionCardYearlyIncrease,
    stockExemptionTaxRate,
    stockExemptionLimit,
    stockExemptionYearlyIncrease,
  ]);

  const refreshSavedScenarios = useCallback(() => {
    setSavedScenarios(listSavedScenarios());
  }, []);

  const openScenarioModal = useCallback(() => {
    refreshSavedScenarios();
    setShareUrl('');
    setDidCopyShareUrl(false);
    setCompareScenarioId('');
    setShowScenarioCompare(false);
    setIsScenarioModalOpen(true);
  }, [refreshSavedScenarios]);

  useImperativeHandle(ref, () => ({
    openSavedScenarios: openScenarioModal,
  }), [openScenarioModal]);

  const hasAppliedFetchedAdvancedDefaultsRef = useRef(false);
  useEffect(() => {
    if (!advancedEnabled) return;
    if (hasAppliedFetchedAdvancedDefaultsRef.current) return;

    const isBlank = (v: any) => String(v ?? '').trim() === '';
    const setIfBlank = (current: any, setter: (v: string) => void, next: any) => {
      if (!isBlank(next)) {
        if (isBlank(current)) setter(String(next));
      }
    };

    const applyDefaultsIfBlank = (data: any) => {
      const infl = Number(data?.inflation?.averagePercentage);
      if (Number.isFinite(infl) && !Number.isFinite(Number(inflationAveragePct))) {
        setInflationAveragePct(infl);
      }

      if (data?.tax?.exemptionCard) {
        setIfBlank(exemptionCardLimit, setExemptionCardLimit, data.tax.exemptionCard.limit);
        setIfBlank(exemptionCardYearlyIncrease, setExemptionCardYearlyIncrease, data.tax.exemptionCard.increase);
      }
      if (data?.tax?.stockExemption) {
        setIfBlank(stockExemptionTaxRate, setStockExemptionTaxRate, data.tax.stockExemption.taxRate);
        setIfBlank(stockExemptionLimit, setStockExemptionLimit, data.tax.stockExemption.limit);
        setIfBlank(stockExemptionYearlyIncrease, setStockExemptionYearlyIncrease, data.tax.stockExemption.increase);
      }

      if (data?.returner?.type && isBlank(returnType)) setReturnType(parseReturnType(data.returner.type));
      if (data?.returner?.random?.seed !== undefined) setIfBlank(seed, setSeed, data.returner.random.seed);
      if (data?.returner?.simpleReturn?.averagePercentage !== undefined) setIfBlank(simpleAveragePercentage, setSimpleAveragePercentage, data.returner.simpleReturn.averagePercentage);

      if (data?.returner?.distribution?.type && isBlank(distributionType)) setDistributionType(parseDistributionType(data.returner.distribution.type));
      if (data?.returner?.distribution?.normal) {
        setIfBlank(normalMean, setNormalMean, data.returner.distribution.normal.mean);
        setIfBlank(normalStdDev, setNormalStdDev, data.returner.distribution.normal.standardDeviation);
      }
      if (data?.returner?.distribution?.brownianMotion) {
        setIfBlank(brownianDrift, setBrownianDrift, data.returner.distribution.brownianMotion.drift);
        setIfBlank(brownianVolatility, setBrownianVolatility, data.returner.distribution.brownianMotion.volatility);
      }
      if (data?.returner?.distribution?.studentT) {
        setIfBlank(studentMu, setStudentMu, data.returner.distribution.studentT.mu);
        setIfBlank(studentSigma, setStudentSigma, data.returner.distribution.studentT.sigma);
        setIfBlank(studentNu, setStudentNu, data.returner.distribution.studentT.nu);
      }
      if (data?.returner?.distribution?.regimeBased) {
        setIfBlank(regimeTickMonths, setRegimeTickMonths, data.returner.distribution.regimeBased.tickMonths);
        const regs = Array.isArray(data.returner.distribution.regimeBased.regimes) ? data.returner.distribution.regimeBased.regimes : [];
        setRegimes((prev) => prev.map((p, i) => {
          const r: any = regs[i] ?? {};
          const dist = String(r?.distributionType ?? '');
          return {
            ...p,
            distributionType: isBlank(p.distributionType) && dist ? (dist === 'studentT' ? 'studentT' : 'normal') : p.distributionType,
            expectedDurationMonths: isBlank(p.expectedDurationMonths) && r?.expectedDurationMonths !== undefined ? String(r.expectedDurationMonths) : p.expectedDurationMonths,
            toRegime0: isBlank(p.toRegime0) && r?.switchWeights?.toRegime0 !== undefined ? String(r.switchWeights.toRegime0) : p.toRegime0,
            toRegime1: isBlank(p.toRegime1) && r?.switchWeights?.toRegime1 !== undefined ? String(r.switchWeights.toRegime1) : p.toRegime1,
            toRegime2: isBlank(p.toRegime2) && r?.switchWeights?.toRegime2 !== undefined ? String(r.switchWeights.toRegime2) : p.toRegime2,
            normalMean: isBlank(p.normalMean) && r?.normal?.mean !== undefined ? String(r.normal.mean) : p.normalMean,
            normalStdDev: isBlank(p.normalStdDev) && r?.normal?.standardDeviation !== undefined ? String(r.normal.standardDeviation) : p.normalStdDev,
            studentMu: isBlank(p.studentMu) && r?.studentT?.mu !== undefined ? String(r.studentT.mu) : p.studentMu,
            studentSigma: isBlank(p.studentSigma) && r?.studentT?.sigma !== undefined ? String(r.studentT.sigma) : p.studentSigma,
            studentNu: isBlank(p.studentNu) && r?.studentT?.nu !== undefined ? String(r.studentT.nu) : p.studentNu,
          };
        }));
      }
    };

    // Apply frontend defaults (best-effort) so advanced fields are prefilled.
    // We still omit the corresponding properties from the request payload when the
    // UI section is disabled/hidden.
    applyDefaultsIfBlank({
      tax: {
        exemptionCard: { limit: 51600, increase: 1000 },
        stockExemption: { taxRate: 27, limit: 67500, increase: 1000 },
      },
      inflation: { averagePercentage: 2 },
      returner: {
        type: 'dataDrivenReturn',
        simpleReturn: { averagePercentage: 7 },
        random: { seed: 1 },
        distribution: {
          type: 'normal',
          brownianMotion: { drift: 0.07, volatility: 0.2 },
          normal: { mean: 0.07, standardDeviation: 0.2 },
          studentT: { mu: 0.042, sigma: 0.609, nu: 3.6 },
          regimeBased: {
            tickMonths: 1,
            regimes: [
              {
                distributionType: 'normal',
                expectedDurationMonths: 12,
                switchWeights: { toRegime0: 0, toRegime1: 1, toRegime2: 1 },
                normal: { mean: 0.07, standardDeviation: 0.2 },
                studentT: { mu: 0.042, sigma: 0.609, nu: 3.6 },
              },
              {
                distributionType: 'normal',
                expectedDurationMonths: 12,
                switchWeights: { toRegime0: 1, toRegime1: 0, toRegime2: 1 },
                normal: { mean: 0.07, standardDeviation: 0.2 },
                studentT: { mu: 0.042, sigma: 0.609, nu: 3.6 },
              },
              {
                distributionType: 'normal',
                expectedDurationMonths: 12,
                switchWeights: { toRegime0: 1, toRegime1: 1, toRegime2: 0 },
                normal: { mean: 0.07, standardDeviation: 0.2 },
                studentT: { mu: 0.042, sigma: 0.609, nu: 3.6 },
              },
            ],
          },
        },
      },
    });
    hasAppliedFetchedAdvancedDefaultsRef.current = true;
  }, [advancedEnabled]);

  const closeScenarioModal = useCallback(() => {
    setIsScenarioModalOpen(false);
    setShareUrl('');
    setDidCopyShareUrl(false);
    setCompareScenarioId('');
    setShowScenarioCompare(false);
  }, []);

  const scenarioA = useMemo(() => savedScenarios.find((s) => s.id === selectedScenarioId), [savedScenarios, selectedScenarioId]);
  const scenarioB = useMemo(() => savedScenarios.find((s) => s.id === compareScenarioId), [savedScenarios, compareScenarioId]);
  const scenarioASummary = useMemo(() => (scenarioA ? summarizeScenario(scenarioA.request) : null), [scenarioA]);
  const scenarioBSummary = useMemo(() => (scenarioB ? summarizeScenario(scenarioB.request) : null), [scenarioB]);

  const fmtNumber = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }),
    []
  );
  const fmtInt = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }),
    []
  );

  useEffect(() => {
    if (!isScenarioModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeScenarioModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeScenarioModal, isScenarioModalOpen]);

  const handleSaveScenario = useCallback(async () => {
    const name = window.prompt('Scenario name?');
    if (!name) return;

    const matchingLastRunId = lastCompletedRun && deepEqual(lastCompletedRun.request, currentRequest)
      ? lastCompletedRun.id
      : undefined;

    const resolvedRunId = matchingLastRunId
      ?? (simulationId
        ? simulationId
        : await findRunForInput(currentRequest).catch(() => null));

    const existing = findScenarioByName(name);
    if (existing) {
      const ok = window.confirm(`Overwrite existing scenario "${existing.name}"?`);
      if (!ok) return;
      const saved = saveScenario(existing.name, currentRequest, existing.id, resolvedRunId ?? existing.runId ?? undefined);
      refreshSavedScenarios();
      setSelectedScenarioId(saved.id);
      return;
    }

    const saved = saveScenario(name, currentRequest, undefined, resolvedRunId ?? undefined);
    refreshSavedScenarios();
    setSelectedScenarioId(saved.id);
  }, [currentRequest, refreshSavedScenarios, simulationId, lastCompletedRun]);

  const runSimulationWithRequest = useCallback(async (req: SimulationRequest) => {
    const total = (req.phases ?? []).reduce((s, p) => s + (Number(p.durationInMonths) || 0), 0);
    if (total > MAX_MONTHS) {
      alert(`Total duration must be ≤ ${MAX_YEARS} years (you have ${formatYearsMonths(total)}).`);
      return;
    }

    setSimulateInProgress(true);
    setSimulationId(null);

    try {
      const sanitized: SimulationRequest = {
        ...req,
        startDate: { date: req.startDate.date },
        phases: (req.phases ?? []).map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
      };
      lastRunRequestRef.current = sanitized;

      if (!advancedEnabled) {
        const id = await startSimulation(sanitized);
        lastRunWasNormalRef.current = true;
        setSimulationId(id);
        return;
      }

      const seedNum = returnModelFeatureOn ? toNumOrUndef(seed) : undefined;
      const inflationFactorToSend = inflationFeatureOn ? 1 + (Number(inflationAveragePct) || 0) / 100 : undefined;
      const yearlyFeePercentageToSend = feeFeatureOn ? (Number(yearlyFeePercentage) || 0) : undefined;

      const exCardLimit = toNumOrUndef(exemptionCardLimit);
      const exCardInc = toNumOrUndef(exemptionCardYearlyIncrease);
      const stockTaxRate = toNumOrUndef(stockExemptionTaxRate);
      const stockLimit = toNumOrUndef(stockExemptionLimit);
      const stockInc = toNumOrUndef(stockExemptionYearlyIncrease);

      const taxExemptionConfig: AdvancedSimulationRequest['taxExemptionConfig'] | undefined =
        exemptionsFeatureOn && (exCardLimit !== undefined || exCardInc !== undefined || stockTaxRate !== undefined || stockLimit !== undefined || stockInc !== undefined)
          ? {
              exemptionCard: {
                limit: exCardLimit,
                yearlyIncrease: exCardInc,
              },
              stockExemption: {
                taxRate: stockTaxRate,
                limit: stockLimit,
                yearlyIncrease: stockInc,
              },
            }
          : undefined;

      const returnTypeToSend: ReturnType = returnModelFeatureOn ? returnType : 'dataDrivenReturn';

      const rc: AdvancedSimulationRequest['returnerConfig'] = {};
      if (returnModelFeatureOn && seedNum !== undefined) rc.seed = seedNum;

      if (returnModelFeatureOn && returnType === 'simpleReturn') {
        const avg = toNumOrUndef(simpleAveragePercentage);
        if (avg !== undefined) rc.simpleAveragePercentage = avg;
      }

      if (returnModelFeatureOn && returnType === 'distributionReturn') {
        const distCfg: NonNullable<AdvancedSimulationRequest['returnerConfig']>['distribution'] = {
          type: distributionType,
        };

        if (distributionType === 'normal') {
          distCfg.normal = {
            mean: toNumOrUndef(normalMean),
            standardDeviation: toNumOrUndef(normalStdDev),
          };
        } else if (distributionType === 'brownianMotion') {
          distCfg.brownianMotion = {
            drift: toNumOrUndef(brownianDrift),
            volatility: toNumOrUndef(brownianVolatility),
          };
        } else if (distributionType === 'studentT') {
          distCfg.studentT = {
            mu: toNumOrUndef(studentMu),
            sigma: toNumOrUndef(studentSigma),
            nu: toNumOrUndef(studentNu),
          };
        } else if (distributionType === 'regimeBased') {
          distCfg.regimeBased = {
            tickMonths: toNumOrUndef(regimeTickMonths),
            regimes: regimes.map((r) => ({
              distributionType: r.distributionType,
              expectedDurationMonths: toNumOrUndef(r.expectedDurationMonths),
              switchWeights: {
                toRegime0: toNumOrUndef(r.toRegime0),
                toRegime1: toNumOrUndef(r.toRegime1),
                toRegime2: toNumOrUndef(r.toRegime2),
              },
              normal: {
                mean: toNumOrUndef(r.normalMean),
                standardDeviation: toNumOrUndef(r.normalStdDev),
              },
              studentT: {
                mu: toNumOrUndef(r.studentMu),
                sigma: toNumOrUndef(r.studentSigma),
                nu: toNumOrUndef(r.studentNu),
              },
            })),
          };
        }

        rc.distribution = distCfg;
      }

      const hasReturnerConfig =
        returnModelFeatureOn && (
          rc.seed !== undefined ||
          rc.simpleAveragePercentage !== undefined ||
          rc.distribution?.type !== undefined
        );

      const inflationEquivalentToNormal = !inflationFeatureOn || (inflationFactorToSend !== undefined && Math.abs(inflationFactorToSend - 1.02) < 1e-12);
      const yearlyFeeEquivalentToNormal = !feeFeatureOn || (yearlyFeePercentageToSend !== undefined && Math.abs(yearlyFeePercentageToSend) < 1e-12);
      const returnerEquivalentToNormal =
        !returnModelFeatureOn || (
          returnTypeToSend === 'dataDrivenReturn' &&
          seedNum === undefined &&
          !hasReturnerConfig
        );
      const taxEquivalentToNormal = !exemptionsFeatureOn || taxExemptionConfig === undefined;

      // Backend dedup is based on the *input DTO* (normal vs advanced), so even if the
      // internal run-spec ends up identical, calling /start-advanced will not dedup with /start.
      // When advanced options don't change anything beyond the normal endpoint defaults,
      // route through /start so we hit dedup.
      const shouldUseNormalEndpointForDedup =
        taxEquivalentToNormal &&
        returnerEquivalentToNormal &&
        inflationEquivalentToNormal &&
        yearlyFeeEquivalentToNormal;

      if (shouldUseNormalEndpointForDedup) {
        const id = await startSimulation(sanitized);
        lastRunWasNormalRef.current = true;
        setSimulationId(id);
        return;
      }

      const advReq: AdvancedSimulationRequest = {
        startDate: { date: sanitized.startDate.date },
        phases: sanitized.phases,
        overallTaxRule: mapOverallTaxRuleForAdvanced(sanitized.overallTaxRule),
        taxPercentage: sanitized.taxPercentage,
        ...(returnModelFeatureOn
          ? {
              returnType: returnTypeToSend,
              seed: seedNum,
              returnerConfig: hasReturnerConfig ? rc : undefined,
            }
          : {}),
        ...(exemptionsFeatureOn ? { taxExemptionConfig } : {}),
        ...(inflationFeatureOn ? { inflationFactor: inflationFactorToSend } : {}),
        ...(feeFeatureOn ? { yearlyFeePercentage: yearlyFeePercentageToSend } : {}),
      };

      const id = await startAdvancedSimulation(advReq);
      lastRunWasNormalRef.current = false;
      setSimulationId(id);
    } catch (err) {
      alert((err as Error).message);
      setSimulateInProgress(false);
    }
  }, [
    advancedEnabled,
    inflationFeatureOn,
    feeFeatureOn,
    exemptionsFeatureOn,
    returnModelFeatureOn,
    inflationAveragePct,
    yearlyFeePercentage,
    returnType,
    seed,
    simpleAveragePercentage,
    distributionType,
    normalMean,
    normalStdDev,
    brownianDrift,
    brownianVolatility,
    studentMu,
    studentSigma,
    studentNu,
    regimeTickMonths,
    regimes,
    exemptionCardLimit,
    exemptionCardYearlyIncrease,
    stockExemptionTaxRate,
    stockExemptionLimit,
    stockExemptionYearlyIncrease,
  ]);

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
    void runSimulationWithRequest(scenario.request);
    closeScenarioModal();
  }, [applyRequestToForm, closeScenarioModal, isDirty, runSimulationWithRequest]);

  const handleShareScenario = useCallback(() => {
    if (!selectedScenarioId) return;
    const scenario = findScenarioById(selectedScenarioId);
    if (!scenario) return;

    const ok = window.confirm(
      'This share link encodes your full scenario inputs in the URL. Anyone with the link can view/decode them. Continue?'
    );
    if (!ok) return;

    const param = encodeScenarioToShareParam(scenario.request);
    const url = new URL(window.location.href);
    url.pathname = '/simulation';
    url.searchParams.set('scenario', param);
    setShareUrl(url.toString());
  }, [selectedScenarioId]);

  const handleCopyShareUrl = useCallback(async () => {
    if (!shareUrl) return;
    try {
      const writeText = navigator.clipboard?.writeText;
      if (typeof writeText !== 'function') throw new Error('Clipboard API unavailable');
      await writeText.call(navigator.clipboard, shareUrl);
      setDidCopyShareUrl(true);
      window.setTimeout(() => setDidCopyShareUrl(false), 2500);
    } catch {
      window.prompt('Copy share link:', shareUrl);
    }
  }, [shareUrl]);

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

  const hasAppliedInitialTemplateRef = useRef(false);
  useEffect(() => {
    if (hasAppliedInitialTemplateRef.current) return;
    hasAppliedInitialTemplateRef.current = true;

    if (scenarioParamOnLoad) return;
    applyTemplate(selectedTemplateId); // Apply starter template on first load
  }, [applyTemplate, scenarioParamOnLoad, selectedTemplateId]);

  const hasAppliedScenarioFromUrlRef = useRef(false);
  useEffect(() => {
    if (hasAppliedScenarioFromUrlRef.current) return;
    if (!scenarioParamOnLoad) return;

    const decoded = decodeScenarioFromShareParam(scenarioParamOnLoad);
    if (!decoded) {
      hasAppliedScenarioFromUrlRef.current = true;
      window.alert('Invalid or corrupted share link.');
      return;
    }

    const okPrivacy = window.confirm(
      'This link contains a scenario encoded in the URL. Anyone with the link can decode it. Load and run it now?'
    );
    if (!okPrivacy) {
      hasAppliedScenarioFromUrlRef.current = true;
      return;
    }

    if (isDirty) {
      const okOverwrite = window.confirm('Loading this scenario will overwrite your current inputs. Continue?');
      if (!okOverwrite) {
        hasAppliedScenarioFromUrlRef.current = true;
        return;
      }
    }

    applyRequestToForm(decoded);
    setSelectedScenarioId('');
    void runSimulationWithRequest(decoded);
    hasAppliedScenarioFromUrlRef.current = true;
  }, [applyRequestToForm, isDirty, runSimulationWithRequest, scenarioParamOnLoad]);

  const handleAddDefaultPhase = () => {
    handleAddPhase(createDefaultPhase('DEPOSIT'));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    void runSimulationWithRequest({
      startDate: { date: startDate },
      overallTaxRule,
      taxPercentage,
      phases,
    });
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

  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--fc-card-border)',
    borderRadius: 12,
    padding: 12,
    background: 'var(--fc-card-bg)',
    color: 'var(--fc-card-text)',
  };

  const cardTitleStyle: React.CSSProperties = { fontWeight: 800, marginBottom: 8 };

  const advancedFieldsetStyle = (enabled: boolean): React.CSSProperties => ({
    border: 0,
    padding: 0,
    margin: 0,
    opacity: enabled ? 1 : 0.55,
  });

  const rowStyle: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center' };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.3rem', flex: 1 };

  const updateRegime = (idx: number, patch: Partial<(typeof regimes)[number]>) => {
    setRegimes((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxWidth: 400, margin: '0 auto', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={cardStyle}>
          <div style={cardTitleStyle}>General Options</div>

          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="fc-field-label">Template</span>
            <div style={rowStyle}>
              <select
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value as SimulationTemplateId)}
                disabled={simulateInProgress}
                style={inputStyle}
              >
                {SIMULATION_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <InfoTooltip label="Info: Template">
                A template fills in a complete example scenario (phases + taxes). Selecting a new template overwrites the current inputs.
              </InfoTooltip>
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 4 }} role="note">
              {selectedTemplate.description}
            </div>
          </label>

          <label data-tour="start-date" style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            <span className="fc-field-label">Start Date</span>
            <div style={rowStyle}>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={inputStyle}
              />
              <InfoTooltip label="Info: Start date">
                The simulation timeline begins here. Phase durations are applied month-by-month starting from this date.
              </InfoTooltip>
            </div>
          </label>

          {advancedEnabled && inflationFeatureOn && (
            <label style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              <span className="fc-field-label">Inflation (avg % / year)</span>
              <div style={rowStyle}>
                <input
                  type="number"
                  step="0.01"
                  value={inflationAveragePct}
                  onChange={(e) => setInflationAveragePct(Number(e.target.value))}
                  disabled={simulateInProgress}
                  style={inputStyle}
                />
                <InfoTooltip label="(i)">
                  Average annual inflation (in %) used to inflation-adjust withdrawals/spending over time.
                  This affects how your “real” spending power changes from year to year.
                </InfoTooltip>
              </div>
            </label>
          )}

          {advancedEnabled && feeFeatureOn && (
            <label style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              <span className="fc-field-label">Fee (avg % / year)</span>
              <div style={rowStyle}>
                <input
                  type="number"
                  step="0.01"
                  value={yearlyFeePercentage}
                  onChange={(e) => setYearlyFeePercentage(Number(e.target.value))}
                  disabled={simulateInProgress}
                  style={inputStyle}
                />
                <InfoTooltip label="(i)">
                  Annual fee charged on current capital at year-end (in %). For example, 0.5 means 0.5% of capital is deducted each year.
                </InfoTooltip>
              </div>
            </label>
          )}
        </div>

        <div style={cardStyle}>
          <div style={cardTitleStyle}>Tax rules</div>

          <label data-tour="tax-rule" style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="fc-field-label">Tax Rule</span>
            <div style={rowStyle}>
              <select
                value={overallTaxRule}
                onChange={e => setOverallTaxRule(e.target.value as OverallTaxRule)}
                style={inputStyle}
              >
                <option value="CAPITAL">Capital Gains</option>
                <option value="NOTIONAL">Notional Gains</option>
              </select>
              <InfoTooltip label="Info: Tax rule">
                Choose how taxes are applied. Capital gains tax happens when you withdraw. Notional gains tax happens at year-end on gains since the prior year-end.
              </InfoTooltip>
            </div>
          </label>

          <label data-tour="tax-percent" style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            <span className="fc-field-label">Tax %</span>
            <div style={rowStyle}>
              <input
                type="number"
                step="0.01"
                value={taxPercentage}
                onChange={e => setTaxPercentage(+e.target.value)}
                style={inputStyle}
              />
              <InfoTooltip label="Info: Tax percentage">
                The tax rate applied by the selected tax rule. Phase exemptions (e.g. exemption card / stock exemption) reduce what gets taxed.
              </InfoTooltip>
            </div>
          </label>

          {advancedEnabled && exemptionsFeatureOn && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--fc-subtle-border)', paddingTop: 12 }}>
            <div style={{ fontWeight: 750, marginBottom: 6 }}>Exemptions</div>
            <fieldset disabled={simulateInProgress} style={advancedFieldsetStyle(true)}>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
                Configure exemption limits and yearly increases. Enable per-phase exemptions inside each phase.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Exemption card</div>

                  <label className="fc-field-row" style={{ marginBottom: 8 }}>
                    <span className="fc-field-label">Limit</span>
                    <div className="fc-field-control">
                      <input type="number" value={exemptionCardLimit} onChange={(e) => setExemptionCardLimit(e.target.value)} style={inputStyle} />
                    </div>
                    <div className="fc-field-info">
                      <InfoTooltip label="(i)">
                        Maximum tax-free amount per year for the exemption card rule.
                        If enabled in a phase, withdrawals up to this limit reduce the taxable amount.
                      </InfoTooltip>
                    </div>
                  </label>

                  <label className="fc-field-row">
                    <span className="fc-field-label">Yearly increase</span>
                    <div className="fc-field-control">
                      <input type="number" value={exemptionCardYearlyIncrease} onChange={(e) => setExemptionCardYearlyIncrease(e.target.value)} style={inputStyle} />
                    </div>
                    <div className="fc-field-info">
                      <InfoTooltip label="(i)">
                        Yearly increase applied to the exemption card limit.
                        Use this to model a tax-free allowance that grows over time.
                      </InfoTooltip>
                    </div>
                  </label>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Stock exemption</div>

                  <label className="fc-field-row" style={{ marginBottom: 8 }}>
                    <span className="fc-field-label">Tax rate %</span>
                    <div className="fc-field-control">
                      <input type="number" step="0.01" value={stockExemptionTaxRate} onChange={(e) => setStockExemptionTaxRate(e.target.value)} style={inputStyle} />
                    </div>
                    <div className="fc-field-info">
                      <InfoTooltip label="(i)">
                        Reduced tax rate (%) applied to the portion covered by the stock exemption rule.
                        This can model preferential taxation for certain equity withdrawals.
                      </InfoTooltip>
                    </div>
                  </label>

                  <label className="fc-field-row" style={{ marginBottom: 8 }}>
                    <span className="fc-field-label">Limit</span>
                    <div className="fc-field-control">
                      <input type="number" value={stockExemptionLimit} onChange={(e) => setStockExemptionLimit(e.target.value)} style={inputStyle} />
                    </div>
                    <div className="fc-field-info">
                      <InfoTooltip label="(i)">
                        Maximum eligible amount per year for the stock exemption.
                        Amounts above this limit are taxed using the overall tax settings.
                      </InfoTooltip>
                    </div>
                  </label>

                  <label className="fc-field-row">
                    <span className="fc-field-label">Yearly increase</span>
                    <div className="fc-field-control">
                      <input type="number" value={stockExemptionYearlyIncrease} onChange={(e) => setStockExemptionYearlyIncrease(e.target.value)} style={inputStyle} />
                    </div>
                    <div className="fc-field-info">
                      <InfoTooltip label="(i)">
                        Yearly increase applied to the stock exemption limit.
                        Use this if the exemption allowance increases over time.
                      </InfoTooltip>
                    </div>
                  </label>
                </div>
              </div>
            </fieldset>
          </div>
          )}
        </div>

        {advancedEnabled && returnModelFeatureOn && (
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Return model</div>
          <fieldset disabled={simulateInProgress} style={advancedFieldsetStyle(true)}>
            <label className="fc-field-row" style={{ marginBottom: 10 }}>
              <span className="fc-field-label">Return type</span>
              <div className="fc-field-control">
                <select value={returnType} onChange={(e) => setReturnType(parseReturnType(e.target.value))} style={inputStyle}>
                  <option value="dataDrivenReturn">Data-driven (historical)</option>
                  <option value="distributionReturn">Distribution-based</option>
                  <option value="simpleReturn">Simple average</option>
                </select>
              </div>
              <div className="fc-field-info">
                <InfoTooltip label="(i)">
                  Select how yearly returns are generated.
                  Historical uses sampled data, distribution-based draws from a parametric model, and simple uses a constant average.
                </InfoTooltip>
              </div>
            </label>
            
            {returnType != 'simpleReturn' && (
              <label className="fc-field-row" style={{ marginBottom: 10 }}>
                <span className="fc-field-label">RNG seed (optional)</span>
                <div className="fc-field-control">
                  <input type="number" step="1" value={seed} onChange={(e) => setSeed(e.target.value)} style={inputStyle} />
                </div>
                <div className="fc-field-info">
                  <InfoTooltip label="(i)">
                    Optional random seed for return generation.
                    Non-negative values make results deterministic for the same inputs; negative forces a fresh random stream each run.
                  </InfoTooltip>
                </div>
              </label>
            )}

            {returnType === 'simpleReturn' && (
              <label className="fc-field-row" style={{ marginBottom: 10 }}>
                <span className="fc-field-label">Return % / year</span>
                <div className="fc-field-control">
                  <input type="number" step="0.01" value={simpleAveragePercentage} onChange={(e) => setSimpleAveragePercentage(e.target.value)} style={inputStyle} />
                </div>
                <div className="fc-field-info">
                  <InfoTooltip label="(i)">
                    Constant yearly return percentage applied each year.
                    Useful for quick what-if scenarios when you don’t want variability.
                  </InfoTooltip>
                </div>
              </label>
            )}

            {returnType === 'distributionReturn' && (
              <div style={{ marginTop: 12 }}>
                <label className="fc-field-row" style={{ marginBottom: 10 }}>
                  <span className="fc-field-label">Distribution</span>
                  <div className="fc-field-control">
                    <select value={distributionType} onChange={(e) => setDistributionType(parseDistributionType(e.target.value))} style={inputStyle}>
                      <option value="normal">Normal</option>
                      <option value="brownianMotion">Brownian motion</option>
                      <option value="studentT">Student t</option>
                      <option value="regimeBased">Regime-based</option>
                    </select>
                  </div>
                  <div className="fc-field-info">
                    <InfoTooltip label="(i)">
                      Parametric model used to draw returns.
                      Choose a simple distribution (Normal/Student t), a process model (Brownian), or switching regimes.
                    </InfoTooltip>
                  </div>
                </label>

                {distributionType === 'normal' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    <label className="fc-field-row">
                      <span className="fc-field-label">Mean</span>
                      <div className="fc-field-control">
                        <input type="number" step="0.0001" value={normalMean} onChange={(e) => setNormalMean(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="fc-field-info">
                        <InfoTooltip label="(i)">
                          Expected return per year (mean of the Normal distribution).
                          Higher mean increases typical growth, but does not change volatility.
                        </InfoTooltip>
                      </div>
                    </label>
                    <label className="fc-field-row">
                      <span className="fc-field-label">Std dev</span>
                      <div className="fc-field-control">
                        <input type="number" step="0.0001" value={normalStdDev} onChange={(e) => setNormalStdDev(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="fc-field-info">
                        <InfoTooltip label="(i)">
                          Volatility per year (standard deviation).
                          Larger values increase year-to-year swings and drawdown risk.
                        </InfoTooltip>
                      </div>
                    </label>
                  </div>
                )}

                {distributionType === 'brownianMotion' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    <label className="fc-field-row">
                      <span className="fc-field-label">Drift</span>
                      <div className="fc-field-control">
                        <input type="number" step="0.0001" value={brownianDrift} onChange={(e) => setBrownianDrift(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="fc-field-info">
                        <InfoTooltip label="(i)">
                          Expected growth component (drift) of the Brownian motion model.
                          Higher drift increases typical growth without changing randomness strength.
                        </InfoTooltip>
                      </div>
                    </label>
                    <label className="fc-field-row">
                      <span className="fc-field-label">Volatility</span>
                      <div className="fc-field-control">
                        <input type="number" step="0.0001" value={brownianVolatility} onChange={(e) => setBrownianVolatility(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="fc-field-info">
                        <InfoTooltip label="(i)">
                          Randomness strength (volatility) for the Brownian model.
                          Higher volatility means more variable outcomes and wider result spread.
                        </InfoTooltip>
                      </div>
                    </label>
                  </div>
                )}

                {distributionType === 'studentT' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    <label className="fc-field-row">
                      <span className="fc-field-label">Mu</span>
                      <div className="fc-field-control">
                        <input type="number" step="0.0001" value={studentMu} onChange={(e) => setStudentMu(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="fc-field-info">
                        <InfoTooltip label="(i)">
                          Location/center of the Student t distribution.
                          Similar role to a mean, but heavy tails can still produce extreme years.
                        </InfoTooltip>
                      </div>
                    </label>
                    <label className="fc-field-row">
                      <span className="fc-field-label">Sigma</span>
                      <div className="fc-field-control">
                        <input type="number" step="0.0001" value={studentSigma} onChange={(e) => setStudentSigma(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="fc-field-info">
                        <InfoTooltip label="(i)">
                          Scale/spread of the Student t distribution.
                          Higher sigma increases variability in outcomes.
                        </InfoTooltip>
                      </div>
                    </label>
                    <label className="fc-field-row">
                      <span className="fc-field-label">Nu</span>
                      <div className="fc-field-control">
                        <input type="number" step="0.0001" value={studentNu} onChange={(e) => setStudentNu(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="fc-field-info">
                        <InfoTooltip label="(i)">
                          Degrees of freedom (tail heaviness).
                          Lower values produce fatter tails (more extreme years); higher values approach Normal behavior.
                        </InfoTooltip>
                      </div>
                    </label>
                  </div>
                )}

                {distributionType === 'regimeBased' && (
                  <div style={{ marginTop: 10 }}>
                    <label className="fc-field-row" style={{ marginBottom: 10 }}>
                      <span className="fc-field-label">Tick months</span>
                      <div className="fc-field-control">
                        <input type="number" step="1" value={regimeTickMonths} onChange={(e) => setRegimeTickMonths(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="fc-field-info">
                        <InfoTooltip label="(i)">
                          How often regime switching is evaluated (in months).
                          Smaller values allow more frequent changes; larger values keep regimes stable longer.
                        </InfoTooltip>
                      </div>
                    </label>

                    <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                      Regime-based defaults to 3 regimes (0..2). You can leave fields blank to use backend defaults.
                    </div>

                    {regimes.map((r, i) => (
                      <details key={i} open={i === 0} style={{ border: '1px solid var(--fc-subtle-border)', borderRadius: 10, padding: 10, marginBottom: 10, background: 'var(--fc-subtle-bg)' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Regime {i}</summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                          <label className="fc-field-row">
                            <span className="fc-field-label">Distribution</span>
                            <div className="fc-field-control">
                              <select
                                value={r.distributionType}
                                onChange={(e) => updateRegime(i, { distributionType: e.target.value === 'studentT' ? 'studentT' : 'normal' })}
                                style={inputStyle}
                              >
                                <option value="normal">Normal</option>
                                <option value="studentT">Student t</option>
                              </select>
                            </div>
                            <div className="fc-field-info">
                              <InfoTooltip label="(i)">
                                Choose the distribution used inside this regime.
                                Student t allows fatter tails than Normal (more extreme years).
                              </InfoTooltip>
                            </div>
                          </label>

                          <label className="fc-field-row">
                            <span className="fc-field-label">Expected duration (months)</span>
                            <div className="fc-field-control">
                              <input type="number" step="1" value={r.expectedDurationMonths} onChange={(e) => updateRegime(i, { expectedDurationMonths: e.target.value })} style={inputStyle} />
                            </div>
                            <div className="fc-field-info">
                              <InfoTooltip label="(i)">
                                Average time spent in this regime before switching (in months).
                                This influences how persistent each market regime is.
                              </InfoTooltip>
                            </div>
                          </label>

                          <label className="fc-field-row">
                            <span className="fc-field-label">Switch to 0</span>
                            <div className="fc-field-control">
                              <input type="number" step="0.01" value={r.toRegime0} onChange={(e) => updateRegime(i, { toRegime0: e.target.value })} style={inputStyle} />
                            </div>
                            <div className="fc-field-info">
                              <InfoTooltip label="(i)">
                                Relative weight/probability to move to regime 0 when switching.
                                The weights (to 0/1/2) are normalized into probabilities.
                              </InfoTooltip>
                            </div>
                          </label>

                          <label className="fc-field-row">
                            <span className="fc-field-label">Switch to 1</span>
                            <div className="fc-field-control">
                              <input type="number" step="0.01" value={r.toRegime1} onChange={(e) => updateRegime(i, { toRegime1: e.target.value })} style={inputStyle} />
                            </div>
                            <div className="fc-field-info">
                              <InfoTooltip label="(i)">
                                Relative weight/probability to move to regime 1 when switching.
                                If all weights are equal, switching is unbiased.
                              </InfoTooltip>
                            </div>
                          </label>

                          <label className="fc-field-row">
                            <span className="fc-field-label">Switch to 2</span>
                            <div className="fc-field-control">
                              <input type="number" step="0.01" value={r.toRegime2} onChange={(e) => updateRegime(i, { toRegime2: e.target.value })} style={inputStyle} />
                            </div>
                            <div className="fc-field-info">
                              <InfoTooltip label="(i)">
                                Relative weight/probability to move to regime 2 when switching.
                                Increase this to spend more time in regime 2 overall.
                              </InfoTooltip>
                            </div>
                          </label>
                        </div>

                        {r.distributionType === 'normal' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            <label className="fc-field-row">
                              <span className="fc-field-label">Mean</span>
                              <div className="fc-field-control">
                                <input type="number" step="0.0001" value={r.normalMean} onChange={(e) => updateRegime(i, { normalMean: e.target.value })} style={inputStyle} />
                              </div>
                              <div className="fc-field-info">
                                <InfoTooltip label="(i)">
                                  Expected return (mean) while in this regime.
                                  Use different means to model bull vs bear markets.
                                </InfoTooltip>
                              </div>
                            </label>

                            <label className="fc-field-row">
                              <span className="fc-field-label">Std dev</span>
                              <div className="fc-field-control">
                                <input type="number" step="0.0001" value={r.normalStdDev} onChange={(e) => updateRegime(i, { normalStdDev: e.target.value })} style={inputStyle} />
                              </div>
                              <div className="fc-field-info">
                                <InfoTooltip label="(i)">
                                  Volatility (standard deviation) while in this regime.
                                  Higher volatility widens the spread of possible outcomes.
                                </InfoTooltip>
                              </div>
                            </label>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            <label className="fc-field-row">
                              <span className="fc-field-label">Mu</span>
                              <div className="fc-field-control">
                                <input type="number" step="0.0001" value={r.studentMu} onChange={(e) => updateRegime(i, { studentMu: e.target.value })} style={inputStyle} />
                              </div>
                              <div className="fc-field-info">
                                <InfoTooltip label="(i)">
                                  Location/center of the Student t distribution for this regime.
                                  Similar to a mean, but with heavy-tail behavior depending on nu.
                                </InfoTooltip>
                              </div>
                            </label>

                            <label className="fc-field-row">
                              <span className="fc-field-label">Sigma</span>
                              <div className="fc-field-control">
                                <input type="number" step="0.0001" value={r.studentSigma} onChange={(e) => updateRegime(i, { studentSigma: e.target.value })} style={inputStyle} />
                              </div>
                              <div className="fc-field-info">
                                <InfoTooltip label="(i)">
                                  Scale/spread of the Student t distribution for this regime.
                                  Increase to allow larger typical swings.
                                </InfoTooltip>
                              </div>
                            </label>

                            <label className="fc-field-row">
                              <span className="fc-field-label">Nu</span>
                              <div className="fc-field-control">
                                <input type="number" step="0.0001" value={r.studentNu} onChange={(e) => updateRegime(i, { studentNu: e.target.value })} style={inputStyle} />
                              </div>
                              <div className="fc-field-info">
                                <InfoTooltip label="(i)">
                                  Degrees of freedom controlling tail heaviness for this regime.
                                  Lower values allow more extreme outcomes; higher values behave closer to Normal.
                                </InfoTooltip>
                              </div>
                            </label>
                          </div>
                        )}
                      </details>
                    ))}
                  </div>
                )}
              </div>
            )}
          </fieldset>
        </div>
        )}
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 8, alignItems: 'center' }}>
        {rightFooterActions}
      </div>

      {footerBelow}

      {simulateInProgress && simulationId && (
        <SimulationProgress
          simulationId={simulationId}
          onComplete={(result) => {
            const completedId = simulationId;
            setSimulateInProgress(false);
            setSimulationId(null);

            if (completedId && lastRunWasNormalRef.current && lastRunRequestRef.current) {
              setLastCompletedRun({ id: completedId, request: lastRunRequestRef.current });
            }

            const inflationFactorPerYear = inflationFeatureOn
              ? 1 + (Number(inflationAveragePct) || 0) / 100
              : 1.02;
            const timeline: SimulationTimelineContext = {
              startDate,
              phaseTypes: phases.map((p) => p.phaseType),
              phaseDurationsInMonths: phases.map((p) => Number(p.durationInMonths) || 0),
              firstPhaseInitialDeposit: phases[0]?.initialDeposit !== undefined ? Number(phases[0]?.initialDeposit) : undefined,
              inflationFactorPerYear,
            };
            onSimulationComplete?.(result, timeline, completedId ?? undefined);
          }}
        />
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

      {isScenarioModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saved scenarios"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeScenarioModal();
          }}
        >
          <div
            style={{
              width: 'min(420px, 92vw)',
              background: '#111',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: 12,
              padding: 14,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Saved scenarios</div>
              <button
                type="button"
                aria-label="Close saved scenarios"
                title="Close"
                onClick={closeScenarioModal}
                style={btn('ghost')}
              >
                <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, display: 'inline-block' }}>✕</span>
              </button>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>Scenario</span>
              <select
                aria-label="Scenario"
                value={selectedScenarioId}
                onChange={(e) => {
                  setSelectedScenarioId(e.target.value);
                  setShowScenarioCompare(false);
                }}
                disabled={simulateInProgress}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.35rem' }}
              >
                <option value="">— Select —</option>
                {savedScenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>Compare to</span>
              <select
                aria-label="Compare to scenario"
                value={compareScenarioId}
                onChange={(e) => {
                  setCompareScenarioId(e.target.value);
                  setShowScenarioCompare(false);
                }}
                disabled={simulateInProgress}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.95rem', padding: '0.35rem' }}
              >
                <option value="">— Select —</option>
                {savedScenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                aria-label="Compare scenarios"
                title="Compare the two selected scenarios"
                onClick={() => {
                  if (!scenarioA || !scenarioB) return;

                  const q = new URLSearchParams({ scenarioA: scenarioA.id, scenarioB: scenarioB.id }).toString();
                  closeScenarioModal();
                  navigate(`/simulation/diff?${q}`);
                }}
                disabled={!selectedScenarioId || !compareScenarioId || selectedScenarioId === compareScenarioId || simulateInProgress}
                style={btn(!selectedScenarioId || !compareScenarioId || selectedScenarioId === compareScenarioId || simulateInProgress ? 'disabled' : 'ghost')}
              >
                <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, display: 'inline-block' }}>⇄</span>
              </button>
              <button
                type="button"
                aria-label="Share scenario"
                title="Share (creates a link that loads + runs)"
                onClick={handleShareScenario}
                disabled={!selectedScenarioId || simulateInProgress}
                style={btn(!selectedScenarioId || simulateInProgress ? 'disabled' : 'ghost')}
              >
                <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, display: 'inline-block' }}>🔗</span>
              </button>
              <button
                type="button"
                aria-label="Load scenario"
                title="Load (also runs simulation)"
                onClick={() => handleLoadScenario(selectedScenarioId)}
                disabled={!selectedScenarioId || simulateInProgress}
                style={btn(!selectedScenarioId || simulateInProgress ? 'disabled' : 'ghost')}
              >
                <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, display: 'inline-block' }}>▶</span>
              </button>
              <button
                type="button"
                aria-label="Save scenario"
                title="Save"
                onClick={handleSaveScenario}
                disabled={simulateInProgress}
                style={btn(simulateInProgress ? 'disabled' : 'ghost')}
              >
                <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, display: 'inline-block' }}>💾</span>
              </button>
              <button
                type="button"
                aria-label="Delete scenario"
                title="Delete"
                onClick={handleDeleteScenario}
                disabled={!selectedScenarioId || simulateInProgress}
                style={
                  !selectedScenarioId || simulateInProgress
                    ? btn('disabled')
                    : {
                        ...btn('ghost'),
                        color: 'crimson',
                        borderColor: 'crimson',
                      }
                }
              >
                <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, display: 'inline-block' }}>🗑</span>
              </button>
            </div>

            {showScenarioCompare && (
              <div
                style={{
                  marginTop: 6,
                  borderTop: '1px solid #2a2a2a',
                  paddingTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 700 }}>Comparison</div>

                {(!scenarioA || !scenarioB || !scenarioASummary || !scenarioBSummary) && (
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    Select two different scenarios to compare.
                  </div>
                )}

                {scenarioA && scenarioB && scenarioASummary && scenarioBSummary && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, opacity: 0.9 }}>{scenarioA.name}</div>
                      <div style={{ fontWeight: 700, fontSize: 12, opacity: 0.9 }}>{scenarioB.name}</div>
                    </div>

                    {(
                      [
                        {
                          id: 'startDate',
                          label: 'Start date',
                          a: scenarioASummary.startDate,
                          b: scenarioBSummary.startDate,
                        },
                        {
                          id: 'overallTaxRule',
                          label: 'Overall tax rule',
                          a: scenarioASummary.overallTaxRule,
                          b: scenarioBSummary.overallTaxRule,
                        },
                        {
                          id: 'taxPercentage',
                          label: 'Tax %',
                          a: `${fmtNumber.format(scenarioASummary.taxPercentage)}`,
                          b: `${fmtNumber.format(scenarioBSummary.taxPercentage)}`,
                        },
                        {
                          id: 'totalDuration',
                          label: 'Total duration',
                          a: formatYearsMonths(scenarioASummary.totalMonths),
                          b: formatYearsMonths(scenarioBSummary.totalMonths),
                        },
                        {
                          id: 'phaseCount',
                          label: 'Phase count',
                          a: `${scenarioASummary.phaseCount}`,
                          b: `${scenarioBSummary.phaseCount}`,
                        },
                        {
                          id: 'phasePattern',
                          label: 'Phase pattern',
                          a: scenarioASummary.phasePattern,
                          b: scenarioBSummary.phasePattern,
                        },
                        {
                          id: 'totalInitialDeposit',
                          label: 'Initial deposits (sum)',
                          a: fmtInt.format(scenarioASummary.totalInitialDeposit),
                          b: fmtInt.format(scenarioBSummary.totalInitialDeposit),
                        },
                        {
                          id: 'totalMonthlyDeposits',
                          label: 'Monthly deposits total (best-effort)',
                          a: fmtInt.format(scenarioASummary.totalMonthlyDeposits),
                          b: fmtInt.format(scenarioBSummary.totalMonthlyDeposits),
                        },
                        {
                          id: 'totalWithdrawAmount',
                          label: 'Withdraw amount total (best-effort)',
                          a: fmtInt.format(scenarioASummary.totalWithdrawAmount),
                          b: fmtInt.format(scenarioBSummary.totalWithdrawAmount),
                        },
                        {
                          id: 'withdrawRatePhaseCount',
                          label: 'Phases using withdraw rate',
                          a: `${scenarioASummary.withdrawRatePhaseCount}`,
                          b: `${scenarioBSummary.withdrawRatePhaseCount}`,
                        },
                      ] as const
                    ).map((row) => {
                      const different = String(row.a) !== String(row.b);
                      const cellStyle: React.CSSProperties = {
                        padding: '6px 8px',
                        border: '1px solid #2a2a2a',
                        borderRadius: 8,
                        background: different ? 'rgba(255, 200, 0, 0.10)' : 'transparent',
                      };
                      return (
                        <div
                          key={row.id}
                          data-testid={`compare-row-${row.id}`}
                          data-different={different ? 'true' : 'false'}
                          style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8, alignItems: 'center' }}
                        >
                          <div style={{ fontSize: 12, opacity: 0.9 }}>{row.label}</div>
                          <div data-testid={`compare-${row.id}-a`} style={cellStyle}>{row.a}</div>
                          <div data-testid={`compare-${row.id}-b`} style={cellStyle}>{row.b}</div>
                        </div>
                      );
                    })}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {(
                        [
                          { id: 'a', req: scenarioA.request, label: scenarioA.name },
                          { id: 'b', req: scenarioB.request, label: scenarioB.name },
                        ] as const
                      ).map((x) => {
                        const segments = getTimelineSegments(x.req);
                        const total = segments.reduce((s, p) => s + (Number(p.durationInMonths) || 0), 0);
                        const colorFor = (t: any) => (t === 'DEPOSIT' ? '#2ecc71' : t === 'WITHDRAW' ? '#e67e22' : '#7f8c8d');
                        return (
                          <div key={x.id}>
                            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Phase timeline</div>
                            <div
                              data-testid={`compare-timeline-${x.id}`}
                              aria-label={`Phase timeline ${x.label}`}
                              style={{
                                display: 'flex',
                                height: 14,
                                borderRadius: 10,
                                overflow: 'hidden',
                                border: '1px solid #2a2a2a',
                                background: '#0b0b0b',
                              }}
                            >
                              {segments.map((s, i) => {
                                const months = Number(s.durationInMonths) || 0;
                                const grow = months > 0 ? months : 1;
                                return (
                                  <div
                                    key={i}
                                    title={`#${i + 1} ${s.phaseType} ${months} months`}
                                    style={{
                                      flexGrow: grow,
                                      background: colorFor(s.phaseType),
                                      opacity: months > 0 ? 1 : 0.35,
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>
                              Total: {formatYearsMonths(total)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {shareUrl && (
              <div style={{ marginTop: 6, borderTop: '1px solid #2a2a2a', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  This link encodes your full scenario inputs in the URL (anyone with it can decode them).
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>Share link</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      aria-label="Share link"
                      readOnly
                      value={shareUrl}
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.45rem',
                        fontSize: '0.9rem',
                        borderRadius: 8,
                        border: '1px solid #333',
                        background: '#0b0b0b',
                        color: '#fff',
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      aria-label="Copy share link"
                      title="Copy"
                      onClick={handleCopyShareUrl}
                      style={btn('ghost')}
                    >
                      {didCopyShareUrl ? (
                        <span aria-label="Copied" title="Copied">
                          ✓
                        </span>
                      ) : (
                        'Copy'
                      )}
                    </button>
                  </div>
                </label>

                <div style={{ display: 'flex', justifyContent: 'center', padding: 8, background: '#fff', borderRadius: 10 }}>
                  <QRCodeSVG value={shareUrl} width={220} height={220} includeMargin />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
});

export default NormalInputForm;
