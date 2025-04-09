import React from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { YearlySummary } from './models/YearlySummary';

interface StatChartProps {
  data: YearlySummary[];
  dataKey: keyof YearlySummary; // Use the keys from YearlySummary for type safety
  label: string;
}

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const StatChart: React.FC<StatChartProps> = ({ data, dataKey, label }) => {
  return (
    <div style={{ marginBottom: '50px' }}>
      <h3>{label}</h3>
      <LineChart
        width={1000}
        height={600}
        data={data}
        margin={{ top: 20, right: 20, bottom: 20, left: 50 }}
        >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="year"
          label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }}
          tickFormatter={formatNumber}
        />
        <YAxis
          label={{ value: label, angle: -90, position: 'insideLeft' }}
          tickFormatter={formatNumber}
          tickMargin={20}
        />
        <Tooltip formatter={(value: any) => formatNumber(Number(value))} />
        <Legend />
        <Line type="monotone" dataKey={dataKey as string} stroke="#8884d8" activeDot={{ r: 8 }} />
      </LineChart>
    </div>
  );
};

interface YearlySummaryChartsProps {
  data: YearlySummary[];
}

const YearlySummaryCharts: React.FC<YearlySummaryChartsProps> = ({ data }) => {
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
        <StatChart key={stat.key} data={data} dataKey={stat.key as keyof YearlySummary} label={stat.label} />
      ))}
    </div>
  );
};

export default YearlySummaryCharts;
