import React, { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Card, Chip, PageHeader } from '../components/ui';

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';
const HORIZON_YEARS = 30;

const SHOCK_PRESETS = [
  { id: 'bad-start', label: 'Bad first 5 years', shockYear: 1, shockDurationYears: 5, shockReturnPct: -8, note: 'Early drawdown shock. Focus: runway + flexibility.' },
  { id: 'inflation', label: 'High inflation decade', shockYear: 1, shockDurationYears: 10, shockReturnPct: -2, note: 'Spending pressure. Focus: real spending guardrails.' },
  { id: 'job-loss', label: 'Job loss year', shockYear: 3, shockDurationYears: 1, shockReturnPct: -15, note: 'Income gap. Focus: buffer policy + recovery plan.' },
];

const StressTestLabPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [startingCapital, setStartingCapital] = useState(500000);
  const [monthlyContribution, setMonthlyContribution] = useState(8000);
  const [shockYear, setShockYear] = useState(1);
  const [shockDurationYears, setShockDurationYears] = useState(5);
  const [shockReturnPct, setShockReturnPct] = useState(-8);

  const applyPreset = (preset: (typeof SHOCK_PRESETS)[number]) => {
    setShockYear(preset.shockYear);
    setShockDurationYears(preset.shockDurationYears);
    setShockReturnPct(preset.shockReturnPct);
  };

  const { chartData, delayYears } = useMemo(() => {
    const rows: { year: number; baseline: number; shocked: number }[] = [];
    let baselineCapital = startingCapital;
    let shockedCapital = startingCapital;
    const normalMonthlyRate = currentAssumptions.expectedReturnPct / 100 / 12;

    for (let year = 1; year <= HORIZON_YEARS; year += 1) {
      const inShockWindow = year >= shockYear && year < shockYear + shockDurationYears;
      const shockedMonthlyRate = inShockWindow ? shockReturnPct / 100 / 12 : normalMonthlyRate;
      for (let m = 0; m < 12; m += 1) {
        baselineCapital = baselineCapital * (1 + normalMonthlyRate) + monthlyContribution;
        shockedCapital = shockedCapital * (1 + shockedMonthlyRate) + monthlyContribution;
      }
      rows.push({ year, baseline: Math.round(baselineCapital), shocked: Math.round(Math.max(0, shockedCapital)) });
    }

    // Estimate FI-delay: how many extra years the shocked path needs to catch up to baseline's
    // final value.
    const target = rows[rows.length - 1]?.baseline ?? 0;
    let extraYears = 0;
    let capital = shockedCapital;
    while (capital < target && extraYears < 30) {
      capital = capital * Math.pow(1 + normalMonthlyRate, 12) + monthlyContribution * 12;
      extraYears += 1;
    }

    return { chartData: rows, delayYears: extraYears };
  }, [startingCapital, monthlyContribution, shockYear, shockDurationYears, shockReturnPct, currentAssumptions.expectedReturnPct]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Stress Test Lab" subtitle="Apply a shock window to a simple growth model and see the FI-delay it causes." />

        <Card className="grid gap-3">
          <div className="font-extrabold">Shock templates</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {SHOCK_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => applyPreset(p)} className="rounded-lg border border-card-border p-3 text-left hover:border-accent">
                <div className="font-bold">{p.label}</div>
                <div className="mt-1 text-sm opacity-80">{p.note}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="grid gap-3">
          <div className="font-extrabold">Shock builder</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="grid gap-1 text-xs">Starting capital<input type="number" value={startingCapital} onChange={(e) => setStartingCapital(Math.max(0, asNumber(e.target.value, startingCapital)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Monthly contribution<input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Math.max(0, asNumber(e.target.value, monthlyContribution)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Shock starts (year)<input type="number" value={shockYear} onChange={(e) => setShockYear(Math.max(1, asNumber(e.target.value, shockYear)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Shock duration (years)<input type="number" value={shockDurationYears} onChange={(e) => setShockDurationYears(Math.max(1, asNumber(e.target.value, shockDurationYears)))} className={fieldClass} /></label>
            <label className="grid gap-1 text-xs">Shock return (%/yr)<input type="number" value={shockReturnPct} onChange={(e) => setShockReturnPct(asNumber(e.target.value, shockReturnPct))} className={fieldClass} /></label>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card><div className="text-xs opacity-75">Baseline at year {HORIZON_YEARS}</div><div className="text-xl font-extrabold">{chartData[chartData.length - 1]?.baseline.toLocaleString()} {currentAssumptions.currency}</div></Card>
          <Card><div className="text-xs opacity-75">Shocked at year {HORIZON_YEARS}</div><div className="text-xl font-extrabold">{chartData[chartData.length - 1]?.shocked.toLocaleString()} {currentAssumptions.currency}</div></Card>
          <Card><div className="text-xs opacity-75">Estimated FI delay</div><div className="text-xl font-extrabold">{delayYears} yr</div><Chip>to catch up to baseline's final value</Chip></Card>
        </div>

        <Card>
          <div className="mb-2 font-extrabold">Baseline vs shocked</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }} />
                <YAxis width={90} tickFormatter={(v) => Math.round(v / 1000) + 'k'} />
                <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString()} ${currentAssumptions.currency}`} />
                <Line type="monotone" dataKey="baseline" name="Baseline" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="shocked" name="Shocked" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-card-border p-3"><div className="font-bold">Cut discretionary</div><div className="mt-1 text-sm opacity-80">Pre-commit a cut plan and thresholds before a shock hits, not during one.</div></div>
          <div className="rounded-lg border border-card-border p-3"><div className="font-bold">Temporary income</div><div className="mt-1 text-sm opacity-80">Have a side-income target and timeline ready (see Side Hustle Lab).</div></div>
          <div className="rounded-lg border border-card-border p-3"><div className="font-bold">Buffer policy</div><div className="mt-1 text-sm opacity-80">Know your refill/pause triggers in advance (see Emergency Buffer Optimizer).</div></div>
        </Card>

        <Card className="text-xs opacity-70">
          This is a simple compounding model with a flat shocked-return window, not a Monte Carlo simulation — for
          real percentile-based stress results, use the FIRE Simulator with a custom return assumption for the shock
          period.
        </Card>
      </div>
    </PageLayout>
  );
};

export default StressTestLabPage;
