// YearlySummaryTable.tsx
import React from 'react';

// This interface should match your YearlySummary DTO from the backend.
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

interface YearlySummaryTableProps {
  stats: YearlySummary[];
}

const YearlySummaryTable: React.FC<YearlySummaryTableProps> = ({ stats }) => {
  // Helper function to format numbers with commas and given decimal places.
  const formatNumber = (num: number, decimals: number = 0): string =>
    num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <div style={{ margin: "2rem" }}>
      <h2>Yearly Simulation Statistics</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Year</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Avg Capital</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Median</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Min</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Max</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Std Dev</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Growth (%)</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Q5</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Q25</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Q75</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Q95</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>VaR</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>CVaR</th>
            <th style={{ border: "1px solid #ccc", padding: "8px" }}>Fail %</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr key={stat.year}>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{stat.year}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.averageCapital)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.medianCapital)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.minCapital)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.maxCapital)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.stdDevCapital)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.cumulativeGrowthRate, 2)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.quantile5)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.quantile25)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.quantile75)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.quantile95)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.var)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{formatNumber(stat.cvar)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>{stat.negativeCapitalPercentage.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default YearlySummaryTable;
