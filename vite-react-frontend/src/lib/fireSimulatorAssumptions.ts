import {
  DEFAULT_OVERALL_TAX_RULE,
  DEFAULT_TAX_PERCENTAGE,
  normalizePhase,
} from '../config/simulationDefaults';
import {
  getTemplateById,
  resolveTemplateToRequest,
  type SimulationTemplateId,
} from '../config/simulationTemplates';
import {
  normalToAdvancedWithDefaults,
  seedForMode,
  type AdvancedSimulationRequest,
} from '../models/advancedSimulation';
import type { PhaseRequest, SimulationRequest, SimulationTimelineContext } from '../models/types';
import type { Assumptions } from '../state/assumptions';
import type { ExecutionDefaults } from '../state/executionDefaults';

export type FireSimulatorReturnType = 'dataDrivenReturn' | 'distributionReturn' | 'simpleReturn';

export type FireSimulatorDistributionType = 'normal' | 'brownianMotion' | 'studentT' | 'regimeBased';

export type FireSimulatorRegimeDistributionType = 'normal' | 'studentT';

export type FireSimulatorRegime = {
  distributionType: FireSimulatorRegimeDistributionType;
  expectedDurationMonths: number;
  switchWeights: {
    toRegime0: number;
    toRegime1: number;
    toRegime2: number;
  };
  normalMean: number;
  normalStdDev: number;
  studentMu: number;
  studentSigma: number;
  studentNu: number;
};

export type FireSimulatorReturnEngine = {
  returnType: FireSimulatorReturnType;
  simpleAveragePercentage: number;
  distributionType: FireSimulatorDistributionType;
  normalMean: number;
  normalStdDev: number;
  brownianDrift: number;
  brownianVolatility: number;
  studentMu: number;
  studentSigma: number;
  studentNu: number;
  regimeTickMonths: number;
  regimes: FireSimulatorRegime[];
};

export type FireSimulatorDefaults = {
  templateId: SimulationTemplateId;
  startDate: string;
  overallTaxRule: SimulationRequest['overallTaxRule'];
  taxPercentage: number;
  returnEngine: FireSimulatorReturnEngine;
  phases: PhaseRequest[];
};

const DEFAULT_RETURN_ENGINE_REGIMES: FireSimulatorRegime[] = [
  {
    distributionType: 'normal',
    expectedDurationMonths: 12,
    switchWeights: { toRegime0: 0, toRegime1: 1, toRegime2: 1 },
    normalMean: 0.07,
    normalStdDev: 0.2,
    studentMu: 0.042,
    studentSigma: 0.609,
    studentNu: 3.6,
  },
  {
    distributionType: 'normal',
    expectedDurationMonths: 12,
    switchWeights: { toRegime0: 1, toRegime1: 0, toRegime2: 1 },
    normalMean: 0.07,
    normalStdDev: 0.2,
    studentMu: 0.042,
    studentSigma: 0.609,
    studentNu: 3.6,
  },
  {
    distributionType: 'normal',
    expectedDurationMonths: 12,
    switchWeights: { toRegime0: 1, toRegime1: 1, toRegime2: 0 },
    normalMean: 0.07,
    normalStdDev: 0.2,
    studentMu: 0.042,
    studentSigma: 0.609,
    studentNu: 3.6,
  },
];

export const DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE: FireSimulatorReturnEngine = {
  returnType: 'dataDrivenReturn',
  simpleAveragePercentage: 7,
  distributionType: 'normal',
  normalMean: 0.07,
  normalStdDev: 0.2,
  brownianDrift: 0.07,
  brownianVolatility: 0.2,
  studentMu: 0.042,
  studentSigma: 0.609,
  studentNu: 3.6,
  regimeTickMonths: 1,
  regimes: DEFAULT_RETURN_ENGINE_REGIMES,
};

export const DEFAULT_FIRE_SIMULATOR_DEFAULTS: FireSimulatorDefaults = {
  templateId: 'custom',
  startDate: '2026-01-01',
  overallTaxRule: DEFAULT_OVERALL_TAX_RULE,
  taxPercentage: DEFAULT_TAX_PERCENTAGE,
  returnEngine: DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE,
  phases: [],
};

const asNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asOverallTaxRule = (
  value: unknown,
  fallback: SimulationRequest['overallTaxRule']
): SimulationRequest['overallTaxRule'] => (value === 'NOTIONAL' || value === 'CAPITAL' ? value : fallback);

const asReturnType = (value: unknown, fallback: FireSimulatorReturnType): FireSimulatorReturnType => {
  return value === 'distributionReturn' || value === 'simpleReturn' || value === 'dataDrivenReturn' ? value : fallback;
};

const asDistributionType = (
  value: unknown,
  fallback: FireSimulatorDistributionType
): FireSimulatorDistributionType => {
  return value === 'normal' || value === 'brownianMotion' || value === 'studentT' || value === 'regimeBased'
    ? value
    : fallback;
};

const asRegimeDistributionType = (
  value: unknown,
  fallback: FireSimulatorRegimeDistributionType
): FireSimulatorRegimeDistributionType => {
  return value === 'studentT' || value === 'normal' ? value : fallback;
};

const asTemplateId = (value: unknown, fallback: SimulationTemplateId): SimulationTemplateId => {
  return value === 'starter' || value === 'custom' || value === 'aktiesparekonto' || value === 'aktiedepot' || value === 'pension' || value === 'childSavings'
    ? value
    : fallback;
};

const asStartDate = (value: unknown, fallback: string): string => {
  return typeof value === 'string' && value.trim() ? value : fallback;
};

export const normalizeFireSimulatorPhases = (raw: unknown): PhaseRequest[] => {
  if (!Array.isArray(raw)) return [...DEFAULT_FIRE_SIMULATOR_DEFAULTS.phases];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      const phaseType = candidate.phaseType;
      if (phaseType !== 'DEPOSIT' && phaseType !== 'PASSIVE' && phaseType !== 'WITHDRAW') return null;
      return normalizePhase(candidate as Partial<PhaseRequest> & { phaseType: PhaseRequest['phaseType'] });
    })
    .filter((phase): phase is PhaseRequest => Boolean(phase));
};

const cloneDefaultRegimes = (): FireSimulatorRegime[] => {
  return DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.regimes.map((regime) => ({
    ...regime,
    switchWeights: { ...regime.switchWeights },
  }));
};

const normalizeReturnEngineRegimes = (raw: unknown): FireSimulatorRegime[] => {
  if (!Array.isArray(raw)) return cloneDefaultRegimes();

  return raw.map((entry, index) => {
    const source = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const fallback = DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.regimes[index] ?? DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.regimes[0];
    const switchWeights = source.switchWeights && typeof source.switchWeights === 'object'
      ? (source.switchWeights as Record<string, unknown>)
      : {};

    return {
      distributionType: asRegimeDistributionType(source.distributionType, fallback.distributionType),
      expectedDurationMonths: asNumber(source.expectedDurationMonths, fallback.expectedDurationMonths),
      switchWeights: {
        toRegime0: asNumber(switchWeights.toRegime0, fallback.switchWeights.toRegime0),
        toRegime1: asNumber(switchWeights.toRegime1, fallback.switchWeights.toRegime1),
        toRegime2: asNumber(switchWeights.toRegime2, fallback.switchWeights.toRegime2),
      },
      normalMean: asNumber(source.normalMean, fallback.normalMean),
      normalStdDev: asNumber(source.normalStdDev, fallback.normalStdDev),
      studentMu: asNumber(source.studentMu, fallback.studentMu),
      studentSigma: asNumber(source.studentSigma, fallback.studentSigma),
      studentNu: asNumber(source.studentNu, fallback.studentNu),
    };
  });
};

export const normalizeFireSimulatorReturnEngine = (raw: unknown, legacyReturnType?: unknown): FireSimulatorReturnEngine => {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    returnType: asReturnType(source.returnType ?? legacyReturnType, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.returnType),
    simpleAveragePercentage: asNumber(source.simpleAveragePercentage, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.simpleAveragePercentage),
    distributionType: asDistributionType(source.distributionType, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.distributionType),
    normalMean: asNumber(source.normalMean, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.normalMean),
    normalStdDev: asNumber(source.normalStdDev, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.normalStdDev),
    brownianDrift: asNumber(source.brownianDrift, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.brownianDrift),
    brownianVolatility: asNumber(source.brownianVolatility, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.brownianVolatility),
    studentMu: asNumber(source.studentMu, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.studentMu),
    studentSigma: asNumber(source.studentSigma, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.studentSigma),
    studentNu: asNumber(source.studentNu, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.studentNu),
    regimeTickMonths: asNumber(source.regimeTickMonths, DEFAULT_FIRE_SIMULATOR_RETURN_ENGINE.regimeTickMonths),
    regimes: normalizeReturnEngineRegimes(source.regimes),
  };
};

export const normalizeFireSimulatorDefaults = (raw: unknown): FireSimulatorDefaults => {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    templateId: asTemplateId(source.templateId, DEFAULT_FIRE_SIMULATOR_DEFAULTS.templateId),
    startDate: asStartDate(source.startDate, DEFAULT_FIRE_SIMULATOR_DEFAULTS.startDate),
    overallTaxRule: asOverallTaxRule(source.overallTaxRule, DEFAULT_FIRE_SIMULATOR_DEFAULTS.overallTaxRule),
    taxPercentage: asNumber(source.taxPercentage, DEFAULT_FIRE_SIMULATOR_DEFAULTS.taxPercentage),
    returnEngine: normalizeFireSimulatorReturnEngine(source.returnEngine, source.returnType),
    phases: normalizeFireSimulatorPhases(source.phases),
  };
};

export const applyFireSimulatorTemplate = (
  current: FireSimulatorDefaults,
  templateId: SimulationTemplateId
): FireSimulatorDefaults => {
  if (templateId === 'custom') return { ...current, templateId };

  const resolved = resolveTemplateToRequest(getTemplateById(templateId));

  return {
    ...current,
    templateId,
    startDate: resolved.startDate.date,
    overallTaxRule: resolved.overallTaxRule,
    taxPercentage: resolved.taxPercentage,
    phases: resolved.phases.map((phase) => normalizePhase(phase)),
  };
};

export const buildSimulationRequestFromAssumptions = (
  assumptions: Pick<Assumptions, 'fireSimulatorDefaults'>
): SimulationRequest => ({
  startDate: { date: assumptions.fireSimulatorDefaults.startDate },
  overallTaxRule: assumptions.fireSimulatorDefaults.overallTaxRule,
  taxPercentage: assumptions.fireSimulatorDefaults.taxPercentage,
  phases: assumptions.fireSimulatorDefaults.phases.map((phase) => normalizePhase(phase)),
});

export const buildSimulationTimelineFromRequest = (
  request: SimulationRequest,
  inflationPct?: number
): SimulationTimelineContext => ({
  startDate: request.startDate.date,
  phaseTypes: request.phases.map((phase) => phase.phaseType),
  phaseDurationsInMonths: request.phases.map((phase) => Number(phase.durationInMonths) || 0),
  phaseInitialDeposits: request.phases.map((phase) =>
    phase.initialDeposit === undefined ? undefined : Number(phase.initialDeposit)
  ),
  firstPhaseInitialDeposit:
    request.phases[0]?.initialDeposit === undefined ? undefined : Number(request.phases[0].initialDeposit),
  inflationFactorPerYear:
    typeof inflationPct === 'number' && Number.isFinite(inflationPct) ? 1 + inflationPct / 100 : undefined,
});

export const buildAdvancedSimulationRequestFromAssumptions = (
  assumptions: Pick<Assumptions, 'fireSimulatorDefaults' | 'inflationPct' | 'yearlyFeePct' | 'taxExemptionDefaults'>,
  executionDefaults: ExecutionDefaults
): AdvancedSimulationRequest => {
  const normalRequest = buildSimulationRequestFromAssumptions(assumptions as Pick<Assumptions, 'fireSimulatorDefaults'>);
  const seed = seedForMode(executionDefaults.seedMode, executionDefaults.customSeed);
  const { returnEngine } = assumptions.fireSimulatorDefaults;
  const advanced = normalToAdvancedWithDefaults({ ...normalRequest, seed }, {
    inflationPct: assumptions.inflationPct,
    yearlyFeePct: assumptions.yearlyFeePct,
    returnType: returnEngine.returnType,
    taxExemptionDefaults: {
      exemptionCardLimit: assumptions.taxExemptionDefaults.exemptionCardLimit,
      exemptionCardYearlyIncrease: assumptions.taxExemptionDefaults.exemptionCardYearlyIncrease,
      stockExemptionTaxRate: assumptions.taxExemptionDefaults.stockExemptionTaxRate,
      stockExemptionLimit: assumptions.taxExemptionDefaults.stockExemptionLimit,
      stockExemptionYearlyIncrease: assumptions.taxExemptionDefaults.stockExemptionYearlyIncrease,
    },
  });

  const returnerConfig: AdvancedSimulationRequest['returnerConfig'] = { seed };
  if (returnEngine.returnType === 'simpleReturn') {
    returnerConfig.simpleAveragePercentage = returnEngine.simpleAveragePercentage;
  }
  if (returnEngine.returnType === 'distributionReturn') {
    returnerConfig.distribution = { type: returnEngine.distributionType };
    if (returnEngine.distributionType === 'normal') {
      returnerConfig.distribution.normal = {
        mean: returnEngine.normalMean,
        standardDeviation: returnEngine.normalStdDev,
      };
    } else if (returnEngine.distributionType === 'brownianMotion') {
      returnerConfig.distribution.brownianMotion = {
        drift: returnEngine.brownianDrift,
        volatility: returnEngine.brownianVolatility,
      };
    } else if (returnEngine.distributionType === 'studentT') {
      returnerConfig.distribution.studentT = {
        mu: returnEngine.studentMu,
        sigma: returnEngine.studentSigma,
        nu: returnEngine.studentNu,
      };
    } else if (returnEngine.distributionType === 'regimeBased') {
      returnerConfig.distribution.regimeBased = {
        tickMonths: returnEngine.regimeTickMonths,
        regimes: returnEngine.regimes.map((regime) => ({
          distributionType: regime.distributionType,
          expectedDurationMonths: regime.expectedDurationMonths,
          switchWeights: { ...regime.switchWeights },
          ...(regime.distributionType === 'studentT'
            ? {
                studentT: {
                  mu: regime.studentMu,
                  sigma: regime.studentSigma,
                  nu: regime.studentNu,
                },
              }
            : {
                normal: {
                  mean: regime.normalMean,
                  standardDeviation: regime.normalStdDev,
                },
              }),
        })),
      };
    }
  }

  return {
    ...advanced,
    returnType: returnEngine.returnType,
    returnerConfig,
    paths: executionDefaults.paths,
    batchSize: executionDefaults.batchSize,
  };
};
