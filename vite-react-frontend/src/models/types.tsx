export interface PhaseRequest {
  phaseType: 'DEPOSIT' | 'PASSIVE' | 'WITHDRAW';
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
  taxPercentage: number;
  returnPercentage: number;
  phases: PhaseRequest[];
}