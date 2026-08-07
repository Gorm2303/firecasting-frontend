import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';
const sliderClass = 'w-full';

const EmergencyBufferOptimizerPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [monthlyExpenses, setMonthlyExpenses] = useState(20000);
  const [incomeStability, setIncomeStability] = useState(6);
  const [expenseVolatility, setExpenseVolatility] = useState(4);
  const [dependents, setDependents] = useState(0);
  const [jobMarketConfidence, setJobMarketConfidence] = useState(6);

  const recommendation = useMemo(() => {
    // Transparent additive heuristic — not a statistical model. Base 3 months, adjusted by
    // the factors below, clamped to a sane 1-18 month range.
    const base = 3;
    const stabilityAdj = (10 - incomeStability) * 0.3;
    const volatilityAdj = expenseVolatility * 0.2;
    const dependentsAdj = dependents * 0.5;
    const jobMarketAdj = (10 - jobMarketConfidence) * 0.2;
    const months = Math.max(1, Math.min(18, base + stabilityAdj + volatilityAdj + dependentsAdj + jobMarketAdj));
    return {
      months: Math.round(months * 10) / 10,
      amount: Math.round(months * monthlyExpenses),
      breakdown: [
        { label: 'Base', value: base },
        { label: 'Income stability', value: Math.round(stabilityAdj * 10) / 10 },
        { label: 'Expense volatility', value: Math.round(volatilityAdj * 10) / 10 },
        { label: 'Dependents', value: Math.round(dependentsAdj * 10) / 10 },
        { label: 'Job market confidence', value: Math.round(jobMarketAdj * 10) / 10 },
      ],
    };
  }, [monthlyExpenses, incomeStability, expenseVolatility, dependents, jobMarketConfidence]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Emergency Buffer Optimizer" subtitle="A transparent, adjustable-factor recommendation for how many months of expenses to hold in a buffer." />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
          <Card className="grid gap-3">
            <div className="font-extrabold">Inputs</div>
            <label className="grid gap-1 text-xs">
              Monthly core expenses
              <input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(Math.max(0, asNumber(e.target.value, monthlyExpenses)))} className={fieldClass + ' max-w-60'} />
            </label>
            <label className="grid gap-1 text-xs">
              Income stability ({incomeStability}/10, higher = more stable)
              <input type="range" min={0} max={10} value={incomeStability} onChange={(e) => setIncomeStability(asNumber(e.target.value, incomeStability))} className={sliderClass} />
            </label>
            <label className="grid gap-1 text-xs">
              Expense volatility ({expenseVolatility}/10, higher = more volatile)
              <input type="range" min={0} max={10} value={expenseVolatility} onChange={(e) => setExpenseVolatility(asNumber(e.target.value, expenseVolatility))} className={sliderClass} />
            </label>
            <label className="grid gap-1 text-xs">
              Job market confidence ({jobMarketConfidence}/10, higher = easier to re-employ)
              <input type="range" min={0} max={10} value={jobMarketConfidence} onChange={(e) => setJobMarketConfidence(asNumber(e.target.value, jobMarketConfidence))} className={sliderClass} />
            </label>
            <label className="grid gap-1 text-xs">
              Dependents
              <input type="number" min={0} max={10} value={dependents} onChange={(e) => setDependents(Math.max(0, asNumber(e.target.value, dependents)))} className={fieldClass + ' max-w-32'} />
            </label>
          </Card>

          <Card className="grid gap-3">
            <div className="font-extrabold">Recommendation</div>
            <div>
              <div className="text-xs opacity-70">Target buffer</div>
              <div className="text-3xl font-extrabold">{recommendation.months} months</div>
              <div className="text-xl font-bold opacity-90">{recommendation.amount.toLocaleString()} {currentAssumptions.currency}</div>
            </div>
            <div className="grid gap-1 text-sm">
              {recommendation.breakdown.map((b) => (
                <div key={b.label} className="flex justify-between opacity-80">
                  <span>{b.label}</span>
                  <span>{b.value >= 0 ? '+' : ''}{b.value} mo</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="grid gap-2">
          <div className="font-extrabold">Refill / pause / release policy</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-card-border p-3">
              <div className="font-bold">Refill trigger</div>
              <div className="mt-1 text-sm opacity-80">If buffer &lt; 70% of target → prioritize refill deposits over other goals.</div>
            </div>
            <div className="rounded-lg border border-card-border p-3">
              <div className="font-bold">Pause trigger</div>
              <div className="mt-1 text-sm opacity-80">If buffer &lt; 40% of target → pause discretionary spending and non-essential investing.</div>
            </div>
            <div className="rounded-lg border border-card-border p-3">
              <div className="font-bold">Release trigger</div>
              <div className="mt-1 text-sm opacity-80">If buffer &gt; 120% of target → route the excess to goals or investments.</div>
            </div>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default EmergencyBufferOptimizerPage;
