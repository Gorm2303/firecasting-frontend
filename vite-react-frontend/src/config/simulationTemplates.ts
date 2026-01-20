import type { PhaseRequest, SimulationRequest } from '../models/types';
import { createDefaultSimulationRequest, normalizePhase } from './simulationDefaults';

export type SimulationTemplateId = 'custom' | 'late-starter';

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
    id: 'late-starter',
    label: 'Late starter',
    description: 'Starts later with higher monthly deposits to compensate. You can tweak any value after applying.',
    patch: {
      startDate: { date: '2040-01-01' },
      phases: [
        // Deposit hard for 15 years
        {
          phaseType: 'DEPOSIT',
          durationInMonths: 15 * 12,
          initialDeposit: 5000,
          monthlyDeposit: 20000,
          yearlyIncreaseInPercentage: 2,
        },
        // Then withdraw for 30 years
        {
          phaseType: 'WITHDRAW',
          durationInMonths: 30 * 12,
          withdrawAmount: 25000,
          lowerVariationPercentage: 0,
          upperVariationPercentage: 0,
        },
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
