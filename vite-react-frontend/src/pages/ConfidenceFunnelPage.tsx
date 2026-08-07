import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useLatestSimulationResult } from '../state/latestSimulationResult';
import { Card, Chip, LinkButton, PageHeader } from '../components/ui';

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const ConfidenceFunnelPage: React.FC = () => {
  const { snapshot, summaries, loading, error } = useLatestSimulationResult();

  const chartData = useMemo(() => {
    if (!summaries) return [];
    return summaries
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((row) => ({
        year: row.year,
        p5: row.quantile5,
        p25: row.quantile25,
        median: row.medianCapital,
        p75: row.quantile75,
        p95: row.quantile95,
        // band heights for stacked areas
        bandOuterLow: row.quantile5,
        bandOuterHeight: Math.max(0, row.quantile95 - row.quantile5),
        bandInnerLow: row.quantile25,
        bandInnerHeight: Math.max(0, row.quantile75 - row.quantile25),
        widthPct: row.medianCapital > 0 ? Math.round(((row.quantile95 - row.quantile5) / row.medianCapital) * 100) : 0,
      }));
  }, [summaries]);

  const firstWidth = chartData[0]?.widthPct;
  const lastWidth = chartData[chartData.length - 1]?.widthPct;

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader
          title="Confidence Funnel"
          subtitle="The real P5–P95 and P25–P75 spread from your last simulation run, and how it narrows or widens over time."
        />

        {loading && <Card>Loading your last run's results…</Card>}
        {error && <Card className="border-danger">Could not load results: {error}</Card>}

        {!loading && !error && (!snapshot || chartData.length === 0) && (
          <Card className="grid gap-2">
            <div className="font-bold">No simulation results available yet</div>
            <div className="text-sm opacity-80">
              This page shows the real uncertainty band (P5–P95) from your most recent simulation run. Run one first to
              see it here.
            </div>
            <div>
              <LinkButton variant="primary" to="/fire-simulator">Open FIRE Simulator</LinkButton>
            </div>
          </Card>
        )}

        {chartData.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card>
                <div className="text-xs opacity-75">Run</div>
                <div className="font-extrabold">{snapshot?.runId.slice(0, 8)}…</div>
              </Card>
              <Card>
                <div className="text-xs opacity-75">Spread at year 1</div>
                <div className="font-extrabold">{firstWidth}% of median</div>
              </Card>
              <Card>
                <div className="text-xs opacity-75">Spread at final year</div>
                <div className="font-extrabold">{lastWidth}% of median</div>
              </Card>
            </div>

            <Card>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-extrabold">Uncertainty funnel</div>
                <div className="flex gap-2">
                  <Chip>P5–P95</Chip>
                  <Chip>P25–P75</Chip>
                  <Chip>Median</Chip>
                </div>
              </div>
              <div style={{ height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }} />
                    <YAxis tickFormatter={formatNumber} width={80} />
                    <Tooltip formatter={(v: number) => formatNumber(Number(v))} />
                    <Area type="monotone" dataKey="bandOuterLow" stackId="outer" stroke="none" fill="transparent" />
                    <Area type="monotone" dataKey="bandOuterHeight" stackId="outer" stroke="none" fill="#6366f1" fillOpacity={0.15} name="P5-P95 band" />
                    <Area type="monotone" dataKey="bandInnerLow" stackId="inner" stroke="none" fill="transparent" />
                    <Area type="monotone" dataKey="bandInnerHeight" stackId="inner" stroke="none" fill="#6366f1" fillOpacity={0.3} name="P25-P75 band" />
                    <Line type="monotone" dataKey="median" stroke="#6366f1" strokeWidth={2} dot={false} name="Median" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="text-sm opacity-80">
              Interventions (increasing contributions, cutting fees, improving tax treatment, adding spending flexibility)
              would each need their own simulation run to compare against this baseline — that comparison isn't wired up
              yet. For now, use the{' '}
              <Link to="/diff-scenarios" className="underline">
                Comparator
              </Link>{' '}
              to run a second scenario and diff it against this one.
            </Card>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default ConfidenceFunnelPage;
