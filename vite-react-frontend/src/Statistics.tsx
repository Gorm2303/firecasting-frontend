// statistics.ts
export interface YearlySummary {
    year: number;
    averageCapital: number;
    medianCapital: number;
    minCapital: number;
    maxCapital: number;
    stdDevCapital: number;
    cumulativeGrowthRate: number; // percentage change over the year
    capitalWentNegative: boolean; // true if capital went negative at least once (only count once)
  }
  
  // Helper function to compute median from an array of numbers
  export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
  
  // Helper function to compute average
  export function average(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
  
  // Helper function to compute standard deviation
  export function stdDev(values: number[]): number {
    const avg = average(values);
    const squareDiffs = values.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(average(squareDiffs));
  }
  
  // Aggregate snapshots by year and compute yearly summaries.
  // We assume each snapshot object has at least properties: year (number) and capital (number).
  export function aggregateYearlySummaries(snapshots: { year: number; capital: number }[]): YearlySummary[] {
    // Group snapshots by year
    const groups = snapshots.reduce<Record<number, number[]>>((acc, snapshot) => {
      if (!acc[snapshot.year]) {
        acc[snapshot.year] = [];
      }
      acc[snapshot.year].push(snapshot.capital);
      return acc;
    }, {});
  
    // Now compute summary for each year
    const summaries: YearlySummary[] = [];
    for (const yearStr in groups) {
      const year = parseInt(yearStr);
      const capitals = groups[year];
      // Cumulative growth rate: (last - first) / first * 100
      // (Assume snapshots are in chronological order; if not, sort by time if available)
      const sortedCaps = [...capitals]; // if order matters, sort if you have a timestamp field
      const first = sortedCaps[0];
      const last = sortedCaps[sortedCaps.length - 1];
      const cumulativeGrowthRate = first !== 0 ? ((last - first) / first) * 100 : 0;
  
      // Determine if capital ever went negative during the year
      const capitalWentNegative = capitals.some(val => val < 0);
  
      summaries.push({
        year,
        averageCapital: average(capitals),
        medianCapital: median(capitals),
        minCapital: Math.min(...capitals),
        maxCapital: Math.max(...capitals),
        stdDevCapital: stdDev(capitals),
        cumulativeGrowthRate,
        capitalWentNegative,
      });
    }
  
    // Sort summaries by year ascending
    return summaries.sort((a, b) => a.year - b.year);
  }
  