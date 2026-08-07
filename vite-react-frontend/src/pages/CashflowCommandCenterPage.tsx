import React, { useEffect, useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Button, Card, PageHeader } from '../components/ui';

type RecurringItem = {
  id: string;
  label: string;
  kind: 'income' | 'expense';
  amount: number;
};

type SpikeItem = {
  id: string;
  label: string;
  month: number; // 1-12
  amount: number;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STORAGE_KEY = 'firecasting:cashflowCommandCenter:v1';
const buildId = (): string => `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type StoredState = { recurring: RecurringItem[]; spikes: SpikeItem[] };

const defaultState = (): StoredState => ({
  recurring: [
    { id: buildId(), label: 'Salary', kind: 'income', amount: 32000 },
    { id: buildId(), label: 'Rent', kind: 'expense', amount: 11000 },
    { id: buildId(), label: 'Groceries', kind: 'expense', amount: 4500 },
    { id: buildId(), label: 'Planned deposit', kind: 'expense', amount: 6000 },
  ],
  spikes: [
    { id: buildId(), label: 'Car insurance', month: 3, amount: 4500 },
    { id: buildId(), label: 'Summer travel', month: 7, amount: 12000 },
    { id: buildId(), label: 'Christmas gifts', month: 12, amount: 6000 },
  ],
});

const loadState = (): StoredState => {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed?.recurring || !parsed?.spikes) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
};

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const CashflowCommandCenterPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [state, setState] = useState<StoredState>(() => loadState());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateRecurring = (id: string, patch: Partial<RecurringItem>) =>
    setState((prev) => ({ ...prev, recurring: prev.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const removeRecurring = (id: string) => setState((prev) => ({ ...prev, recurring: prev.recurring.filter((r) => r.id !== id) }));
  const addRecurring = () =>
    setState((prev) => ({ ...prev, recurring: [...prev.recurring, { id: buildId(), label: 'New item', kind: 'expense', amount: 0 }] }));

  const updateSpike = (id: string, patch: Partial<SpikeItem>) =>
    setState((prev) => ({ ...prev, spikes: prev.spikes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeSpike = (id: string) => setState((prev) => ({ ...prev, spikes: prev.spikes.filter((s) => s.id !== id) }));
  const addSpike = () => setState((prev) => ({ ...prev, spikes: [...prev.spikes, { id: buildId(), label: 'New spike', month: 1, amount: 0 }] }));

  const monthlyNet = useMemo(() => {
    const baseIncome = state.recurring.filter((r) => r.kind === 'income').reduce((sum, r) => sum + r.amount, 0);
    const baseExpense = state.recurring.filter((r) => r.kind === 'expense').reduce((sum, r) => sum + r.amount, 0);
    const baseNet = baseIncome - baseExpense;

    return MONTH_LABELS.map((label, idx) => {
      const spikesThisMonth = state.spikes.filter((s) => s.month === idx + 1).reduce((sum, s) => sum + s.amount, 0);
      return { month: idx + 1, label, net: baseNet - spikesThisMonth, spikes: spikesThisMonth };
    });
  }, [state]);

  const worstMonth = monthlyNet.reduce((worst, m) => (m.net < worst.net ? m : worst), monthlyNet[0]);
  const deficitMonths = monthlyNet.filter((m) => m.net < 0).length;

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Cashflow Command Center" subtitle="Monthly recurring income/expenses plus annual spikes, laid out across a calendar year." />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold">Recurring monthly items</div>
              <Button variant="secondary" onClick={addRecurring}>Add item</Button>
            </div>
            <div className="grid gap-2">
              {state.recurring.map((r) => (
                <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_110px_120px_auto] items-center gap-2">
                  <input value={r.label} onChange={(e) => updateRecurring(r.id, { label: e.target.value })} className={fieldClass} />
                  <select value={r.kind} onChange={(e) => updateRecurring(r.id, { kind: e.target.value as RecurringItem['kind'] })} className={fieldClass}>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                  <input type="number" value={r.amount} onChange={(e) => updateRecurring(r.id, { amount: Math.max(0, asNumber(e.target.value, r.amount)) })} className={fieldClass} />
                  <button type="button" onClick={() => removeRecurring(r.id)} className="text-sm text-danger hover:underline">Remove</button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold">Annual spikes</div>
              <Button variant="secondary" onClick={addSpike}>Add spike</Button>
            </div>
            <div className="grid gap-2">
              {state.spikes.map((s) => (
                <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_90px_120px_auto] items-center gap-2">
                  <input value={s.label} onChange={(e) => updateSpike(s.id, { label: e.target.value })} className={fieldClass} />
                  <select value={s.month} onChange={(e) => updateSpike(s.id, { month: Math.max(1, Math.min(12, asNumber(e.target.value, s.month))) })} className={fieldClass}>
                    {MONTH_LABELS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <input type="number" value={s.amount} onChange={(e) => updateSpike(s.id, { amount: Math.max(0, asNumber(e.target.value, s.amount)) })} className={fieldClass} />
                  <button type="button" onClick={() => removeSpike(s.id)} className="text-sm text-danger hover:underline">Remove</button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card><div className="text-xs opacity-75">Worst month</div><div className="text-xl font-extrabold">{worstMonth.label}: {worstMonth.net.toLocaleString()} {currentAssumptions.currency}</div></Card>
          <Card><div className="text-xs opacity-75">Months in deficit</div><div className="text-2xl font-extrabold">{deficitMonths}</div></Card>
          <Card><div className="text-xs opacity-75">Avg monthly net</div><div className="text-2xl font-extrabold">{Math.round(monthlyNet.reduce((s, m) => s + m.net, 0) / 12).toLocaleString()} {currentAssumptions.currency}</div></Card>
        </div>

        <Card>
          <div className="mb-2 font-extrabold">Calendar view</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {monthlyNet.map((m) => (
              <div
                key={m.month}
                className={`rounded-lg border p-3 ${m.net < 0 ? 'border-danger bg-danger/10' : 'border-card-border bg-subtle'}`}
              >
                <div className="font-extrabold">{m.label}</div>
                <div className="mt-1 text-sm">{m.net.toLocaleString()} {currentAssumptions.currency}</div>
                {m.spikes > 0 && <div className="mt-1 text-xs opacity-70">Spike: {m.spikes.toLocaleString()}</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default CashflowCommandCenterPage;
