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

export type AssumptionsImpactSensitivityRow = {
  label: string;
  impact: AssumptionsImpact;
  deltaFromBase: {
    nominalNetReturnPct: number;
    approxRealReturnPct: number;
    coreExpenseMonthlyNominalAtHorizonDkk: number;
    safeMonthlySpendPer1MDkk: number;
    fiNumberDkk: number | null;
  };
};

export type AssumptionsImpactSensitivity = {
  base: AssumptionsImpact;
  rows: AssumptionsImpactSensitivityRow[];
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

export function computeAssumptionsImpactSensitivity(baseAssumptions: Assumptions): AssumptionsImpactSensitivity {
  const base = computeAssumptionsImpact(baseAssumptions);

  const bump = (n: unknown, delta: number): number => {
    const v = Number(n);
    return (Number.isFinite(v) ? v : 0) + delta;
  };

  const applyPatch = (patch: Partial<Assumptions>): Assumptions => {
    return {
      ...baseAssumptions,
      ...patch,
      moneyPerspectiveDefaults: {
        ...baseAssumptions.moneyPerspectiveDefaults,
        ...(patch.moneyPerspectiveDefaults ?? {}),
      },
    } as Assumptions;
  };

  const scenarios: Array<{ label: string; assumptions: Assumptions }> = [
    {
      label: '+1pp expected return',
      assumptions: applyPatch({ expectedReturnPct: bump(baseAssumptions.expectedReturnPct, 1) }),
    },
    {
      label: '+0.5pp yearly fee',
      assumptions: applyPatch({ yearlyFeePct: bump(baseAssumptions.yearlyFeePct, 0.5) }),
    },
    {
      label: '+1pp inflation',
      assumptions: applyPatch({ inflationPct: bump(baseAssumptions.inflationPct, 1) }),
    },
    {
      label: '+0.5pp safe withdrawal rate',
      assumptions: applyPatch({ safeWithdrawalPct: bump(baseAssumptions.safeWithdrawalPct, 0.5) }),
    },
  ];

  const rows: AssumptionsImpactSensitivityRow[] = scenarios.map((s) => {
    const impact = computeAssumptionsImpact(s.assumptions);
    const fiDelta =
      base.fiNumberDkk !== null && impact.fiNumberDkk !== null ? impact.fiNumberDkk - base.fiNumberDkk : null;

    return {
      label: s.label,
      impact,
      deltaFromBase: {
        nominalNetReturnPct: impact.nominalNetReturnPct - base.nominalNetReturnPct,
        approxRealReturnPct: impact.approxRealReturnPct - base.approxRealReturnPct,
        coreExpenseMonthlyNominalAtHorizonDkk:
          impact.coreExpenseMonthlyNominalAtHorizonDkk - base.coreExpenseMonthlyNominalAtHorizonDkk,
        safeMonthlySpendPer1MDkk: impact.safeMonthlySpendPer1MDkk - base.safeMonthlySpendPer1MDkk,
        fiNumberDkk: fiDelta,
      },
    };
  });

  return { base, rows };
}
