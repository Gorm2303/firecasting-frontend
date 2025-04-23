import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface StateData {
  day: number;
  capital: number;
  phaseName: string;
  // include any other fields you wish to visualize
}

interface SimulationResult {
  snapshots: { state: StateData }[];
}

interface ChartProps {
  results: SimulationResult[];
}

const formatNumber = (value: number): string =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const SimulationChart: React.FC<ChartProps> = ({ results }) => {
  // Flatten all snapshots from all results into a single array.
  const data: StateData[] = results.flatMap(result =>
    result.snapshots.map(snap => snap.state)
  );

  return (
<LineChart
  width={1000}
  height={600}
  data={data}
  margin={{ top: 20, right: 20, bottom: 20, left: 50 }} // increased left margin
>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis 
    dataKey="year" 
    label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }} 
    tickFormatter={formatNumber}
  />
  <YAxis 
    label={{ value: 'Capital', angle: -90, position: 'insideLeft' }}
    tickFormatter={formatNumber}
    tickMargin={20} // increase the tick margin to push labels further from the axis
  />
  <Tooltip formatter={(value: any) => formatNumber(Number(value))} />
  <Legend />
  <Line 
    type="monotone" 
    dataKey="capital" 
    stroke="#8884d8" 
    activeDot={{ r: 8 }} 
  />
</LineChart>

  );
};

export default SimulationChart;
