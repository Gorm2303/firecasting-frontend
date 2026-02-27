import type { PhaseRequest } from '../models/types';

export type TaxRule = NonNullable<PhaseRequest['taxRules']>[number];

export function normalizeTaxRules(v: unknown): TaxRule[] {
  if (!Array.isArray(v)) return [];

  const out: TaxRule[] = [];
  for (const raw of v) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim();
    if (!s) continue;

    const u = s.toUpperCase();

    if (u === 'EXEMPTIONCARD' || u === 'EXEMPTION_CARD' || s.toLowerCase() === 'exemptioncard') {
      out.push('exemptioncard');
      continue;
    }

    if (u === 'STOCKEXEMPTION' || u === 'STOCK_EXEMPTION' || s.toLowerCase() === 'stockexemption') {
      out.push('stockexemption');
      continue;
    }
  }

  return out;
}
