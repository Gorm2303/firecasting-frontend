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
  /** ISO simulation start date (YYYY-MM-DD). Used to compute real-vs-nominal conversion. */
  simulationStartDateIso?: string;
  /** Yearly inflation factor (e.g. 1.02). Used to compute real-vs-nominal conversion. */
  inflationFactorPerYear?: number;
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
const parseStartYear = (iso?: string): number | null => {
  if (!iso) return null;
  const m = /^\s*(\d{4})-\d{2}-\d{2}\s*$/.exec(String(iso));
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
};

const computeInflationIndex = (year: number, startYear: number, inflationFactorPerYear: number): number => {
  if (!Number.isFinite(year) || !Number.isFinite(startYear)) return 1;
  if (!Number.isFinite(inflationFactorPerYear) || inflationFactorPerYear <= 0) return 1;
  const completedYears = Math.max(0, Math.trunc(year - startYear));
  return Math.pow(inflationFactorPerYear, completedYears);
};

const transformDataForBands = (source: any[], opts?: { startYear?: number | null; inflationFactorPerYear?: number }) => {
  const startYear = opts?.startYear ?? null;
  const f = opts?.inflationFactorPerYear;

  return source.map((d) => {
    const year = Number(d.year);
    const inflationIdx =
      startYear !== null && Number.isFinite(f) && Number(f) > 0
        ? computeInflationIndex(year, startYear, Number(f))
        : 1;

    const q5 = Number(d.quantile5);
    const q25 = Number(d.quantile25);
    const q75 = Number(d.quantile75);
    const q95 = Number(d.quantile95);
    const median = Number(d.medianCapital);

    return {
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
    inflationIdx,
    // Real (start-date currency): divide by inflation index (inflation compounds at year-end).
    realLower5: inflationIdx ? q5 / inflationIdx : q5,
    realBand5_95: inflationIdx ? (q95 - q5) / inflationIdx : (q95 - q5),
    realLower25: inflationIdx ? q25 / inflationIdx : q25,
    realBand25_75: inflationIdx ? (q75 - q25) / inflationIdx : (q75 - q25),
    realMedianCapital: inflationIdx ? median / inflationIdx : median,
    negativeCapitalPercentage: d.negativeCapitalPercentage,
    };
  });
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

    const realQuantile5 = dataPoint.realLower5;
    const realQuantile95 = dataPoint.realLower5 + dataPoint.realBand5_95;
    const realQuantile25 = dataPoint.realLower25;
    const realQuantile75 = dataPoint.realLower25 + dataPoint.realBand25_75;
    const realMedian = dataPoint.realMedianCapital;
    const showReal = Number(dataPoint.inflationIdx) && Math.abs(Number(dataPoint.inflationIdx) - 1) > 1e-12;

    const failPct = Number(dataPoint.negativeCapitalPercentage) || 0;
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
        <p style={{ margin: 0 }}>{`95th Quantile (nominal): ${formatNumber(quantile95)}`}</p>
        <p style={{ margin: 0 }}>{`75th Quantile (nominal): ${formatNumber(quantile75)}`}</p>
        <p style={{ margin: 0 }}>{`Median (nominal): ${formatNumber(median)}`}</p>
        <p style={{ margin: 0 }}>{`25th Quantile (nominal): ${formatNumber(quantile25)}`}</p>
        <p style={{ margin: 0 }}>{`5th Quantile (nominal): ${formatNumber(quantile5)}`}</p>

        {showReal && (
          <>
            <div style={{ height: 6 }} />
            <p style={{ margin: 0, opacity: 0.9 }}>{`95th Quantile (real): ${formatNumber(realQuantile95)}`}</p>
            <p style={{ margin: 0, opacity: 0.9 }}>{`75th Quantile (real): ${formatNumber(realQuantile75)}`}</p>
            <p style={{ margin: 0, opacity: 0.9 }}>{`Median (real): ${formatNumber(realMedian)}`}</p>
            <p style={{ margin: 0, opacity: 0.9 }}>{`25th Quantile (real): ${formatNumber(realQuantile25)}`}</p>
            <p style={{ margin: 0, opacity: 0.9 }}>{`5th Quantile (real): ${formatNumber(realQuantile5)}`}</p>
          </>
        )}
        <p style={{ margin: '4px 0 0 0' }}>{`Failure Rate: ${failPct.toFixed(2)}%`}</p>
      </div>
    );
  }
  return null;
};

const YearlySummaryOverview: React.FC<YearlySummaryOverviewProps> = ({
  data,
  simulationStartDateIso,
  inflationFactorPerYear,
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
  const stackedData = useMemo(() => {
    const startYear = parseStartYear(simulationStartDateIso);
    return transformDataForBands(monthlyData, { startYear, inflationFactorPerYear });
  }, [monthlyData, simulationStartDateIso, inflationFactorPerYear]);

  const showRealSeries = useMemo(() => {
    if (!simulationStartDateIso) return false;
    if (!Number.isFinite(Number(inflationFactorPerYear))) return false;
    const f = Number(inflationFactorPerYear);
    return f > 0 && Math.abs(f - 1) > 1e-12;
  }, [simulationStartDateIso, inflationFactorPerYear]);

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
              label={{ value: 'Capital (nominal)', angle: -90, position: 'insideBottomLeft' }}
              tickFormatter={formatNumber}
            />
            <YAxis
              yAxisId="failure"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
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
              name="Quantiles (5th-95th, nominal)"
            />
            <Area
              dataKey="band25_75"
              stackId="innerBand"
              stroke="none"
              fill="#0088FF"
              fillOpacity={0.7}
              name="Quantiles (25th-75th, nominal)"
            />
            <Line
              type="monotone"
              dataKey="medianCapital"
              stroke="#0033FF"
              strokeWidth={2}
              dot={false}
              name="Median Capital (nominal)"
            />

            {showRealSeries && (
              <Line
                type="monotone"
                dataKey="realMedianCapital"
                stroke="#00B894"
                strokeWidth={2}
                dot={false}
                name="Median Capital (real)"
              />
            )}
            <Line
              type="monotone"
              yAxisId="failure"
              dataKey="negativeCapitalPercentage"
              stroke="#ff4d4d"
              strokeWidth={2}
              dot={false}
              name="Failure Rate (%)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <FailedCasesSummary yearlyData={yearlySorted} monthlyData={monthlyData} />
    </div>
  );
};

export default YearlySummaryOverview;
