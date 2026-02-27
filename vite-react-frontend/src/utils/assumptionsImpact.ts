import type { Assumptions } from '../state/assumptions';

export type AssumptionsImpact = {
  horizonYears: number;

  nominalNetReturnPct: number;
  approxRealReturnPct: number;

  inflationFactorOverHorizon: number;
  realGrowthFactorOverHorizon: number;

  coreExpenseMonthlyDkk: number;
  coreExpenseMonthlyNominalAtHorizonDkk: number;

  safeMonthlySpendPer1MDkk: number;
  fiNumberDkk: number | null;
};

const pctToFactor = (pct: number): number => 1 + pct / 100;

export function computeAssumptionsImpact(a: Assumptions): AssumptionsImpact {
  const horizonYears = Math.max(0, Math.trunc(Number(a.moneyPerspectiveDefaults.timeHorizonYears) || 0));

  const inflationPct = Number(a.inflationPct) || 0;
  const feePct = Number(a.yearlyFeePct) || 0;
  const expectedReturnPct = Number(a.expectedReturnPct) || 0;
  const safeWithdrawalPct = Number(a.safeWithdrawalPct) || 0;

  const nominalNetReturnPct = expectedReturnPct - feePct;

  const nominalNetFactorPerYear = pctToFactor(nominalNetReturnPct);
  const inflationFactorPerYear = pctToFactor(inflationPct);

  // This is an approximation useful for quick “what changes matter” previews.
  // It intentionally avoids compounding-intra-year and sequence-of-returns effects.
  const realFactorPerYear = inflationFactorPerYear > 0 ? nominalNetFactorPerYear / inflationFactorPerYear : 1;
  const approxRealReturnPct = (realFactorPerYear - 1) * 100;

  const inflationFactorOverHorizon = Math.pow(inflationFactorPerYear, horizonYears);
  const realGrowthFactorOverHorizon = Math.pow(realFactorPerYear, horizonYears);

  const coreExpenseMonthlyDkk = Number(a.moneyPerspectiveDefaults.coreExpenseMonthlyDkk) || 0;
  const coreExpenseMonthlyNominalAtHorizonDkk = coreExpenseMonthlyDkk * inflationFactorOverHorizon;

  const safeMonthlySpendPer1MDkk = (1_000_000 * (safeWithdrawalPct / 100)) / 12;

  const fiNumberDkk = safeWithdrawalPct > 0 ? (coreExpenseMonthlyDkk * 12) / (safeWithdrawalPct / 100) : null;

  return {
    horizonYears,
    nominalNetReturnPct,
    approxRealReturnPct,
    inflationFactorOverHorizon,
    realGrowthFactorOverHorizon,
    coreExpenseMonthlyDkk,
    coreExpenseMonthlyNominalAtHorizonDkk,
    safeMonthlySpendPer1MDkk,
    fiNumberDkk,
  };
}
