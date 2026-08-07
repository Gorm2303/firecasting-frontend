import React, { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useLatestSimulationResult } from '../state/latestSimulationResult';
import { Card, LinkButton, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';
const formatNumber = (value: number): string => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const SequenceRiskRadarPage: React.FC = () => {
  const { snapshot, summaries, loading, error } = useLatestSimulationResult();

  const [worstYearReturnPct, setWorstYearReturnPct] = useState(-25);
  const [monthlySpending, setMonthlySpending] = useState(22000);

  const chartData = useMemo(() => {
    if (!summaries) return [];
    return summaries
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((row) => ({ year: row.year, phaseName: row.phaseName, quantile5: row.quantile5, median: row.medianCapital, quantile95: row.quantile95 }));
  }, [summaries]);

  const withdrawStartYear = useMemo(() => {
    const firstWithdraw = chartData.find((d) => d.phaseName?.toUpperCase().includes('WITHDRAW'));
    return firstWithdraw?.year ?? null;
  }, [chartData]);

  // Simple local heuristic: a worse-than-expected year requires a proportional spending cut to
  // preserve the same portfolio drawdown path. Not derived from the actual simulation.
  const computedCut = useMemo(() => {
    const shortfallPct = Math.max(0, -worstYearReturnPct - 10); // assume 10% is "expected" bad-year buffer
    return Math.min(50, Math.round(shortfallPct * 0.6));
  }, [worstYearReturnPct]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Sequence Risk Radar" subtitle="Danger zones around the deposit → withdrawal transition, from your last run, plus a bad-year spending-cut estimate." />

        {loading && <Card>Loading your last run's results…</Card>}
        {error && <Card className="border-danger">Could not load results: {error}</Card>}
        {!loading && !error && (!snapshot || chartData.length === 0) && (
          <Card className="grid gap-2">
            <div className="font-bold">No simulation results available yet</div>
            <div className="text-sm opacity-80">Run a simulation to see the real fragility radar around your withdrawal start.</div>
            <div><LinkButton variant="primary" to="/fire-simulator">Open FIRE Simulator</LinkButton></div>
          </Card>
        )}

        {chartData.length > 0 && (
          <Card>
            <div className="mb-2 font-extrabold">Fragility radar{withdrawStartYear ? ` — withdrawals start year ${withdrawStartYear}` : ''}</div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }} />
                  <YAxis tickFormatter={formatNumber} width={80} />
                  <Tooltip formatter={(v: number) => formatNumber(Number(v))} />
                  {withdrawStartYear !== null && (
                    <ReferenceLine x={withdrawStartYear} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Withdrawals start', position: 'top', fill: '#ef4444', fontSize: 12 }} />
                  )}
                  <Line type="monotone" dataKey="quantile5" name="P5" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="median" name="Median" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="quantile95" name="P95" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs opacity-70">
              The years right around the dashed line are the highest-fragility window — a bad market sequence there hits
              hardest because withdrawals start compounding losses instead of deposits smoothing them out.
            </div>
          </Card>
        )}

        <Card className="grid gap-3">
          <div className="font-extrabold">Bad-year spending-cut estimate (local heuristic)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">
              Worst-year return (%)
              <input type="range" min={-70} max={20} value={worstYearReturnPct} onChange={(e) => setWorstYearReturnPct(asNumber(e.target.value, worstYearReturnPct))} />
              <div className="text-sm font-bold">{worstYearReturnPct}%</div>
            </label>
            <label className="grid gap-1 text-xs">
              Current monthly spending
              <input type="number" value={monthlySpending} onChange={(e) => setMonthlySpending(Math.max(0, asNumber(e.target.value, monthlySpending)))} className={fieldClass} />
            </label>
            <div className="rounded-lg border border-card-border p-3">
              <div className="text-xs opacity-70">Suggested cut</div>
              <div className="text-xl font-extrabold">{computedCut}%</div>
              <div className="text-xs opacity-70">→ {Math.round(monthlySpending * (1 - computedCut / 100)).toLocaleString()}/mo</div>
            </div>
          </div>
          <div className="text-xs opacity-70">
            Heuristic: for every percentage point of return worse than a 10%-down "expected bad year", suggest cutting
            spending by 0.6 of that shortfall, capped at 50%. This is a rule of thumb, not derived from your actual
            simulation — use the Withdrawal Strategy page's guardrails for a plan-specific rule.
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default SequenceRiskRadarPage;
