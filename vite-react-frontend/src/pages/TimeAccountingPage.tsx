import React, { useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const TimeAccountingPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [netMonthlyIncome, setNetMonthlyIncome] = useState(35000);
  const [workHoursPerWeek, setWorkHoursPerWeek] = useState(37);
  const [commuteMinPerDay, setCommuteMinPerDay] = useState(60);
  const [recoveryHoursPerWeek, setRecoveryHoursPerWeek] = useState(5);
  const [vacationWeeksPerYear, setVacationWeeksPerYear] = useState(6);
  const [sideIncomeMonthly, setSideIncomeMonthly] = useState(0);

  const stats = useMemo(() => {
    const workWeeksPerYear = Math.max(1, 52 - vacationWeeksPerYear);
    const commuteHoursPerWeek = (commuteMinPerDay * 5) / 60;
    const totalWorkRelatedHoursPerWeek = workHoursPerWeek + commuteHoursPerWeek + recoveryHoursPerWeek;
    const wakingHoursPerWeek = 16 * 7;
    const freeHoursPerWeek = Math.max(0, wakingHoursPerWeek - totalWorkRelatedHoursPerWeek);

    const totalIncomeMonthly = netMonthlyIncome + sideIncomeMonthly;
    const workHoursPerMonth = (workHoursPerWeek * workWeeksPerYear) / 12;
    const commuteHoursPerMonth = (commuteHoursPerWeek * workWeeksPerYear) / 12;
    const effectiveHourlyRate = workHoursPerMonth + commuteHoursPerMonth > 0
      ? totalIncomeMonthly / (workHoursPerMonth + commuteHoursPerMonth)
      : 0;
    const nominalHourlyRate = workHoursPerMonth > 0 ? netMonthlyIncome / workHoursPerMonth : 0;

    const commuteCostMonthly = commuteHoursPerMonth * nominalHourlyRate;
    const recoveryCostMonthly = ((recoveryHoursPerWeek * workWeeksPerYear) / 12) * nominalHourlyRate;

    return {
      freeHoursPerWeek: Math.round(freeHoursPerWeek * 10) / 10,
      effectiveHourlyRate: Math.round(effectiveHourlyRate),
      nominalHourlyRate: Math.round(nominalHourlyRate),
      commuteCostMonthly: Math.round(commuteCostMonthly),
      recoveryCostMonthly: Math.round(recoveryCostMonthly),
    };
  }, [netMonthlyIncome, workHoursPerWeek, commuteMinPerDay, recoveryHoursPerWeek, vacationWeeksPerYear, sideIncomeMonthly]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Time Accounting Dashboard" subtitle="Turns money into time: what work, commuting, and recovery actually cost in hours." />

        <Card className="grid gap-3">
          <div className="font-extrabold">Inputs</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">Net monthly income<input type="number" value={netMonthlyIncome} onChange={(e) => setNetMonthlyIncome(Math.max(0, asNumber(e.target.value, netMonthlyIncome)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Side income (monthly)<input type="number" value={sideIncomeMonthly} onChange={(e) => setSideIncomeMonthly(Math.max(0, asNumber(e.target.value, sideIncomeMonthly)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Work hours / week<input type="number" value={workHoursPerWeek} onChange={(e) => setWorkHoursPerWeek(Math.max(0, asNumber(e.target.value, workHoursPerWeek)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Commute (minutes/day)<input type="number" value={commuteMinPerDay} onChange={(e) => setCommuteMinPerDay(Math.max(0, asNumber(e.target.value, commuteMinPerDay)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Stress recovery (hrs/week)<input type="number" value={recoveryHoursPerWeek} onChange={(e) => setRecoveryHoursPerWeek(Math.max(0, asNumber(e.target.value, recoveryHoursPerWeek)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Vacation (weeks/year)<input type="number" value={vacationWeeksPerYear} onChange={(e) => setVacationWeeksPerYear(Math.max(0, Math.min(20, asNumber(e.target.value, vacationWeeksPerYear))))} className={fieldClass} /></label>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card><div className="text-xs opacity-75">Net free hours / week</div><div className="text-2xl font-extrabold">{stats.freeHoursPerWeek}</div></Card>
          <Card><div className="text-xs opacity-75">Effective hourly rate</div><div className="text-2xl font-extrabold">{stats.effectiveHourlyRate} {currentAssumptions.currency}</div></Card>
          <Card><div className="text-xs opacity-75">Commute cost / month</div><div className="text-2xl font-extrabold">{stats.commuteCostMonthly} {currentAssumptions.currency}</div></Card>
          <Card><div className="text-xs opacity-75">Recovery cost / month</div><div className="text-2xl font-extrabold">{stats.recoveryCostMonthly} {currentAssumptions.currency}</div></Card>
        </div>

        <Card className="text-sm opacity-80">
          "Effective hourly rate" divides your total income by work hours <em>plus</em> commute hours — it's usually
          lower than your nominal hourly wage ({stats.nominalHourlyRate} {currentAssumptions.currency}/hr), which is the
          point: commuting and recovery time are real costs of earning that income, even though they don't show up on a
          payslip.
        </Card>
      </div>
    </PageLayout>
  );
};

export default TimeAccountingPage;
