/**
 * Utility functions for loading scenario data into forms.
 * 
 * This module handles the conversion between scenario data formats
 * (from ExplorePage) and form input formats (for NormalInputForm and AdvancedInputForm).
 */

import { PhaseRequest } from '../models/types';

/**
 * PhaseInput type from ExplorePage scenarios
 */
export type PhaseInput = {
  type: 'DEPOSIT' | 'PASSIVE' | 'WITHDRAW';
  durationInMonths: number;
  // DEPOSIT fields
  initialDeposit?: number;
  monthlyDeposit?: number;
  yearlyIncreasePercent?: number;
  // WITHDRAW fields
  withdrawAmount?: number;
  lowerVariationPercent?: number;
  upperVariationPercent?: number;
  // Shared
  taxRules?: ('EXEMPTIONCARD' | 'STOCKEXEMPTION')[];
};

/**
 * SimulationInputs type from ExplorePage scenarios
 */
export type SimulationInputs = {
  startDate: string; // ISO yyyy-mm-dd
  overallTaxRule: 'CAPITAL' | 'NOTIONAL';
  taxPercentage: number;
  phases: PhaseInput[];
};

/**
 * Converts a PhaseInput (from scenario) to PhaseRequest (for form submission).
 * 
 * Handles field name differences:
 * - type -> phaseType
 * - yearlyIncreasePercent -> yearlyIncreaseInPercentage
 * - lowerVariationPercent -> lowerVariationPercentage
 * - upperVariationPercent -> upperVariationPercentage
 * 
 * @param phaseInput - Phase data from scenario
 * @returns PhaseRequest compatible with form submission
 */
export function convertPhaseInputToPhaseRequest(phaseInput: PhaseInput): PhaseRequest {
  const phase: PhaseRequest = {
    phaseType: phaseInput.type,
    durationInMonths: phaseInput.durationInMonths,
    taxRules: phaseInput.taxRules || [],
  };

  // DEPOSIT-specific fields
  if (phaseInput.type === 'DEPOSIT') {
    if (phaseInput.initialDeposit !== undefined) {
      phase.initialDeposit = phaseInput.initialDeposit;
    }
    if (phaseInput.monthlyDeposit !== undefined) {
      phase.monthlyDeposit = phaseInput.monthlyDeposit;
    }
    if (phaseInput.yearlyIncreasePercent !== undefined) {
      phase.yearlyIncreaseInPercentage = phaseInput.yearlyIncreasePercent;
    }
  }

  // WITHDRAW-specific fields
  if (phaseInput.type === 'WITHDRAW') {
    if (phaseInput.withdrawAmount !== undefined) {
      phase.withdrawAmount = phaseInput.withdrawAmount;
    }
    if (phaseInput.lowerVariationPercent !== undefined) {
      phase.lowerVariationPercentage = phaseInput.lowerVariationPercent;
    }
    if (phaseInput.upperVariationPercent !== undefined) {
      phase.upperVariationPercentage = phaseInput.upperVariationPercent;
    }
  }

  return phase;
}

/**
 * Converts SimulationInputs (from scenario) to initial data for NormalInputForm.
 * 
 * @param inputs - Scenario input data
 * @returns Initial form data for NormalInputForm
 */
export function convertToNormalFormData(inputs: SimulationInputs) {
  return {
    startDate: inputs.startDate,
    overallTaxRule: inputs.overallTaxRule,
    taxPercentage: inputs.taxPercentage,
    phases: inputs.phases.map(convertPhaseInputToPhaseRequest),
  };
}

/**
 * Converts SimulationInputs (from scenario) to initial data for AdvancedInputForm.
 * 
 * Note: AdvancedInputForm uses a dynamic form config from the backend, so we
 * map the scenario data to the expected form structure.
 * 
 * @param inputs - Scenario input data
 * @returns Initial form data for AdvancedInputForm
 */
export function convertToAdvancedFormData(inputs: SimulationInputs) {
  return {
    startDate: inputs.startDate,
    taxRule: inputs.overallTaxRule.toLowerCase(), // Advanced form expects lowercase
    tax: {
      percentage: inputs.taxPercentage,
    },
    phases: inputs.phases.map((p) => ({
      phaseType: p.type,
      durationInMonths: p.durationInMonths,
      initialDeposit: p.initialDeposit,
      monthlyDeposit: p.monthlyDeposit,
      yearlyIncreaseInPercentage: p.yearlyIncreasePercent,
      withdrawAmount: p.withdrawAmount,
      lowerVariationPercentage: p.lowerVariationPercent,
      upperVariationPercentage: p.upperVariationPercent,
      taxExemptions: p.taxRules?.length
        ? p.taxRules.length === 2
          ? 'BOTH'
          : p.taxRules[0]
        : undefined,
    })),
  };
}

