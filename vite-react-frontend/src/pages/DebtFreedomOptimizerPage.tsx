import React, { useEffect, useMemo, useState } from 'react';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Button, Card, Chip, PageHeader } from '../components/ui';

type Debt = {
  id: string;
  name: string;
  balance: number;
  ratePct: number;
  minimumPayment: number;
};

type PayoffResult = {
  months: number;
  totalInterest: number;
  order: string[];
};

const STORAGE_KEY = 'firecasting:debtFreedom:v1';
const buildId = (): string => `debt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultDebts = (): Debt[] => [
  { id: buildId(), name: 'Credit card', balance: 25000, ratePct: 19.9, minimumPayment: 800 },
  { id: buildId(), name: 'Car loan', balance: 90000, ratePct: 6.5, minimumPayment: 2200 },
  { id: buildId(), name: 'Student loan', balance: 60000, ratePct: 3.5, minimumPayment: 1200 },
];

const loadDebts = (): Debt[] => {
  if (typeof window === 'undefined') return defaultDebts();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDebts();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultDebts();
  } catch {
    return defaultDebts();
  }
};

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

/**
 * Simulates monthly amortization: each month, accrue interest and apply minimum payments to
 * every debt, then cascade the extra budget down the ranked order, fully paying off each debt
 * in turn until the pool runs out.
 */
const simulatePayoff = (debts: Debt[], extraBudget: number, order: 'snowball' | 'avalanche'): PayoffResult => {
  const balances = new Map(debts.map((d) => [d.id, d.balance]));
  const ranked = [...debts].sort((a, b) => (order === 'snowball' ? a.balance - b.balance : b.ratePct - a.ratePct));
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 600;

  while (months < maxMonths && Array.from(balances.values()).some((b) => b > 0.01)) {
    months += 1;

    for (const d of ranked) {
      const bal = balances.get(d.id) ?? 0;
      if (bal <= 0) continue;
      const interest = (bal * (d.ratePct / 100)) / 12;
      totalInterest += interest;
      balances.set(d.id, Math.max(0, bal + interest - d.minimumPayment));
    }

    let pool = extraBudget;
    for (const d of ranked) {
      if (pool <= 0) break;
      const bal = balances.get(d.id) ?? 0;
      if (bal <= 0) continue;
      const applied = Math.min(pool, bal);
      balances.set(d.id, bal - applied);
      pool -= applied;
    }
  }

  return { months, totalInterest: Math.round(totalInterest), order: ranked.map((d) => d.name) };
};

const DebtFreedomOptimizerPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [debts, setDebts] = useState<Debt[]>(() => loadDebts());
  const [extraBudget, setExtraBudget] = useState(1500);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
  }, [debts]);

  const updateDebt = (id: string, patch: Partial<Debt>) => setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const removeDebt = (id: string) => setDebts((prev) => prev.filter((d) => d.id !== id));
  const addDebt = () => setDebts((prev) => [...prev, { id: buildId(), name: `Debt ${prev.length + 1}`, balance: 10000, ratePct: 8, minimumPayment: 500 }]);

  const snowball = useMemo(() => simulatePayoff(debts, extraBudget, 'snowball'), [debts, extraBudget]);
  const avalanche = useMemo(() => simulatePayoff(debts, extraBudget, 'avalanche'), [debts, extraBudget]);
  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinimums = debts.reduce((sum, d) => sum + d.minimumPayment, 0);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Debt Freedom Optimizer" subtitle="Compare snowball (smallest balance first) vs avalanche (highest rate first) payoff order." />

        <Card className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-extrabold">Debts</div>
            <Button variant="secondary" onClick={addDebt}>Add debt</Button>
          </div>
          <div className="grid gap-2.5">
            {debts.map((d) => (
              <div key={d.id} className="grid grid-cols-1 items-end gap-2.5 rounded-lg border border-card-border p-3 sm:grid-cols-[minmax(0,1fr)_120px_100px_140px_auto]">
                <label className="grid gap-1 text-xs">Name<input value={d.name} onChange={(e) => updateDebt(d.id, { name: e.target.value })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Balance<input type="number" value={d.balance} onChange={(e) => updateDebt(d.id, { balance: Math.max(0, asNumber(e.target.value, d.balance)) })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Rate (%)<input type="number" value={d.ratePct} onChange={(e) => updateDebt(d.id, { ratePct: Math.max(0, asNumber(e.target.value, d.ratePct)) })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Min. payment<input type="number" value={d.minimumPayment} onChange={(e) => updateDebt(d.id, { minimumPayment: Math.max(0, asNumber(e.target.value, d.minimumPayment)) })} className={fieldClass} /></label>
                <button type="button" onClick={() => removeDebt(d.id)} className="text-sm text-danger hover:underline">Remove</button>
              </div>
            ))}
          </div>
          <label className="grid max-w-60 gap-1 text-xs">
            Extra payment budget / month (on top of minimums)
            <input type="number" value={extraBudget} onChange={(e) => setExtraBudget(Math.max(0, asNumber(e.target.value, extraBudget)))} className={fieldClass} />
          </label>
          <div className="flex flex-wrap gap-2 text-xs opacity-70">
            <Chip>Total balance: {totalBalance.toLocaleString()} {currentAssumptions.currency}</Chip>
            <Chip>Total minimums: {totalMinimums.toLocaleString()} {currentAssumptions.currency}/mo</Chip>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="grid gap-2">
            <div className="font-extrabold">Snowball (smallest balance first)</div>
            <div className="text-sm opacity-70">Order: {snowball.order.join(' → ')}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs opacity-70">Debt-free in</div><div className="text-xl font-extrabold">{snowball.months} mo</div></div>
              <div><div className="text-xs opacity-70">Total interest</div><div className="text-xl font-extrabold">{snowball.totalInterest.toLocaleString()} {currentAssumptions.currency}</div></div>
            </div>
          </Card>
          <Card className="grid gap-2">
            <div className="font-extrabold">Avalanche (highest rate first)</div>
            <div className="text-sm opacity-70">Order: {avalanche.order.join(' → ')}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs opacity-70">Debt-free in</div><div className="text-xl font-extrabold">{avalanche.months} mo</div></div>
              <div><div className="text-xs opacity-70">Total interest</div><div className="text-xl font-extrabold">{avalanche.totalInterest.toLocaleString()} {currentAssumptions.currency}</div></div>
            </div>
          </Card>
        </div>

        <Card className="text-sm opacity-80">
          Avalanche minimizes total interest paid (mathematically optimal); snowball can be motivating because smaller
          debts disappear first. {avalanche.totalInterest < snowball.totalInterest
            ? `Avalanche saves ${(snowball.totalInterest - avalanche.totalInterest).toLocaleString()} ${currentAssumptions.currency} in interest here.`
            : 'Both orders land on the same total interest for this debt set.'}
        </Card>
      </div>
    </PageLayout>
  );
};

export default DebtFreedomOptimizerPage;
