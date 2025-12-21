export interface PhaseRequest {
  phaseType: 'DEPOSIT' | 'PASSIVE' | 'WITHDRAW';
  taxRules?: ('EXEMPTIONCARD' | 'STOCKEXEMPTION')[];
  durationInMonths: number;
  initialDeposit?: number;
  monthlyDeposit?: number;
  yearlyIncreaseInPercentage?: number;
  withdrawRate?: number;
  withdrawAmount?: number;
  lowerVariationPercentage?: number;
  upperVariationPercentage?: number;
}

export interface SimulationRequest {
  startDate: { date: string };
  overallTaxRule: 'CAPITAL' | 'NOTIONAL';
  taxPercentage: number;
  phases: PhaseRequest[];
}

// UI-only helper: enough info to compute where each phase starts on a calendar.
export interface SimulationTimelineContext {
  /** ISO date string (YYYY-MM-DD) */
  startDate: string;
  /** Phase types in order (DEPOSIT/PASSIVE/WITHDRAW). */
  phaseTypes: PhaseRequest['phaseType'][];
  /** Phase durations in months, in the order entered */
  phaseDurationsInMonths: number[];
  /** Used as the start anchor for Phase #1 interpolation when no previous year exists. */
  firstPhaseInitialDeposit?: number;
}