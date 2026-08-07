import React, { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Button, Card, Chip, PageHeader } from '../components/ui';

type Holding = {
  id: string;
  name: string;
  weightPct: number;
  feePct: number;
  account: 'taxable' | 'wrapper' | 'pension';
};

const STORAGE_KEY = 'firecasting:portfolio:v1';
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#84cc16'];
const buildId = (): string => `holding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultHoldings = (): Holding[] => [
  { id: buildId(), name: 'Global equity index', weightPct: 60, feePct: 0.2, account: 'taxable' },
  { id: buildId(), name: 'Domestic bonds', weightPct: 20, feePct: 0.15, account: 'wrapper' },
  { id: buildId(), name: 'Individual stock A', weightPct: 12, feePct: 0, account: 'taxable' },
  { id: buildId(), name: 'Pension fund', weightPct: 8, feePct: 0.8, account: 'pension' },
];

const loadHoldings = (): Holding[] => {
  if (typeof window === 'undefined') return defaultHoldings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultHoldings();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultHoldings();
  } catch {
    return defaultHoldings();
  }
};

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const PortfolioPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [holdings, setHoldings] = useState<Holding[]>(() => loadHoldings());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  }, [holdings]);

  const updateHolding = (id: string, patch: Partial<Holding>) => setHoldings((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const removeHolding = (id: string) => setHoldings((prev) => prev.filter((h) => h.id !== id));
  const addHolding = () => setHoldings((prev) => [...prev, { id: buildId(), name: `Holding ${prev.length + 1}`, weightPct: 0, feePct: 0, account: 'taxable' }]);

  const stats = useMemo(() => {
    const totalWeight = holdings.reduce((sum, h) => sum + h.weightPct, 0);
    const blendedFee = totalWeight > 0 ? holdings.reduce((sum, h) => sum + h.weightPct * h.feePct, 0) / totalWeight : 0;
    const largestHolding = holdings.reduce((max, h) => (h.weightPct > (max?.weightPct ?? 0) ? h : max), holdings[0]);
    const accountBreakdown = (['taxable', 'wrapper', 'pension'] as const).map((acc) => ({
      account: acc,
      weight: holdings.filter((h) => h.account === acc).reduce((sum, h) => sum + h.weightPct, 0),
    }));
    // Simple concentration heuristic: 100 - largest holding weight, so higher = more diversified.
    const diversificationScore = Math.max(0, Math.round(100 - (largestHolding?.weightPct ?? 0)));
    return { totalWeight: Math.round(totalWeight * 10) / 10, blendedFee: Math.round(blendedFee * 100) / 100, largestHolding, accountBreakdown, diversificationScore };
  }, [holdings]);

  const pieData = holdings.map((h) => ({ name: h.name, value: h.weightPct }));

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Portfolio" subtitle="Holdings, blended fee drag, and a simple concentration/diversification read." />

        {stats.totalWeight !== 100 && (
          <Card className="border-danger text-sm">
            Weights sum to {stats.totalWeight}%, not 100% — the numbers below still compute correctly against the ratios you've
            entered, but consider adjusting so weights add up to 100%.
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card><div className="text-xs opacity-75">Blended fee</div><div className="text-2xl font-extrabold">{stats.blendedFee}%</div></Card>
          <Card><div className="text-xs opacity-75">Largest holding</div><div className="text-lg font-extrabold">{stats.largestHolding?.name}</div><div className="text-sm opacity-70">{stats.largestHolding?.weightPct}%</div></Card>
          <Card><div className="text-xs opacity-75">Diversification score</div><div className="text-2xl font-extrabold">{stats.diversificationScore}/100</div></Card>
          <Card><div className="text-xs opacity-75">Holdings</div><div className="text-2xl font-extrabold">{holdings.length}</div></Card>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <Card className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold">Holdings</div>
              <Button variant="secondary" onClick={addHolding}>Add holding</Button>
            </div>
            <div className="grid gap-2">
              {holdings.map((h) => (
                <div key={h.id} className="grid grid-cols-[minmax(0,1.4fr)_100px_90px_120px_auto] items-center gap-2">
                  <input value={h.name} onChange={(e) => updateHolding(h.id, { name: e.target.value })} className={fieldClass} />
                  <input type="number" value={h.weightPct} onChange={(e) => updateHolding(h.id, { weightPct: Math.max(0, asNumber(e.target.value, h.weightPct)) })} className={fieldClass} aria-label="Weight %" />
                  <input type="number" value={h.feePct} onChange={(e) => updateHolding(h.id, { feePct: Math.max(0, asNumber(e.target.value, h.feePct)) })} className={fieldClass} aria-label="Fee %" />
                  <select value={h.account} onChange={(e) => updateHolding(h.id, { account: e.target.value as Holding['account'] })} className={fieldClass}>
                    <option value="taxable">Taxable</option>
                    <option value="wrapper">Wrapper</option>
                    <option value="pension">Pension</option>
                  </select>
                  <button type="button" onClick={() => removeHolding(h.id)} className="text-sm text-danger hover:underline">Remove</button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="grid gap-3">
            <div className="font-extrabold">Weight split</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.accountBreakdown.map((a) => (
                <Chip key={a.account}>{a.account}: {a.weight}%</Chip>
              ))}
            </div>
          </Card>
        </div>

        <Card className="text-sm opacity-80">
          Blended fee weights each holding's fee by its portfolio share — a {stats.blendedFee}% fee on a{' '}
          {currentAssumptions.expectedReturnPct}% expected return is a real drag worth comparing against lower-cost fund
          alternatives for the same exposure.
        </Card>
      </div>
    </PageLayout>
  );
};

export default PortfolioPage;
