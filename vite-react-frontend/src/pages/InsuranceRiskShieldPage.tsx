import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, Chip, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const InsuranceRiskShieldPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [monthlyExpenses, setMonthlyExpenses] = useState(20000);
  const [monthlyIncome, setMonthlyIncome] = useState(30000);
  const [healthDeductible, setHealthDeductible] = useState(15000);
  const [disabilityIncomePct, setDisabilityIncomePct] = useState(60);
  const [incomeProtectionMonths, setIncomeProtectionMonths] = useState(6);
  const [currentBuffer, setCurrentBuffer] = useState(90000);

  const scenarios = useMemo(() => {
    const disabilityMonthlyIncome = monthlyIncome * (disabilityIncomePct / 100);
    const disabilityMonthlyGap = Math.max(0, monthlyExpenses - disabilityMonthlyIncome);

    const jobLossMonthlyGap = monthlyExpenses; // no income replacement assumed beyond savings/buffer
    const jobLossMonthsCovered = jobLossMonthlyGap > 0 ? currentBuffer / jobLossMonthlyGap : Infinity;

    const healthEventGap = healthDeductible; // one-off, assumed absorbed by buffer immediately
    const healthMonthsToCover = monthlyExpenses > 0 ? healthEventGap / monthlyExpenses : 0;

    return [
      {
        id: 'health',
        label: 'Health event',
        worstMonthGap: Math.round(healthEventGap),
        bufferMonthsNeeded: Math.round(healthMonthsToCover * 10) / 10,
        note: `A single deductible of ${healthDeductible.toLocaleString()} ${currentAssumptions.currency} due at once.`,
      },
      {
        id: 'disability',
        label: 'Disability',
        worstMonthGap: Math.round(disabilityMonthlyGap),
        bufferMonthsNeeded: incomeProtectionMonths,
        note: `Coverage replaces ${disabilityIncomePct}% of income, leaving a ${Math.round(disabilityMonthlyGap).toLocaleString()} ${currentAssumptions.currency}/mo gap for up to ${incomeProtectionMonths} months of protection.`,
      },
      {
        id: 'job-loss',
        label: 'Job loss',
        worstMonthGap: Math.round(jobLossMonthlyGap),
        bufferMonthsNeeded: Number.isFinite(jobLossMonthsCovered) ? Math.round(jobLossMonthsCovered * 10) / 10 : 0,
        note: `Full income gap, covered by buffer only: your current buffer lasts ~${Number.isFinite(jobLossMonthsCovered) ? (Math.round(jobLossMonthsCovered * 10) / 10) : '∞'} months at this expense level.`,
      },
    ];
  }, [monthlyExpenses, monthlyIncome, healthDeductible, disabilityIncomePct, incomeProtectionMonths, currentBuffer, currentAssumptions.currency]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Insurance Risk Shield" subtitle="Stress-test health, disability, and job-loss scenarios against your coverage and buffer." />

        <Card className="grid gap-3">
          <div className="font-extrabold">Coverage & finances</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">Monthly expenses<input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(Math.max(0, asNumber(e.target.value, monthlyExpenses)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Monthly income<input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(Math.max(0, asNumber(e.target.value, monthlyIncome)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Current buffer<input type="number" value={currentBuffer} onChange={(e) => setCurrentBuffer(Math.max(0, asNumber(e.target.value, currentBuffer)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Health deductible / max OOP<input type="number" value={healthDeductible} onChange={(e) => setHealthDeductible(Math.max(0, asNumber(e.target.value, healthDeductible)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Disability income coverage (%)<input type="number" value={disabilityIncomePct} onChange={(e) => setDisabilityIncomePct(Math.max(0, Math.min(100, asNumber(e.target.value, disabilityIncomePct))))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Income protection (months covered)<input type="number" value={incomeProtectionMonths} onChange={(e) => setIncomeProtectionMonths(Math.max(0, asNumber(e.target.value, incomeProtectionMonths)))} className={fieldClass} /></label>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          {scenarios.map((s) => (
            <Card key={s.id} className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold">{s.label}</div>
                <Chip>{s.bufferMonthsNeeded} mo</Chip>
              </div>
              <div className="text-xl font-extrabold">{s.worstMonthGap.toLocaleString()} {currentAssumptions.currency}</div>
              <div className="text-xs opacity-70">worst-month gap</div>
              <div className="text-sm opacity-85">{s.note}</div>
            </Card>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

export default InsuranceRiskShieldPage;
