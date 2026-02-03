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

function toMonthIndex(year: number, month: number): number {
  // 0-based index where (year, month=1) is year*12.
  return Math.trunc(year) * 12 + (Math.trunc(month) - 1);
}

function fromMonthIndex(idx: number): { year: number; month: number } {
  const year = Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return { year, month };
}

function clampMonth(m: number): number {
  if (!Number.isFinite(m)) return 1;
  return Math.min(12, Math.max(1, Math.trunc(m)));
}

type Point = { idx: number; summary: YearlySummary };

function sortAndDedupePoints(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.idx - b.idx);
  const out: Point[] = [];
  for (const p of sorted) {
    if (!out.length || out[out.length - 1].idx !== p.idx) {
      out.push(p);
      continue;
    }
    // If duplicate indices exist, prefer the later one (e.g., startAnchor overriding Jan summary).
    out[out.length - 1] = p;
  }
  return out;
}

function makePchipInterpolator(xs: number[], ys: number[]) {
  const n = xs.length;

  if (n === 0) {
    return {
      evalAt: (_x: number) => 0,
    };
  }

  if (n === 1) {
    const y0 = Number(ys[0]) || 0;
    return {
      evalAt: (_x: number) => y0,
    };
  }

  const x: number[] = xs.map((v) => Number(v) || 0);
  const y: number[] = ys.map((v) => Number(v) || 0);

  const h: number[] = new Array(n - 1);
  const delta: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const hi = x[i + 1] - x[i];
    h[i] = hi === 0 ? 1 : hi;
    delta[i] = (y[i + 1] - y[i]) / h[i];
  }

  const m: number[] = new Array(n);

  // Endpoints (Fritsch-Carlson)
  const endpointSlope = (h0: number, h1: number, d0: number, d1: number) =>
    ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);

  if (n === 2) {
    m[0] = delta[0];
    m[1] = delta[0];
  } else {
    m[0] = endpointSlope(h[0], h[1], delta[0], delta[1]);
    if (Math.sign(m[0]) !== Math.sign(delta[0])) m[0] = 0;
    else if (Math.sign(delta[0]) !== Math.sign(delta[1]) && Math.abs(m[0]) > Math.abs(3 * delta[0])) m[0] = 3 * delta[0];

    m[n - 1] = endpointSlope(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3]);
    if (Math.sign(m[n - 1]) !== Math.sign(delta[n - 2])) m[n - 1] = 0;
    else if (Math.sign(delta[n - 2]) !== Math.sign(delta[n - 3]) && Math.abs(m[n - 1]) > Math.abs(3 * delta[n - 2])) m[n - 1] = 3 * delta[n - 2];

    // Interior slopes
    for (let i = 1; i < n - 1; i++) {
      const d0 = delta[i - 1];
      const d1 = delta[i];
      if (d0 === 0 || d1 === 0 || Math.sign(d0) !== Math.sign(d1)) {
        m[i] = 0;
      } else {
        const w1 = 2 * h[i] + h[i - 1];
        const w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d0 + w2 / d1);
      }
    }
  }

  // Eval cache for increasing x queries
  let seg = 0;
  return {
    evalAt: (xq: number) => {
      const xx = Number(xq) || 0;
      if (xx <= x[0]) {
        // Linear extrapolation using the first endpoint slope.
        return y[0] + m[0] * (xx - x[0]);
      }
      if (xx >= x[n - 1]) {
        // Linear extrapolation using the last endpoint slope.
        return y[n - 1] + m[n - 1] * (xx - x[n - 1]);
      }

      while (seg < n - 2 && xx > x[seg + 1]) seg++;
      while (seg > 0 && xx < x[seg]) seg--;

      const x0 = x[seg];
      const x1 = x[seg + 1];
      const hseg = x1 - x0 || 1;
      const t = (xx - x0) / hseg;
      const t2 = t * t;
      const t3 = t2 * t;

      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      return h00 * y[seg] + h10 * hseg * m[seg] + h01 * y[seg + 1] + h11 * hseg * m[seg + 1];
    },
  };
}

function buildSeries(sortedPoints: Point[], selector: (s: YearlySummary) => number): { xs: number[]; ys: number[] } {
  const outX: number[] = [];
  const outY: number[] = [];
  let lastX: number | undefined;
  for (const p of sortedPoints) {
    const x = Number(p.idx);
    if (!Number.isFinite(x)) continue;
    const y = Number(selector(p.summary)) || 0;
    if (lastX === undefined || x !== lastX) {
      outX.push(x);
      outY.push(y);
      lastX = x;
    } else {
      // duplicate x shouldn't happen post-dedupe, but keep latest y.
      outY[outY.length - 1] = y;
    }
  }
  return { xs: outX, ys: outY };
}

function buildAugmentedInterpolator(
  base: { xs: number[]; ys: number[] },
  extra: Array<{ x: number; y: number }>
) {
  if (!extra.length) return makePchipInterpolator(base.xs, base.ys);

  const pairs: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < base.xs.length; i++) pairs.push({ x: base.xs[i], y: base.ys[i] });
  for (const e of extra) {
    const x = Number(e.x);
    if (!Number.isFinite(x)) continue;
    pairs.push({ x, y: Number(e.y) || 0 });
  }

  pairs.sort((a, b) => a.x - b.x);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of pairs) {
    if (!xs.length || xs[xs.length - 1] !== p.x) {
      xs.push(p.x);
      ys.push(p.y);
    } else {
      // If there is a duplicate x, prefer the minimum y (for zero-knots).
      ys[ys.length - 1] = Math.min(ys[ys.length - 1], p.y);
    }
  }

  return makePchipInterpolator(xs, ys);
}

/**
 * Transforms yearly summaries into monthly summaries using linear interpolation.
 * For each phase and year, generates month-end points by interpolating linearly:
 * - First (possibly partial) year: from `startAnchor` (if provided) to that year's summary.
 * - Subsequent years: from previous year's summary to current year's summary.
 *
 * Example: if year 2025 has avg capital 1.00 and year 2026 has 1.10,
 * then Jan 2025 = 1.00, Feb 2025 ≈ 1.0083, ..., Dec 2025 ≈ 1.0917
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
    const startMonthFromRange = rangeStart ? clampMonth(rangeStart.getMonth() + 1) : clampMonth(startMonth);

    // Interpret yearly summary points as being at the phase's "anniversary" month.
    // Example: startDate 2026-06 => points live at YYYY-06, not YYYY-01.
    const yearlyPointMonth = startMonthFromRange;

    // End month is inclusive: the endDate's month is produced.
    // This intentionally duplicates the boundary month so it appears in both phases.
    const endYearFromRange = rangeEnd ? rangeEnd.getFullYear() : null;
    const endMonthInclusiveFromRange = rangeEnd ? rangeEnd.getMonth() + 1 : null;

    const startAnchor = options?.startAnchor;

    const inferredEndYear = endYearFromRange ?? yearlyForPhase[yearlyForPhase.length - 1]?.year;
    const endMonthFromRange = endMonthInclusiveFromRange ?? 12;
    if (!inferredEndYear || !Number.isFinite(inferredEndYear)) continue;

    const startIdx = toMonthIndex(startYearFromRange, startMonthFromRange);
    const endIdx = toMonthIndex(inferredEndYear, clampMonth(endMonthFromRange));
    if (endIdx < startIdx) continue;

    // Known points are yearly summaries at Jan (YYYY-01), plus an optional startAnchor at the
    // actual phase start month. We interpolate linearly between the surrounding points.
    const points: Point[] = [];
    for (const s of yearlyForPhase) {
      const y = Number(s.year);
      if (!Number.isFinite(y)) continue;
      points.push({ idx: toMonthIndex(y, yearlyPointMonth), summary: s });
    }
    if (startAnchor) {
      points.push({ idx: startIdx, summary: startAnchor });
    }

    const sortedPoints = sortAndDedupePoints(points);

    const sAverage = buildSeries(sortedPoints, (s) => s.averageCapital);
    const sMedian = buildSeries(sortedPoints, (s) => s.medianCapital);
    const sMin = buildSeries(sortedPoints, (s) => s.minCapital);
    const sMax = buildSeries(sortedPoints, (s) => s.maxCapital);
    const sStd = buildSeries(sortedPoints, (s) => s.stdDevCapital);
    const sGrowth = buildSeries(sortedPoints, (s) => s.cumulativeGrowthRate);
    const sQ5 = buildSeries(sortedPoints, (s) => s.quantile5);
    const sQ25 = buildSeries(sortedPoints, (s) => s.quantile25);
    const sQ75 = buildSeries(sortedPoints, (s) => s.quantile75);
    const sQ95 = buildSeries(sortedPoints, (s) => s.quantile95);
    const sVar = buildSeries(sortedPoints, (s) => s.var);
    const sCvar = buildSeries(sortedPoints, (s) => s.cvar);
    const sNeg = buildSeries(sortedPoints, (s) => s.negativeCapitalPercentage);

    const interpNeg = makePchipInterpolator(sNeg.xs, sNeg.ys);

    // Add synthetic zero knots for percentiles at the month where failure rate crosses them.
    const findCrossIdx = (p: number): number | null => {
      for (let idx = startIdx; idx <= endIdx; idx++) {
        if (interpNeg.evalAt(idx) >= p) return idx;
      }
      return null;
    };

    const cross5 = findCrossIdx(5);
    const cross25 = findCrossIdx(25);
    const cross50 = findCrossIdx(50);
    const cross75 = findCrossIdx(75);
    const cross95 = findCrossIdx(95);

    const interpAverage = makePchipInterpolator(sAverage.xs, sAverage.ys);
    const interpMin = makePchipInterpolator(sMin.xs, sMin.ys);
    const interpMax = makePchipInterpolator(sMax.xs, sMax.ys);
    const interpStd = makePchipInterpolator(sStd.xs, sStd.ys);
    const interpGrowth = makePchipInterpolator(sGrowth.xs, sGrowth.ys);
    const interpVar = makePchipInterpolator(sVar.xs, sVar.ys);
    const interpCvar = makePchipInterpolator(sCvar.xs, sCvar.ys);

    const interpQ5 = buildAugmentedInterpolator(sQ5, cross5 !== null ? [{ x: cross5, y: 0 }] : []);
    const interpQ25 = buildAugmentedInterpolator(sQ25, cross25 !== null ? [{ x: cross25, y: 0 }] : []);
    const interpMedian = buildAugmentedInterpolator(sMedian, cross50 !== null ? [{ x: cross50, y: 0 }] : []);
    const interpQ75 = buildAugmentedInterpolator(sQ75, cross75 !== null ? [{ x: cross75, y: 0 }] : []);
    const interpQ95 = buildAugmentedInterpolator(sQ95, cross95 !== null ? [{ x: cross95, y: 0 }] : []);

    for (let idx = startIdx; idx <= endIdx; idx++) {
      const { year, month } = fromMonthIndex(idx);

      // If the rangeEnd is set, enforce inclusive endMonth for that endYear.
      if (endYearFromRange !== null && endMonthInclusiveFromRange !== null) {
        if (year > endYearFromRange) break;
        if (year === endYearFromRange && month > endMonthInclusiveFromRange) break;
      }

      // Spline interpolation per metric across all known points.
      let averageCapital = interpAverage.evalAt(idx);
      let medianCapital = interpMedian.evalAt(idx);
      let minCapital = interpMin.evalAt(idx);
      let maxCapital = interpMax.evalAt(idx);
      let stdDevCapital = interpStd.evalAt(idx);
      let cumulativeGrowthRate = interpGrowth.evalAt(idx);
      let quantile5 = interpQ5.evalAt(idx);
      let quantile25 = interpQ25.evalAt(idx);
      let quantile75 = interpQ75.evalAt(idx);
      let quantile95 = interpQ95.evalAt(idx);
      let variance = interpVar.evalAt(idx);
      let cvar = interpCvar.evalAt(idx);
      let negativeCapitalPercentage = interpNeg.evalAt(idx);

      // Clamp / sanitize to avoid weird artifacts from smoothing.
      if (!Number.isFinite(negativeCapitalPercentage)) negativeCapitalPercentage = 0;
      negativeCapitalPercentage = Math.min(100, Math.max(0, negativeCapitalPercentage));

      if (!Number.isFinite(stdDevCapital)) stdDevCapital = 0;
      if (!Number.isFinite(variance)) variance = 0;
      if (!Number.isFinite(cvar)) cvar = 0;
      stdDevCapital = Math.max(0, stdDevCapital);
      variance = Math.max(0, variance);
      cvar = Math.max(0, cvar);

      // If X% of runs have failed (capital <= 0), then any percentile <= X must be 0.
      // This keeps the percentile bands consistent with the failure-rate line.
      const fail = negativeCapitalPercentage;
      const floorPercentile = (p: number, v: number) => (fail >= p ? 0 : v);

      quantile5 = floorPercentile(5, quantile5);
      quantile25 = floorPercentile(25, quantile25);
      medianCapital = floorPercentile(50, medianCapital);
      quantile75 = floorPercentile(75, quantile75);
      quantile95 = floorPercentile(95, quantile95);

      // Ensure percentiles are ordered and median stays inside [p25, p75].
      quantile25 = Math.max(quantile25, quantile5);
      quantile75 = Math.max(quantile75, quantile25);
      quantile95 = Math.max(quantile95, quantile75);
      medianCapital = Math.min(Math.max(medianCapital, quantile25), quantile75);

      // Ensure min/max envelope the quantiles.
      minCapital = Math.min(minCapital, quantile5);
      maxCapital = Math.max(maxCapital, quantile95);
      if (maxCapital < minCapital) maxCapital = minCapital;

      result.push({
        phaseName,
        year,
        month,
        yearMonth: `${year}-${String(month).padStart(2, '0')}`,
        averageCapital,
        medianCapital,
        minCapital,
        maxCapital,
        stdDevCapital,
        cumulativeGrowthRate,
        quantile5,
        quantile25,
        quantile75,
        quantile95,
        var: variance,
        cvar,
        negativeCapitalPercentage,
      });
    }
  }

  return result;
}
