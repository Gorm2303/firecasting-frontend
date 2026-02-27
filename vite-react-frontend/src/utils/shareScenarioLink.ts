import type { PhaseRequest, SimulationRequest } from '../models/types';
import { createDefaultSimulationRequest, normalizePhase } from '../config/simulationDefaults';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

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

export function encodeScenarioToShareParam(request: SimulationRequest): string {
  // Normalize before encoding so the share format stays stable.
  const normalized: SimulationRequest = {
    ...request,
    phases: (request.phases ?? []).map((p) => ({ ...p, taxRules: toTaxRules((p as any).taxRules) })),
  };
  const json = JSON.stringify(normalized);
  // Prefix so we can decode unambiguously and keep backward compat.
  return `z:${compressToEncodedURIComponent(json)}`;
}

export function decodeScenarioFromShareParam(param: string): SimulationRequest | null {
  try {
    const raw = typeof param === 'string' ? param : '';
    const withoutPrefix = raw.startsWith('z:') || raw.startsWith('b:') ? raw.slice(2) : raw;

    // New format: lz-string compressed, URI-safe
    if (raw.startsWith('z:')) {
      const decompressed = decompressFromEncodedURIComponent(withoutPrefix);
      if (typeof decompressed === 'string' && decompressed.length > 0) {
        const parsed = JSON.parse(decompressed) as unknown;
        return normalizeDecodedScenario(parsed);
      }
      return null;
    }

    // Legacy format: base64url JSON
    try {
      const json = base64Decode(fromBase64Url(withoutPrefix));
      const parsed = JSON.parse(json) as unknown;
      return normalizeDecodedScenario(parsed);
    } catch {
      // Best-effort fallback: accept unprefixed compressed strings
      const decompressed = decompressFromEncodedURIComponent(withoutPrefix);
      if (typeof decompressed === 'string' && decompressed.length > 0) {
        const parsed = JSON.parse(decompressed) as unknown;
        return normalizeDecodedScenario(parsed);
      }
      return null;
    }
  } catch {
    return null;
  }
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

      return normalizePhase({
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
    })
    .filter((p): p is PhaseRequest => p !== null);

  return {
    startDate: { date: startDate },
    overallTaxRule,
    taxPercentage,
    phases,
  };
}
