import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, PageHeader, Textarea } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const HouseholdNegotiationBoardPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [decisionLabel, setDecisionLabel] = useState('Upgrade the car');
  const [monthlyCost, setMonthlyCost] = useState(1200);
  const [durationMonths, setDurationMonths] = useState(36);
  const [notes, setNotes] = useState('');

  const stats = useMemo(() => {
    const totalCost = monthlyCost * durationMonths;
    const monthlyRate = currentAssumptions.expectedReturnPct / 100 / 12;
    // Future value of investing that same monthly amount instead, over the same period.
    const investedInstead = monthlyRate > 0
      ? monthlyCost * ((Math.pow(1 + monthlyRate, durationMonths) - 1) / monthlyRate)
      : totalCost;
    const opportunityCost = investedInstead - totalCost;
    return { totalCost: Math.round(totalCost), investedInstead: Math.round(investedInstead), opportunityCost: Math.round(opportunityCost) };
  }, [monthlyCost, durationMonths, currentAssumptions.expectedReturnPct]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Household Negotiation Board" subtitle="Make a spending trade-off explicit: what it costs vs what it would have grown into if invested instead." />

        <Card className="grid gap-3">
          <div className="font-extrabold">Decision under discussion</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">Decision<input value={decisionLabel} onChange={(e) => setDecisionLabel(e.target.value)} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Cost / month<input type="number" value={monthlyCost} onChange={(e) => setMonthlyCost(Math.max(0, asNumber(e.target.value, monthlyCost)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Duration (months)<input type="number" value={durationMonths} onChange={(e) => setDurationMonths(Math.max(1, asNumber(e.target.value, durationMonths)))} className={fieldClass} /></label>
          </div>
          <label className="grid gap-1 text-xs">
            Non-negotiables / notes
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What matters to each person in this decision" />
          </label>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <div className="text-xs opacity-75">Total cost</div>
            <div className="text-2xl font-extrabold">{stats.totalCost.toLocaleString()} {currentAssumptions.currency}</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">If invested instead ({currentAssumptions.expectedReturnPct}%/yr)</div>
            <div className="text-2xl font-extrabold">{stats.investedInstead.toLocaleString()} {currentAssumptions.currency}</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">Opportunity cost</div>
            <div className="text-2xl font-extrabold">{stats.opportunityCost.toLocaleString()} {currentAssumptions.currency}</div>
          </Card>
        </div>

        <Card className="grid gap-2">
          <div className="font-extrabold">What this delays</div>
          <div className="text-sm opacity-85">
            "{decisionLabel}" costs {monthlyCost.toLocaleString()} {currentAssumptions.currency}/month for {durationMonths}{' '}
            months. At the assumed {currentAssumptions.expectedReturnPct}% return, that same money invested instead
            would have grown to {stats.investedInstead.toLocaleString()} {currentAssumptions.currency} — a real number to
            weigh against the value of the decision, not a verdict on whether to do it.
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default HouseholdNegotiationBoardPage;
