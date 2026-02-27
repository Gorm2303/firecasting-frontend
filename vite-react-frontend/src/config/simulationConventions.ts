import { requireConventionToken } from '../state/conventionsRegistry';

export const SIMULATION_TIMING_CONVENTIONS = {
  simulationStep: requireConventionToken('timing.simulationStep'),
  initialDeposit: requireConventionToken('timing.initialDeposit'),
  monthlyDeposit: requireConventionToken('timing.monthlyDeposit'),
  yearlyDepositIncrease: requireConventionToken('timing.yearlyDepositIncrease'),
  inflationCompounds: requireConventionToken('timing.inflationCompounds'),
  capitalGainsTaxApplied: requireConventionToken('timing.capitalGainsTaxApplied'),
  notionalGainsTaxApplied: requireConventionToken('timing.notionalGainsTaxApplied'),
} as const;

