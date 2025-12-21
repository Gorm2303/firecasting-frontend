import { YearlySummary } from '../models/YearlySummary';
import { MonthlySummary } from '../models/MonthlySummary';

type TransformOptions = {
  /** Return the 1..12 start month for the first year of a given phase. */
  getFirstYearStartMonth?: (phaseName: string) => number | undefined;
};

/**
 * Transforms yearly summaries into monthly summaries using linear interpolation.
 * For each phase and year, generates 12 monthly records interpolating linearly
 * from year N values to year N+1 values.
 *
 * Example: if year 2025 has avg capital 100 and year 2026 has 110,
 * then Jan 2025 ≈ 100.83, Feb 2025 ≈ 101.67, ..., Dec 2025 ≈ 109.17
 */
export function transformYearlyToMonthly(yearly: YearlySummary[], options?: TransformOptions): MonthlySummary[] {
  if (yearly.length === 0) return [];

  // Group by phase to handle interpolation per phase independently
  const byPhase = new Map<string, YearlySummary[]>();
  for (const summary of yearly) {
    const phase = summary.phaseName;
    if (!byPhase.has(phase)) {
      byPhase.set(phase, []);
    }
    byPhase.get(phase)!.push(summary);
  }

  const result: MonthlySummary[] = [];

  // Process each phase
  for (const [phaseName, yearlyForPhase] of byPhase.entries()) {
    // Sort by year ascending
    yearlyForPhase.sort((a, b) => a.year - b.year);

    const firstYear = yearlyForPhase[0]?.year;
    const rawStartMonth = options?.getFirstYearStartMonth?.(phaseName);
    const startMonth =
      rawStartMonth && Number.isFinite(rawStartMonth)
        ? Math.min(12, Math.max(1, Math.trunc(rawStartMonth)))
        : 1;

    // For each year, interpolate to the next year
    for (let i = 0; i < yearlyForPhase.length; i++) {
      const current = yearlyForPhase[i];
      const next = i + 1 < yearlyForPhase.length ? yearlyForPhase[i + 1] : null;

      const monthStart = current.year === firstYear ? startMonth : 1;

      // Generate months for this year
      for (let month = monthStart; month <= 12; month++) {
        const t = (month - 1) / 12; // 0 at Jan, 11/12 at Dec

        let interpolated: MonthlySummary;

        if (next && next.year === current.year + 1) {
          // Linear interpolation between current year and next year
          interpolated = {
            phaseName: current.phaseName,
            year: current.year,
            month,
            yearMonth: `${current.year}-${String(month).padStart(2, '0')}`,
            averageCapital: lerp(current.averageCapital, next.averageCapital, t),
            medianCapital: lerp(current.medianCapital, next.medianCapital, t),
            minCapital: lerp(current.minCapital, next.minCapital, t),
            maxCapital: lerp(current.maxCapital, next.maxCapital, t),
            stdDevCapital: lerp(current.stdDevCapital, next.stdDevCapital, t),
            cumulativeGrowthRate: lerp(
              current.cumulativeGrowthRate,
              next.cumulativeGrowthRate,
              t
            ),
            quantile5: lerp(current.quantile5, next.quantile5, t),
            quantile25: lerp(current.quantile25, next.quantile25, t),
            quantile75: lerp(current.quantile75, next.quantile75, t),
            quantile95: lerp(current.quantile95, next.quantile95, t),
            var: lerp(current.var, next.var, t),
            cvar: lerp(current.cvar, next.cvar, t),
            negativeCapitalPercentage: lerp(
              current.negativeCapitalPercentage,
              next.negativeCapitalPercentage,
              t
            ),
          };
        } else {
          // No next year or gap: repeat current year's values
          interpolated = {
            phaseName: current.phaseName,
            year: current.year,
            month,
            yearMonth: `${current.year}-${String(month).padStart(2, '0')}`,
            averageCapital: current.averageCapital,
            medianCapital: current.medianCapital,
            minCapital: current.minCapital,
            maxCapital: current.maxCapital,
            stdDevCapital: current.stdDevCapital,
            cumulativeGrowthRate: current.cumulativeGrowthRate,
            quantile5: current.quantile5,
            quantile25: current.quantile25,
            quantile75: current.quantile75,
            quantile95: current.quantile95,
            var: current.var,
            cvar: current.cvar,
            negativeCapitalPercentage: current.negativeCapitalPercentage,
          };
        }

        result.push(interpolated);
      }
    }
  }

  return result;
}

/**
 * Linear interpolation: lerp(a, b, t) = a + (b - a) * t
 * t=0 → a, t=1 → b
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
