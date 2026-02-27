export interface PhaseRequest {
  phaseType: 'DEPOSIT' | 'PASSIVE' | 'WITHDRAW';
  /**
   * Tax exemption rule keys (wire format) understood by the backend.
   * Keep these in sync with backend `TaxExemptionRule` JSON values.
   */
  taxRules?: ('exemptioncard' | 'stockexemption')[];
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
  /** Optional RNG seed for reproducibility in normal mode. */
  seed?: number;
}

// UI-only helper: enough info to compute where each phase starts on a calendar.
export interface SimulationTimelineContext {
  /** ISO date string (YYYY-MM-DD) */
  startDate: string;
  /** Phase types in order (DEPOSIT/PASSIVE/WITHDRAW). */
  phaseTypes: PhaseRequest['phaseType'][];
  /** Phase durations in months, in the order entered */
  phaseDurationsInMonths: number[];
  /** Initial deposits per phase (only meaningful for DEPOSIT phases). UI-only helper. */
  phaseInitialDeposits?: Array<number | undefined>;
  /** Used as the start anchor for Phase #1 interpolation when no previous year exists. */
  firstPhaseInitialDeposit?: number;
  /** UI-only: yearly inflation factor used for this run (e.g. 1.02). */
  inflationFactorPerYear?: number;
}