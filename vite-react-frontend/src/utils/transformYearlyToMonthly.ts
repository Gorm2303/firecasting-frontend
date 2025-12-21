import { YearlySummary } from '../models/YearlySummary';
import { MonthlySummary } from '../models/MonthlySummary';

type TransformOptions = {
  /** Return the 1..12 start month for the first year of a given phase. */
  getFirstYearStartMonth?: (phaseName: string) => number | undefined;
  /** Optional calendar range for a phase; months at/after endDate are not generated. */
  phaseRange?: { startDateIso: string; endDateIso?: string };
  /** Optional start anchor for first-year interpolation (previous year values or initial deposit). */
  startAnchor?: YearlySummary;
};

function parseIsoDateLocal(isoDate: string): Date | null {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(isoDate ?? ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d);
}

function lerpYearly(a: YearlySummary, b: YearlySummary, phaseName: string, year: number, month: number, t: number): MonthlySummary {
  const lerpVal = (x: number, y: number) => lerp(Number(x) || 0, Number(y) || 0, t);
  return {
    phaseName,
    year,
    month,
    yearMonth: `${year}-${String(month).padStart(2, '0')}`,
    averageCapital: lerpVal(a.averageCapital, b.averageCapital),
    medianCapital: lerpVal(a.medianCapital, b.medianCapital),
    minCapital: lerpVal(a.minCapital, b.minCapital),
    maxCapital: lerpVal(a.maxCapital, b.maxCapital),
    stdDevCapital: lerpVal(a.stdDevCapital, b.stdDevCapital),
    cumulativeGrowthRate: lerpVal(a.cumulativeGrowthRate, b.cumulativeGrowthRate),
    quantile5: lerpVal(a.quantile5, b.quantile5),
    quantile25: lerpVal(a.quantile25, b.quantile25),
    quantile75: lerpVal(a.quantile75, b.quantile75),
    quantile95: lerpVal(a.quantile95, b.quantile95),
    var: lerpVal(a.var, b.var),
    cvar: lerpVal(a.cvar, b.cvar),
    negativeCapitalPercentage: lerpVal(a.negativeCapitalPercentage, b.negativeCapitalPercentage),
  };
}

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

    const rangeStart = options?.phaseRange?.startDateIso
      ? parseIsoDateLocal(options.phaseRange.startDateIso)
      : null;
    const rangeEnd = options?.phaseRange?.endDateIso
      ? parseIsoDateLocal(options.phaseRange.endDateIso)
      : null;

    const startYearFromRange = rangeStart ? rangeStart.getFullYear() : firstYear;
    const startMonthFromRange = rangeStart ? rangeStart.getMonth() + 1 : startMonth;

    // End is exclusive: months at/after endDate's month are not produced.
    const endYearFromRange = rangeEnd ? rangeEnd.getFullYear() : null;
    const endMonthExclusiveFromRange = rangeEnd ? rangeEnd.getMonth() + 1 : null;

    const startAnchor = options?.startAnchor;

    // If the phase starts in a calendar year that has no reported yearly summary,
    // generate "year 0" months within that start year by interpolating from the
    // start anchor to the first available yearly summary (typically startYear+1).
    if (startAnchor && rangeStart) {
      const syntheticYear0 = startYearFromRange;
      const firstReported = yearlyForPhase[0];
      if (firstReported && syntheticYear0 < firstReported.year) {
        let monthEnd = 12;
        if (endYearFromRange !== null && endMonthExclusiveFromRange !== null && endYearFromRange === syntheticYear0) {
          monthEnd = endMonthExclusiveFromRange - 1;
        }

        for (let month = startMonthFromRange; month <= monthEnd; month++) {
          // Mirror the existing convention: month 1 is t=0, Dec is near (but not equal to) next-year.
          const monthIndex = month - startMonthFromRange + 1;
          const t = (monthIndex - 1) / 12;
          result.push(lerpYearly(startAnchor, firstReported, phaseName, syntheticYear0, month, t));
        }
      }
    }

    // For each year, interpolate to the next year
    for (let i = 0; i < yearlyForPhase.length; i++) {
      const current = yearlyForPhase[i];
      const next = i + 1 < yearlyForPhase.length ? yearlyForPhase[i + 1] : null;

      const monthStart = current.year === startYearFromRange ? startMonthFromRange : 1;

      let monthEnd = 12;
      if (endYearFromRange !== null && current.year === endYearFromRange && endMonthExclusiveFromRange !== null) {
        monthEnd = endMonthExclusiveFromRange - 1;
      }

      if (monthEnd < monthStart) {
        continue;
      }

      // Generate months for this year
      for (let month = monthStart; month <= 12; month++) {
        if (month > monthEnd) break;

        const isFirstYearOfPhase = current.year === startYearFromRange;

        // Fix interpolation at phase start:
        // - If we have a startAnchor (previous year or initial deposit), interpolate from it
        //   toward the *next year* value when available (fallback to current year).
        if (isFirstYearOfPhase && startAnchor) {
          const nextYearSummary = yearlyForPhase.find((s) => s.year === current.year + 1);
          const nextAvailableAfter = yearlyForPhase.find((s) => s.year > current.year);
          const target = nextYearSummary ?? nextAvailableAfter ?? current;
          const span = Math.max(0, monthEnd - monthStart);
          const t = span === 0 ? 0 : (month - monthStart) / span;
          result.push(lerpYearly(startAnchor, target, current.phaseName, current.year, month, t));
          continue;
        }

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
