import { describe, expect, it } from 'vitest';
import { transformYearlyToMonthly } from './transformYearlyToMonthly';
import type { YearlySummary } from '../models/YearlySummary';

describe('transformYearlyToMonthly (startDate handling)', () => {
  it('starts at the phase start month for a mid-year startDate', () => {
    const yearly: YearlySummary[] = [
      {
        phaseName: 'DEPOSIT',
        year: 2027,
        averageCapital: 100,
        medianCapital: 100,
        minCapital: 100,
        maxCapital: 100,
        stdDevCapital: 0,
        cumulativeGrowthRate: 0,
        quantile5: 100,
        quantile25: 100,
        quantile75: 100,
        quantile95: 100,
        var: 100,
        cvar: 100,
        negativeCapitalPercentage: 0,
      },
    ];

    const monthly = transformYearlyToMonthly(yearly, {
      phaseRange: { startDateIso: '2027-06-18', endDateIso: '2027-08-18' },
    });

    // We should generate months starting at June for 2027.
    expect(monthly.length).toBeGreaterThan(0);
    expect(monthly[0].yearMonth).toBe('2027-06');
  });

  it('is continuous across Dec->Jan for mid-year phases', () => {
    const mk = (phaseName: string, year: number, v: number): YearlySummary => ({
      phaseName,
      year,
      averageCapital: v,
      medianCapital: v,
      minCapital: v,
      maxCapital: v,
      stdDevCapital: 0,
      cumulativeGrowthRate: 0,
      quantile5: v,
      quantile25: v,
      quantile75: v,
      quantile95: v,
      var: v,
      cvar: v,
      negativeCapitalPercentage: 0,
    });

    // Yearly points are interpreted at the phase anniversary month (June here).
    const yearly: YearlySummary[] = [mk('DEPOSIT', 2027, 160), mk('DEPOSIT', 2028, 220), mk('DEPOSIT', 2029, 300)];

    const monthly = transformYearlyToMonthly(yearly, {
      phaseRange: { startDateIso: '2027-06-18', endDateIso: '2028-06-18' },
      startAnchor: mk('DEPOSIT', 2027, 100),
    });

    const byYm = new Map(monthly.map((m) => [m.yearMonth, m] as const));
    const dec = byYm.get('2027-12');
    const jan = byYm.get('2028-01');
    expect(dec).toBeTruthy();
    expect(jan).toBeTruthy();

    // Dec is year-end 2027; Jan should be slightly above it (not a jump down / reset).
    expect(jan!.averageCapital).toBeGreaterThanOrEqual(dec!.averageCapital);
    expect(Math.abs(jan!.averageCapital - dec!.averageCapital)).toBeLessThan(100);
  });

  it('does not create a flat line in the final partial year (Jan->Jun has slope)', () => {
    const mk = (phaseName: string, year: number, v: number): YearlySummary => ({
      phaseName,
      year,
      averageCapital: v,
      medianCapital: v,
      minCapital: v,
      maxCapital: v,
      stdDevCapital: 0,
      cumulativeGrowthRate: 0,
      quantile5: v,
      quantile25: v,
      quantile75: v,
      quantile95: v,
      var: v,
      cvar: v,
      negativeCapitalPercentage: 0,
    });

    const yearly: YearlySummary[] = [mk('DEPOSIT', 2027, 160), mk('DEPOSIT', 2028, 220), mk('DEPOSIT', 2029, 300)];

    const monthly = transformYearlyToMonthly(yearly, {
      phaseRange: { startDateIso: '2027-06-18', endDateIso: '2028-06-18' },
      startAnchor: mk('DEPOSIT', 2027, 100),
    });

    const byYm = new Map(monthly.map((m) => [m.yearMonth, m] as const));
    const jan = byYm.get('2028-01');
    const jun = byYm.get('2028-06');
    expect(jan).toBeTruthy();
    expect(jun).toBeTruthy();

    expect(jun!.averageCapital).toBeGreaterThan(jan!.averageCapital);
  });

  it('does not flatline after the last provided January point when phase ends mid-year', () => {
    const mk = (phaseName: string, year: number, v: number): YearlySummary => ({
      phaseName,
      year,
      averageCapital: v,
      medianCapital: v,
      minCapital: v,
      maxCapital: v,
      stdDevCapital: 0,
      cumulativeGrowthRate: 0,
      quantile5: v,
      quantile25: v,
      quantile75: v,
      quantile95: v,
      var: 0,
      cvar: 0,
      negativeCapitalPercentage: 0,
    });

    // Simulates a phase that runs Jun 2026 -> Jun 2031, but only has yearly points through 2031.
    const yearly: YearlySummary[] = [
      mk('PASSIVE', 2026, 500_000),
      mk('PASSIVE', 2027, 520_000),
      mk('PASSIVE', 2028, 540_000),
      mk('PASSIVE', 2029, 560_000),
      mk('PASSIVE', 2030, 580_000),
      mk('PASSIVE', 2031, 600_000),
    ];

    const monthly = transformYearlyToMonthly(yearly, {
      phaseRange: { startDateIso: '2026-06-19', endDateIso: '2031-06-19' },
      startAnchor: mk('PASSIVE', 2026, 500_000),
    });

    const byYm = new Map(monthly.map((m) => [m.yearMonth, m] as const));
    // Previously the chart could kink/flatten around Jan because yearly points were treated as Jan.
    const jan = byYm.get('2031-01');
    const feb = byYm.get('2031-02');
    const jun = byYm.get('2031-06');
    expect(jan).toBeTruthy();
    expect(feb).toBeTruthy();
    expect(jun).toBeTruthy();

    // Previously this would go flat at Jan because the next-year point was missing.
    expect(feb!.averageCapital).not.toBe(jan!.averageCapital);
    expect(jun!.averageCapital).not.toBe(jan!.averageCapital);
  });

  it('floors low percentiles to 0 when failure rate exceeds them', () => {
    const mk = (phaseName: string, year: number, v: number, failPct: number): YearlySummary => ({
      phaseName,
      year,
      averageCapital: v,
      medianCapital: v,
      minCapital: v,
      maxCapital: v,
      stdDevCapital: 0,
      cumulativeGrowthRate: 0,
      quantile5: v,
      quantile25: v,
      quantile75: v,
      quantile95: v,
      var: 0,
      cvar: 0,
      negativeCapitalPercentage: failPct,
    });

    // 8% failed => 5th percentile must be 0.
    const monthly8 = transformYearlyToMonthly([mk('WITHDRAW', 2031, 10_000, 8), mk('WITHDRAW', 2032, 12_000, 8)], {
      phaseRange: { startDateIso: '2031-01-01', endDateIso: '2031-02-01' },
    });
    expect(monthly8[0].quantile5).toBe(0);
    expect(monthly8[0].quantile25).toBeGreaterThanOrEqual(0);

    // 32.45% failed => 25th percentile must be 0.
    const monthly32 = transformYearlyToMonthly(
      [mk('WITHDRAW', 2031, 10_000, 32.45), mk('WITHDRAW', 2032, 12_000, 32.45)],
      { phaseRange: { startDateIso: '2031-01-01', endDateIso: '2031-02-01' } }
    );
    expect(monthly32[0].quantile25).toBe(0);
  });

  it('trends percentiles toward 0 before they cross to failure', () => {
    const mk = (phaseName: string, year: number, q25: number, failPct: number): YearlySummary => ({
      phaseName,
      year,
      averageCapital: q25,
      medianCapital: q25,
      minCapital: q25,
      maxCapital: q25,
      stdDevCapital: 0,
      cumulativeGrowthRate: 0,
      quantile5: q25,
      quantile25: q25,
      quantile75: q25,
      quantile95: q25,
      var: 0,
      cvar: 0,
      negativeCapitalPercentage: failPct,
    });

    // Failure rate ramps from 0% to 50% over the year; p25 should be pulled down before it hits 0.
    const yearly: YearlySummary[] = [mk('WITHDRAW', 2036, 100_000, 0), mk('WITHDRAW', 2037, 100_000, 50)];
    const monthly = transformYearlyToMonthly(yearly, {
      phaseRange: { startDateIso: '2036-06-01', endDateIso: '2037-05-01' },
    });

    const byYm = new Map(monthly.map((m) => [m.yearMonth, m] as const));
    // Around the 25% crossing (roughly 6 months in), the month before crossing should already be below the initial value.
    const start = byYm.get('2036-06');
    const beforeCross = byYm.get('2036-11');
    const cross = byYm.get('2036-12');
    expect(start).toBeTruthy();
    expect(beforeCross).toBeTruthy();
    expect(cross).toBeTruthy();

    expect(start!.quantile25).toBeGreaterThan(0);
    expect(cross!.quantile25).toBe(0);
    expect(beforeCross!.quantile25).toBeLessThan(start!.quantile25);
  });
});
