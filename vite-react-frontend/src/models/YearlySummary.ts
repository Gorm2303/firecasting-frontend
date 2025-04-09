export interface YearlySummary {
    year: number;
    averageCapital: number;
    medianCapital: number;
    minCapital: number;
    maxCapital: number;
    stdDevCapital: number;
    cumulativeGrowthRate: number;
    quantile5: number;
    quantile25: number;
    quantile75: number;
    quantile95: number;
    var: number;
    cvar: number;
    negativeCapitalPercentage: number;
  }
  