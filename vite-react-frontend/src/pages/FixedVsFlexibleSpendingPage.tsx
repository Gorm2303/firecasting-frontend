import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, Chip, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const FixedVsFlexibleSpendingPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [fixedExpenses, setFixedExpenses] = useState(18000);
  const [flexibleExpenses, setFlexibleExpenses] = useState(8000);
  const [targetCutPct, setTargetCutPct] = useState(15);
  const [currentBuffer, setCurrentBuffer] = useState(60000);

  const stats = useMemo(() => {
    const totalExpenses = fixedExpenses + flexibleExpenses;
    const stiffnessRatio = totalExpenses > 0 ? Math.round((fixedExpenses / totalExpenses) * 100) : 0;
    const maxSafeCut = Math.round(flexibleExpenses * (targetCutPct / 100));
    const reducedExpenses = totalExpenses - maxSafeCut;
    const baselineSurvivalMonths = totalExpenses > 0 ? currentBuffer / totalExpenses : 0;
    const flexedSurvivalMonths = reducedExpenses > 0 ? currentBuffer / reducedExpenses : 0;
    const survivalGainMonths = flexedSurvivalMonths - baselineSurvivalMonths;
    return {
      totalExpenses,
      stiffnessRatio,
      maxSafeCut,
      baselineSurvivalMonths: Math.round(baselineSurvivalMonths * 10) / 10,
      flexedSurvivalMonths: Math.round(flexedSurvivalMonths * 10) / 10,
      survivalGainMonths: Math.round(survivalGainMonths * 10) / 10,
    };
  }, [fixedExpenses, flexibleExpenses, targetCutPct, currentBuffer]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Fixed vs Flexible Spending Analyzer" subtitle="Split spending into stiff (non-negotiable) vs bendable, and see how much runway a downturn cut buys you." />

        <Card className="grid gap-3">
          <div className="font-extrabold">Expense split</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-xs">Fixed expenses / month<input type="number" value={fixedExpenses} onChange={(e) => setFixedExpenses(Math.max(0, asNumber(e.target.value, fixedExpenses)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Flexible expenses / month<input type="number" value={flexibleExpenses} onChange={(e) => setFlexibleExpenses(Math.max(0, asNumber(e.target.value, flexibleExpenses)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Target cut in downturn (%)<input type="number" value={targetCutPct} onChange={(e) => setTargetCutPct(Math.max(0, Math.min(100, asNumber(e.target.value, targetCutPct))))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Current buffer<input type="number" value={currentBuffer} onChange={(e) => setCurrentBuffer(Math.max(0, asNumber(e.target.value, currentBuffer)))} className={fieldClass} /></label>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <div className="text-xs opacity-75">Stiffness ratio</div>
            <div className="text-2xl font-extrabold">{stats.stiffnessRatio}%</div>
            <div className="mt-1 text-xs opacity-70">of spending is fixed</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">Max safe cut</div>
            <div className="text-2xl font-extrabold">{stats.maxSafeCut} {currentAssumptions.currency}/mo</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">Baseline survival</div>
            <div className="text-2xl font-extrabold">{stats.baselineSurvivalMonths} mo</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">Survival with cut plan</div>
            <div className="text-2xl font-extrabold">{stats.flexedSurvivalMonths} mo</div>
            <Chip>+{stats.survivalGainMonths} mo</Chip>
          </Card>
        </div>

        <Card className="grid gap-2">
          <div className="font-extrabold">Interpretation</div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-subtle">
            <div className="h-full bg-accent" style={{ width: `${stats.stiffnessRatio}%` }} />
          </div>
          <div className="text-sm opacity-80">
            {stats.stiffnessRatio >= 75
              ? 'Most of the plan is stiff — a downturn cut plan has limited room to work with. Consider whether any "fixed" costs (subscriptions, insurance tiers) can actually move.'
              : stats.stiffnessRatio >= 50
              ? 'A moderate share of spending is flexible — the buffer above is a real, usable cut plan.'
              : 'Most of the plan is bendable — cutting the flexible share buys meaningful extra runway in a downturn.'}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default FixedVsFlexibleSpendingPage;
