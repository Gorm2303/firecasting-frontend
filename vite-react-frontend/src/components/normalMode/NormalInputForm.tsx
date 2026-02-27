// src/features/simulation/SimulationForm.tsx
import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { YearlySummary } from '../../models/YearlySummary';
import { PhaseRequest, SimulationRequest, SimulationTimelineContext } from '../../models/types';
import NormalPhaseList from '../../components/normalMode/NormalPhaseList';
import SimulationProgress from '../../components/SimulationProgress';
import { findRunForInput, startAdvancedSimulation, type StartRunResponse } from '../../api/simulation';
import type { AdvancedSimulationRequest, MasterSeedMode } from '../../models/advancedSimulation';
import { advancedToNormalRequest, DEFAULT_MASTER_SEED, DEFAULT_RETURN_TYPE, normalToAdvancedWithDefaults, seedForMode } from '../../models/advancedSimulation';
import { createDefaultSimulationRequest, createDefaultPhase } from '../../config/simulationDefaults';
import { getTemplateById, resolveTemplateToRequest, SIMULATION_TEMPLATES, type SimulationTemplateId, type TemplateAdvancedDefaults } from '../../config/simulationTemplates';
import {
  deleteScenario,
  findScenarioById,
  findScenarioByName,
  isRandomSeedRequested,
  listSavedScenarios,
  materializeRandomSeedIfNeeded,
  saveScenario,
  type SavedScenario,
} from '../../config/savedScenarios';
import { deepEqual } from '../../utils/deepEqual';
import { decodeScenarioFromShareParam, encodeScenarioToShareParam } from '../../utils/shareScenarioLink';
import { normalizeTaxRules } from '../../utils/taxRules';
import { getTimelineSegments, summarizeScenario } from '../../utils/summarizeScenario';
import { draftToIntOrZero, draftToNumberOrZero, isValidDecimalDraft, isValidIntegerDraft, parseLocaleNumber } from '../../utils/numberInput';
import { QRCodeSVG } from 'qrcode.react';
import InfoTooltip from '../InfoTooltip';
import { useAssumptions } from '../../state/assumptions';
import { getDefaultExecutionDefaults, useExecutionDefaults } from '../../state/executionDefaults';
import { appendSimulationSnapshot } from '../../state/simulationSnapshots';

const ADVANCED_OPTIONS_KEY = 'firecasting:advancedOptions:v1';
const NORMAL_DRAFT_KEY = 'firecasting:normalDraft:v1';

type OverallTaxRule = 'CAPITAL' | 'NOTIONAL';

type ReturnType = 'dataDrivenReturn' | 'distributionReturn' | 'simpleReturn';

type DistributionType = 'normal' | 'brownianMotion' | 'studentT' | 'regimeBased';

type AdvancedOptionsLoad = {
  enabled?: boolean;
  paths?: number | string;
  batchSize?: number | string;
  inflationAveragePct?: number;
  yearlyFeePercentage?: number;
  returnType?: ReturnType;
  seedMode?: MasterSeedMode;
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

// Keep advanced payload tax rule aligned with the normal endpoint casing so reproducibility works across modes.
const mapOverallTaxRuleForAdvanced = (rule: OverallTaxRule): string => (rule === 'NOTIONAL' ? 'NOTIONAL' : 'CAPITAL');

const toNumOrUndef = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseLocaleNumber(String(v));
  return Number.isFinite(n) ? n : undefined;
};

const parseReturnType = (v: any): ReturnType => {
  const s = String(v ?? '').trim();
  if (s === 'distributionReturn' || s === 'dataDrivenReturn' || s === 'simpleReturn') return s;
  // Keep backward/forward compatibility (backend defaults SimpleDailyReturn for unknown).
  return DEFAULT_RETURN_TYPE;
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
  requires?: TutorialRequirement[];
  // If true, auto-advance to the next step once all requirements are met.
  // Defaults to true for steps with requirements.
  autoAdvance?: boolean;
};

export type TutorialRequirement =
  | {
      kind: 'exists';
      selector: string;
      message: string;
    }
  | {
      kind: 'valueEquals';
      selector: string;
      value: string | number;
      message: string;
    }
  | {
      kind: 'numberEquals';
      selector: string;
      value: number;
      message: string;
      tolerance?: number;
    }
  | {
      kind: 'checkboxChecked';
      selector: string;
      message: string;
    };

export type NormalInputFormMode = 'normal' | 'advanced';

export type AdvancedFeatureFlags = {
  execution: boolean;
  inflation: boolean;
  fee: boolean;
  exemptions: boolean;
  returnModel: boolean;
};

const TUTORIAL_TEMPLATE_ID = 'tutorial' as const;
type TemplatePickerId = SimulationTemplateId | typeof TUTORIAL_TEMPLATE_ID;

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
  enteredViaBack?: boolean;
}> = ({ step, onNext, onBack, onExit, isFirst, isLast, enteredViaBack }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = useState<{ width: number; height: number } | null>(null);
  const [isPositioning, setIsPositioning] = useState<boolean>(false);
  const positioningTokenRef = useRef(0);

  const [requirementsOk, setRequirementsOk] = useState(false);
  const [requirementsHint, setRequirementsHint] = useState<string | null>(null);
  const lastAutoAdvanceStepRef = useRef<string | null>(null);
  const autoAdvancePendingForStepRef = useRef<string | null>(null);
  const hasInteractedSinceStepStartRef = useRef<boolean>(false);

  const computeUnmetRequirements = useCallback(() => {
    const reqs = step.requires ?? [];
    if (reqs.length === 0) return [] as string[];

    const resolveValueElement = (node: any): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null => {
      if (!node) return null;
      if (typeof (node as any).value !== 'undefined') return node as any;
      const nested = node.querySelector?.('input, select, textarea') as any;
      return nested ?? null;
    };

    const resolveCheckboxElement = (node: any): HTMLInputElement | null => {
      if (!node) return null;
      if (typeof (node as any).checked !== 'undefined') return node as any;
      const nested = node.querySelector?.('input[type="checkbox"]') as any;
      return nested ?? null;
    };

    const unmet: string[] = [];
    for (const r of reqs) {
      const el = document.querySelector(r.selector) as any;
      if (r.kind === 'exists') {
        if (!el) unmet.push(r.message);
        continue;
      }

      if (!el) {
        unmet.push(r.message);
        continue;
      }

      if (r.kind === 'checkboxChecked') {
        const checkboxEl = resolveCheckboxElement(el);
        const ok = Boolean(checkboxEl?.checked);
        if (!ok) unmet.push(r.message);
        continue;
      }

      const valueEl = resolveValueElement(el);
      const rawValue = String((valueEl as any)?.value ?? '');
      if (r.kind === 'valueEquals') {
        const ok = rawValue === String(r.value);
        if (!ok) unmet.push(r.message);
        continue;
      }

      if (r.kind === 'numberEquals') {
        const n = draftToNumberOrZero(rawValue);
        const tol = Number.isFinite(r.tolerance) ? Number(r.tolerance) : 1e-9;
        const ok = Number.isFinite(n) && Math.abs(n - r.value) <= tol;
        if (!ok) unmet.push(r.message);
        continue;
      }
    }

    return unmet;
  }, [step.requires]);

  const evaluateRequirements = useCallback(() => {
    const reqs = step.requires ?? [];
    if (reqs.length === 0) {
      setRequirementsOk(true);
      setRequirementsHint(null);
      return;
    }

    const unmet = computeUnmetRequirements();
    setRequirementsOk(unmet.length === 0);
    setRequirementsHint(unmet.length === 0 ? null : unmet.join(' '));
  }, [computeUnmetRequirements, step.requires]);

  useLayoutEffect(() => {
    // Reset per-step tracking so auto-advance works even when a field starts already-correct
    // (e.g., a select default matches the requirement).
    // If the user navigated here via Back, suppress the initial auto-advance even if values are already correct.
    lastAutoAdvanceStepRef.current = null;
    autoAdvancePendingForStepRef.current = null;
    hasInteractedSinceStepStartRef.current = false;
    setRequirementsOk(false);
    setRequirementsHint(null);
  }, [enteredViaBack, step.id]);

  // Evaluate requirements immediately when a step mounts/changes, so we don't miss fast user input.
  useLayoutEffect(() => {
    evaluateRequirements();
  }, [evaluateRequirements, step.id]);

  // Auto-advance once action requirements are satisfied.
  useEffect(() => {
    const reqs = step.requires ?? [];
    if (reqs.length === 0) return;
    if (isLast) return;

    const shouldAutoAdvance = step.autoAdvance ?? true;
    if (!shouldAutoAdvance) return;
    // Back navigation should never auto-progress.
    if (enteredViaBack) return;

    // Advance as soon as requirements are satisfied (after user interaction).
    if (requirementsOk !== true) return;

    // Prevent stacking multiple timers while requirements remain satisfied,
    // but do NOT permanently lock the step if the re-check below fails.
    if (autoAdvancePendingForStepRef.current === step.id) return;
    autoAdvancePendingForStepRef.current = step.id;

    let cancelled = false;

    const t = window.setTimeout(() => {
      if (cancelled) return;

      // Timer fired; allow future scheduling if we still can't advance.
      if (autoAdvancePendingForStepRef.current === step.id) {
        autoAdvancePendingForStepRef.current = null;
      }

      const unmet = computeUnmetRequirements();
      setRequirementsOk(unmet.length === 0);
      setRequirementsHint(unmet.length === 0 ? null : unmet.join(' '));
      if (unmet.length !== 0) return;

      // Lock to avoid double-advancing within the same step.
      if (lastAutoAdvanceStepRef.current === step.id) return;
      lastAutoAdvanceStepRef.current = step.id;

      onNext();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (autoAdvancePendingForStepRef.current === step.id) {
        autoAdvancePendingForStepRef.current = null;
      }
    };
  }, [computeUnmetRequirements, enteredViaBack, isLast, onNext, requirementsOk, step.autoAdvance, step.id, step.requires]);

  const measure = useCallback(() => {
    if (!step.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    setRect(el.getBoundingClientRect());
  }, [step.selector]);

  const scrollToTargetIfNeeded = useCallback((): { didScroll: boolean; element: HTMLElement | null } => {
    if (!step.selector) return { didScroll: false, element: null };
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) return { didScroll: false, element: null };

    const r = el.getBoundingClientRect();
    const margin = 80;
    const inView = r.top >= margin && r.bottom <= window.innerHeight - margin;
    if (inView) return { didScroll: false, element: el };

    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch {
      // ignore
    }
    return { didScroll: true, element: el };
  }, [step.selector]);

  // Avoid showing the previous step's tooltip position while we re-measure the next step.
  useEffect(() => {
    positioningTokenRef.current += 1;
    setRect(null);
    setIsPositioning(Boolean(step.selector));
  }, [step.id, step.selector]);

  // Gate tutorial progression on user actions.
  useEffect(() => {
    let cancelled = false;

    const triggerEvaluate = (markInteracted: boolean) => {
      if (cancelled) return;
      if (markInteracted) hasInteractedSinceStepStartRef.current = true;
      evaluateRequirements();
    };
    const onAnyInput = () => triggerEvaluate(true);
    window.addEventListener('input', onAnyInput, true);
    window.addEventListener('change', onAnyInput, true);
    window.addEventListener('click', onAnyInput, true);

    // Poll requirements for auto-advance steps to be resilient to cases where input events
    // aren't reliably captured (e.g. browser date widgets, number spinners, focus quirks).
    const reqs = step.requires ?? [];
    const shouldAutoAdvance = (step.autoAdvance ?? true) && reqs.length > 0 && !isLast && !enteredViaBack;
    const poll = shouldAutoAdvance ? window.setInterval(() => triggerEvaluate(false), 200) : null;

    return () => {
      cancelled = true;
      window.removeEventListener('input', onAnyInput, true);
      window.removeEventListener('change', onAnyInput, true);
      window.removeEventListener('click', onAnyInput, true);
      if (poll) window.clearInterval(poll);
    };
  }, [enteredViaBack, evaluateRequirements, isLast, step.autoAdvance, step.id, step.requires]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;
    let raf: number | null = null;
    let observer: MutationObserver | null = null;

    const token = positioningTokenRef.current;

    const doMeasure = () => {
      if (cancelled) return;
      measure();
    };

    const scheduleMeasure = () => {
      if (cancelled) return;
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        doMeasure();
        evaluateRequirements();
      });
    };

    const tryFindAndScroll = () => {
      if (cancelled) return;
      if (!step.selector) {
        setRect(null);
        setIsPositioning(false);
        return;
      }
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }

      const { didScroll } = scrollToTargetIfNeeded() ?? { didScroll: false };
      if (!didScroll) {
        doMeasure();
        if (!cancelled && token === positioningTokenRef.current) setIsPositioning(false);
        return;
      }

      // If we scrolled, keep the tooltip hidden until the target is in view or a short timeout.
      const startedAt = Date.now();
      const margin = 80;
      const tickScroll = () => {
        if (cancelled) return;
        if (token !== positioningTokenRef.current) return;
        doMeasure();
        const r = el.getBoundingClientRect();
        const inView = r.top >= margin && r.bottom <= window.innerHeight - margin;
        if (inView || Date.now() - startedAt > 900) {
          setIsPositioning(false);
          return;
        }
        pollTimer = window.setTimeout(tickScroll, 50);
      };
      pollTimer = window.setTimeout(tickScroll, 80);
    };

    // Optional delay for dynamic UI. Prefer polling over large delays to avoid visible "jump".
    const delay = step.waitFor && step.waitFor > 0 ? step.waitFor : 0;
    const startDelay = window.setTimeout(() => {
      if (cancelled) return;

      // Poll briefly so steps that depend on newly-rendered elements don't jump to center.
      const startedAt = Date.now();
      const tick = () => {
        if (cancelled) return;
        const el = step.selector ? (document.querySelector(step.selector) as HTMLElement | null) : null;
        if (el) {
          tryFindAndScroll();
          return;
        }
        if (Date.now() - startedAt > 6000) {
          doMeasure();
          if (!cancelled && token === positioningTokenRef.current) setIsPositioning(false);
          return;
        }
        pollTimer = window.setTimeout(tick, 120);
      };
      tick();
    }, delay);

    window.addEventListener('resize', doMeasure);
    window.addEventListener('scroll', doMeasure, true);

    // Keep the coachmark aligned when the UI updates (results render, accordions expand, etc.).
    // Throttle to animation frames to avoid excessive layouts.
    try {
      if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(() => scheduleMeasure());
        observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      }
    } catch {
      // ignore
    }

    return () => {
      cancelled = true;
      if (startDelay) window.clearTimeout(startDelay);
      if (pollTimer) window.clearTimeout(pollTimer);
      if (raf !== null) window.cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', doMeasure);
      window.removeEventListener('scroll', doMeasure, true);
    };
  }, [evaluateRequirements, measure, scrollToTargetIfNeeded, step.selector, step.waitFor]);

  // Measure tooltip size so we can clamp it inside the viewport.
  useEffect(() => {
    const measureTooltip = () => {
      const el = tooltipRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const next = { width: Math.round(r.width), height: Math.round(r.height) };
      setTooltipSize((prev) => {
        if (prev && prev.width === next.width && prev.height === next.height) return prev;
        return next;
      });
    };

    // Next tick ensures DOM has painted with current content.
    const t = window.setTimeout(measureTooltip, 0);
    window.addEventListener('resize', measureTooltip);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measureTooltip);
    };
  }, [step.id, step.title, step.body]);

  const tooltipBase: React.CSSProperties = {
    position: 'fixed', zIndex: 999999, maxWidth: 320,
    background: '#111', color: '#fff', border: '1px solid #333',
    borderRadius: 12, padding: '12px 14px', boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
    transition: 'top 120ms ease, left 120ms ease, opacity 120ms ease',
  };

  const tooltipStyle: React.CSSProperties = (() => {
    if (!rect) {
      return {
        ...tooltipBase,
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        // If we don't have a target yet (e.g., conditional fields that appear after a selection),
        // keep the tutorial visible rather than disappearing while we poll for the element.
        opacity: 1,
        pointerEvents: 'auto',
      };
    }
    const gap = 10;
    const size = tooltipSize ?? { width: 340, height: 190 };
    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
    const pad = 12;

    let top = rect.top;
    let left = rect.left;
    switch (step.placement) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left;
        break;
      case 'left':
        top = rect.top;
        left = rect.left - size.width - gap;
        break;
      case 'right':
        top = rect.top;
        left = rect.right + gap;
        break;
      case 'top':
      default:
        top = rect.top - size.height - gap;
        left = rect.left;
        break;
    }

    const maxLeft = Math.max(pad, window.innerWidth - size.width - pad);
    const maxTop = Math.max(pad, window.innerHeight - size.height - pad);
    return { ...tooltipBase, top: clamp(top, pad, maxTop), left: clamp(left, pad, maxLeft), opacity: isPositioning ? 0 : 1, pointerEvents: isPositioning ? 'none' : 'auto' };
  })();

  const spotlightStyle: React.CSSProperties = rect
    ? { position: 'fixed', top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: 8, border: '2px solid #6ea8fe', boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)', pointerEvents: 'none', zIndex: 999998 }
    : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 999998, pointerEvents: 'none' };

  const shouldAutoAdvance = !enteredViaBack && (step.autoAdvance ?? true) && (step.requires?.length ?? 0) > 0 && !isLast;
  const showNextButton = !shouldAutoAdvance;

  return (
    <>
      <div style={spotlightStyle} />
      <div ref={tooltipRef} style={tooltipStyle} role="dialog" aria-live="polite">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 14, opacity: 0.95, lineHeight: 1.35 }}>{step.body}</div>
        {requirementsHint && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>To continue:</div>
            <div>{requirementsHint}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onExit} style={btn('ghost')}>Exit</button>
          <button type="button" onClick={onBack} disabled={isFirst} style={btn(isFirst ? 'disabled' : 'ghost')}>Back</button>
          {showNextButton && (
            <button
              type="button"
              onClick={onNext}
              disabled={!isLast && !requirementsOk}
              style={btn((!isLast && !requirementsOk) ? 'disabled' : 'primary')}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          )}
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
  const { currentAssumptions } = useAssumptions();
  const { executionDefaults, updateExecutionDefaults } = useExecutionDefaults();
  const initialDefaults = useMemo(() => createDefaultSimulationRequest(), []);
  const isTutorial = Boolean(tutorialSteps && tutorialSteps.length > 0);

  const [startDate, setStartDate] = useState(initialDefaults.startDate.date);
  const [overallTaxRule, setOverallTaxRule] = useState<OverallTaxRule>(initialDefaults.overallTaxRule);
  const [taxPercentage, setTaxPercentage] = useState<string>(() => String(initialDefaults.taxPercentage ?? 0));
  const [phases, setPhases] = useState<PhaseRequest[]>(() => (isTutorial ? [] : initialDefaults.phases));

  // Hard-coded advanced defaults (independent of localStorage).
  // Templates reset advanced values back to these defaults (unless the template overrides).
  const hardDefaultAdvancedUi = useMemo(() => {
    return {
      enabled: false,
      // Execution params (defaults align with backend defaults; backend will clamp/validate anyway).
      paths: String(executionDefaults.paths),
      batchSize: String(executionDefaults.batchSize),
      inflationAveragePct: String(currentAssumptions.inflationPct),
      yearlyFeePercentage: String(currentAssumptions.yearlyFeePct),

      // Returner
      returnType: DEFAULT_RETURN_TYPE as ReturnType,
      seedMode: executionDefaults.seedMode as MasterSeedMode,
      seed: String(DEFAULT_MASTER_SEED),
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
      exemptionCardLimit: String(currentAssumptions.taxExemptionDefaults.exemptionCardLimit),
      exemptionCardYearlyIncrease: String(currentAssumptions.taxExemptionDefaults.exemptionCardYearlyIncrease),
      stockExemptionTaxRate: String(currentAssumptions.taxExemptionDefaults.stockExemptionTaxRate),
      stockExemptionLimit: String(currentAssumptions.taxExemptionDefaults.stockExemptionLimit),
      stockExemptionYearlyIncrease: String(currentAssumptions.taxExemptionDefaults.stockExemptionYearlyIncrease),
    };
  }, [
    executionDefaults.batchSize,
    executionDefaults.paths,
    executionDefaults.seedMode,
    currentAssumptions.inflationPct,
    currentAssumptions.yearlyFeePct,
    currentAssumptions.taxExemptionDefaults.exemptionCardLimit,
    currentAssumptions.taxExemptionDefaults.exemptionCardYearlyIncrease,
    currentAssumptions.taxExemptionDefaults.stockExemptionTaxRate,
    currentAssumptions.taxExemptionDefaults.stockExemptionLimit,
    currentAssumptions.taxExemptionDefaults.stockExemptionYearlyIncrease,
  ]);

  const initialAdvancedState = useMemo<{
    enabled: boolean;
    paths: string;
    batchSize: string;
    inflationAveragePct: string;
    yearlyFeePercentage: string;
    returnType: ReturnType;
    seedMode: MasterSeedMode;
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
    const fallbackDefaults = hardDefaultAdvancedUi;

    try {
      const raw = window.localStorage.getItem(ADVANCED_OPTIONS_KEY);
      if (!raw) {
        return fallbackDefaults;
      }
      const parsed = JSON.parse(raw);
      const enabled = Boolean(parsed?.enabled);
      const paths = fallbackDefaults.paths;
      const batchSize = fallbackDefaults.batchSize;
      // Inflation + fee are global assumptions; do not rehydrate them from advanced-options storage.
      const inflationAveragePct = String(fallbackDefaults.inflationAveragePct);
      const yearlyFeePercentage = String(fallbackDefaults.yearlyFeePercentage);
      const returnType = parseReturnType(parsed?.returnType);
      const distributionType = parseDistributionType(parsed?.distributionType);
      const seedRaw = parsed?.seed ?? fallbackDefaults.seed;
      const seedMode: MasterSeedMode = (() => {
        const n = Number(seedRaw);
        if (Number.isFinite(n) && n < 0) return 'random';
        // If the stored seed differs from the default seed, assume custom mode.
        if (String(seedRaw) !== String(fallbackDefaults.seed)) return 'custom';
        return fallbackDefaults.seedMode;
      })();

      const seed = seedMode === 'random' ? String(fallbackDefaults.seed) : String(seedRaw);
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
        paths: String(paths),
        batchSize: String(batchSize),
        inflationAveragePct,
        yearlyFeePercentage,
        returnType,
        distributionType,
        seedMode,
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
  }, [hardDefaultAdvancedUi]);

  const [advancedEnabled, setAdvancedEnabled] = useState<boolean>(initialAdvancedState.enabled);
  const [paths, setPaths] = useState<string>(String(initialAdvancedState.paths));
  const [batchSize, setBatchSize] = useState<string>(String(initialAdvancedState.batchSize));
  const [inflationAveragePct, setInflationAveragePct] = useState<string>(String(initialAdvancedState.inflationAveragePct));
  const [yearlyFeePercentage, setYearlyFeePercentage] = useState<string>(String(initialAdvancedState.yearlyFeePercentage));

  // Inflation + fee are global assumptions. Keep UI in sync with the authority.
  useEffect(() => {
    const next = String(currentAssumptions.inflationPct);
    setInflationAveragePct((prev) => (prev === next ? prev : next));
  }, [currentAssumptions.inflationPct]);

  useEffect(() => {
    const next = String(currentAssumptions.yearlyFeePct);
    setYearlyFeePercentage((prev) => (prev === next ? prev : next));
  }, [currentAssumptions.yearlyFeePct]);

  const [exemptionCardLimit, setExemptionCardLimit] = useState<string>(String(initialAdvancedState.exemptionCardLimit));
  const [exemptionCardYearlyIncrease, setExemptionCardYearlyIncrease] = useState<string>(String(initialAdvancedState.exemptionCardYearlyIncrease));
  const [stockExemptionTaxRate, setStockExemptionTaxRate] = useState<string>(String(initialAdvancedState.stockExemptionTaxRate));
  const [stockExemptionLimit, setStockExemptionLimit] = useState<string>(String(initialAdvancedState.stockExemptionLimit));
  const [stockExemptionYearlyIncrease, setStockExemptionYearlyIncrease] = useState<string>(String(initialAdvancedState.stockExemptionYearlyIncrease));

  const [returnType, setReturnType] = useState<ReturnType>(initialAdvancedState.returnType);
  const [seedMode, setSeedMode] = useState<MasterSeedMode>(initialAdvancedState.seedMode ?? 'default');
  const [seed, setSeed] = useState<string>(String(initialAdvancedState.seed ?? DEFAULT_MASTER_SEED));
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

  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplatePickerId>(() => (isTutorial ? TUTORIAL_TEMPLATE_ID : 'starter'));

  type TemplateDiff = {
    templateId: SimulationTemplateId;
    templateLabel: string;
    normal: Array<{ field: string; touched: boolean; changed: boolean; from: string; to: string }>;
    advanced: Array<{ field: string; touched: boolean; changed: boolean; from: string; to: string }>;
  };

  const [templatePickerId, setTemplatePickerId] = useState<TemplatePickerId>(selectedTemplateId);
  const [pendingTemplateId, setPendingTemplateId] = useState<TemplatePickerId | null>(null);

  const [isTemplateDiffOpen, setIsTemplateDiffOpen] = useState(false);
  const [templateDiffTitle, setTemplateDiffTitle] = useState<'Template preview' | 'What changed?'>('What changed?');
  const [templateDiffMode, setTemplateDiffMode] = useState<'preview' | 'whatChanged'>('whatChanged');
  const [templateModalDiff, setTemplateModalDiff] = useState<TemplateDiff | null>(null);
  const [lastTemplateDiff, setLastTemplateDiff] = useState<TemplateDiff | null>(null);
  type AdvancedUiSnapshot = {
    paths: string;
    batchSize: string;
    inflationAveragePct: string;
    yearlyFeePercentage: string;
    returnType: ReturnType;
    seedMode: MasterSeedMode;
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
    regimes: typeof regimes;
    exemptionCardLimit: string;
    exemptionCardYearlyIncrease: string;
    stockExemptionTaxRate: string;
    stockExemptionLimit: string;
    stockExemptionYearlyIncrease: string;
  };

  const currentAdvancedUi = useMemo<AdvancedUiSnapshot>(() => ({
    paths,
    batchSize,
    inflationAveragePct,
    yearlyFeePercentage,
    returnType,
    seedMode,
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
  }), [
    batchSize,
    brownianDrift,
    brownianVolatility,
    distributionType,
    exemptionCardLimit,
    exemptionCardYearlyIncrease,
    inflationAveragePct,
    normalMean,
    normalStdDev,
    paths,
    regimeTickMonths,
    regimes,
    returnType,
    seed,
    seedMode,
    simpleAveragePercentage,
    stockExemptionLimit,
    stockExemptionTaxRate,
    stockExemptionYearlyIncrease,
    yearlyFeePercentage,
  ]);

  const [baselineAdvancedUi, setBaselineAdvancedUi] = useState<AdvancedUiSnapshot>(() => ({
    paths: String(initialAdvancedState.paths),
    batchSize: String(initialAdvancedState.batchSize),
    inflationAveragePct: initialAdvancedState.inflationAveragePct,
    yearlyFeePercentage: initialAdvancedState.yearlyFeePercentage,
    returnType: initialAdvancedState.returnType,
    seedMode: initialAdvancedState.seedMode ?? 'default',
    seed: String(initialAdvancedState.seed ?? DEFAULT_MASTER_SEED),
    simpleAveragePercentage: String(initialAdvancedState.simpleAveragePercentage ?? ''),
    distributionType: initialAdvancedState.distributionType,
    normalMean: String(initialAdvancedState.normalMean ?? ''),
    normalStdDev: String(initialAdvancedState.normalStdDev ?? ''),
    brownianDrift: String(initialAdvancedState.brownianDrift ?? ''),
    brownianVolatility: String(initialAdvancedState.brownianVolatility ?? ''),
    studentMu: String(initialAdvancedState.studentMu ?? ''),
    studentSigma: String(initialAdvancedState.studentSigma ?? ''),
    studentNu: String(initialAdvancedState.studentNu ?? ''),
    regimeTickMonths: String(initialAdvancedState.regimeTickMonths ?? ''),
    regimes: initialAdvancedState.regimes,
    exemptionCardLimit: String(initialAdvancedState.exemptionCardLimit),
    exemptionCardYearlyIncrease: String(initialAdvancedState.exemptionCardYearlyIncrease),
    stockExemptionTaxRate: String(initialAdvancedState.stockExemptionTaxRate),
    stockExemptionLimit: String(initialAdvancedState.stockExemptionLimit),
    stockExemptionYearlyIncrease: String(initialAdvancedState.stockExemptionYearlyIncrease),
  }));

  const [baselineRequest, setBaselineRequest] = useState<SimulationRequest>(() => {
    const seedNum = seedForMode(initialAdvancedState.seedMode ?? 'default', toNumOrUndef(initialAdvancedState.seed));
    return {
      ...initialDefaults,
      startDate: { date: initialDefaults.startDate.date },
      phases: initialDefaults.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
      seed: seedNum,
    };
  });

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => listSavedScenarios());
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [compareScenarioId, setCompareScenarioId] = useState<string>('');
  const [showScenarioCompare, setShowScenarioCompare] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [didCopyShareUrl, setDidCopyShareUrl] = useState(false);
  const [simulateInProgress, setSimulateInProgress] = useState(false);
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const simulationIdRef = useRef<string | null>(null);
  const [lastCompletedRun, setLastCompletedRun] = useState<{ id: string; advancedRequest: AdvancedSimulationRequest } | null>(null);
  const lastStartedRunMetaRef = useRef<StartRunResponse | null>(null);
  const lastRunRequestRef = useRef<AdvancedSimulationRequest | null>(null);
  const lastRunWasNormalRef = useRef<boolean>(false);

  const advancedMode = mode === 'advanced';

  const effectiveAdvancedFeatureFlags = useMemo<AdvancedFeatureFlags>(
    () => advancedFeatureFlags ?? { execution: true, inflation: true, exemptions: true, returnModel: true, fee: true },
    [advancedFeatureFlags]
  );

  const executionFeatureOn = effectiveAdvancedFeatureFlags.execution;
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

  const scenarioAutoLoadOnLoad = useMemo(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('scenarioAuto');
      return v === '1' || v === 'true';
    } catch {
      return false;
    }
  }, []);

  const clearScenarioFromUrl = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('scenario');
      url.searchParams.delete('scenarioAuto');
      // Keep any other params intact.
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash;
      window.history.replaceState({}, '', next);
    } catch {
      // ignore
    }
  }, []);

  const didRestoreDraftRef = useRef(false);
  useEffect(() => {
    if (didRestoreDraftRef.current) return;
    if (isTutorial) return;
    if (scenarioParamOnLoad) return;

    try {
      const raw = window.localStorage.getItem(NORMAL_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return;

      const tpl = String(parsed.selectedTemplateId ?? 'starter') as SimulationTemplateId;
      if (tpl) setSelectedTemplateId(tpl);

      if (typeof parsed.startDate === 'string') setStartDate(parsed.startDate);
      if (parsed.overallTaxRule === 'CAPITAL' || parsed.overallTaxRule === 'NOTIONAL') setOverallTaxRule(parsed.overallTaxRule);
      if (typeof parsed.taxPercentage === 'number') setTaxPercentage(String(parsed.taxPercentage));
      if (typeof parsed.taxPercentage === 'string') setTaxPercentage(parsed.taxPercentage);
      if (Array.isArray(parsed.phases)) {
        setPhases(parsed.phases.map((p: any) => ({ ...p, taxRules: p?.taxRules ?? [] })));
      }

      if (parsed.baselineRequest && typeof parsed.baselineRequest === 'object') {
        const br = parsed.baselineRequest as SimulationRequest;
        if (br?.startDate?.date && Array.isArray(br?.phases)) {
          setBaselineRequest({
            ...br,
            startDate: { date: String(br.startDate.date) },
            phases: br.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
          });
        }
      }

      if (parsed.baselineAdvancedUi && typeof parsed.baselineAdvancedUi === 'object') {
        setBaselineAdvancedUi(parsed.baselineAdvancedUi as any);
      }

      hasUserEditedRef.current = false;
      didRestoreDraftRef.current = true;
    } catch {
      // ignore
    }
  }, [scenarioParamOnLoad]);

  useEffect(() => {
    if (isTutorial) return;
    if (scenarioParamOnLoad) return;
    try {
      window.localStorage.setItem(
        NORMAL_DRAFT_KEY,
        JSON.stringify({
          version: 1,
          selectedTemplateId,
          startDate,
          overallTaxRule,
          taxPercentage,
          phases,
          baselineRequest,
          baselineAdvancedUi,
        })
      );
    } catch {
      // ignore
    }
  }, [
    baselineAdvancedUi,
    baselineRequest,
    overallTaxRule,
    phases,
    scenarioParamOnLoad,
    selectedTemplateId,
    startDate,
    taxPercentage,
  ]);

  // Tutorial should always start with a predictable blank phase list.
  const didTutorialInitRef = useRef(false);
  useEffect(() => {
    if (!isTutorial) return;
    if (didTutorialInitRef.current) return;
    didTutorialInitRef.current = true;

    // Always start from the tutorial template (and keep the <select> value valid).
    setSelectedTemplateId(TUTORIAL_TEMPLATE_ID);
    setTemplatePickerId(TUTORIAL_TEMPLATE_ID);

    hasUserEditedRef.current = false;

    // Tutorial start state:
    // - Normal tutorial: keep normal-mode fields "wrong" so the user must fill them.
    // - Advanced tutorial: keep normal-mode fields pre-made like the Aktiedepot template,
    //   so the tutorial can focus only on advanced-only controls.
    if (advancedMode) {
      const aktiedepot = resolveTemplateToRequest(getTemplateById('aktiedepot'));
      setStartDate(aktiedepot.startDate.date);
      setOverallTaxRule(aktiedepot.overallTaxRule);
      setTaxPercentage(String(aktiedepot.taxPercentage ?? 0));
      setPhases(aktiedepot.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })));
    } else {
      // Start from a clean slate: numeric fields to 0.
      // For selects, intentionally pick a *wrong* but valid option so the user must take action.
      setStartDate('');
      setOverallTaxRule('NOTIONAL');
      setTaxPercentage('');
      setPhases([]);
    }

    // Advanced-only fields: reset to wrong values so the tutorial can teach them explicitly.
    // Exception: paths + batch should remain at their normal default in the advanced tutorial.
    setPaths(advancedMode ? String(hardDefaultAdvancedUi.paths) : '0');
    setBatchSize(advancedMode ? String(hardDefaultAdvancedUi.batchSize) : '0');
    setInflationAveragePct('0');
    setYearlyFeePercentage('0');

    setExemptionCardLimit('0');
    setExemptionCardYearlyIncrease('0');
    setStockExemptionTaxRate('0');
    setStockExemptionLimit('0');
    setStockExemptionYearlyIncrease('0');

    // Advanced-only selects: set to a "wrong" option so advanced tutorial steps require action.
    setSeedMode('default');
    setSeed(String(DEFAULT_MASTER_SEED));
    setReturnType('simpleReturn');
    setSimpleAveragePercentage('0');
    setDistributionType('normal');
    setNormalMean('');
    setNormalStdDev('');
    setBrownianDrift('');
    setBrownianVolatility('');
    setStudentMu('');
    setStudentSigma('');
    setStudentNu('');
    setRegimeTickMonths('');
  }, [advancedMode, hardDefaultAdvancedUi.batchSize, hardDefaultAdvancedUi.paths, isTutorial]);

  const [userEditTick, setUserEditTick] = useState(0);
  const hasUserEditedRef = useRef(false);
  const markUserEdited = useCallback(() => {
    hasUserEditedRef.current = true;
    setUserEditTick((t) => t + 1);
  }, []);

  const handleAddPhase = (phase: PhaseRequest) => {
    markUserEdited();
    setPhases(prev => [...prev, { ...phase, taxRules: phase.taxRules || [] }]);
  };
  const handlePhaseChange = (index: number, field: keyof PhaseRequest, value: number | string | undefined) => {
    markUserEdited();
    setPhases(phs => phs.map((p, i) => (i === index ? { ...p, [field]: value as any } : p)));
  };
  const handlePhaseReplace = (index: number, phase: PhaseRequest) => {
    markUserEdited();
    setPhases(phs => phs.map((p, i) => (i === index ? { ...phase, taxRules: phase.taxRules ?? [] } : p)));
  };
  const handlePhaseRemove = (index: number) => {
    markUserEdited();
    setPhases(phs => phs.filter((_, i) => i !== index));
  };
  const handlePhaseToggleRule = (index: number, rule: NonNullable<PhaseRequest['taxRules']>[number]) => {
    markUserEdited();
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

  const totalMonths = phases.reduce((s, p) => s + (Number(p.durationInMonths) || 0), 0);
  const overLimit = totalMonths > MAX_MONTHS;

  const materializePhasesForRequest = useCallback((rawPhases: PhaseRequest[]): PhaseRequest[] => {
    const asDraft = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
    return rawPhases.map((p) => {
      return {
        ...p,
        taxRules: p.taxRules ?? [],
        durationInMonths: Math.trunc(Number(p.durationInMonths) || 0),

        initialDeposit: draftToIntOrZero(asDraft((p as any).initialDeposit)),
        monthlyDeposit: draftToIntOrZero(asDraft((p as any).monthlyDeposit)),
        withdrawAmount: draftToIntOrZero(asDraft((p as any).withdrawAmount)),

        yearlyIncreaseInPercentage: draftToNumberOrZero(asDraft((p as any).yearlyIncreaseInPercentage)),
        withdrawRate: draftToNumberOrZero(asDraft((p as any).withdrawRate)),
        lowerVariationPercentage: draftToNumberOrZero(asDraft((p as any).lowerVariationPercentage)),
        upperVariationPercentage: draftToNumberOrZero(asDraft((p as any).upperVariationPercentage)),
      };
    });
  }, []);

  const currentRequest = useMemo<SimulationRequest>(() => {
    const seedNum = seedForMode(seedMode, toNumOrUndef(seed));
    return {
      startDate: { date: startDate },
      overallTaxRule,
      taxPercentage: draftToNumberOrZero(taxPercentage),
      phases: materializePhasesForRequest(phases),
      seed: seedNum,
    };
  }, [materializePhasesForRequest, startDate, overallTaxRule, taxPercentage, phases, seed, seedMode]);

  const currentAdvancedRequest = useMemo<AdvancedSimulationRequest>(() => {
    const seedNum = seedForMode(seedMode, toNumOrUndef(seed));
    const isAdvancedRun = advancedEnabled;

    const assumptionsTaxExemptionConfig: AdvancedSimulationRequest['taxExemptionConfig'] = {
      exemptionCard: {
        limit: Number(currentAssumptions.taxExemptionDefaults.exemptionCardLimit) || 0,
        yearlyIncrease: Number(currentAssumptions.taxExemptionDefaults.exemptionCardYearlyIncrease) || 0,
      },
      stockExemption: {
        taxRate: Number(currentAssumptions.taxExemptionDefaults.stockExemptionTaxRate) || 0,
        limit: Number(currentAssumptions.taxExemptionDefaults.stockExemptionLimit) || 0,
        yearlyIncrease: Number(currentAssumptions.taxExemptionDefaults.stockExemptionYearlyIncrease) || 0,
      },
    };

    // Base request (always present)
    const base: AdvancedSimulationRequest = {
      startDate: { date: startDate },
      phases: materializePhasesForRequest(phases),
      overallTaxRule: mapOverallTaxRuleForAdvanced(overallTaxRule),
      taxPercentage: draftToNumberOrZero(taxPercentage),
      seed: seedNum,
    };

    const clampExec = (v: number | undefined): number | undefined => {
      if (v === undefined) return undefined;
      if (!Number.isFinite(v)) return undefined;
      return Math.max(1, Math.min(100_000, Math.floor(v)));
    };

    // Execution params should affect runs even when the UI section is hidden.
    // Backend will clamp/validate and also defaults when missing.
    const pathsToSend = isAdvancedRun && executionFeatureOn ? clampExec(draftToIntOrZero(paths)) : undefined;
    const batchSizeToSend = isAdvancedRun && executionFeatureOn ? clampExec(draftToIntOrZero(batchSize)) : undefined;
    // Inflation + fee are global assumptions and should apply to both normal and advanced runs.
    // (Normal runs still go through the unified advanced endpoint.)
    const inflationFactorToSend = inflationFeatureOn
      ? 1 + (Number(currentAssumptions.inflationPct) || 0) / 100
      : undefined;
    const yearlyFeePercentageToSend = feeFeatureOn
      ? (Number(currentAssumptions.yearlyFeePct) || 0)
      : undefined;

    const anyTaxRulesEnabled = base.phases.some((p) => Array.isArray(p.taxRules) && p.taxRules.length > 0);
    const taxExemptionConfig: AdvancedSimulationRequest['taxExemptionConfig'] | undefined = anyTaxRulesEnabled
      ? (isAdvancedRun && exemptionsFeatureOn
          ? {
              exemptionCard: {
                limit: draftToIntOrZero(exemptionCardLimit),
                yearlyIncrease: draftToIntOrZero(exemptionCardYearlyIncrease),
              },
              stockExemption: {
                taxRate: draftToNumberOrZero(stockExemptionTaxRate),
                limit: draftToIntOrZero(stockExemptionLimit),
                yearlyIncrease: draftToIntOrZero(stockExemptionYearlyIncrease),
              },
            }
          : assumptionsTaxExemptionConfig)
      : undefined;

    // In normal mode, ignore any persisted advanced return-model settings.
    const returnTypeToSend: ReturnType = isAdvancedRun && returnModelFeatureOn ? returnType : 'dataDrivenReturn';

    const rc: AdvancedSimulationRequest['returnerConfig'] = { seed: seedNum };
    if (isAdvancedRun && returnModelFeatureOn && returnType === 'simpleReturn') {
      rc.simpleAveragePercentage = draftToNumberOrZero(simpleAveragePercentage);
    }

    if (isAdvancedRun && returnModelFeatureOn && returnType === 'distributionReturn') {
      rc.distribution = { type: distributionType };
      if (distributionType === 'normal') {
        rc.distribution.normal = {
          mean: draftToNumberOrZero(normalMean),
          standardDeviation: draftToNumberOrZero(normalStdDev),
        };
      } else if (distributionType === 'brownianMotion') {
        rc.distribution.brownianMotion = {
          drift: draftToNumberOrZero(brownianDrift),
          volatility: draftToNumberOrZero(brownianVolatility),
        };
      } else if (distributionType === 'studentT') {
        rc.distribution.studentT = {
          mu: draftToNumberOrZero(studentMu),
          sigma: draftToNumberOrZero(studentSigma),
          nu: draftToNumberOrZero(studentNu),
        };
      } else if (distributionType === 'regimeBased') {
        rc.distribution.regimeBased = {
          tickMonths: draftToIntOrZero(regimeTickMonths),
          regimes: regimes.map((r) => ({
            distributionType: r.distributionType,
            expectedDurationMonths: draftToIntOrZero(r.expectedDurationMonths),
            switchWeights: {
              toRegime0: draftToNumberOrZero(r.toRegime0),
              toRegime1: draftToNumberOrZero(r.toRegime1),
              toRegime2: draftToNumberOrZero(r.toRegime2),
            },
            ...(r.distributionType === 'studentT'
              ? {
                  studentT: {
                    mu: draftToNumberOrZero(r.studentMu),
                    sigma: draftToNumberOrZero(r.studentSigma),
                    nu: draftToNumberOrZero(r.studentNu),
                  },
                }
              : {
                  normal: {
                    mean: draftToNumberOrZero(r.normalMean),
                    standardDeviation: draftToNumberOrZero(r.normalStdDev),
                  },
                }),
          })),
        };
      }
    }

    const hasReturnerConfig =
      isAdvancedRun && returnModelFeatureOn &&
      (rc.simpleAveragePercentage !== undefined || rc.distribution?.type !== undefined || rc.seed !== undefined);

    return {
      ...base,
      ...(pathsToSend !== undefined ? { paths: pathsToSend } : {}),
      ...(batchSizeToSend !== undefined ? { batchSize: batchSizeToSend } : {}),
      ...(inflationFactorToSend !== undefined ? { inflationFactor: inflationFactorToSend } : {}),
      ...(yearlyFeePercentageToSend !== undefined ? { yearlyFeePercentage: yearlyFeePercentageToSend } : {}),
      returnType: returnTypeToSend,
      ...(taxExemptionConfig ? { taxExemptionConfig } : {}),
      ...(hasReturnerConfig ? { returnerConfig: rc } : {}),
    };
  }, [
    advancedEnabled,
    batchSize,
    brownianDrift,
    brownianVolatility,
    distributionType,
    exemptionCardLimit,
    exemptionCardYearlyIncrease,
    executionFeatureOn,
    exemptionsFeatureOn,
    feeFeatureOn,
    inflationFeatureOn,
    currentAssumptions.inflationPct,
    currentAssumptions.yearlyFeePct,
    normalMean,
    normalStdDev,
    overallTaxRule,
    paths,
    phases,
    regimeTickMonths,
    regimes,
    returnModelFeatureOn,
    returnType,
    seed,
    seedMode,
    simpleAveragePercentage,
    startDate,
    stockExemptionLimit,
    stockExemptionTaxRate,
    stockExemptionYearlyIncrease,
    studentMu,
    studentNu,
    studentSigma,
    taxPercentage,
    yearlyFeePercentage,
    currentRequest,
  ]);

  const isDirtyNormal = useMemo(() => !deepEqual(currentRequest, baselineRequest), [currentRequest, baselineRequest]);
  const isDirtyAdvanced = useMemo(() => !deepEqual(currentAdvancedUi, baselineAdvancedUi), [currentAdvancedUi, baselineAdvancedUi]);
  const isDirty = useMemo(() => isDirtyNormal || isDirtyAdvanced, [isDirtyAdvanced, isDirtyNormal]);

  const applyRequestToForm = useCallback((req: SimulationRequest) => {
    hasUserEditedRef.current = false;
    setStartDate(req.startDate.date);
    setOverallTaxRule(req.overallTaxRule);
    setTaxPercentage(String(req.taxPercentage ?? 0));
    setPhases(req.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })));
    let nextSeedMode: MasterSeedMode = 'default';
    let nextSeed = '1';

    if (req.seed !== undefined && req.seed !== null) {
      const n = Number(req.seed);
      if (Number.isFinite(n) && n < 0) {
        nextSeedMode = 'random';
        nextSeed = '1';
      } else if (Number.isFinite(n) && Math.trunc(n) === 1) {
        nextSeedMode = 'default';
        nextSeed = '1';
      } else if (Number.isFinite(n)) {
        nextSeedMode = 'custom';
        nextSeed = String(Math.trunc(n));
      } else {
        nextSeedMode = 'default';
        nextSeed = '1';
      }
    } else {
      nextSeedMode = 'default';
      nextSeed = '1';
    }

    setSeedMode(nextSeedMode);
    setSeed(nextSeed);
    setBaselineRequest({
      ...req,
      startDate: { date: req.startDate.date },
      phases: req.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
    });
    setBaselineAdvancedUi((prev) => ({ ...prev, seedMode: nextSeedMode, seed: nextSeed }));
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

    if (externalLoadAdvanced.paths !== undefined) {
      const p = String(externalLoadAdvanced.paths);
      if (p !== '') setPaths(p);
    }
    if (externalLoadAdvanced.batchSize !== undefined) {
      const b = String(externalLoadAdvanced.batchSize);
      if (b !== '') setBatchSize(b);
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

    const rc = externalLoadAdvanced.returnerConfig;

    const rawSeed = rc?.seed ?? externalLoadAdvanced.seed;
    const explicitMode = externalLoadAdvanced.seedMode;
    const inferredMode: MasterSeedMode =
      explicitMode === 'default' || explicitMode === 'custom' || explicitMode === 'random'
        ? explicitMode
        : (() => {
            const n = Number(rawSeed);
            if (Number.isFinite(n) && n < 0) return 'random';
            if (Number.isFinite(n) && Math.trunc(n) === 1) return 'default';
            if (Number.isFinite(n)) return 'custom';
            return 'default';
          })();

    setSeedMode(inferredMode);
    if (inferredMode === 'custom') {
      if (rawSeed !== undefined) setSeed(String(rawSeed));
    } else {
      // Preserve a positive seed so Custom can be re-enabled without losing state.
      if (rawSeed !== undefined && Number(rawSeed) > 0) setSeed(String(rawSeed));
    }
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
    setPaths,
    setBatchSize,
    setExemptionCardLimit,
    setExemptionCardYearlyIncrease,
    setStockExemptionTaxRate,
    setStockExemptionLimit,
    setStockExemptionYearlyIncrease,
    setReturnType,
    setSeedMode,
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
    if (isTutorial) return;
    try {
      window.localStorage.setItem(
        ADVANCED_OPTIONS_KEY,
        JSON.stringify({
          enabled: advancedEnabled,
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

  // Baseline advanced defaults (used when applying templates).
  // Applying a template should reset *all* advanced values to the template defaults,
  // not keep whatever advanced values the user previously experimented with.
  const templateBaselineExecutionDefaults = useMemo(() => getDefaultExecutionDefaults(), []);

  const defaultAdvancedUi = useMemo<AdvancedUiSnapshot>(() => ({
    paths: String(templateBaselineExecutionDefaults.paths),
    batchSize: String(templateBaselineExecutionDefaults.batchSize),
    inflationAveragePct: hardDefaultAdvancedUi.inflationAveragePct,
    yearlyFeePercentage: hardDefaultAdvancedUi.yearlyFeePercentage,
    returnType: hardDefaultAdvancedUi.returnType,
    seedMode: templateBaselineExecutionDefaults.seedMode,
    seed: String(hardDefaultAdvancedUi.seed),
    simpleAveragePercentage: String(hardDefaultAdvancedUi.simpleAveragePercentage),
    distributionType: hardDefaultAdvancedUi.distributionType,
    normalMean: String(hardDefaultAdvancedUi.normalMean),
    normalStdDev: String(hardDefaultAdvancedUi.normalStdDev),
    brownianDrift: String(hardDefaultAdvancedUi.brownianDrift),
    brownianVolatility: String(hardDefaultAdvancedUi.brownianVolatility),
    studentMu: String(hardDefaultAdvancedUi.studentMu),
    studentSigma: String(hardDefaultAdvancedUi.studentSigma),
    studentNu: String(hardDefaultAdvancedUi.studentNu),
    regimeTickMonths: String(hardDefaultAdvancedUi.regimeTickMonths),
    regimes: hardDefaultAdvancedUi.regimes,
    exemptionCardLimit: String(hardDefaultAdvancedUi.exemptionCardLimit),
    exemptionCardYearlyIncrease: String(hardDefaultAdvancedUi.exemptionCardYearlyIncrease),
    stockExemptionTaxRate: String(hardDefaultAdvancedUi.stockExemptionTaxRate),
    stockExemptionLimit: String(hardDefaultAdvancedUi.stockExemptionLimit),
    stockExemptionYearlyIncrease: String(hardDefaultAdvancedUi.stockExemptionYearlyIncrease),
  }), [hardDefaultAdvancedUi, templateBaselineExecutionDefaults.batchSize, templateBaselineExecutionDefaults.paths, templateBaselineExecutionDefaults.seedMode]);

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
        setInflationAveragePct(String(infl));
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
        exemptionCard: {
          limit: currentAssumptions.taxExemptionDefaults.exemptionCardLimit,
          increase: currentAssumptions.taxExemptionDefaults.exemptionCardYearlyIncrease,
        },
        stockExemption: {
          taxRate: currentAssumptions.taxExemptionDefaults.stockExemptionTaxRate,
          limit: currentAssumptions.taxExemptionDefaults.stockExemptionLimit,
          increase: currentAssumptions.taxExemptionDefaults.stockExemptionYearlyIncrease,
        },
      },
      inflation: { averagePercentage: currentAssumptions.inflationPct },
      returner: {
        type: DEFAULT_RETURN_TYPE,
        simpleReturn: { averagePercentage: 7 },
        random: { seed: DEFAULT_MASTER_SEED },
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
  const scenarioASummary = useMemo(
    () => (scenarioA ? summarizeScenario(scenarioA.request ?? advancedToNormalRequest(scenarioA.advancedRequest), currentAssumptions) : null),
    [currentAssumptions, scenarioA]
  );
  const scenarioBSummary = useMemo(
    () => (scenarioB ? summarizeScenario(scenarioB.request ?? advancedToNormalRequest(scenarioB.advancedRequest), currentAssumptions) : null),
    [currentAssumptions, scenarioB]
  );

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

    const lastStartedRunMeta = lastStartedRunMetaRef.current;
    const preferredSeed = (() => {
      const text = (lastStartedRunMeta as any)?.rngSeedText;
      if (typeof text === 'string' && /^-?\d+$/.test(text.trim())) {
        try {
          const bi = BigInt(text.trim());
          const max = BigInt(Number.MAX_SAFE_INTEGER);
          const min = -max;
          if (bi > max || bi < min) return null;
          const n = Number(bi);
          return Number.isSafeInteger(n) ? n : null;
        } catch {
          return null;
        }
      }
      const n = lastStartedRunMeta?.rngSeed;
      return Number.isSafeInteger(n) ? (n ?? null) : null;
    })();
    const requestToSave = materializeRandomSeedIfNeeded(
      currentAdvancedRequest,
      preferredSeed
    );
    const wasRandomRequested = isRandomSeedRequested(currentAdvancedRequest);

    const matchingLastRunId = lastCompletedRun && deepEqual(lastCompletedRun.advancedRequest, requestToSave)
      ? lastCompletedRun.id
      : undefined;

    const lastStartedRunId = simulationIdRef.current;

    const resolvedRunId = matchingLastRunId
      ?? (!wasRandomRequested && lastStartedRunId
        ? lastStartedRunId
        : await findRunForInput(requestToSave).catch(() => null));

    const metaMatchesCurrentRequest =
      Boolean(lastStartedRunMeta) &&
      Boolean(lastRunRequestRef.current) &&
      deepEqual(lastRunRequestRef.current, currentAdvancedRequest);

    const metaToStore =
      lastStartedRunMeta &&
      (
        // For deterministic runs: only store meta when it matches the persisted run id.
        (resolvedRunId && resolvedRunId === lastStartedRunMeta.id) ||
        // For random-seed requests: store meta when it matches the last submitted payload.
        (wasRandomRequested && metaMatchesCurrentRequest)
      )
        ? {
            id: lastStartedRunMeta.id,
            createdAt: lastStartedRunMeta.createdAt,
            rngSeed: lastStartedRunMeta.rngSeed ?? null,
            rngSeedText: (lastStartedRunMeta as any)?.rngSeedText ?? (lastStartedRunMeta.rngSeed !== null && lastStartedRunMeta.rngSeed !== undefined ? String(lastStartedRunMeta.rngSeed) : null),
            modelAppVersion: lastStartedRunMeta.modelAppVersion ?? null,
            modelBuildTime: lastStartedRunMeta.modelBuildTime ?? null,
            modelSpringBootVersion: lastStartedRunMeta.modelSpringBootVersion ?? null,
            modelJavaVersion: lastStartedRunMeta.modelJavaVersion ?? null,
          }
        : undefined;

    const existing = findScenarioByName(name);
    if (existing) {
      const ok = window.confirm(`Overwrite existing scenario "${existing.name}"?`);
      if (!ok) return;

      const keepExistingRunId =
        !wasRandomRequested &&
        deepEqual(existing.advancedRequest, requestToSave);

      const saved = saveScenario(
        existing.name,
        requestToSave,
        existing.id,
        resolvedRunId ?? (keepExistingRunId ? existing.runId : undefined),
        metaToStore ?? existing.lastRunMeta
      );
      refreshSavedScenarios();
      setSelectedScenarioId(saved.id);
      return;
    }

    const saved = saveScenario(name, requestToSave, undefined, resolvedRunId ?? undefined, metaToStore);
    refreshSavedScenarios();
    setSelectedScenarioId(saved.id);
  }, [currentAdvancedRequest, refreshSavedScenarios, lastCompletedRun]);

  const runSimulationWithRequest = useCallback(async (req: AdvancedSimulationRequest) => {
    const total = (req.phases ?? []).reduce((s, p: any) => s + (Number(p.durationInMonths) || 0), 0);
    if (total > MAX_MONTHS) {
      alert(`Total duration must be ≤ ${MAX_YEARS} years (you have ${formatYearsMonths(total)}).`);
      return;
    }

    setSimulateInProgress(true);
    setSimulationId(null);
    simulationIdRef.current = null;

    try {
      // Always track the exact payload we submit, for dedup and scenario-save matching.
      lastRunRequestRef.current = req;

      const started = await startAdvancedSimulation(req);
      appendSimulationSnapshot({
        runId: started.id,
        createdAt: started.createdAt ?? new Date().toISOString(),
        assumptions: currentAssumptions,
        advancedRequest: req,
      });
      lastStartedRunMetaRef.current = started;
      lastRunWasNormalRef.current = !advancedEnabled;
      setSimulationId(started.id);
      simulationIdRef.current = started.id;
    } catch (err) {
      alert((err as Error).message);
      setSimulateInProgress(false);
    }
  }, [advancedEnabled, currentAssumptions]);

  const handleLoadScenario = useCallback((scenarioId: string) => {
    if (!scenarioId) return;
    const scenario = findScenarioById(scenarioId);
    if (!scenario) return;
    if (isDirty) {
      const ok = window.confirm('Loading a scenario will overwrite your current inputs. Continue?');
      if (!ok) return;
    }
    const reqForForm = scenario.request ?? advancedToNormalRequest(scenario.advancedRequest);
    applyRequestToForm(reqForForm);
    setSelectedScenarioId(scenario.id);

    const normalizedAdvanced: AdvancedSimulationRequest = {
      ...scenario.advancedRequest,
      phases: (scenario.advancedRequest.phases ?? []).map((p: any) => ({
        ...p,
        taxRules: normalizeTaxRules(p?.taxRules),
      })),
    };

    const hasAnyTaxRules = (normalizedAdvanced.phases ?? []).some((p: any) => (p?.taxRules?.length ?? 0) > 0);
    const cfg = normalizedAdvanced.taxExemptionConfig;
    const hasExplicitTaxExemptionConfig =
      cfg?.exemptionCard?.limit !== undefined ||
      cfg?.exemptionCard?.yearlyIncrease !== undefined ||
      cfg?.stockExemption?.taxRate !== undefined ||
      cfg?.stockExemption?.limit !== undefined ||
      cfg?.stockExemption?.yearlyIncrease !== undefined;

    const assumptionsTaxExemptionConfig = {
      exemptionCard: {
        limit: currentAssumptions.taxExemptionDefaults.exemptionCardLimit,
        yearlyIncrease: currentAssumptions.taxExemptionDefaults.exemptionCardYearlyIncrease,
      },
      stockExemption: {
        taxRate: currentAssumptions.taxExemptionDefaults.stockExemptionTaxRate,
        limit: currentAssumptions.taxExemptionDefaults.stockExemptionLimit,
        yearlyIncrease: currentAssumptions.taxExemptionDefaults.stockExemptionYearlyIncrease,
      },
    };

    const requestToRun =
      hasAnyTaxRules && !hasExplicitTaxExemptionConfig
        ? { ...normalizedAdvanced, taxExemptionConfig: assumptionsTaxExemptionConfig }
        : normalizedAdvanced;

    void runSimulationWithRequest(requestToRun);
    closeScenarioModal();
  }, [applyRequestToForm, closeScenarioModal, currentAssumptions.taxExemptionDefaults, isDirty, runSimulationWithRequest]);

  const handleShareScenario = useCallback(() => {
    if (!selectedScenarioId) return;
    const scenario = findScenarioById(selectedScenarioId);
    if (!scenario) return;

    const ok = window.confirm(
      'This share link encodes your full scenario inputs in the URL. Anyone with the link can view/decode them. Continue?'
    );
    if (!ok) return;

    const reqForShare = scenario.request ?? advancedToNormalRequest(scenario.advancedRequest);
    const param = encodeScenarioToShareParam(reqForShare);
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

  const selectedTemplate = useMemo(() => {
    if (templatePickerId === TUTORIAL_TEMPLATE_ID) {
      return {
        id: TUTORIAL_TEMPLATE_ID,
        label: 'Tutorial (guided)',
        description: 'Tutorial-only preset that intentionally starts with “wrong” values so you must change inputs step-by-step.',
      } as any;
    }
    return getTemplateById(templatePickerId as SimulationTemplateId);
  }, [templatePickerId]);

  useEffect(() => {
    if (pendingTemplateId != null) return;
    setTemplatePickerId(selectedTemplateId);
  }, [pendingTemplateId, selectedTemplateId]);

  useEffect(() => {
    if (selectedTemplateId !== 'custom' && isDirty && hasUserEditedRef.current) {
      setSelectedTemplateId('custom');
    }
  }, [isDirty, selectedTemplateId, userEditTick]);

  const closeTemplateDiff = useCallback(() => {
    // If we're previewing a template, closing acts like cancel.
    if (templateDiffMode === 'preview' && pendingTemplateId != null) {
      setPendingTemplateId(null);
      setTemplatePickerId(selectedTemplateId);
      setTemplateModalDiff(null);
    }
    setIsTemplateDiffOpen(false);
  }, [pendingTemplateId, selectedTemplateId, templateDiffMode]);

  const coerceTemplateAdvancedPatch = useCallback((adv?: TemplateAdvancedDefaults | null): Partial<AdvancedUiSnapshot> => {
    if (!adv) return {};
    const patch: Partial<AdvancedUiSnapshot> = {};

    if (adv.paths !== undefined) patch.paths = String(adv.paths);
    if (adv.batchSize !== undefined) patch.batchSize = String(adv.batchSize);
    if (adv.inflationAveragePct !== undefined) patch.inflationAveragePct = String(adv.inflationAveragePct);
    if (adv.yearlyFeePercentage !== undefined) patch.yearlyFeePercentage = String(adv.yearlyFeePercentage);

    if (adv.returnType !== undefined) patch.returnType = adv.returnType as ReturnType;
    if (adv.seedMode !== undefined) patch.seedMode = adv.seedMode;
    if (adv.seed !== undefined) patch.seed = String(Math.trunc(Number(adv.seed)));

    return patch;
  }, []);

  const buildTemplateDiff = useCallback((templateId: SimulationTemplateId) => {
    const template = getTemplateById(templateId);
    const resolved = resolveTemplateToRequest(template);
    const advPatch = coerceTemplateAdvancedPatch(template.advanced);
    const targetAdvancedUi: AdvancedUiSnapshot = { ...defaultAdvancedUi, ...advPatch, regimes: advPatch.regimes ?? defaultAdvancedUi.regimes };

    const phaseTouched = Boolean(template.patch?.phases);
    const fromPhases = phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] }));
    const toPhases = resolved.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] }));

    const fmt = (v: unknown): string => {
      if (v === null || v === undefined) return '—';
      const s = String(v);
      return s.trim() === '' ? '—' : s;
    };

    const fmtTaxRules = (rules?: Array<string> | null): string => {
      if (!rules || rules.length === 0) return '—';
      return rules.join(', ');
    };

    const phaseDetailRows: Array<{ field: string; touched: boolean; changed: boolean; from: string; to: string }> = [];
    if (phaseTouched) {
      const max = Math.max(fromPhases.length, toPhases.length);
      for (let i = 0; i < max; i++) {
        const a = fromPhases[i];
        const b = toPhases[i];
        const phaseLabel = `Phase ${i + 1}`;

        if (!a && b) {
          phaseDetailRows.push({
            field: `${phaseLabel}: Added`,
            touched: true,
            changed: true,
            from: '—',
            to: `${b.phaseType} (${fmt(b.durationInMonths)} months)`,
          });
          continue;
        }
        if (a && !b) {
          phaseDetailRows.push({
            field: `${phaseLabel}: Removed`,
            touched: true,
            changed: true,
            from: `${a.phaseType} (${fmt(a.durationInMonths)} months)`,
            to: '—',
          });
          continue;
        }
        if (!a || !b) continue;

        const fields: Array<{ key: keyof PhaseRequest; label: string; format?: (v: any) => string }> = [
          { key: 'phaseType', label: 'Type', format: (v) => fmt(v) },
          { key: 'durationInMonths', label: 'Duration (months)', format: (v) => fmt(v) },
          { key: 'initialDeposit', label: 'Initial deposit', format: (v) => fmt(v) },
          { key: 'monthlyDeposit', label: 'Monthly deposit', format: (v) => fmt(v) },
          { key: 'yearlyIncreaseInPercentage', label: 'Yearly increase (%)', format: (v) => fmt(v) },
          { key: 'withdrawRate', label: 'Withdraw rate', format: (v) => fmt(v) },
          { key: 'withdrawAmount', label: 'Withdraw amount', format: (v) => fmt(v) },
          { key: 'lowerVariationPercentage', label: 'Lower variation (%)', format: (v) => fmt(v) },
          { key: 'upperVariationPercentage', label: 'Upper variation (%)', format: (v) => fmt(v) },
          { key: 'taxRules', label: 'Tax exemptions', format: (v) => fmtTaxRules(v) },
        ];

        for (const f of fields) {
          const av = (a as any)[f.key];
          const bv = (b as any)[f.key];
          const aStr = f.format ? f.format(av) : fmt(av);
          const bStr = f.format ? f.format(bv) : fmt(bv);
          if (aStr === bStr) continue;
          phaseDetailRows.push({
            field: `${phaseLabel}: ${f.label}`,
            touched: true,
            changed: true,
            from: aStr,
            to: bStr,
          });
        }
      }
    }

    const normalRows: Array<{ field: string; touched: boolean; changed: boolean; from: string; to: string }> = [
      {
        field: 'Start date',
        touched: Boolean(template.patch?.startDate),
        changed: startDate !== resolved.startDate.date,
        from: startDate,
        to: resolved.startDate.date,
      },
      {
        field: 'Tax rule',
        touched: Boolean(template.patch?.overallTaxRule),
        changed: overallTaxRule !== resolved.overallTaxRule,
        from: String(overallTaxRule),
        to: String(resolved.overallTaxRule),
      },
      {
        field: 'Tax %',
        touched: typeof template.patch?.taxPercentage === 'number',
        changed: Number(taxPercentage) !== Number(resolved.taxPercentage),
        from: String(taxPercentage),
        to: String(resolved.taxPercentage),
      },
      {
        field: 'Phases',
        touched: phaseTouched,
        changed: !deepEqual(fromPhases, toPhases),
        from: `${phases.length} phase(s)`,
        to: `${resolved.phases.length} phase(s)`,
      },
      ...phaseDetailRows,
    ];

    // Only show model-specific fields when the *target* template uses that model.
    // Otherwise the diff becomes noisy with defaults for other return models.
    const advFields: Array<keyof AdvancedUiSnapshot> = [
      'seedMode',
      'seed',
      'returnType',
      'paths',
      'batchSize',
      'inflationAveragePct',
      'yearlyFeePercentage',
      'exemptionCardLimit',
      'exemptionCardYearlyIncrease',
      'stockExemptionTaxRate',
      'stockExemptionLimit',
      'stockExemptionYearlyIncrease',
    ];

    if (targetAdvancedUi.returnType === 'simpleReturn') {
      advFields.push('simpleAveragePercentage');
    }

    if (targetAdvancedUi.returnType === 'distributionReturn') {
      advFields.push('distributionType');
      if (targetAdvancedUi.distributionType === 'normal') {
        advFields.push('normalMean', 'normalStdDev');
      } else if (targetAdvancedUi.distributionType === 'brownianMotion') {
        advFields.push('brownianDrift', 'brownianVolatility');
      } else if (targetAdvancedUi.distributionType === 'studentT') {
        advFields.push('studentMu', 'studentSigma', 'studentNu');
      } else if (targetAdvancedUi.distributionType === 'regimeBased') {
        advFields.push('regimeTickMonths');
      }
    }

    const advLabel: Record<string, string> = {
      seedMode: 'Master seed mode',
      seed: 'Master seed',
      returnType: 'Return model',
      simpleAveragePercentage: 'Simple return (avg %/year)',
      distributionType: 'Distribution type',
      normalMean: 'Normal mean',
      normalStdDev: 'Normal std dev',
      brownianDrift: 'Brownian drift',
      brownianVolatility: 'Brownian volatility',
      studentMu: 'Student-t mu',
      studentSigma: 'Student-t sigma',
      studentNu: 'Student-t nu',
      regimeTickMonths: 'Regime tick (months)',
      paths: 'Paths (runs)',
      batchSize: 'Batch size',
      inflationAveragePct: 'Inflation (avg %/year)',
      yearlyFeePercentage: 'Fee (avg %/year)',
      exemptionCardLimit: 'Exemption card limit',
      exemptionCardYearlyIncrease: 'Exemption card yearly increase',
      stockExemptionTaxRate: 'Stock exemption tax rate',
      stockExemptionLimit: 'Stock exemption limit',
      stockExemptionYearlyIncrease: 'Stock exemption yearly increase',
    };

    const touchedKeys = new Set(Object.keys(advPatch));
    const advancedRows = advFields.map((k) => {
      const fromV = (currentAdvancedUi as any)[k];
      const toV = (targetAdvancedUi as any)[k];
      const fromS = typeof fromV === 'string' ? fromV : String(fromV);
      const toS = typeof toV === 'string' ? toV : String(toV);
      return {
        field: advLabel[String(k)] ?? String(k),
        touched: touchedKeys.has(String(k)),
        changed: fromS !== toS,
        from: fromS,
        to: toS,
      };
    });

    return {
      templateId,
      templateLabel: template.label,
      normal: normalRows,
      advanced: advancedRows,
      resolved,
      targetAdvancedUi,
    };
  }, [coerceTemplateAdvancedPatch, defaultAdvancedUi, overallTaxRule, phases, startDate, taxPercentage]);

  const applyTutorialTemplate = useCallback(() => {
    hasUserEditedRef.current = false;

    if (advancedMode) {
      const aktiedepot = resolveTemplateToRequest(getTemplateById('aktiedepot'));
      setStartDate(aktiedepot.startDate.date);
      setOverallTaxRule(aktiedepot.overallTaxRule);
      setTaxPercentage(String(aktiedepot.taxPercentage ?? 0));
      setPhases(aktiedepot.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })));
    } else {
      setStartDate('');
      setOverallTaxRule('NOTIONAL');
      setTaxPercentage('');
      setPhases([]);
    }

    // Keep advanced fields at 0, and choose a "wrong" return type.
    // Exception: paths + batch should remain at their normal default in the advanced tutorial.
    setPaths(advancedMode ? String(hardDefaultAdvancedUi.paths) : '0');
    setBatchSize(advancedMode ? String(hardDefaultAdvancedUi.batchSize) : '0');
    setInflationAveragePct('0');
    setYearlyFeePercentage('0');

    setExemptionCardLimit('0');
    setExemptionCardYearlyIncrease('0');
    setStockExemptionTaxRate('0');
    setStockExemptionLimit('0');
    setStockExemptionYearlyIncrease('0');

    setSeedMode('default');
    setSeed(String(DEFAULT_MASTER_SEED));
    setReturnType('simpleReturn');
    setSimpleAveragePercentage('0');
    setDistributionType('normal');
    setNormalMean('');
    setNormalStdDev('');
    setBrownianDrift('');
    setBrownianVolatility('');
    setStudentMu('');
    setStudentSigma('');
    setStudentNu('');
    setRegimeTickMonths('');
  }, [
    advancedMode,
    hardDefaultAdvancedUi.batchSize,
    hardDefaultAdvancedUi.paths,
    setBatchSize,
    setDistributionType,
    setExemptionCardLimit,
    setExemptionCardYearlyIncrease,
    setInflationAveragePct,
    setOverallTaxRule,
    setPaths,
    setPhases,
    setBrownianDrift,
    setBrownianVolatility,
    setNormalMean,
    setNormalStdDev,
    setRegimeTickMonths,
    setReturnType,
    setSeed,
    setSeedMode,
    setSimpleAveragePercentage,
    setStartDate,
    setStudentMu,
    setStudentNu,
    setStudentSigma,
    setStockExemptionLimit,
    setStockExemptionTaxRate,
    setStockExemptionYearlyIncrease,
    setTaxPercentage,
    setYearlyFeePercentage,
  ]);

  const applyTemplateConfirmed = useCallback((templateId: TemplatePickerId) => {
    if (templateId === TUTORIAL_TEMPLATE_ID) {
      setSelectedTemplateId(TUTORIAL_TEMPLATE_ID);
      setLastTemplateDiff(null);
      applyTutorialTemplate();
      return;
    }
    if (templateId === 'custom') {
      setSelectedTemplateId('custom');
      setLastTemplateDiff(null);
      return;
    }

    const d = buildTemplateDiff(templateId as SimulationTemplateId);

    hasUserEditedRef.current = false;
    setSelectedTemplateId(templateId);

    // Apply normal fields
    setStartDate(d.resolved.startDate.date);
    setOverallTaxRule(d.resolved.overallTaxRule);
    setTaxPercentage(String(d.resolved.taxPercentage ?? 0));
    setPhases(d.resolved.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })));

    // Apply advanced template defaults (do not change UI mode)
    const adv = d.targetAdvancedUi;

    // Execution defaults are global (persisted) and are now the single source of truth for
    // paths/batchSize/seedMode. Applying a template should reset them alongside the UI.
    updateExecutionDefaults({
      paths: Math.trunc(Number(adv.paths)),
      batchSize: Math.trunc(Number(adv.batchSize)),
      seedMode: adv.seedMode,
    });

    setPaths(String(adv.paths));
    setBatchSize(String(adv.batchSize));
    setInflationAveragePct(String(adv.inflationAveragePct));
    setYearlyFeePercentage(String(adv.yearlyFeePercentage));

    setReturnType(adv.returnType);
    setSeedMode(adv.seedMode);
    setSeed(String(adv.seed));
    setSimpleAveragePercentage(String(adv.simpleAveragePercentage));

    setDistributionType(adv.distributionType);
    setNormalMean(String(adv.normalMean));
    setNormalStdDev(String(adv.normalStdDev));
    setBrownianDrift(String(adv.brownianDrift));
    setBrownianVolatility(String(adv.brownianVolatility));
    setStudentMu(String(adv.studentMu));
    setStudentSigma(String(adv.studentSigma));
    setStudentNu(String(adv.studentNu));

    setRegimeTickMonths(String(adv.regimeTickMonths));
    setRegimes(adv.regimes);

    setExemptionCardLimit(String(adv.exemptionCardLimit));
    setExemptionCardYearlyIncrease(String(adv.exemptionCardYearlyIncrease));
    setStockExemptionTaxRate(String(adv.stockExemptionTaxRate));
    setStockExemptionLimit(String(adv.stockExemptionLimit));
    setStockExemptionYearlyIncrease(String(adv.stockExemptionYearlyIncrease));

    // Update baselines so template doesn't instantly flip back to custom.
    const baselineSeedMode = adv.seedMode;
    const baselineSeed = adv.seed;
    const seedNum = seedForMode(baselineSeedMode, toNumOrUndef(baselineSeed));
    setBaselineRequest({
      startDate: { date: d.resolved.startDate.date },
      overallTaxRule: d.resolved.overallTaxRule,
      taxPercentage: d.resolved.taxPercentage,
      phases: d.resolved.phases.map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
      seed: seedNum,
    });
    setBaselineAdvancedUi(adv);

    setLastTemplateDiff({
      templateId: d.templateId,
      templateLabel: d.templateLabel,
      normal: d.normal,
      advanced: d.advanced,
    });
  }, [applyTutorialTemplate, buildTemplateDiff, updateExecutionDefaults]);

  const openTemplatePreview = useCallback((templateId: TemplatePickerId) => {
    // In tutorials, only allow Tutorial + Custom (prevents skipping tutorial steps via other presets).
    if (isTutorial) {
      if (templateId !== TUTORIAL_TEMPLATE_ID && templateId !== 'custom') return;

      setPendingTemplateId(null);
      setTemplatePickerId(templateId);
      setTemplateModalDiff(null);
      applyTemplateConfirmed(templateId);
      setIsTemplateDiffOpen(false);
      return;
    }

    // Selecting "Custom" applies immediately.
    if (templateId === 'custom') {
      setPendingTemplateId(null);
      setTemplatePickerId('custom');
      setTemplateModalDiff(null);
      applyTemplateConfirmed('custom');
      setIsTemplateDiffOpen(false);
      return;
    }

    // Preview first; only apply on confirmation.
    setPendingTemplateId(templateId);
    setTemplatePickerId(templateId);

    const d = buildTemplateDiff(templateId as SimulationTemplateId);
    const diffForUi: TemplateDiff = {
      templateId: d.templateId,
      templateLabel: d.templateLabel,
      normal: d.normal,
      advanced: d.advanced,
    };

    setTemplateDiffMode('preview');
    setTemplateDiffTitle('Template preview');
    setTemplateModalDiff(diffForUi);
    setIsTemplateDiffOpen(true);
  }, [applyTemplateConfirmed, buildTemplateDiff, isTutorial]);

  const confirmTemplatePreview = useCallback(() => {
    if (!pendingTemplateId) return;
    applyTemplateConfirmed(pendingTemplateId);
    setPendingTemplateId(null);
    setTemplatePickerId(pendingTemplateId);
    setTemplateModalDiff(null);
    setIsTemplateDiffOpen(false);
  }, [applyTemplateConfirmed, pendingTemplateId]);

  const cancelTemplatePreview = useCallback(() => {
    setPendingTemplateId(null);
    setTemplatePickerId(selectedTemplateId);
    setTemplateModalDiff(null);
    setIsTemplateDiffOpen(false);
  }, [selectedTemplateId]);

  const openWhatChanged = useCallback(() => {
    if (selectedTemplateId === 'custom') return;
    // Show the changes that were applied when the template was last confirmed.
    // Recomputing based on current state will often yield an empty diff right after apply.
    const diffForUi: TemplateDiff | null =
      lastTemplateDiff && lastTemplateDiff.templateId === selectedTemplateId
        ? lastTemplateDiff
        : null;
    if (!diffForUi) return;
    setTemplateDiffMode('whatChanged');
    setTemplateDiffTitle('What changed?');
    setTemplateModalDiff(diffForUi);
    setIsTemplateDiffOpen(true);
  }, [lastTemplateDiff, selectedTemplateId]);

  const hasAppliedInitialTemplateRef = useRef(false);
  useEffect(() => {
    if (hasAppliedInitialTemplateRef.current) return;
    hasAppliedInitialTemplateRef.current = true;

    if (isTutorial) return;
    if (scenarioParamOnLoad) return;
    if (didRestoreDraftRef.current) return;

    // Do not auto-apply template defaults when the user has persisted advanced options;
    // those represent explicit user preferences and should win unless the user
    // explicitly applies a template.
    try {
      const raw = window.localStorage.getItem(ADVANCED_OPTIONS_KEY);
      if (raw) return;
    } catch {
      // ignore
    }
    applyTemplateConfirmed(selectedTemplateId); // Apply starter template on first load
  }, [applyTemplateConfirmed, scenarioParamOnLoad, selectedTemplateId]);

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

    if (!scenarioAutoLoadOnLoad) {
      const okPrivacy = window.confirm(
        'This link contains a scenario encoded in the URL. Anyone with the link can decode it. Load and run it now?'
      );
      if (!okPrivacy) {
        hasAppliedScenarioFromUrlRef.current = true;
        return;
      }
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
    void runSimulationWithRequest(normalToAdvancedWithDefaults(decoded, {
      inflationPct: currentAssumptions.inflationPct,
      yearlyFeePct: currentAssumptions.yearlyFeePct,
      taxExemptionDefaults: {
        exemptionCardLimit: currentAssumptions.taxExemptionDefaults.exemptionCardLimit,
        exemptionCardYearlyIncrease: currentAssumptions.taxExemptionDefaults.exemptionCardYearlyIncrease,
        stockExemptionTaxRate: currentAssumptions.taxExemptionDefaults.stockExemptionTaxRate,
        stockExemptionLimit: currentAssumptions.taxExemptionDefaults.stockExemptionLimit,
        stockExemptionYearlyIncrease: currentAssumptions.taxExemptionDefaults.stockExemptionYearlyIncrease,
      },
    }));
    hasAppliedScenarioFromUrlRef.current = true;

    // If this scenario came from an internal navigation (e.g. Explore -> Clone to form),
    // remove the scenario payload from the URL to avoid re-running on refresh and to
    // prevent users from accidentally copying a sensitive/huge URL.
    if (scenarioAutoLoadOnLoad) {
      clearScenarioFromUrl();
    }
  }, [applyRequestToForm, clearScenarioFromUrl, isDirty, runSimulationWithRequest, scenarioAutoLoadOnLoad, scenarioParamOnLoad]);

  const handleAddDefaultPhase = () => {
    if (isTutorial) {
      // Tutorial should start with blank inputs.
      handleAddPhase({
        ...createDefaultPhase('PASSIVE'),
        durationInMonths: 0,
        initialDeposit: 0,
        monthlyDeposit: 0,
        yearlyIncreaseInPercentage: 0,
        withdrawAmount: 0,
        withdrawRate: 0,
        lowerVariationPercentage: 0,
        upperVariationPercentage: 0,
        taxRules: [],
      });
      return;
    }
    handleAddPhase(createDefaultPhase('DEPOSIT'));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    void runSimulationWithRequest(currentAdvancedRequest);
  };

  // --- tutorial stepper (only if steps provided) ---
  const [idx, setIdx] = useState(0);
  const [enteredViaBack, setEnteredViaBack] = useState(false);
  const steps = tutorialSteps ?? [];
  const current = steps[idx];
  const isFirst = idx === 0;
  const isLast = idx === steps.length - 1;
  const next = () => {
    setEnteredViaBack(false);
    setIdx(i => {
      if (!steps.length) return i;
      if (i + 1 >= steps.length) { onExitTutorial?.(); return i; } // Finish -> back to /simulation
      return i + 1;
    });
  };
  const back = () => {
    setEnteredViaBack(true);
    setIdx(i => Math.max(i - 1, 0));
  };
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
        {advancedEnabled && (
          <div style={cardStyle}>
            <div data-tour="engine-settings" style={cardTitleStyle}>Engine Settings</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label data-tour="master-seed" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="fc-field-label">Master seed</span>
                <div style={rowStyle}>
                  <select
                    value={seedMode}
                    onChange={(e) => {
                      markUserEdited();
                      const next = e.target.value as MasterSeedMode;
                      setSeedMode(next);
                      if (!isTutorial) updateExecutionDefaults({ seedMode: next });
                      if (next === 'custom') {
                        const n = toNumOrUndef(seed);
                        if (!n || n <= 0) setSeed(String(DEFAULT_MASTER_SEED));
                      }
                    }}
                    disabled={simulateInProgress}
                    style={inputStyle}
                  >
                    <option value="default">Default (fixed, deduplicates)</option>
                    <option value="custom">Custom (fixed, deduplicates)</option>
                    <option value="random">Random (not stored)</option>
                  </select>
                  <InfoTooltip label="(i)">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div><b>Default</b>: uses seed 1. Deterministic; same inputs reuse the same run.</div>
                      <div><b>Custom</b>: uses the seed you enter. Deterministic; same inputs + seed reuse the same run.</div>
                      <div><b>Random</b>: uses a fresh seed each time. Results vary; runs are not reused or stored.</div>
                    </div>
                  </InfoTooltip>
                </div>

                {seedMode === 'custom' && (
                  <div style={{ ...rowStyle, marginTop: 6 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={seed}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!isValidIntegerDraft(next)) return;
                        markUserEdited();
                        setSeed(next);
                      }}
                      disabled={simulateInProgress}
                      style={inputStyle}
                    />
                  </div>
                )}
              </label>

              {executionFeatureOn && (
                <>
                  <label data-tour="paths" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="fc-field-label">Paths (runs)</span>
                    <div style={rowStyle}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={paths}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isValidIntegerDraft(next)) return;
                          markUserEdited();
                          setPaths(next);
                          const n = Number(next);
                          if (!isTutorial && Number.isFinite(n) && n > 0) {
                            updateExecutionDefaults({ paths: Math.trunc(n) });
                          }
                        }}
                        disabled={simulateInProgress}
                        style={inputStyle}
                      />
                      <InfoTooltip label="(i)">
                        Monte Carlo paths / runs. Higher values reduce noise but take longer.
                        Capped at 100,000.
                      </InfoTooltip>
                    </div>
                  </label>

                  <label data-tour="batch-size" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="fc-field-label">Batch size</span>
                    <div style={rowStyle}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={batchSize}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isValidIntegerDraft(next)) return;
                          markUserEdited();
                          setBatchSize(next);
                          const n = Number(next);
                          if (!isTutorial && Number.isFinite(n) && n > 0) {
                            updateExecutionDefaults({ batchSize: Math.trunc(n) });
                          }
                        }}
                        disabled={simulateInProgress}
                        style={inputStyle}
                      />
                      <InfoTooltip label="(i)">
                        Work chunk size for progress updates. Smaller batches update more often; larger batches can be faster.
                        Capped at 100,000.
                      </InfoTooltip>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <div style={cardTitleStyle}>General Options</div>

          <label data-tour="template" style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="fc-field-label">Template</span>
            <div style={rowStyle}>
              <select
                value={templatePickerId}
                onChange={(e) => openTemplatePreview(e.target.value as TemplatePickerId)}
                disabled={simulateInProgress}
                style={inputStyle}
              >
                {isTutorial ? (
                  <>
                    <option value={TUTORIAL_TEMPLATE_ID}>Tutorial (guided)</option>
                    <option value="custom">Custom</option>
                  </>
                ) : (
                  SIMULATION_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))
                )}
              </select>
              <InfoTooltip label="Info: Template">
                Selecting a template previews changes. Click Apply to confirm.
              </InfoTooltip>

              {lastTemplateDiff && selectedTemplateId !== 'custom' && (
                <button
                  type="button"
                  onClick={() => {
                    openWhatChanged();
                  }}
                  disabled={simulateInProgress}
                  style={btn('ghost')}
                >
                  What changed?
                </button>
              )}
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
                onChange={e => { markUserEdited(); setStartDate(e.target.value); }}
                style={inputStyle}
              />
              <InfoTooltip label="Info: Start date">
                The simulation timeline begins here. Phase durations are applied month-by-month starting from this date.
              </InfoTooltip>
            </div>
          </label>

          {advancedEnabled && inflationFeatureOn && (
            <label data-tour="inflation" style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              <span className="fc-field-label">Inflation (avg % / year)</span>
              <div style={rowStyle}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inflationAveragePct}
                  disabled={true}
                  style={inputStyle}
                />
                <InfoTooltip label="(i)">
                  Average annual inflation (in %) used to inflation-adjust withdrawals/spending over time.
                  This affects how your “real” spending power changes from year to year.
                </InfoTooltip>
                <button
                  type="button"
                  onClick={() => navigate('/assumptions')}
                  disabled={simulateInProgress}
                  style={btn('ghost')}
                >
                  Edit in Assumptions Hub
                </button>
              </div>
            </label>
          )}

          {advancedEnabled && feeFeatureOn && (
            <label data-tour="fee" style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
              <span className="fc-field-label">Fee (avg % / year)</span>
              <div style={rowStyle}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={yearlyFeePercentage}
                  disabled={true}
                  style={inputStyle}
                />
                <InfoTooltip label="(i)">
                  Annual fee charged on current capital at year-end (in %). For example, 0.5 means 0.5% of capital is deducted each year.
                </InfoTooltip>
                <button
                  type="button"
                  onClick={() => navigate('/assumptions')}
                  disabled={simulateInProgress}
                  style={btn('ghost')}
                >
                  Edit in Assumptions Hub
                </button>
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
                onChange={e => { markUserEdited(); setOverallTaxRule(e.target.value as OverallTaxRule); }}
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
                type="text"
                inputMode="decimal"
                value={taxPercentage}
                onChange={e => {
                  const next = e.target.value;
                  if (!isValidDecimalDraft(next)) return;
                  markUserEdited();
                  setTaxPercentage(next);
                }}
                style={inputStyle}
              />
              <InfoTooltip label="Info: Tax percentage">
                The tax rate applied by the selected tax rule. Phase exemptions (e.g. exemption card / stock exemption) reduce what gets taxed.
              </InfoTooltip>
            </div>
          </label>

          {advancedEnabled && exemptionsFeatureOn && (
          <div data-tour="exemptions-config" style={{ marginTop: 12, borderTop: '1px solid var(--fc-subtle-border)', paddingTop: 12 }}>
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
                      <input
                        data-tour="exemption-card-limit"
                        type="text"
                        inputMode="numeric"
                        value={exemptionCardLimit}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isValidIntegerDraft(next)) return;
                          markUserEdited();
                          setExemptionCardLimit(next);
                        }}
                        style={inputStyle}
                      />
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
                      <input
                        data-tour="exemption-card-yearly-increase"
                        type="text"
                        inputMode="numeric"
                        value={exemptionCardYearlyIncrease}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isValidIntegerDraft(next)) return;
                          markUserEdited();
                          setExemptionCardYearlyIncrease(next);
                        }}
                        style={inputStyle}
                      />
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
                      <input
                        data-tour="stock-exemption-tax-rate"
                        type="text"
                        inputMode="decimal"
                        value={stockExemptionTaxRate}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isValidDecimalDraft(next)) return;
                          markUserEdited();
                          setStockExemptionTaxRate(next);
                        }}
                        style={inputStyle}
                      />
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
                      <input
                        data-tour="stock-exemption-limit"
                        type="text"
                        inputMode="numeric"
                        value={stockExemptionLimit}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isValidIntegerDraft(next)) return;
                          markUserEdited();
                          setStockExemptionLimit(next);
                        }}
                        style={inputStyle}
                      />
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
                      <input
                        data-tour="stock-exemption-yearly-increase"
                        type="text"
                        inputMode="numeric"
                        value={stockExemptionYearlyIncrease}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isValidIntegerDraft(next)) return;
                          markUserEdited();
                          setStockExemptionYearlyIncrease(next);
                        }}
                        style={inputStyle}
                      />
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
          <div data-tour="return-model" style={cardTitleStyle}>Return model</div>
          <fieldset disabled={simulateInProgress} style={advancedFieldsetStyle(true)}>
            <label className="fc-field-row" style={{ marginBottom: 10 }}>
              <span className="fc-field-label">Return type</span>
              <div className="fc-field-control">
                <select data-tour="return-type" value={returnType} onChange={(e) => { markUserEdited(); setReturnType(parseReturnType(e.target.value)); }} style={inputStyle}>
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
            
            {returnType === 'simpleReturn' && (
              <label className="fc-field-row" style={{ marginBottom: 10 }}>
                <span className="fc-field-label">Return % / year</span>
                <div className="fc-field-control">
                  <input
                    data-tour="return-simple-average"
                    type="text"
                    inputMode="decimal"
                    value={simpleAveragePercentage}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!isValidDecimalDraft(next)) return;
                      markUserEdited();
                      setSimpleAveragePercentage(next);
                    }}
                    style={inputStyle}
                  />
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
                    <select data-tour="return-distribution" value={distributionType} onChange={(e) => { markUserEdited(); setDistributionType(parseDistributionType(e.target.value)); }} style={inputStyle}>
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
                        <input
                          data-tour="return-normal-mean"
                          type="text"
                          inputMode="decimal"
                          value={normalMean}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isValidDecimalDraft(next)) return;
                            markUserEdited();
                            setNormalMean(next);
                          }}
                          style={inputStyle}
                        />
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
                        <input
                          data-tour="return-normal-stddev"
                          type="text"
                          inputMode="decimal"
                          value={normalStdDev}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isValidDecimalDraft(next)) return;
                            markUserEdited();
                            setNormalStdDev(next);
                          }}
                          style={inputStyle}
                        />
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
                        <input
                          type="text"
                          inputMode="decimal"
                          value={brownianDrift}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isValidDecimalDraft(next)) return;
                            markUserEdited();
                            setBrownianDrift(next);
                          }}
                          style={inputStyle}
                        />
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
                        <input
                          type="text"
                          inputMode="decimal"
                          value={brownianVolatility}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isValidDecimalDraft(next)) return;
                            markUserEdited();
                            setBrownianVolatility(next);
                          }}
                          style={inputStyle}
                        />
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
                        <input
                          type="text"
                          inputMode="decimal"
                          value={studentMu}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isValidDecimalDraft(next)) return;
                            markUserEdited();
                            setStudentMu(next);
                          }}
                          style={inputStyle}
                        />
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
                        <input
                          type="text"
                          inputMode="decimal"
                          value={studentSigma}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isValidDecimalDraft(next)) return;
                            markUserEdited();
                            setStudentSigma(next);
                          }}
                          style={inputStyle}
                        />
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
                        <input
                          type="text"
                          inputMode="decimal"
                          value={studentNu}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isValidDecimalDraft(next)) return;
                            markUserEdited();
                            setStudentNu(next);
                          }}
                          style={inputStyle}
                        />
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
                  <div data-tour="return-regime-settings" style={{ marginTop: 10 }}>
                    <label className="fc-field-row" style={{ marginBottom: 10 }}>
                      <span className="fc-field-label">Tick months</span>
                      <div className="fc-field-control">
                        <input
                          data-tour="return-regime-tick-months"
                          type="text"
                          inputMode="numeric"
                          value={regimeTickMonths}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!isValidIntegerDraft(next)) return;
                            markUserEdited();
                            setRegimeTickMonths(next);
                          }}
                          style={inputStyle}
                        />
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
                                data-tour={`return-regime-${i}-distribution`}
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
                              <input
                                data-tour={`return-regime-${i}-duration-months`}
                                type="text"
                                inputMode="numeric"
                                value={r.expectedDurationMonths}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (!isValidIntegerDraft(next)) return;
                                  markUserEdited();
                                  updateRegime(i, { expectedDurationMonths: next });
                                }}
                                style={inputStyle}
                              />
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
                              <input
                                data-tour={`return-regime-${i}-to-0`}
                                type="text"
                                inputMode="decimal"
                                value={r.toRegime0}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (!isValidDecimalDraft(next)) return;
                                  markUserEdited();
                                  updateRegime(i, { toRegime0: next });
                                }}
                                style={inputStyle}
                              />
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
                              <input
                                data-tour={`return-regime-${i}-to-1`}
                                type="text"
                                inputMode="decimal"
                                value={r.toRegime1}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (!isValidDecimalDraft(next)) return;
                                  markUserEdited();
                                  updateRegime(i, { toRegime1: next });
                                }}
                                style={inputStyle}
                              />
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
                              <input
                                data-tour={`return-regime-${i}-to-2`}
                                type="text"
                                inputMode="decimal"
                                value={r.toRegime2}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (!isValidDecimalDraft(next)) return;
                                  markUserEdited();
                                  updateRegime(i, { toRegime2: next });
                                }}
                                style={inputStyle}
                              />
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
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={r.normalMean}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    if (!isValidDecimalDraft(next)) return;
                                    markUserEdited();
                                    updateRegime(i, { normalMean: next });
                                  }}
                                  style={inputStyle}
                                />
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
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={r.normalStdDev}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    if (!isValidDecimalDraft(next)) return;
                                    markUserEdited();
                                    updateRegime(i, { normalStdDev: next });
                                  }}
                                  style={inputStyle}
                                />
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
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={r.studentMu}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    if (!isValidDecimalDraft(next)) return;
                                    markUserEdited();
                                    updateRegime(i, { studentMu: next });
                                  }}
                                  style={inputStyle}
                                />
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
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={r.studentSigma}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    if (!isValidDecimalDraft(next)) return;
                                    markUserEdited();
                                    updateRegime(i, { studentSigma: next });
                                  }}
                                  style={inputStyle}
                                />
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
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={r.studentNu}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    if (!isValidDecimalDraft(next)) return;
                                    markUserEdited();
                                    updateRegime(i, { studentNu: next });
                                  }}
                                  style={inputStyle}
                                />
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

      {simulationId && (
        <SimulationProgress
          simulationId={simulationId}
          onComplete={(result) => {
            const completedId = simulationId;
            setSimulateInProgress(false);

            if (completedId && lastRunRequestRef.current) {
              setLastCompletedRun({ id: completedId, advancedRequest: lastRunRequestRef.current });
            }

            const inflationFactorPerYear = 1 + (Number(currentAssumptions.inflationPct) || 0) / 100;
            const timeline: SimulationTimelineContext = {
              startDate,
              phaseTypes: phases.map((p) => p.phaseType),
              phaseDurationsInMonths: phases.map((p) => Number(p.durationInMonths) || 0),
              phaseInitialDeposits: phases.map((p) => (p?.initialDeposit !== undefined ? Number(p.initialDeposit) : undefined)),
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
          key={current.id}
          step={current}
          onNext={next}
          onBack={back}
          onExit={exit}
          isFirst={isFirst}
          isLast={isLast}
          enteredViaBack={enteredViaBack}
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
                          { id: 'a', req: scenarioA.request ?? advancedToNormalRequest(scenarioA.advancedRequest), label: scenarioA.name },
                          { id: 'b', req: scenarioB.request ?? advancedToNormalRequest(scenarioB.advancedRequest), label: scenarioB.name },
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

      {isTemplateDiffOpen && templateModalDiff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={templateDiffTitle}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000001,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeTemplateDiff();
          }}
        >
          <div
            style={{
              width: 'min(560px, 95vw)',
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
              <div style={{ fontWeight: 800 }}>{templateDiffTitle} ({templateModalDiff.templateLabel})</div>
              <button type="button" onClick={closeTemplateDiff} style={btn('ghost')} aria-label="Close template changes">✕</button>
            </div>

            {(() => {
              const normalChanged = templateModalDiff.normal.filter((r) => r.changed);
              const advancedChanged = templateModalDiff.advanced.filter((r) => r.changed);
              const hasAny = normalChanged.length > 0 || advancedChanged.length > 0;

              if (!hasAny) {
                return (
                  <div style={{ padding: 10, borderRadius: 10, border: '1px solid #333', background: '#0e0e0e' }}>
                    No fields changed.
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 750, marginBottom: 8 }}>Normal</div>
                    {normalChanged.length === 0 ? (
                      <div style={{ fontSize: 13, opacity: 0.85 }}>No changes.</div>
                    ) : (
                      normalChanged.map((r) => (
                        <div key={r.field} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid #222' }}>
                          <div style={{ opacity: 0.9 }}>{r.field}</div>
                          <div style={{ opacity: 0.85 }}>{`${r.from} → ${r.to}`}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ border: '1px solid #333', borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 750, marginBottom: 8 }}>Advanced</div>
                    {advancedChanged.length === 0 ? (
                      <div style={{ fontSize: 13, opacity: 0.85 }}>No changes.</div>
                    ) : (
                      advancedChanged.map((r) => (
                        <div key={r.field} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid #222' }}>
                          <div style={{ opacity: 0.9 }}>{r.field}</div>
                          <div style={{ opacity: 0.85 }}>{`${r.from} → ${r.to}`}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}

            {templateDiffMode === 'preview' && (
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                Applying this template will overwrite the following changes.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              {templateDiffMode === 'preview' ? (
                <>
                  <button type="button" onClick={cancelTemplatePreview} style={btn('ghost')}>Cancel</button>
                  <button type="button" onClick={confirmTemplatePreview} style={btn('primary')}>Apply template</button>
                </>
              ) : (
                <button type="button" onClick={closeTemplateDiff} style={btn('primary')}>Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
});

export default NormalInputForm;
