import type { SimulationRequest } from '../models/types';
import type { AdvancedSimulationRequest } from '../models/advancedSimulation';
import { advancedToNormalRequest, normalToAdvancedWithDefaults } from '../models/advancedSimulation';
import { loadCurrentAssumptionsFromStorage, type AssumptionsOverride } from '../state/assumptions';
import { normalizeTaxRules } from '../utils/taxRules';

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isRandomSeedRequested(req: AdvancedSimulationRequest | null | undefined): boolean {
  if (!req) return false;
  const seed = (req as any)?.seed ?? (req as any)?.returnerConfig?.seed;
  return isFiniteNumber(seed) ? seed < 0 : Number(seed) < 0;
}

export function generateFixedSeed(): number {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    c.getRandomValues(arr);
    // Keep within signed 32-bit range for safety across systems.
    return 1 + (arr[0] % 2_147_483_647);
  }
  // Fallback: not cryptographically strong, but stable enough for non-security use.
  return 1 + Math.floor(Math.random() * 2_147_483_647);
}

export function withPinnedSeed(req: AdvancedSimulationRequest, seed: number): AdvancedSimulationRequest {
  const pinned = Math.max(1, Math.trunc(seed));
  return {
    ...req,
    seed: pinned,
    returnerConfig: {
      ...(req.returnerConfig ?? {}),
      seed: pinned,
    },
  };
}

/**
 * Converts a random-seed request (seed < 0) into a fixed deterministic seed.
 * Preference order: preferredSeed (if > 0) else a newly generated seed.
 */
export function materializeRandomSeedIfNeeded(
  req: AdvancedSimulationRequest,
  preferredSeed?: number | null
): AdvancedSimulationRequest {
  if (!isRandomSeedRequested(req)) return req;
  const candidate = isFiniteNumber(preferredSeed) && preferredSeed > 0 ? Math.trunc(preferredSeed) : generateFixedSeed();
  return withPinnedSeed(req, candidate);
}

export type SavedScenario = {
  id: string;
  name: string;
  savedAt: string;
  /** Optional per-scenario overlay on top of the current baseline assumptions.
   * Used to model scenario-specific world-model tweaks without mutating the global baseline.
   */
  assumptionsOverride?: AssumptionsOverride | null;
  /** Canonical scenario footprint used for reruns/diff and to match backend persistence. */
  advancedRequest: AdvancedSimulationRequest;
  /** Backward-compatible subset for older UI flows / share links. */
  request?: SimulationRequest;
  runId?: string | null;
  /** Best-effort metadata from the last execution started from this scenario (may be non-persisted). */
  lastRunMeta?: {
    id: string;
    createdAt?: string;
    rngSeed?: number | null;
    /** String form to avoid JS number precision loss (preferred when present). */
    rngSeedText?: string | null;
    modelAppVersion?: string | null;
    modelBuildTime?: string | null;
    modelSpringBootVersion?: string | null;
    modelJavaVersion?: string | null;
  };
};

const STORAGE_KEY = 'firecasting:savedScenarios:v2';

function newId(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function toArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeAdvancedRequestTaxRules(req: AdvancedSimulationRequest): AdvancedSimulationRequest {
  const originalPhases: any[] = Array.isArray((req as any).phases) ? ((req as any).phases as any[]) : [];

  let changed = false;
  const phases = originalPhases.map((p: any) => {
    const normalized = normalizeTaxRules(p?.taxRules);
    const current = Array.isArray(p?.taxRules) ? (p.taxRules as any[]) : [];
    const same = current.length === normalized.length && current.every((x, i) => x === normalized[i]);
    if (same) return p;
    changed = true;
    return { ...p, taxRules: normalized };
  });

  if (!changed) return req;
  return { ...req, phases };
}

export function listSavedScenarios(): SavedScenario[] {
  if (typeof window === 'undefined') return [];
  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY));

  const v2Raw = toArray(raw)
    .map((x) => x as SavedScenario)
    .filter((x) => !!x && typeof x.id === 'string' && typeof x.name === 'string' && !!x.advancedRequest);

  if (v2Raw.length > 0) {
    let changed = false;
    const v2 = v2Raw.map((s) => {
      const normalizedAdvanced = normalizeAdvancedRequestTaxRules(s.advancedRequest);
      if (normalizedAdvanced !== s.advancedRequest) changed = true;
      const normalizedRequest = advancedToNormalRequest(normalizedAdvanced);
      return {
        ...s,
        advancedRequest: normalizedAdvanced,
        request: normalizedRequest,
      };
    });

    if (changed) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v2));
    }

    return v2;
  }

  // Backward-compat: migrate v1 entries stored under the old key.
  const rawV1 = safeParse(window.localStorage.getItem('firecasting:savedScenarios:v1'));
  const v1 = toArray(rawV1)
    .map((x) => x as any)
    .filter((x) => !!x && typeof x.id === 'string' && typeof x.name === 'string' && !!x.request);

  const migrated: SavedScenario[] = v1.map((s) => {
    const normalReq = s.request as SimulationRequest;
    const assumptions = loadCurrentAssumptionsFromStorage();
    const advancedRequest = normalToAdvancedWithDefaults(normalReq, {
      inflationPct: assumptions.inflationPct,
      yearlyFeePct: assumptions.yearlyFeePct,
      taxExemptionDefaults: {
        exemptionCardLimit: assumptions.taxExemptionDefaults.exemptionCardLimit,
        exemptionCardYearlyIncrease: assumptions.taxExemptionDefaults.exemptionCardYearlyIncrease,
        stockExemptionTaxRate: assumptions.taxExemptionDefaults.stockExemptionTaxRate,
        stockExemptionLimit: assumptions.taxExemptionDefaults.stockExemptionLimit,
        stockExemptionYearlyIncrease: assumptions.taxExemptionDefaults.stockExemptionYearlyIncrease,
      },
    });
    return {
      id: String(s.id),
      name: String(s.name),
      savedAt: String(s.savedAt ?? new Date().toISOString()),
      advancedRequest: normalizeAdvancedRequestTaxRules(advancedRequest),
      request: normalReq,
      runId: s.runId ?? undefined,
    };
  });

  if (migrated.length > 0) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }

  return migrated;
}

export function saveScenario(
  name: string,
  advancedRequest: AdvancedSimulationRequest,
  id?: string,
  runId?: string | null,
  lastRunMeta?: SavedScenario['lastRunMeta'],
  assumptionsOverride?: SavedScenario['assumptionsOverride']
): SavedScenario {
  if (typeof window === 'undefined') throw new Error('Cannot save scenario outside browser');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Scenario name is required');

  const scenarios = listSavedScenarios();
  const now = new Date().toISOString();

  const normalizedAdvanced = normalizeAdvancedRequestTaxRules(advancedRequest);

  const scenario: SavedScenario = {
    id: id ?? newId(),
    name: trimmed,
    savedAt: now,
    ...(assumptionsOverride !== undefined ? { assumptionsOverride } : {}),
    advancedRequest: normalizedAdvanced,
    request: advancedToNormalRequest(normalizedAdvanced),
    runId: runId ?? undefined,
    ...(lastRunMeta ? { lastRunMeta } : {}),
  };

  const withoutSameId = scenarios.filter((s) => s.id !== scenario.id);
  const next = [scenario, ...withoutSameId].slice(0, 50);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return scenario;
}

export function updateScenarioRunMeta(
  scenarioId: string,
  meta: SavedScenario['lastRunMeta'],
  runId?: string | null
): void {
  if (typeof window === 'undefined') return;
  const scenarios = listSavedScenarios();
  const next = scenarios.map((s) => {
    if (s.id !== scenarioId) return s;
    return {
      ...s,
      ...(runId !== undefined ? { runId } : {}),
      lastRunMeta: meta,
    };
  });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function deleteScenario(id: string): void {
  if (typeof window === 'undefined') return;
  const scenarios = listSavedScenarios();
  const next = scenarios.filter((s) => s.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function findScenarioById(id: string): SavedScenario | undefined {
  return listSavedScenarios().find((s) => s.id === id);
}

export function findScenarioByName(name: string): SavedScenario | undefined {
  const trimmed = name.trim().toLowerCase();
  return listSavedScenarios().find((s) => s.name.trim().toLowerCase() === trimmed);
}
