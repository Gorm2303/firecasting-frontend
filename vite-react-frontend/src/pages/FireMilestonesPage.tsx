import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { useLatestSimulationResult, latestYearRow } from '../state/latestSimulationResult';
import { Card, Chip, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

/**
 * Months until `current + monthlyContribution` (compounding monthly at `annualRatePct`)
 * reaches `target`. Iterative rather than closed-form since we want a simple, easy-to-audit
 * calculation, not a hidden algebraic identity. Capped at 100 years.
 */
const monthsToReach = (current: number, monthlyContribution: number, annualRatePct: number, target: number): number | null => {
  if (current >= target) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  let capital = current;
  const maxMonths = 1200;
  for (let m = 1; m <= maxMonths; m += 1) {
    capital = capital * (1 + monthlyRate) + monthlyContribution;
    if (capital >= target) return m;
  }
  return null;
};

const formatMonths = (months: number | null): string => {
  if (months === null) return 'Not reachable within 100 years at this rate';
  if (months === 0) return 'Already there';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y > 0 && m > 0) return `${y}y ${m}mo`;
  if (y > 0) return `${y}y`;
  return `${m}mo`;
};

const FireMilestonesPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const { snapshot, summaries } = useLatestSimulationResult();
  const lastRow = latestYearRow(summaries);

  const [currentPortfolio, setCurrentPortfolio] = useState(200000);
  const [monthlyContribution, setMonthlyContribution] = useState(8000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(20000);
  const [leanMonthlyExpenses, setLeanMonthlyExpenses] = useState(14000);

  const returnPct = currentAssumptions.expectedReturnPct;
  const swrPct = currentAssumptions.safeWithdrawalPct;
  const bufferMonths = currentAssumptions.depositStrategyDefaults.emergencyBufferTargetMonths;

  const milestones = useMemo(() => {
    const bufferTarget = monthlyExpenses * bufferMonths;
    const leanTarget = swrPct > 0 ? (leanMonthlyExpenses * 12) / (swrPct / 100) : 0;
    const fireTarget = swrPct > 0 ? (monthlyExpenses * 12) / (swrPct / 100) : 0;
    // Coast FI: the amount that, left alone with no further contributions, grows to the full
    // FIRE number by the time contributions would otherwise have gotten there anyway.
    const monthsToFireWithContributions = monthsToReach(currentPortfolio, monthlyContribution, returnPct, fireTarget);
    const coastTarget = monthsToFireWithContributions
      ? fireTarget / Math.pow(1 + returnPct / 100, monthsToFireWithContributions / 12)
      : fireTarget;

    return [
      { id: 'buffer', label: 'Emergency buffer', target: bufferTarget, months: monthsToReach(currentPortfolio, monthlyContribution, returnPct, bufferTarget) },
      { id: 'coast', label: 'Coast FIRE', target: coastTarget, months: monthsToReach(currentPortfolio, monthlyContribution, returnPct, coastTarget) },
      { id: 'lean', label: 'Lean FIRE', target: leanTarget, months: monthsToReach(currentPortfolio, monthlyContribution, returnPct, leanTarget) },
      { id: 'fire', label: 'FIRE', target: fireTarget, months: monthsToFireWithContributions },
    ];
  }, [currentPortfolio, monthlyContribution, monthlyExpenses, leanMonthlyExpenses, returnPct, swrPct, bufferMonths]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader
          title="FIRE Milestones"
          subtitle="Buffer → Coast → Lean → FIRE. A local projection from your current numbers and the return/SWR assumptions in the Assumptions Hub."
        />

        <Card className="grid gap-3">
          <div className="font-extrabold">Your numbers</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-xs">
              Current portfolio
              <input type="number" value={currentPortfolio} onChange={(e) => setCurrentPortfolio(Math.max(0, asNumber(e.target.value, currentPortfolio)))} className={fieldClass} />
            </label>
            <label className="grid gap-1 text-xs">
              Monthly contribution
              <input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Math.max(0, asNumber(e.target.value, monthlyContribution)))} className={fieldClass} />
            </label>
            <label className="grid gap-1 text-xs">
              Target monthly expenses
              <input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(Math.max(0, asNumber(e.target.value, monthlyExpenses)))} className={fieldClass} />
            </label>
            <label className="grid gap-1 text-xs">
              Lean monthly expenses
              <input type="number" value={leanMonthlyExpenses} onChange={(e) => setLeanMonthlyExpenses(Math.max(0, asNumber(e.target.value, leanMonthlyExpenses)))} className={fieldClass} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 text-xs opacity-70">
            <Chip>Return: {returnPct}%/yr</Chip>
            <Chip>SWR: {swrPct}%</Chip>
            <Chip>Buffer target: {bufferMonths} months of expenses</Chip>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {milestones.map((m) => (
            <Card key={m.id} className="grid gap-1.5">
              <div className="font-bold">{m.label}</div>
              <div className="text-xl font-extrabold">{Math.round(m.target).toLocaleString()} {currentAssumptions.currency}</div>
              <div className="text-sm opacity-80">ETA: {formatMonths(m.months)}</div>
            </Card>
          ))}
        </div>

        <Card>
          <div className="mb-1 font-extrabold">Last simulator run</div>
          {snapshot && lastRow ? (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><div className="text-xs opacity-70">Run</div><div>{snapshot.runId.slice(0, 8)}…</div></div>
              <div><div className="text-xs opacity-70">Final year</div><div>{lastRow.year}</div></div>
              <div><div className="text-xs opacity-70">Median capital</div><div>{Math.round(lastRow.medianCapital).toLocaleString()}</div></div>
              <div><div className="text-xs opacity-70">P5–P95 band</div><div>{Math.round(lastRow.quantile5).toLocaleString()} – {Math.round(lastRow.quantile95).toLocaleString()}</div></div>
            </div>
          ) : (
            <div className="text-sm opacity-80">
              Run a simulation from the FIRE Simulator to see your real projected outcome alongside these local milestone
              estimates.
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
};

export default FireMilestonesPage;
