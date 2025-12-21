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
import { transformYearlyToMonthly } from './utils/transformYearlyToMonthly';
import FailedCasesSummary from './components/FailedCasesSummary';

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

interface YearlySummaryOverviewProps {
  data: YearlySummary[];
  /** 1..12. If provided, the chart's first year starts at this month instead of January. */
  firstYearStartMonth?: number;
  /** ISO date of phase start (YYYY-MM-DD). Used to fix interpolation at phase boundary. */
  phaseStartDateIso?: string;
  /** ISO date of phase end (YYYY-MM-DD). Months at/after this date are not generated. */
  phaseEndDateIso?: string;
  /** Anchor values used for the first partial year interpolation. */
  startAnchor?: YearlySummary;
}

/**
 * Transforms monthly data into a format that's
 * suitable for rendering the stacked areas:
 * - outer band: from 5th to 95th quantiles
 * - inner band: from 25th to 75th quantiles
 */
const transformDataForBands = (source: any[]) => {
  return source.map((d) => ({
    yearMonth: d.yearMonth,
    year: d.year,
    month: d.month,
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
 * Custom tooltip that displays the Year-Month along with each quantile value.
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
    const yearMonth = dataPoint.yearMonth || label;
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
        <p style={{ margin: '0 0 4px 0' }}>{`${yearMonth}`}</p>
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

const YearlySummaryOverview: React.FC<YearlySummaryOverviewProps> = ({
  data,
  firstYearStartMonth,
  phaseStartDateIso,
  phaseEndDateIso,
  startAnchor,
}) => {
  const yearlySorted = useMemo(() => {
    return [...data].sort((a, b) => a.year - b.year);
  }, [data]);

  // Transform yearly → monthly with linear interpolation
  const monthlyData = useMemo(
    () =>
      transformYearlyToMonthly(data, {
        getFirstYearStartMonth: () => firstYearStartMonth,
        phaseRange: phaseStartDateIso
          ? { startDateIso: phaseStartDateIso, endDateIso: phaseEndDateIso }
          : undefined,
        startAnchor,
      }),
    [data, firstYearStartMonth, phaseStartDateIso, phaseEndDateIso, startAnchor]
  );
  // Transform the monthly data for the stacked areas
  const stackedData = useMemo(() => transformDataForBands(monthlyData), [monthlyData]);

  return (
    <div
      style={{
        marginTop: '2rem',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          maxHeight: '80vh',
          aspectRatio: '1.6',
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={stackedData}
            margin={{ top: 0, right: 20, bottom: 0, left: 50 }}
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
              label={{ value: 'Capital', angle: -90, position: 'insideBottomLeft' }}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            <Area dataKey="lower5" stackId="outerBand" stroke="none" fill="none" name=" " />
            <Area dataKey="lower25" stackId="innerBand" stroke="none" fill="none" name=" " />
            <Area
              dataKey="band5_95"
              stackId="outerBand"
              stroke="none"
              fill="#00FFFF"
              fillOpacity={0.3}
              name="Quantiles (5th-95th)"
            />
            <Area
              dataKey="band25_75"
              stackId="innerBand"
              stroke="none"
              fill="#0088FF"
              fillOpacity={0.7}
              name="Quantiles (25th-75th)"
            />
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
      </div>
      <FailedCasesSummary yearlyData={yearlySorted} monthlyData={monthlyData} />
    </div>
  );
};

export default YearlySummaryOverview;
