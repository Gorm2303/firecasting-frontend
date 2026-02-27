import type { PhaseRequest, SimulationRequest } from '../models/types';
import type { Assumptions } from '../state/assumptions';

export type PhaseSummary = {
  index: number;
  phaseType: PhaseRequest['phaseType'];
  durationInMonths: number;
  taxRules?: PhaseRequest['taxRules'];
  taxExemptionsActive?: {
    card: boolean;
    stock: boolean;
    any: boolean;
  };
  // Per-phase tax exemption details (from global TaxExemptionConfig)
  taxExemptions?: {
    exemptionCard?: { limit?: number; yearlyIncrease?: number };
    stockExemption?: { taxRate?: number; limit?: number; yearlyIncrease?: number };
  };
  // DEPOSIT-specific fields
  initialDeposit?: number;
  monthlyDeposit?: number;
  yearlyIncreaseInPercentage?: number;
  depositTotal?: number; // initialDeposit + (monthlyDeposit * durationInMonths)
  // WITHDRAW-specific fields
  withdrawAmount?: number;
  withdrawRate?: number;
  withdrawTotal?: number; // withdrawAmount * durationInMonths (approximation)
  lowerVariationPercentage?: number;
  upperVariationPercentage?: number;
  // PASSIVE has no additional fields beyond durationInMonths
};

export type AdvancedModeSummary = {
  returnType?: string;
  seed?: number | null;
  inflationFactor?: number;
  yearlyFeePercentage?: number;
  taxExemptionConfig?: {
    exemptionCard?: { limit?: number; yearlyIncrease?: number };
    stockExemption?: { taxRate?: number; limit?: number; yearlyIncrease?: number };
  };
  // Returner config details
  simpleAveragePercentage?: number;
  distributionType?: string;
  normalMean?: number;
  normalStdDev?: number;
  brownianDrift?: number;
  brownianVolatility?: number;
  studentMu?: number;
  studentSigma?: number;
  studentNu?: number;
  regimeTickMonths?: number;
};

export type ScenarioSummary = {
  paths?: number;
  batchSize?: number;
  startDate: string;
  overallTaxRule: SimulationRequest['overallTaxRule'];
  taxPercentage: number;
  phaseCount: number;
  totalMonths: number;
  phasePattern: string;
  totalInitialDeposit: number;
  totalMonthlyDeposits: number;
  totalWithdrawAmount: number;
  withdrawRatePhaseCount: number;
  phases: PhaseSummary[];
  // Advanced mode details (included even for normal mode runs)
  advancedMode?: AdvancedModeSummary;
};

export type ScenarioTimelineSegment = {
  phaseType: PhaseRequest['phaseType'];
  durationInMonths: number;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Frontend fallback defaults for tax exemptions when not provided by backend
function resolveTaxExemptionConfig(assumptions: Assumptions): AdvancedModeSummary['taxExemptionConfig'] {
  const a = assumptions;
  return {
    exemptionCard: {
      limit: a.taxExemptionDefaults.exemptionCardLimit,
      yearlyIncrease: a.taxExemptionDefaults.exemptionCardYearlyIncrease,
    },
    stockExemption: {
      taxRate: a.taxExemptionDefaults.stockExemptionTaxRate,
      limit: a.taxExemptionDefaults.stockExemptionLimit,
      yearlyIncrease: a.taxExemptionDefaults.stockExemptionYearlyIncrease,
    },
  };
}

export function getTimelineSegments(req: SimulationRequest): ScenarioTimelineSegment[] {
  return (req.phases ?? []).map((p) => ({
    phaseType: p.phaseType,
    durationInMonths: toNum(p.durationInMonths),
  }));
}

export function summarizePhase(phase: PhaseRequest, index: number, taxExemptionConfig?: any): PhaseSummary {
  const taxRules = phase.taxRules ?? [];
  const cardActive = taxRules.includes('exemptioncard');
  const stockActive = taxRules.includes('stockexemption');

  const summary: PhaseSummary = {
    index,
    phaseType: phase.phaseType,
    durationInMonths: toNum(phase.durationInMonths),
    taxRules,
    taxExemptionsActive: {
      card: cardActive,
      stock: stockActive,
      any: cardActive || stockActive,
    },
    taxExemptions: taxExemptionConfig,
  };

  if (phase.phaseType === 'DEPOSIT') {
    summary.initialDeposit = toNum(phase.initialDeposit);
    summary.monthlyDeposit = toNum(phase.monthlyDeposit);
    summary.yearlyIncreaseInPercentage = toNum(phase.yearlyIncreaseInPercentage);
    summary.depositTotal = summary.initialDeposit + summary.monthlyDeposit * summary.durationInMonths;
  } else if (phase.phaseType === 'WITHDRAW') {
    summary.withdrawAmount = toNum(phase.withdrawAmount);
    summary.withdrawRate = toNum(phase.withdrawRate);
    summary.withdrawTotal = summary.withdrawAmount * summary.durationInMonths;
    summary.lowerVariationPercentage = toNum(phase.lowerVariationPercentage);
    summary.upperVariationPercentage = toNum(phase.upperVariationPercentage);
  }
  // PASSIVE phase: only has durationInMonths and taxRules

  return summary;
}

export function summarizeScenario(req: any, assumptions: Assumptions): ScenarioSummary {
  const phases = req.phases ?? [];
  const startDate = resolveStartDate(req?.startDate);
  const paths = toNum(req?.paths) > 0 ? toNum(req?.paths) : undefined;
  const batchSize = toNum(req?.batchSize) > 0 ? toNum(req?.batchSize) : undefined;

  const totalMonths = phases.reduce((s: number, p: any) => s + toNum(p.durationInMonths), 0);
  const phaseCount = phases.length;
  const phasePattern = phases
    .map((p: any) => (p.phaseType === 'DEPOSIT' ? 'D' : p.phaseType === 'WITHDRAW' ? 'W' : 'P'))
    .join('-');

  const totalInitialDeposit = phases.reduce((s: number, p: any) => s + toNum(p.initialDeposit), 0);

  // Best-effort totals for constant monthly amounts. This ignores growth/variation.
  const totalMonthlyDeposits = phases.reduce((s: number, p: any) => s + toNum(p.monthlyDeposit) * toNum(p.durationInMonths), 0);
  const totalWithdrawAmount = phases.reduce((s: number, p: any) => s + toNum(p.withdrawAmount) * toNum(p.durationInMonths), 0);
  const withdrawRatePhaseCount = phases.filter((p: any) => toNum(p.withdrawRate) > 0).length;

  // Extract advanced mode details (present for both normal and advanced requests)
  const advancedMode = extractAdvancedModeDetails(req, assumptions);
  // Ensure tax exemption defaults are present in per-phase details
  const taxExemptionConfig = req.taxExemptionConfig ?? resolveTaxExemptionConfig(assumptions);

  return {
    paths,
    batchSize,
    startDate,
    overallTaxRule: req.overallTaxRule,
    taxPercentage: toNum(req.taxPercentage),
    phaseCount,
    totalMonths,
    phasePattern,
    totalInitialDeposit,
    totalMonthlyDeposits,
    totalWithdrawAmount,
    withdrawRatePhaseCount,
    phases: phases.map((p: any, idx: number) => summarizePhase(p, idx, taxExemptionConfig)),
    advancedMode: advancedMode && Object.keys(advancedMode).length > 0 ? advancedMode : undefined,
  };
}

function resolveStartDate(startDate: any): string {
  if (!startDate) return '';
  if (typeof startDate?.date === 'string' && startDate.date.trim()) return startDate.date;
  const y = Number(startDate?.year);
  const m = Number(startDate?.month);
  const d = Number(startDate?.dayOfMonth);
  if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return '';
}

function extractAdvancedModeDetails(req: any, assumptions: Assumptions): AdvancedModeSummary | null {
  const returnerConfig = req.returnerConfig;
  const distribution = returnerConfig?.distribution;
  const taxCfg = req.taxExemptionConfig ?? resolveTaxExemptionConfig(assumptions);

  return {
    returnType: req.returnType,
    seed: req.seed ?? returnerConfig?.seed,
    inflationFactor: req.inflationFactor,
    yearlyFeePercentage: req.yearlyFeePercentage,
    taxExemptionConfig: taxCfg,
    // Returner config fields
    simpleAveragePercentage: returnerConfig?.simpleAveragePercentage,
    distributionType: distribution?.type,
    normalMean: distribution?.normal?.mean,
    normalStdDev: distribution?.normal?.standardDeviation,
    brownianDrift: distribution?.brownianMotion?.drift,
    brownianVolatility: distribution?.brownianMotion?.volatility,
    studentMu: distribution?.studentT?.mu,
    studentSigma: distribution?.studentT?.sigma,
    studentNu: distribution?.studentT?.nu,
    regimeTickMonths: distribution?.regimeBased?.tickMonths,
  };
}
