import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { YearlySummary } from '../models/YearlySummary';

interface StatChartProps {
  data: YearlySummary[];
  dataKey: keyof YearlySummary;
  label: string;
}

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const StatChart: React.FC<StatChartProps> = ({ data, dataKey, label }) => {
  return (
    <div style={{ marginBottom: '50px' }}>
      <h3>{label}</h3>
      <AreaChart
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
          label={{ value: label, angle: -90, position: 'insideBottomLeft' }}
          tickFormatter={formatNumber}
          tickMargin={20}
        />
        <Tooltip formatter={(value: any) => formatNumber(Number(value))} />
        <Legend />
        <Area
          type="monotone"
          dataKey={dataKey as string}
          stroke="#8884d8"
          fill="#8884d8"
          fillOpacity={0.3}
        />
      </AreaChart>
    </div>
  );
};

export default StatChart;
