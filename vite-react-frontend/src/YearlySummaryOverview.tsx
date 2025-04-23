// YearlySummaryOverview.tsx
import React, { useMemo } from 'react';
import {
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  Line,
} from 'recharts';
import { YearlySummary } from './models/YearlySummary';
import FailedCasesSummary from './components/FailedCasesSummary';

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

interface YearlySummaryOverviewProps {
  data: YearlySummary[];
}

/**
 * Transforms the original YearlySummary data into a format that’s
 * suitable for rendering the stacked areas:
 * - outer band: from 5th to 95th quantiles
 * - inner band: from 25th to 75th quantiles
 */
const transformDataForBands = (source: YearlySummary[]) => {
  return source.map((d) => ({
    year: d.year,
    lower5: d.quantile5,
    // Difference between 95th and 5th quantile
    band5_95: d.quantile95 - d.quantile5,
    lower25: d.quantile25,
    // Difference between 75th and 25th quantile
    band25_75: d.quantile75 - d.quantile25,
    medianCapital: d.medianCapital,
  }));
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
}

/**
 * Custom tooltip that displays the Year along with each quantile value.
 */
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length && payload[0].payload) {
    const dataPoint = payload[0].payload;
    // Recover the actual quantile values:
    const quantile5 = dataPoint.lower5;
    const quantile95 = dataPoint.lower5 + dataPoint.band5_95;
    const quantile25 = dataPoint.lower25;
    const quantile75 = dataPoint.lower25 + dataPoint.band25_75;
    const median = dataPoint.medianCapital;
    return (
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          border: '1px solid #999',
          padding: '8px',
          fontSize: '14px',
          color: '#333',
        }}
      >
        <p style={{ margin: '0 0 4px 0' }}>{`Year: ${label}`}</p>
        <p style={{ margin: 0 }}>{`95th Quantile: ${formatNumber(quantile95)}`}</p>
        <p style={{ margin: 0 }}>{`75th Quantile: ${formatNumber(quantile75)}`}</p>
        <p style={{ margin: 0 }}>{`Median: ${formatNumber(median)}`}</p>
        <p style={{ margin: 0 }}>{`25th Quantile: ${formatNumber(quantile25)}`}</p>
        <p style={{ margin: 0 }}>{`5th Quantile: ${formatNumber(quantile5)}`}</p>
      </div>
    );
  }
  return null;
};

const YearlySummaryOverview: React.FC<YearlySummaryOverviewProps> = ({ data }) => {
  // Transform the data for the stacked areas
  const stackedData = useMemo(() => transformDataForBands(data), [data]);

  return (
    <div style={{ marginTop: '2rem', width: '93vw' }}>
      <ResponsiveContainer width="100%" aspect={1.6}>
        <ComposedChart
          data={stackedData}
          margin={{ top: 0, right: 20, bottom: 0, left: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="year"
            label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }}
          />
          <YAxis
            label={{ value: 'Capital', angle: -90, position: 'insideBottomLeft' }}
            tickFormatter={formatNumber}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/*
            Outer band: from 5th to 95th quantile.
            Render an invisible baseline then a stacked area that fills with blue.
          */}
          <Area dataKey="lower5" stackId="outerBand" stroke="none" fill="none" name=" " />
          <Area dataKey="lower25" stackId="innerBand" stroke="none" fill="none" name=" " />
          <Area
            dataKey="band5_95"
            stackId="outerBand"
            stroke="none"
            fill="#FFFF00"
            fillOpacity={0.1}
            name="Quantiles (5th-95th)"
          />

          {/*
            Inner band: from 25th to 75th quantile.
          */}
          <Area
            dataKey="band25_75"
            stackId="innerBand"
            stroke="none"
            fill="#0088FF"
            fillOpacity={0.3}
            name="Quantiles (25th-75th)"
          />

          {/*
            Overlay the median capital line.
          */}
          <Line
            type="monotone"
            dataKey="medianCapital"
            stroke="#0033FF"
            strokeWidth={2}
            dot={false}
            name="Median Capital"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <FailedCasesSummary data={data} />
    </div>
  );
};

export default YearlySummaryOverview;
