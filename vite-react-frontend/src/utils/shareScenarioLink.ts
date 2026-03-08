import type { PhaseRequest, SimulationRequest } from '../models/types';
import { createDefaultSimulationRequest, normalizePhase } from '../config/simulationDefaults';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import {
  hasMeaningfulAssumptionsOverride,
  normalizeAssumptionsOverride,
  type AssumptionsOverride,
} from '../state/assumptions';
import type { StrategyProfileAttachments } from '../pages/strategy/strategyProfiles';

type PhaseType = PhaseRequest['phaseType'];
type TaxRule = NonNullable<PhaseRequest['taxRules']>[number];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const isPhaseType = (v: unknown): v is PhaseType => v === 'DEPOSIT' || v === 'WITHDRAW' || v === 'PASSIVE';

const toNumberOrUndefined = (v: unknown): number | undefined => {
  if (typeof v !== 'number') return undefined;
  if (!Number.isFinite(v)) return undefined;
  return v;
};

const toStringOrUndefined = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

const toTaxRules = (v: unknown): NonNullable<PhaseRequest['taxRules']> => {
  if (!Array.isArray(v)) return [];

  // Accept both legacy spellings (old frontend) and the backend wire keys.
  const normalize = (raw: unknown): TaxRule | null => {
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    const u = s.toUpperCase();

    if (u === 'EXEMPTIONCARD' || u === 'EXEMPTION_CARD' || s.toLowerCase() === 'exemptioncard') return 'exemptioncard';
    if (u === 'STOCKEXEMPTION' || u === 'STOCK_EXEMPTION' || s.toLowerCase() === 'stockexemption') return 'stockexemption';
    return null;
  };

  const out: Array<TaxRule> = [];
  for (const r of v) {
    const norm = normalize(r);
    if (norm) out.push(norm);
  }
  return out;
};

const base64Decode = (b64: string): string => {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  const BufferAny = (globalThis as any).Buffer as any;
  if (BufferAny) return BufferAny.from(b64, 'base64').toString('utf-8');

  throw new Error('No base64 decoder available');
};

const fromBase64Url = (b64url: string): string => {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return padded + '='.repeat(padLength);
};

const stripUndefinedPhaseFields = (value: PhaseRequest): PhaseRequest => {
  return Object.fromEntries(
    Object.entries(value as unknown as Record<string, unknown>).filter(([, entryValue]) => entryValue !== undefined)
  ) as unknown as PhaseRequest;
};

export type SharedScenarioPayload = {
  request: SimulationRequest;
  assumptionsOverride?: AssumptionsOverride | null;
  strategyProfileAttachments?: StrategyProfileAttachments | null;
};

const isSharedScenarioPayload = (decoded: unknown): decoded is { request: unknown; assumptionsOverride?: unknown; strategyProfileAttachments?: unknown } => {
  return isRecord(decoded) && 'request' in decoded;
};

const normalizeDecodedSharedScenario = (decoded: unknown): SharedScenarioPayload | null => {
  if (isSharedScenarioPayload(decoded)) {
    const request = normalizeDecodedScenario(decoded.request);
    if (!request) return null;
    return {
      request,
      assumptionsOverride: normalizeAssumptionsOverride(decoded.assumptionsOverride as AssumptionsOverride | null | undefined),
      strategyProfileAttachments: (decoded.strategyProfileAttachments ?? null) as StrategyProfileAttachments | null,
    };
  }

  const request = normalizeDecodedScenario(decoded);
  if (!request) return null;
  return { request, assumptionsOverride: null, strategyProfileAttachments: null };
};

export function encodeScenarioToShareParam(
  request: SimulationRequest,
  assumptionsOverride?: AssumptionsOverride | null,
  strategyProfileAttachments?: StrategyProfileAttachments | null
): string {
  // Normalize before encoding so the share format stays stable.
  const normalizedRequest: SimulationRequest = {
    ...request,
    phases: (request.phases ?? []).map((p) => ({ ...p, taxRules: toTaxRules((p as any).taxRules) })),
  };
  const hasStrategyAttachments = Boolean(strategyProfileAttachments && Object.keys(strategyProfileAttachments).length > 0);
  const payload = hasMeaningfulAssumptionsOverride(assumptionsOverride) || hasStrategyAttachments
    ? {
        request: normalizedRequest,
        assumptionsOverride: normalizeAssumptionsOverride(assumptionsOverride),
        ...(hasStrategyAttachments ? { strategyProfileAttachments } : {}),
      }
    : normalizedRequest;
  const json = JSON.stringify(payload);
  // Prefix so we can decode unambiguously and keep backward compat.
  return `z:${compressToEncodedURIComponent(json)}`;
}

export function decodeSharedScenarioFromShareParam(param: string): SharedScenarioPayload | null {
  try {
    const raw = typeof param === 'string' ? param : '';
    const withoutPrefix = raw.startsWith('z:') || raw.startsWith('b:') ? raw.slice(2) : raw;

    if (raw.startsWith('z:')) {
      const decompressed = decompressFromEncodedURIComponent(withoutPrefix);
      if (typeof decompressed === 'string' && decompressed.length > 0) {
        return normalizeDecodedSharedScenario(JSON.parse(decompressed) as unknown);
      }
      return null;
    }

    try {
      const json = base64Decode(fromBase64Url(withoutPrefix));
      return normalizeDecodedSharedScenario(JSON.parse(json) as unknown);
    } catch {
      const decompressed = decompressFromEncodedURIComponent(withoutPrefix);
      if (typeof decompressed === 'string' && decompressed.length > 0) {
        return normalizeDecodedSharedScenario(JSON.parse(decompressed) as unknown);
      }
      return null;
    }
  } catch {
    return null;
  }
}

export function decodeScenarioFromShareParam(param: string): SimulationRequest | null {
  return decodeSharedScenarioFromShareParam(param)?.request ?? null;
}

export function normalizeDecodedScenario(decoded: unknown): SimulationRequest | null {
  if (!isRecord(decoded)) return null;

  const defaults = createDefaultSimulationRequest();

  const startDateObj = isRecord(decoded.startDate) ? decoded.startDate : undefined;
  const startDate = toStringOrUndefined(startDateObj?.date) ?? defaults.startDate.date;

  const overallTaxRuleRaw = decoded.overallTaxRule;
  const overallTaxRule: SimulationRequest['overallTaxRule'] =
    overallTaxRuleRaw === 'CAPITAL' || overallTaxRuleRaw === 'NOTIONAL' ? overallTaxRuleRaw : defaults.overallTaxRule;

  const taxPercentage = toNumberOrUndefined(decoded.taxPercentage) ?? defaults.taxPercentage;

  const phasesRaw = decoded.phases;
  const phasesArray = Array.isArray(phasesRaw) ? phasesRaw : [];

  const phases = phasesArray
    .map((p): PhaseRequest | null => {
      if (!isRecord(p)) return null;
      if (!isPhaseType(p.phaseType)) return null;

      const normalizedPhase = normalizePhase({
        phaseType: p.phaseType,
        durationInMonths: toNumberOrUndefined(p.durationInMonths),
        initialDeposit: toNumberOrUndefined(p.initialDeposit),
        monthlyDeposit: toNumberOrUndefined(p.monthlyDeposit),
        yearlyIncreaseInPercentage: toNumberOrUndefined(p.yearlyIncreaseInPercentage),
        withdrawRate: toNumberOrUndefined(p.withdrawRate),
        withdrawAmount: toNumberOrUndefined(p.withdrawAmount),
        lowerVariationPercentage: toNumberOrUndefined(p.lowerVariationPercentage),
        upperVariationPercentage: toNumberOrUndefined(p.upperVariationPercentage),
        taxRules: toTaxRules(p.taxRules),
      });
      return stripUndefinedPhaseFields(normalizedPhase);
    })
    .filter((p): p is PhaseRequest => p !== null);

  return {
    startDate: { date: startDate },
    overallTaxRule,
    taxPercentage,
    phases,
  };
}
