import type { PhaseRequest, SimulationRequest } from '../models/types';

type OverallTaxRule = SimulationRequest['overallTaxRule'];

type PhaseType = PhaseRequest['phaseType'];

type NormalizedPhaseInput = Partial<Omit<PhaseRequest, 'phaseType'>> & {
  phaseType: PhaseType;
};

export const DEFAULT_START_DATE = '2025-01-01';
export const DEFAULT_OVERALL_TAX_RULE: OverallTaxRule = 'CAPITAL';
export const DEFAULT_TAX_PERCENTAGE = 42;

export const DEFAULT_DEPOSIT_PHASE: Readonly<Required<Pick<PhaseRequest, 'phaseType' | 'taxRules'>> &
  Pick<PhaseRequest, 'durationInMonths' | 'initialDeposit' | 'monthlyDeposit' | 'yearlyIncreaseInPercentage'>> = {
  phaseType: 'DEPOSIT',
  durationInMonths: 20 * 12,
  initialDeposit: 10000,
  monthlyDeposit: 10000,
  yearlyIncreaseInPercentage: 2,
  taxRules: [],
};

export const DEFAULT_WITHDRAW_PHASE: Readonly<Required<Pick<PhaseRequest, 'phaseType' | 'taxRules'>> &
  Pick<PhaseRequest, 'durationInMonths' | 'withdrawRate' | 'withdrawAmount' | 'lowerVariationPercentage' | 'upperVariationPercentage'>> = {
  phaseType: 'WITHDRAW',
  durationInMonths: 20 * 12,
  withdrawRate: 0,
  withdrawAmount: 10000,
  lowerVariationPercentage: 0,
  upperVariationPercentage: 0,
  taxRules: [],
};

export const DEFAULT_PASSIVE_PHASE: Readonly<Required<Pick<PhaseRequest, 'phaseType' | 'taxRules'>> &
  Pick<PhaseRequest, 'durationInMonths'>> = {
  phaseType: 'PASSIVE',
  durationInMonths: 20 * 12,
  taxRules: [],
};

export function createDefaultPhase(phaseType: PhaseType): PhaseRequest {
  if (phaseType === 'DEPOSIT') return { ...DEFAULT_DEPOSIT_PHASE };
  if (phaseType === 'WITHDRAW') return { ...DEFAULT_WITHDRAW_PHASE };
  return { ...DEFAULT_PASSIVE_PHASE };
}

export function normalizePhase(phase: NormalizedPhaseInput): PhaseRequest {
  const base = createDefaultPhase(phase.phaseType);
  const merged: PhaseRequest = {
    ...base,
    ...phase,
    taxRules: phase.taxRules ?? base.taxRules ?? [],
  };

  if (merged.phaseType === 'DEPOSIT') {
    merged.initialDeposit = merged.initialDeposit ?? DEFAULT_DEPOSIT_PHASE.initialDeposit;
    merged.monthlyDeposit = merged.monthlyDeposit ?? DEFAULT_DEPOSIT_PHASE.monthlyDeposit;
    merged.yearlyIncreaseInPercentage = merged.yearlyIncreaseInPercentage ?? DEFAULT_DEPOSIT_PHASE.yearlyIncreaseInPercentage;
    merged.withdrawRate = undefined;
    merged.withdrawAmount = undefined;
    merged.lowerVariationPercentage = undefined;
    merged.upperVariationPercentage = undefined;
  }

  if (merged.phaseType === 'WITHDRAW') {
    merged.lowerVariationPercentage = merged.lowerVariationPercentage ?? DEFAULT_WITHDRAW_PHASE.lowerVariationPercentage;
    merged.upperVariationPercentage = merged.upperVariationPercentage ?? DEFAULT_WITHDRAW_PHASE.upperVariationPercentage;

    const hasRate = typeof phase.withdrawRate === 'number';
    const hasAmount = typeof phase.withdrawAmount === 'number';

    if (hasRate && !hasAmount) {
      merged.withdrawAmount = 0;
    } else if (hasAmount && !hasRate) {
      merged.withdrawRate = 0;
    } else if (!hasAmount && !hasRate) {
      merged.withdrawAmount = DEFAULT_WITHDRAW_PHASE.withdrawAmount;
      merged.withdrawRate = 0;
    }

    merged.initialDeposit = undefined;
    merged.monthlyDeposit = undefined;
    merged.yearlyIncreaseInPercentage = undefined;
  }

  if (merged.phaseType === 'PASSIVE') {
    merged.initialDeposit = undefined;
    merged.monthlyDeposit = undefined;
    merged.yearlyIncreaseInPercentage = undefined;
    merged.withdrawRate = undefined;
    merged.withdrawAmount = undefined;
    merged.lowerVariationPercentage = undefined;
    merged.upperVariationPercentage = undefined;
  }

  return merged;
}

export function createDefaultSimulationRequest(): SimulationRequest {
  return {
    startDate: { date: DEFAULT_START_DATE },
    overallTaxRule: DEFAULT_OVERALL_TAX_RULE,
    taxPercentage: DEFAULT_TAX_PERCENTAGE,
    phases: [],
  };
}
