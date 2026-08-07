import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Button, Card, PageHeader } from '../components/ui';

type ChildcareWave = {
  id: string;
  childName: string;
  startYear: number;
  endYear: number;
  monthlyCost: number;
};

const STORAGE_KEY = 'firecasting:familyMode:v1';
const HORIZON_YEARS = 20;

const buildId = (): string => `wave-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultWaves = (): ChildcareWave[] => [{ id: buildId(), childName: 'Child 1', startYear: 1, endYear: 6, monthlyCost: 7500 }];

const loadWaves = (): ChildcareWave[] => {
  if (typeof window === 'undefined') return defaultWaves();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWaves();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultWaves();
  } catch {
    return defaultWaves();
  }
};

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const FamilyModePlannerPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [waves, setWaves] = useState<ChildcareWave[]>(() => loadWaves());
  const [parentalLeaveMonths, setParentalLeaveMonths] = useState(9);
  const [parentalLeaveIncomeDropPct, setParentalLeaveIncomeDropPct] = useState(40);
  const [currentMonthlyIncome, setCurrentMonthlyIncome] = useState(30000);
  const [educationFundTarget, setEducationFundTarget] = useState(300000);
  const [educationFundMonths, setEducationFundMonths] = useState(216);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(waves));
  }, [waves]);

  const updateWave = (id: string, patch: Partial<ChildcareWave>) => setWaves((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const removeWave = (id: string) => setWaves((prev) => prev.filter((w) => w.id !== id));
  const addWave = () => setWaves((prev) => [...prev, { id: buildId(), childName: `Child ${prev.length + 1}`, startYear: 0, endYear: 6, monthlyCost: 7000 }]);

  const chartData = useMemo(
    () =>
      Array.from({ length: HORIZON_YEARS }).map((_, year) => {
        const monthlyCost = waves.filter((w) => year >= w.startYear && year < w.endYear).reduce((sum, w) => sum + w.monthlyCost, 0);
        return { year, monthlyCost };
      }),
    [waves]
  );

  const parentalLeaveIncomeLoss = Math.round(currentMonthlyIncome * (parentalLeaveIncomeDropPct / 100) * parentalLeaveMonths);
  const educationMonthlyRequired = educationFundMonths > 0 ? Math.round(educationFundTarget / educationFundMonths) : 0;

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Family Mode Planner" subtitle="Childcare cost waves, parental leave income impact, and education fund targets in one place." />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="grid gap-3">
            <div className="font-extrabold">Parental leave</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs">Current monthly income<input type="number" value={currentMonthlyIncome} onChange={(e) => setCurrentMonthlyIncome(Math.max(0, asNumber(e.target.value, currentMonthlyIncome)))} className={fieldClass} /></label>
              <label className="grid gap-1 text-xs">Leave duration (months)<input type="number" value={parentalLeaveMonths} onChange={(e) => setParentalLeaveMonths(Math.max(0, asNumber(e.target.value, parentalLeaveMonths)))} className={fieldClass} /></label>
              <label className="grid gap-1 text-xs">Income drop (%)<input type="number" value={parentalLeaveIncomeDropPct} onChange={(e) => setParentalLeaveIncomeDropPct(Math.max(0, Math.min(100, asNumber(e.target.value, parentalLeaveIncomeDropPct))))} className={fieldClass} /></label>
            </div>
            <div className="rounded-lg border border-card-border p-3">
              <div className="text-xs opacity-70">Total income loss over leave</div>
              <div className="text-xl font-extrabold">{parentalLeaveIncomeLoss.toLocaleString()} {currentAssumptions.currency}</div>
            </div>
          </Card>

          <Card className="grid gap-3">
            <div className="font-extrabold">Education fund</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs">Target amount<input type="number" value={educationFundTarget} onChange={(e) => setEducationFundTarget(Math.max(0, asNumber(e.target.value, educationFundTarget)))} className={fieldClass} /></label>
              <label className="grid gap-1 text-xs">Months until needed<input type="number" value={educationFundMonths} onChange={(e) => setEducationFundMonths(Math.max(1, asNumber(e.target.value, educationFundMonths)))} className={fieldClass} /></label>
            </div>
            <div className="rounded-lg border border-card-border p-3">
              <div className="text-xs opacity-70">Required monthly contribution (no growth assumed)</div>
              <div className="text-xl font-extrabold">{educationMonthlyRequired.toLocaleString()} {currentAssumptions.currency}</div>
            </div>
          </Card>
        </div>

        <Card className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-extrabold">Childcare waves</div>
            <Button variant="secondary" onClick={addWave}>Add wave</Button>
          </div>
          <div className="grid gap-2.5">
            {waves.map((w) => (
              <div key={w.id} className="grid grid-cols-1 items-end gap-2.5 rounded-lg border border-card-border p-3 sm:grid-cols-[minmax(0,1fr)_100px_100px_140px_auto]">
                <label className="grid gap-1 text-xs">Child<input value={w.childName} onChange={(e) => updateWave(w.id, { childName: e.target.value })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Start (yr)<input type="number" value={w.startYear} onChange={(e) => updateWave(w.id, { startYear: Math.max(0, asNumber(e.target.value, w.startYear)) })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">End (yr)<input type="number" value={w.endYear} onChange={(e) => updateWave(w.id, { endYear: Math.max(0, asNumber(e.target.value, w.endYear)) })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Cost / month<input type="number" value={w.monthlyCost} onChange={(e) => updateWave(w.id, { monthlyCost: Math.max(0, asNumber(e.target.value, w.monthlyCost)) })} className={fieldClass} /></label>
                <button type="button" onClick={() => removeWave(w.id)} className="text-sm text-danger hover:underline">Remove</button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-2 font-extrabold">Combined childcare cost over time</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }} />
                <YAxis width={80} />
                <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString()} ${currentAssumptions.currency}/mo`} />
                <Bar dataKey="monthlyCost" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default FamilyModePlannerPage;
