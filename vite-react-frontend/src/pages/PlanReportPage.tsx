import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { useLatestSimulationResult, latestYearRow } from '../state/latestSimulationResult';
import { Card, Chip, LinkButton, PageHeader } from '../components/ui';

const formatNumber = (value: number): string => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

type Health = 'green' | 'yellow' | 'red';

const healthFromFailureRisk = (pct: number): Health => (pct < 5 ? 'green' : pct < 20 ? 'yellow' : 'red');

const healthLabel: Record<Health, string> = { green: 'Healthy', yellow: 'Watch', red: 'At risk' };

const PlanReportPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const { snapshot, summaries, loading } = useLatestSimulationResult();
  const lastRow = latestYearRow(summaries);
  const health: Health | null = lastRow ? healthFromFailureRisk(lastRow.negativeCapitalPercentage) : null;

  const nextActions = useMemo(() => {
    const actions: { title: string; body: string }[] = [];
    if (currentAssumptions.yearlyFeePct > 0.3) {
      actions.push({
        title: 'Check portfolio fees',
        body: `Your assumed fee is ${currentAssumptions.yearlyFeePct}%/yr. Even a 0.2pp reduction compounds meaningfully over a multi-decade horizon — worth comparing fund options.`,
      });
    }
    if (currentAssumptions.safeWithdrawalPct > 4.5) {
      actions.push({
        title: 'Reconsider the safe withdrawal rate',
        body: `A ${currentAssumptions.safeWithdrawalPct}% SWR is more aggressive than the commonly-cited 3.5-4% range — the Withdrawal Strategy page lets you test guardrails instead of a flat rate.`,
      });
    }
    if (lastRow && lastRow.negativeCapitalPercentage > 5) {
      actions.push({
        title: 'Add a spending-flexibility plan',
        body: `${lastRow.negativeCapitalPercentage.toFixed(1)}% of simulated paths ran out of capital in the final year. A pre-committed downturn cut plan (see Withdrawal Strategy's bad-year playbook) reduces this without changing the base plan.`,
      });
    }
    actions.push({
      title: 'Keep assumptions and reality in sync',
      body: 'Revisit the Assumptions Hub whenever your income, expenses, or return expectations change — every page on this site reads from the same baseline.',
    });
    return actions;
  }, [currentAssumptions, lastRow]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader
          title="Plan Report"
          subtitle="A short, human summary: plan health from your last run, key assumptions, and what to look at next."
        />

        <Card className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-extrabold">Executive summary</div>
            {health && <Chip>{healthLabel[health]}</Chip>}
          </div>
          {loading && <div className="text-sm opacity-80">Loading your last run…</div>}
          {!loading && !lastRow && (
            <div className="text-sm opacity-80">
              No simulation results yet.{' '}
              <LinkButton variant="secondary" to="/fire-simulator" className="ml-1">
                Run one
              </LinkButton>{' '}
              to populate this report with real numbers.
            </div>
          )}
          {lastRow && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><div className="text-xs opacity-70">Final year</div><div className="text-xl font-extrabold">{lastRow.year}</div></div>
              <div><div className="text-xs opacity-70">Median capital</div><div className="text-xl font-extrabold">{formatNumber(lastRow.medianCapital)}</div></div>
              <div><div className="text-xs opacity-70">P5–P95 range</div><div className="text-xl font-extrabold">{formatNumber(lastRow.quantile5)} – {formatNumber(lastRow.quantile95)}</div></div>
              <div><div className="text-xs opacity-70">Paths ending negative</div><div className="text-xl font-extrabold">{lastRow.negativeCapitalPercentage.toFixed(1)}%</div></div>
            </div>
          )}
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <Card className="grid gap-3">
            <div className="font-extrabold">Next best actions</div>
            <div className="grid gap-2.5">
              {nextActions.map((a) => (
                <div key={a.title} className="rounded-lg border border-card-border p-3">
                  <div className="font-bold">{a.title}</div>
                  <div className="mt-1 text-sm opacity-85">{a.body}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="grid gap-3">
            <div className="font-extrabold">Assumptions snapshot</div>
            <div className="grid gap-1.5 text-sm">
              <div className="flex justify-between"><span className="opacity-70">Currency</span><span>{currentAssumptions.currency}</span></div>
              <div className="flex justify-between"><span className="opacity-70">Inflation</span><span>{currentAssumptions.inflationPct}%</span></div>
              <div className="flex justify-between"><span className="opacity-70">Yearly fee</span><span>{currentAssumptions.yearlyFeePct}%</span></div>
              <div className="flex justify-between"><span className="opacity-70">Expected return</span><span>{currentAssumptions.expectedReturnPct}%</span></div>
              <div className="flex justify-between"><span className="opacity-70">Safe withdrawal rate</span><span>{currentAssumptions.safeWithdrawalPct}%</span></div>
              <div className="flex justify-between"><span className="opacity-70">Emergency buffer target</span><span>{currentAssumptions.depositStrategyDefaults.emergencyBufferTargetMonths} months</span></div>
            </div>
            <Link to="/assumptions" className="text-sm underline">Edit in Assumptions Hub →</Link>
          </Card>
        </div>

        <Card>
          <div className="mb-2 font-extrabold">Risks & mitigations</div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg border border-card-border p-3">
              <div className="font-bold">Sequence-of-returns risk</div>
              <div className="mt-1 text-sm opacity-85">Bad early returns near retirement hurt more than the same bad returns later. See Sequence Risk Radar once withdrawals start.</div>
            </div>
            <div className="rounded-lg border border-card-border p-3">
              <div className="font-bold">Inflation drift</div>
              <div className="mt-1 text-sm opacity-85">This report uses a fixed {currentAssumptions.inflationPct}% assumption. Real inflation is variable — revisit this yearly.</div>
            </div>
            <div className="rounded-lg border border-card-border p-3">
              <div className="font-bold">Tax and policy changes</div>
              <div className="mt-1 text-sm opacity-85">Tax exemption thresholds and rules change over time; the simulator applies today's rules for the full horizon.</div>
            </div>
            <div className="rounded-lg border border-card-border p-3">
              <div className="font-bold">Model risk</div>
              <div className="mt-1 text-sm opacity-85">All figures here are projections from stated assumptions, not guarantees. Re-run periodically as reality diverges from plan.</div>
            </div>
          </div>
        </Card>

        {snapshot && (
          <div className="text-xs opacity-60">Based on run {snapshot.runId} from {new Date(snapshot.createdAt).toLocaleString()}.</div>
        )}
      </div>
    </PageLayout>
  );
};

export default PlanReportPage;
