import type { PhaseRequest, SimulationRequest } from '../models/types';

export type ScenarioSummary = {
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
};

export type ScenarioTimelineSegment = {
  phaseType: PhaseRequest['phaseType'];
  durationInMonths: number;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getTimelineSegments(req: SimulationRequest): ScenarioTimelineSegment[] {
  return (req.phases ?? []).map((p) => ({
    phaseType: p.phaseType,
    durationInMonths: toNum(p.durationInMonths),
  }));
}

export function summarizeScenario(req: SimulationRequest): ScenarioSummary {
  const phases = req.phases ?? [];

  const totalMonths = phases.reduce((s, p) => s + toNum(p.durationInMonths), 0);
  const phaseCount = phases.length;
  const phasePattern = phases
    .map((p) => (p.phaseType === 'DEPOSIT' ? 'D' : p.phaseType === 'WITHDRAW' ? 'W' : 'P'))
    .join('-');

  const totalInitialDeposit = phases.reduce((s, p) => s + toNum(p.initialDeposit), 0);

  // Best-effort totals for constant monthly amounts. This ignores growth/variation.
  const totalMonthlyDeposits = phases.reduce((s, p) => s + toNum(p.monthlyDeposit) * toNum(p.durationInMonths), 0);
  const totalWithdrawAmount = phases.reduce((s, p) => s + toNum(p.withdrawAmount) * toNum(p.durationInMonths), 0);
  const withdrawRatePhaseCount = phases.filter((p) => toNum(p.withdrawRate) > 0).length;

  return {
    startDate: req.startDate?.date ?? '',
    overallTaxRule: req.overallTaxRule,
    taxPercentage: toNum(req.taxPercentage),
    phaseCount,
    totalMonths,
    phasePattern,
    totalInitialDeposit,
    totalMonthlyDeposits,
    totalWithdrawAmount,
    withdrawRatePhaseCount,
  };
}
