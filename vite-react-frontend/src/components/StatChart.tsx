import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface StatChartProps {
  data: any[];
  dataKey: string;
  label: string;
}

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const StatChart: React.FC<StatChartProps> = ({ data, dataKey, label }) => {
  return (
    <div style={{ marginBottom: '50px' }}>
      <h3>{label}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={data}
          margin={{ top: 20, right: 20, bottom: 80, left: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="yearMonth"
            label={{ value: 'Month', position: 'insideBottomRight', offset: -6 }}
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={11}
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
            dataKey={dataKey}
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatChart;
