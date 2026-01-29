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
  /** If provided, Recharts will synchronize hover/tooltip/cursor across charts with the same syncId. */
  syncId?: string;
  /** ISO simulation start date (YYYY-MM-DD). Used to compute real-vs-nominal conversion. */
  simulationStartDateIso?: string;
  /** Yearly inflation factor (e.g. 1.02). Used to compute real-vs-nominal conversion. */
  inflationFactorPerYear?: number;
  /** Which capital series to visualize. */
  capitalView?: 'nominal' | 'real';
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
const parseStartYearMonth = (iso?: string): { year: number; month: number } | null => {
  if (!iso) return null;
  const m = /^\s*(\d{4})-(\d{2})-\d{2}\s*$/.exec(String(iso));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
};

const computeInflationIndexForMonth = (
  year: number,
  month: number,
  startYear: number,
  startMonth: number,
  inflationFactorPerYear: number
): number => {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 1;
  if (!Number.isFinite(startYear) || !Number.isFinite(startMonth)) return 1;
  if (!Number.isFinite(inflationFactorPerYear) || inflationFactorPerYear <= 0) return 1;

  const monthsSinceStart = Math.trunc((year - startYear) * 12 + (month - startMonth));
  const completedMonths = Math.max(0, monthsSinceStart);
  return Math.pow(inflationFactorPerYear, completedMonths / 12);
};

const transformDataForBands = (
  source: any[],
  opts?: { startYearMonth?: { year: number; month: number } | null; inflationFactorPerYear?: number }
) => {
  const startYearMonth = opts?.startYearMonth ?? null;
  const f = opts?.inflationFactorPerYear;

  return source.map((d) => {
    const year = Number(d.year);
    const month = Number(d.month);
    const inflationIdx =
      startYearMonth !== null && Number.isFinite(f) && Number(f) > 0
        ? computeInflationIndexForMonth(year, month, startYearMonth.year, startYearMonth.month, Number(f))
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
  capitalView?: 'nominal' | 'real';
}

/**
 * Custom tooltip that displays the Year-Month along with each quantile value.
 */
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length && payload[0].payload) {
    const dataPoint = payload[0].payload;
    const mode: 'nominal' | 'real' = dataPoint?.__capitalView === 'real' ? 'real' : 'nominal';

    const lower5 = mode === 'real' ? dataPoint.realLower5 : dataPoint.lower5;
    const band5_95 = mode === 'real' ? dataPoint.realBand5_95 : dataPoint.band5_95;
    const lower25 = mode === 'real' ? dataPoint.realLower25 : dataPoint.lower25;
    const band25_75 = mode === 'real' ? dataPoint.realBand25_75 : dataPoint.band25_75;
    const median = mode === 'real' ? dataPoint.realMedianCapital : dataPoint.medianCapital;

    const quantile5 = lower5;
    const quantile95 = lower5 + band5_95;
    const quantile25 = lower25;
    const quantile75 = lower25 + band25_75;

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
        <p style={{ margin: '0 0 4px 0' }}>{`${yearMonth} — ${mode === 'real' ? 'Real' : 'Nominal'}`}</p>
        <p style={{ margin: 0 }}>{`95th Quantile: ${formatNumber(quantile95)}`}</p>
        <p style={{ margin: 0 }}>{`75th Quantile: ${formatNumber(quantile75)}`}</p>
        <p style={{ margin: 0 }}>{`Median: ${formatNumber(median)}`}</p>
        <p style={{ margin: 0 }}>{`25th Quantile: ${formatNumber(quantile25)}`}</p>
        <p style={{ margin: 0 }}>{`5th Quantile: ${formatNumber(quantile5)}`}</p>
        <p style={{ margin: '4px 0 0 0' }}>{`Failure Rate: ${failPct.toFixed(2)}%`}</p>
      </div>
    );
  }
  return null;
};

const YearlySummaryOverview: React.FC<YearlySummaryOverviewProps> = ({
  data,
  syncId,
  simulationStartDateIso,
  inflationFactorPerYear,
  capitalView = 'nominal',
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
    const startYearMonth = parseStartYearMonth(simulationStartDateIso);
    return transformDataForBands(monthlyData, { startYearMonth, inflationFactorPerYear });
  }, [monthlyData, simulationStartDateIso, inflationFactorPerYear]);

  const canShowRealSeries = useMemo(() => {
    if (!simulationStartDateIso) return false;
    if (!Number.isFinite(Number(inflationFactorPerYear))) return false;
    const f = Number(inflationFactorPerYear);
    return f > 0 && Math.abs(f - 1) > 1e-12;
  }, [simulationStartDateIso, inflationFactorPerYear]);

  const effectiveCapitalView: 'nominal' | 'real' =
    capitalView === 'real' && canShowRealSeries ? 'real' : 'nominal';

  const chartKeys = useMemo(() => {
    if (effectiveCapitalView === 'real') {
      return {
        lower5: 'realLower5',
        band5_95: 'realBand5_95',
        lower25: 'realLower25',
        band25_75: 'realBand25_75',
        median: 'realMedianCapital',
      } as const;
    }
    return {
      lower5: 'lower5',
      band5_95: 'band5_95',
      lower25: 'lower25',
      band25_75: 'band25_75',
      median: 'medianCapital',
    } as const;
  }, [effectiveCapitalView]);

  const stackedDataWithMode = useMemo(() => {
    // Recharts tooltip payload doesn't include component props; embed mode into each datapoint.
    return stackedData.map((d: any) => ({ ...d, __capitalView: effectiveCapitalView }));
  }, [stackedData, effectiveCapitalView]);

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
            data={stackedDataWithMode}
            margin={{ top: 0, right: 20, bottom: 0, left: 50 }}
            syncId={syncId}
            syncMethod="value"
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
              label={{ value: `Capital (${effectiveCapitalView})`, angle: -90, position: 'insideBottomLeft' }}
              tickFormatter={formatNumber}
            />
            <YAxis
              yAxisId="failure"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip capitalView={effectiveCapitalView} />} />
            <Legend />

            <Area dataKey={chartKeys.lower5} stackId="outerBand" stroke="none" fill="none" name=" " />
            <Area dataKey={chartKeys.lower25} stackId="innerBand" stroke="none" fill="none" name=" " />
            <Area
              dataKey={chartKeys.band5_95}
              stackId="outerBand"
              stroke="none"
              fill="#00FFFF"
              fillOpacity={0.3}
              name={`Quantiles (5th-95th, ${effectiveCapitalView})`}
            />
            <Area
              dataKey={chartKeys.band25_75}
              stackId="innerBand"
              stroke="none"
              fill="#0088FF"
              fillOpacity={0.7}
              name={`Quantiles (25th-75th, ${effectiveCapitalView})`}
            />
            <Line
              type="monotone"
              dataKey={chartKeys.median}
              stroke="#0033FF"
              strokeWidth={2}
              dot={false}
              name={`Median Capital (${effectiveCapitalView})`}
            />
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
