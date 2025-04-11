import React from 'react';
import { YearlySummary } from './models/YearlySummary';
import StatChart from './components/StatChart';

interface YearlySummaryChartsProps {
  data: YearlySummary[];
}

const YearlySummaryCharts: React.FC<YearlySummaryChartsProps> = ({ data }) => {
  // Define the list of statistics to chart.
  const statsList = [
    { key: 'averageCapital', label: 'Average Capital' },
    { key: 'medianCapital', label: 'Median Capital' },
    { key: 'minCapital', label: 'Minimum Capital' },
    { key: 'maxCapital', label: 'Maximum Capital' },
    { key: 'stdDevCapital', label: 'Std. Dev. Capital' },
    { key: 'cumulativeGrowthRate', label: 'Cumulative Growth Rate' },
    { key: 'quantile5', label: '5th Quantile' },
    { key: 'quantile25', label: '25th Quantile' },
    { key: 'quantile75', label: '75th Quantile' },
    { key: 'quantile95', label: '95th Quantile' },
    { key: 'var', label: 'Value at Risk (VaR)' },
    { key: 'cvar', label: 'Conditional VaR (CVaR)' },
    { key: 'negativeCapitalPercentage', label: 'Negative Capital Percentage' },
  ];

  return (
    <div>
      {statsList.map((stat) => (
        <StatChart
          key={stat.key}
          data={data}
          dataKey={stat.key as keyof YearlySummary}
          label={stat.label}
        />
      ))}
    </div>
  );
};

export default YearlySummaryCharts;
