import type { PhaseRequest, SimulationRequest } from '../models/types';
import { createDefaultSimulationRequest, normalizePhase } from './simulationDefaults';

export type SimulationTemplateId = 'starter' | 'custom' | 'aktiesparekonto' | 'aktiedepot' | 'pension' | 'childSavings';

export type SimulationTemplate = {
  id: SimulationTemplateId;
  label: string;
  description: string;
  patch?: Partial<Omit<SimulationRequest, 'phases'>> & {
    phases?: Array<Partial<Omit<PhaseRequest, 'phaseType'>> & Pick<PhaseRequest, 'phaseType'>>;
  };
};

export const SIMULATION_TEMPLATES: SimulationTemplate[] = [
  {
    id: 'custom',
    label: 'Custom',
    description: 'Use your own inputs (no preset applied).',
  },
  {
    id: 'starter',
    label: 'Starter',
    description: 'A simple simulation with a 15-year deposit phase.',
    patch: {
      startDate: { date: '2026-01-01' },
      phases: [
        // Deposit for 15 years
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 15 * 12,
          initialDeposit: 5000,
          monthlyDeposit: 5000,
          yearlyIncreaseInPercentage: 2,
        },
      ],
    },
  },
  {
    id: 'aktiesparekonto',
    label: 'Aktiesparekonto',
    description: 'Simulation using the Danish "Aktiesparekonto" tax rules.',
    patch: {
      startDate: { date: '2026-01-01' },
      overallTaxRule: 'NOTIONAL',
      taxPercentage: 17,
      phases: [
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 2 * 12,
          initialDeposit: 0,
          monthlyDeposit: 7250,
          yearlyIncreaseInPercentage: 0,
        },
        {
            phaseType: 'PASSIVE', 
            durationInMonths: 23 * 12 
        },
        {
            phaseType: 'WITHDRAW', 
            durationInMonths: 30 * 12,
            withdrawAmount: 3000,
            lowerVariationPercentage: 0,
            upperVariationPercentage: 0

        }
      ],
    },
  },
    {
    id: 'aktiedepot',
    label: 'Aktiedepot',
    description: 'Simulation using the Danish "Aktiedepot" tax rules for capital gains.',
    patch: {
      startDate: { date: '2026-01-01' },
      overallTaxRule: 'CAPITAL',
      taxPercentage: 42,
      phases: [
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 20 * 12,
          initialDeposit: 5000,
          monthlyDeposit: 5000,
          yearlyIncreaseInPercentage: 2,
        },
        {
            phaseType: 'PASSIVE', 
            durationInMonths: 5 * 12 
        },
        {
            phaseType: 'WITHDRAW', 
            durationInMonths: 30 * 12,
            withdrawAmount: 10000,
            lowerVariationPercentage: 0,
            upperVariationPercentage: 0,
            taxRules: ['EXEMPTIONCARD', 'STOCKEXEMPTION']

        }
      ],
    },
  },
    {
    id: 'pension',
    label: 'Pension (Aldersopsparing)',
    description: 'Simulation using the Danish "Pension (Aldersopsparing)" tax rules.',
    patch: {
      startDate: { date: '2026-01-01' },
      overallTaxRule: 'NOTIONAL',
      taxPercentage: 15.3,
      phases: [
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 30 * 12,
          initialDeposit: 825,
          monthlyDeposit: 825,
          yearlyIncreaseInPercentage: 1.5,
        },
        {
            phaseType: 'PASSIVE', 
            durationInMonths: 15 * 12 
        },
        {
            phaseType: 'WITHDRAW', 
            durationInMonths: 1 * 12,
            withdrawAmount: 100000,
            lowerVariationPercentage: 0,
            upperVariationPercentage: 0,
        }
      ],
    },
  },
    {
    id: 'childSavings',
    label: 'Child Savings (Aktiedepot)',
    description: 'Simulation using the Danish "Aktiedepot" tax rules for capital gains.',
    patch: {
      startDate: { date: '2026-01-01' },
      overallTaxRule: 'CAPITAL',
      taxPercentage: 42,
      phases: [
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 21 * 12,
          initialDeposit: 5000,
          monthlyDeposit: 250,
          yearlyIncreaseInPercentage: 2,
        },
        {
            phaseType: 'WITHDRAW', 
            durationInMonths: 1,
            withdrawAmount: 123000,
            lowerVariationPercentage: 0,
            upperVariationPercentage: 0,
            taxRules: ['EXEMPTIONCARD', 'STOCKEXEMPTION']

        }
      ],
    },
  },
];

export function getTemplateById(id: SimulationTemplateId): SimulationTemplate {
  return SIMULATION_TEMPLATES.find((t) => t.id === id) ?? SIMULATION_TEMPLATES[0];
}

export function resolveTemplateToRequest(template: SimulationTemplate): SimulationRequest {
  const base = createDefaultSimulationRequest();
  if (!template.patch) return base;

  const request: SimulationRequest = {
    ...base,
    ...template.patch,
    startDate: template.patch.startDate ?? base.startDate,
    phases: (template.patch.phases ?? base.phases).map((p) => normalizePhase(p as any)),
  };

  return request;
}
