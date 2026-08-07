import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, Chip, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const SideHustleLabPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [hoursPerWeek, setHoursPerWeek] = useState(6);
  const [startupCost, setStartupCost] = useState(2500);
  const [recurringCostMonthly, setRecurringCostMonthly] = useState(250);
  const [expectedIncomeMonthlyLow, setExpectedIncomeMonthlyLow] = useState(2000);
  const [expectedIncomeMonthlyLikely, setExpectedIncomeMonthlyLikely] = useState(4000);
  const [expectedIncomeMonthlyHigh, setExpectedIncomeMonthlyHigh] = useState(8000);

  const stats = useMemo(() => {
    const netMonthlyLikely = expectedIncomeMonthlyLikely - recurringCostMonthly;
    const netMonthlyLow = expectedIncomeMonthlyLow - recurringCostMonthly;
    const netMonthlyHigh = expectedIncomeMonthlyHigh - recurringCostMonthly;
    const hoursPerMonth = hoursPerWeek * 4.33;
    const effectiveHourlyLikely = hoursPerMonth > 0 ? netMonthlyLikely / hoursPerMonth : 0;
    const paybackMonths = netMonthlyLikely > 0 ? startupCost / netMonthlyLikely : null;
    return {
      netMonthlyLow: Math.round(netMonthlyLow),
      netMonthlyLikely: Math.round(netMonthlyLikely),
      netMonthlyHigh: Math.round(netMonthlyHigh),
      effectiveHourlyLikely: Math.round(effectiveHourlyLikely),
      paybackMonths: paybackMonths !== null ? Math.round(paybackMonths * 10) / 10 : null,
    };
  }, [hoursPerWeek, recurringCostMonthly, expectedIncomeMonthlyLow, expectedIncomeMonthlyLikely, expectedIncomeMonthlyHigh, startupCost]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Side Hustle Lab" subtitle="Turn a side income idea into numbers: effective hourly rate, payback time, and net monthly contribution." />

        <Card className="grid gap-3">
          <div className="font-extrabold">Your idea</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">Hours available / week<input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Math.max(0, asNumber(e.target.value, hoursPerWeek)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Startup cost<input type="number" value={startupCost} onChange={(e) => setStartupCost(Math.max(0, asNumber(e.target.value, startupCost)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Recurring costs / month<input type="number" value={recurringCostMonthly} onChange={(e) => setRecurringCostMonthly(Math.max(0, asNumber(e.target.value, recurringCostMonthly)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Expected income — low<input type="number" value={expectedIncomeMonthlyLow} onChange={(e) => setExpectedIncomeMonthlyLow(Math.max(0, asNumber(e.target.value, expectedIncomeMonthlyLow)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Expected income — likely<input type="number" value={expectedIncomeMonthlyLikely} onChange={(e) => setExpectedIncomeMonthlyLikely(Math.max(0, asNumber(e.target.value, expectedIncomeMonthlyLikely)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Expected income — high<input type="number" value={expectedIncomeMonthlyHigh} onChange={(e) => setExpectedIncomeMonthlyHigh(Math.max(0, asNumber(e.target.value, expectedIncomeMonthlyHigh)))} className={fieldClass} /></label>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <div className="text-xs opacity-75">Net monthly (likely)</div>
            <div className="text-2xl font-extrabold">{stats.netMonthlyLikely} {currentAssumptions.currency}</div>
            <div className="mt-1 text-xs opacity-70">range {stats.netMonthlyLow} – {stats.netMonthlyHigh}</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">Effective hourly rate</div>
            <div className="text-2xl font-extrabold">{stats.effectiveHourlyLikely} {currentAssumptions.currency}/hr</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">Payback period</div>
            <div className="text-2xl font-extrabold">{stats.paybackMonths !== null ? `${stats.paybackMonths} mo` : 'Never at this rate'}</div>
          </Card>
          <Card>
            <div className="text-xs opacity-75">Annualized net</div>
            <div className="text-2xl font-extrabold">{stats.netMonthlyLikely * 12} {currentAssumptions.currency}</div>
            {stats.netMonthlyLikely > 0 && <Chip>Contributes to plan</Chip>}
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default SideHustleLabPage;
