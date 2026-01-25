import type { SimulationRequest } from './types';

// Shared request shape for the backend `/start-advanced` endpoint.
// Keep this in `models/` so UI, API, and scenario storage all agree.
export type AdvancedSimulationRequest = {
  /** Optional override for how many Monte Carlo paths/runs to execute (max 100000). */
  paths?: number;
  /** Optional override for the engine batch size (max 100000). */
  batchSize?: number;

  startDate: { date: string };
  phases: SimulationRequest['phases'];
  overallTaxRule: string;
  taxPercentage: number;

  // Optional to allow clients to omit when UI sections are disabled/hidden.
  // Backend defaults to dataDrivenReturn when missing/blank.
  returnType?: string;

  /**
   * Master seed contract:
   * - null/undefined => backend uses default deterministic seed
   * - negative => random seed each run (stochastic; not persisted)
   * - positive => deterministic custom seed
   */
  seed?: number;

  returnerConfig?: {
    seed?: number;
    simpleAveragePercentage?: number;
    distribution?: {
      type?: string;
      normal?: { mean?: number; standardDeviation?: number };
      brownianMotion?: { drift?: number; volatility?: number };
      studentT?: { mu?: number; sigma?: number; nu?: number };
      regimeBased?: {
        tickMonths?: number;
        regimes?: Array<{
          distributionType?: string;
          expectedDurationMonths?: number;
          switchWeights?: { toRegime0?: number; toRegime1?: number; toRegime2?: number };
          normal?: { mean?: number; standardDeviation?: number };
          studentT?: { mu?: number; sigma?: number; nu?: number };
        }>;
      };
    };
  };

  taxExemptionConfig?: {
    exemptionCard?: { limit?: number; yearlyIncrease?: number };
    stockExemption?: { taxRate?: number; limit?: number; yearlyIncrease?: number };
  };

  // Optional to allow omitting when UI sections are disabled/hidden.
  // Backend defaults to 1.02 when missing/<=0.
  inflationFactor?: number;

  // Optional: yearly fee percent charged on capital at year-end (e.g. 0.5 = 0.5% per year).
  // Backend defaults to 0 when missing/invalid.
  yearlyFeePercentage?: number;
};

export type MasterSeedMode = 'default' | 'custom' | 'random';

const DEFAULT_MASTER_SEED = 1;

export function getRequestedSeed(req: AdvancedSimulationRequest | undefined | null): number | undefined {
  if (!req) return undefined;
  const seed = req.seed ?? req.returnerConfig?.seed;
  return typeof seed === 'number' && Number.isFinite(seed) ? seed : undefined;
}

export function inferMasterSeedMode(seed: number | undefined): MasterSeedMode {
  if (seed === undefined) return 'default';
  if (seed < 0) return 'random';
  return 'custom';
}

export function seedForMode(mode: MasterSeedMode, customSeed?: number): number {
  if (mode === 'random') return -1;
  if (mode === 'custom') {
    const s = typeof customSeed === 'number' && Number.isFinite(customSeed) ? Math.trunc(customSeed) : DEFAULT_MASTER_SEED;
    return Math.max(1, s);
  }
  return DEFAULT_MASTER_SEED;
}

export function normalToAdvancedWithDefaults(req: SimulationRequest): AdvancedSimulationRequest {
  // Tax exemption frontend defaults (mirror backend defaults)
  const taxExemptionConfig = {
    exemptionCard: { limit: 51600, yearlyIncrease: 1000 },
    stockExemption: { taxRate: 27, limit: 67500, yearlyIncrease: 1000 },
  };

  const seed = typeof req.seed === 'number' && Number.isFinite(req.seed) ? req.seed : undefined;
  const returnerConfig = seed !== undefined ? { seed } : undefined;

  return {
    startDate: req.startDate,
    phases: req.phases,
    overallTaxRule: req.overallTaxRule,
    taxPercentage: req.taxPercentage,
    returnType: 'dataDrivenReturn',
    ...(seed !== undefined ? { seed } : {}),
    ...(returnerConfig ? { returnerConfig } : {}),
    taxExemptionConfig,
    inflationFactor: 1.02,
    yearlyFeePercentage: 0.5,
  };
}

export function advancedToNormalRequest(req: AdvancedSimulationRequest): SimulationRequest {
  const seed = getRequestedSeed(req);
  return {
    startDate: req.startDate,
    phases: (req.phases ?? []).map((p) => ({ ...p, taxRules: p.taxRules ?? [] })),
    overallTaxRule: req.overallTaxRule as SimulationRequest['overallTaxRule'],
    taxPercentage: req.taxPercentage,
    ...(seed !== undefined ? { seed } : {}),
  };
}
