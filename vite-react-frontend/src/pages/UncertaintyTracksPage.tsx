import React, { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useLatestSimulationResult, latestYearRow } from '../state/latestSimulationResult';
import { Card, LinkButton, PageHeader } from '../components/ui';

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const TRACKS: Array<{ key: 'quantile5' | 'quantile25' | 'medianCapital' | 'quantile75' | 'quantile95'; label: string; action: string }> = [
  { key: 'quantile5', label: 'P5 (bad case)', action: 'If you land near here: cut discretionary spending, delay any planned one-off purchases, and hold off increasing withdrawal amounts.' },
  { key: 'quantile25', label: 'P25', action: 'Below-plan but not critical. Re-check contributions and fees before making spending changes.' },
  { key: 'medianCapital', label: 'Median (P50)', action: 'On track. Rebalance on schedule, no plan changes needed.' },
  { key: 'quantile75', label: 'P75', action: 'Ahead of plan. Consider whether the extra margin should go to goals, giving, or de-risking.' },
  { key: 'quantile95', label: 'P95 (good case)', action: 'Well ahead of plan. Revisit whether the FIRE date or spending ceiling should move.' },
];

const TRACK_COLORS: Record<string, string> = {
  quantile5: '#ef4444',
  quantile25: '#f59e0b',
  medianCapital: '#6366f1',
  quantile75: '#22c55e',
  quantile95: '#06b6d4',
};

const UncertaintyTracksPage: React.FC = () => {
  const { snapshot, summaries, loading, error } = useLatestSimulationResult();
  const lastRow = latestYearRow(summaries);

  const chartData = useMemo(() => {
    if (!summaries) return [];
    return summaries
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((row) => ({
        year: row.year,
        quantile5: row.quantile5,
        quantile25: row.quantile25,
        medianCapital: row.medianCapital,
        quantile75: row.quantile75,
        quantile95: row.quantile95,
        negativeCapitalPercentage: row.negativeCapitalPercentage,
      }));
  }, [summaries]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader
          title="Uncertainty Tracks"
          subtitle="Parallel P5/P25/P50/P75/P95 tracks from your last run, with per-track KPIs and a runbook of what to do if you land on each."
        />

        {loading && <Card>Loading your last run's results…</Card>}
        {error && <Card className="border-danger">Could not load results: {error}</Card>}

        {!loading && !error && (!snapshot || chartData.length === 0) && (
          <Card className="grid gap-2">
            <div className="font-bold">No simulation results available yet</div>
            <div className="text-sm opacity-80">Run a simulation to see the real percentile tracks here.</div>
            <div>
              <LinkButton variant="primary" to="/fire-simulator">Open FIRE Simulator</LinkButton>
            </div>
          </Card>
        )}

        {chartData.length > 0 && (
          <>
            <Card>
              <div className="mb-2 font-extrabold">Track comparison</div>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }} />
                    <YAxis tickFormatter={formatNumber} width={80} />
                    <Tooltip formatter={(v: number) => formatNumber(Number(v))} />
                    {TRACKS.map((t) => (
                      <Line key={t.key} type="monotone" dataKey={t.key} name={t.label} stroke={TRACK_COLORS[t.key]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="mb-2 font-extrabold">Per-track KPIs (final year){lastRow ? ` — year ${lastRow.year}` : ''}</div>
              <div className="overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-card-border px-2.5 py-2 text-left text-xs opacity-75">Track</th>
                      <th className="border-b border-card-border px-2.5 py-2 text-left text-xs opacity-75">Final capital</th>
                      <th className="border-b border-card-border px-2.5 py-2 text-left text-xs opacity-75">Runbook action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TRACKS.map((t) => (
                      <tr key={t.key}>
                        <td className="border-b border-card-border px-2.5 py-2.5 font-bold">{t.label}</td>
                        <td className="border-b border-card-border px-2.5 py-2.5">{lastRow ? formatNumber(lastRow[t.key]) : '—'}</td>
                        <td className="border-b border-card-border px-2.5 py-2.5 opacity-85">{t.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastRow && (
                <div className="mt-3 text-xs opacity-70">
                  Negative-capital share in the final year: {lastRow.negativeCapitalPercentage.toFixed(1)}% of simulated paths.
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default UncertaintyTracksPage;
