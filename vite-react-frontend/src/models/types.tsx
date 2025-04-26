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
  returnPercentage: number;
  phases: PhaseRequest[];
}