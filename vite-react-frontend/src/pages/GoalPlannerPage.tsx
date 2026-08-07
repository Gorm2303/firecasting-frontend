import React, { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Button, Card, Chip, PageHeader } from '../components/ui';

type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  targetMonths: number;
  priority: number;
  fundedAmount: number;
};

type GoalAllocation = Goal & {
  monthlyRequired: number;
  monthlyAllocated: number;
  fundedPct: number;
  isConflict: boolean;
};

const STORAGE_KEY = 'firecasting:goalPlanner:v1';
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7'];

const buildId = (): string => `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultGoals = (): Goal[] => [
  { id: buildId(), name: 'Emergency buffer', targetAmount: 90000, targetMonths: 18, priority: 9, fundedAmount: 20000 },
  { id: buildId(), name: 'House down payment', targetAmount: 400000, targetMonths: 60, priority: 6, fundedAmount: 50000 },
  { id: buildId(), name: 'FIRE / retirement', targetAmount: 6000000, targetMonths: 240, priority: 8, fundedAmount: 300000 },
];

const loadGoals = (): Goal[] => {
  if (typeof window === 'undefined') return defaultGoals();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultGoals();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultGoals();
    return parsed;
  } catch {
    return defaultGoals();
  }
};

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const GoalPlannerPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals());
  const [monthlyBudget, setMonthlyBudget] = useState<number>(12000);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  }, [goals]);

  const updateGoal = (id: string, patch: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeGoal = (id: string) => setGoals((prev) => prev.filter((g) => g.id !== id));

  const addGoal = () => {
    setGoals((prev) => [
      ...prev,
      { id: buildId(), name: `Goal ${prev.length + 1}`, targetAmount: 100000, targetMonths: 36, priority: 5, fundedAmount: 0 },
    ]);
  };

  const allocations = useMemo<GoalAllocation[]>(() => {
    const totalPriority = goals.reduce((sum, g) => sum + Math.max(0, g.priority), 0) || 1;
    return goals.map((g) => {
      const remaining = Math.max(0, g.targetAmount - g.fundedAmount);
      const monthlyRequired = g.targetMonths > 0 ? remaining / g.targetMonths : remaining;
      const share = Math.max(0, g.priority) / totalPriority;
      const monthlyAllocated = monthlyBudget * share;
      const fundedPct = g.targetAmount > 0 ? Math.min(100, Math.round((g.fundedAmount / g.targetAmount) * 100)) : 0;
      return {
        ...g,
        monthlyRequired: Math.round(monthlyRequired),
        monthlyAllocated: Math.round(monthlyAllocated),
        fundedPct,
        isConflict: monthlyAllocated + 1e-6 < monthlyRequired,
      };
    });
  }, [goals, monthlyBudget]);

  const conflicts = allocations.filter((a) => a.isConflict);
  const totalRequired = allocations.reduce((sum, a) => sum + a.monthlyRequired, 0);
  const pieData = allocations.map((a) => ({ name: a.name, value: Math.max(0, a.monthlyAllocated) }));

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader
          title="Goal Planner"
          subtitle="Split your monthly savings budget across multiple goals by priority, and see where the split falls short."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="text-xs opacity-75">Monthly budget</div>
            <div className="text-2xl font-extrabold">{monthlyBudget.toLocaleString()} {currentAssumptions.currency}</div>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="text-xs opacity-75">Total required / mo</div>
            <div className="text-2xl font-extrabold">{totalRequired.toLocaleString()} {currentAssumptions.currency}</div>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="text-xs opacity-75">Goals</div>
            <div className="text-2xl font-extrabold">{goals.length}</div>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-4">
            <div className="text-xs opacity-75">Underfunded</div>
            <div className="text-2xl font-extrabold">{conflicts.length}</div>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <Card className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold">Goals & priorities</div>
              <label className="flex items-center gap-2 text-sm">
                Monthly budget
                <input
                  type="number"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(Math.max(0, asNumber(e.target.value, monthlyBudget)))}
                  className={fieldClass + ' w-32'}
                />
              </label>
            </div>

            <div className="grid gap-3">
              {allocations.map((a) => (
                <div key={a.id} className={`grid gap-2 rounded-lg border p-3 ${a.isConflict ? 'border-danger' : 'border-card-border'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      value={a.name}
                      onChange={(e) => updateGoal(a.id, { name: e.target.value })}
                      className={fieldClass + ' max-w-60 font-bold'}
                      aria-label="Goal name"
                    />
                    <div className="flex items-center gap-2">
                      {a.isConflict && <Chip>Underfunded</Chip>}
                      <button type="button" onClick={() => removeGoal(a.id)} className="text-sm text-danger hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="grid gap-1 text-xs">
                      Target amount
                      <input type="number" value={a.targetAmount} onChange={(e) => updateGoal(a.id, { targetAmount: Math.max(0, asNumber(e.target.value, a.targetAmount)) })} className={fieldClass} />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Already funded
                      <input type="number" value={a.fundedAmount} onChange={(e) => updateGoal(a.id, { fundedAmount: Math.max(0, asNumber(e.target.value, a.fundedAmount)) })} className={fieldClass} />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Months to target
                      <input type="number" value={a.targetMonths} onChange={(e) => updateGoal(a.id, { targetMonths: Math.max(1, asNumber(e.target.value, a.targetMonths)) })} className={fieldClass} />
                    </label>
                    <label className="grid gap-1 text-xs">
                      Priority (0-10)
                      <input type="number" min={0} max={10} value={a.priority} onChange={(e) => updateGoal(a.id, { priority: Math.min(10, Math.max(0, asNumber(e.target.value, a.priority))) })} className={fieldClass} />
                    </label>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${a.fundedPct}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs opacity-80">
                    <span>Funded: {a.fundedPct}%</span>
                    <span>Needs {a.monthlyRequired.toLocaleString()}/mo</span>
                    <span>Allocated {a.monthlyAllocated.toLocaleString()}/mo</span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Button variant="secondary" onClick={addGoal}>Add goal</Button>
            </div>
          </Card>

          <Card className="grid gap-3">
            <div className="font-extrabold">Allocation split (priority-weighted)</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString()} ${currentAssumptions.currency}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {conflicts.length > 0 ? (
              <div className="grid gap-1.5 rounded-lg border border-danger p-3 text-sm">
                <div className="font-bold">Conflict warnings</div>
                {conflicts.map((c) => (
                  <div key={c.id} className="opacity-85">
                    {c.name}: needs {c.monthlyRequired.toLocaleString()}/mo but only gets {c.monthlyAllocated.toLocaleString()}/mo at the
                    current split.
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-card-border p-3 text-sm opacity-80">
                Every goal is funded at or above its required monthly pace at the current split.
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default GoalPlannerPage;
