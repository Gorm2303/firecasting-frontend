import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import PageLayout from '../components/PageLayout';
import { useAssumptions } from '../state/assumptions';
import { Button, Card, PageHeader } from '../components/ui';

type LifeEvent = {
  id: string;
  label: string;
  startYear: number;
  durationYears: number;
  monthlyIncomeDelta: number;
  monthlyCostDelta: number;
};

const STORAGE_KEY = 'firecasting:lifeEvents:v1';
const HORIZON_YEARS = 30;

const buildId = (): string => `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultEvents = (): LifeEvent[] => [
  { id: buildId(), label: 'Parental leave', startYear: 3, durationYears: 1, monthlyIncomeDelta: -12000, monthlyCostDelta: 2000 },
  { id: buildId(), label: 'Relocation', startYear: 8, durationYears: 1, monthlyIncomeDelta: 3000, monthlyCostDelta: 5000 },
];

const loadEvents = (): LifeEvent[] => {
  if (typeof window === 'undefined') return defaultEvents();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultEvents();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultEvents();
  } catch {
    return defaultEvents();
  }
};

const asNumber = (value: unknown, fallback: number): number => {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fieldClass = 'w-full box-border rounded-md border border-card-border bg-card px-2.5 py-2 text-sm text-card-fg';

const LifeEventsSimulatorPage: React.FC = () => {
  const { currentAssumptions } = useAssumptions();
  const [events, setEvents] = useState<LifeEvent[]>(() => loadEvents());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const updateEvent = (id: string, patch: Partial<LifeEvent>) => setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeEvent = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id));
  const addEvent = () => setEvents((prev) => [...prev, { id: buildId(), label: `Event ${prev.length + 1}`, startYear: 0, durationYears: 1, monthlyIncomeDelta: 0, monthlyCostDelta: 0 }]);

  const chartData = useMemo(() => {
    return Array.from({ length: HORIZON_YEARS }).map((_, year) => {
      const active = events.filter((e) => year >= e.startYear && year < e.startYear + e.durationYears);
      const netMonthly = active.reduce((sum, e) => sum + e.monthlyIncomeDelta - e.monthlyCostDelta, 0);
      return { year, netMonthly, activeCount: active.length };
    });
  }, [events]);

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Life Events Simulator" subtitle="Model big life events on a timeline and see their combined effect on monthly cashflow." />

        <Card className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-extrabold">Events</div>
            <Button variant="secondary" onClick={addEvent}>Add event</Button>
          </div>
          <div className="grid gap-2.5">
            {events.map((e) => (
              <div key={e.id} className="grid grid-cols-1 items-end gap-2.5 rounded-lg border border-card-border p-3 sm:grid-cols-[minmax(0,1.3fr)_100px_100px_140px_140px_auto]">
                <label className="grid gap-1 text-xs">Name<input value={e.label} onChange={(ev) => updateEvent(e.id, { label: ev.target.value })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Start (yr)<input type="number" value={e.startYear} onChange={(ev) => updateEvent(e.id, { startYear: Math.max(0, asNumber(ev.target.value, e.startYear)) })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Duration (yr)<input type="number" value={e.durationYears} onChange={(ev) => updateEvent(e.id, { durationYears: Math.max(0, asNumber(ev.target.value, e.durationYears)) })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Income Δ/mo<input type="number" value={e.monthlyIncomeDelta} onChange={(ev) => updateEvent(e.id, { monthlyIncomeDelta: asNumber(ev.target.value, e.monthlyIncomeDelta) })} className={fieldClass} /></label>
                <label className="grid gap-1 text-xs">Cost Δ/mo<input type="number" value={e.monthlyCostDelta} onChange={(ev) => updateEvent(e.id, { monthlyCostDelta: asNumber(ev.target.value, e.monthlyCostDelta) })} className={fieldClass} /></label>
                <button type="button" onClick={() => removeEvent(e.id)} className="text-sm text-danger hover:underline">Remove</button>
              </div>
            ))}
            {events.length === 0 && <div className="text-sm opacity-70">No events yet — add one above.</div>}
          </div>
        </Card>

        <Card>
          <div className="mb-2 font-extrabold">Cashflow impact over {HORIZON_YEARS} years</div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -6 }} />
                <YAxis width={80} />
                <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString()} ${currentAssumptions.currency}/mo`} />
                <Line type="stepAfter" dataKey="netMonthly" stroke="#6366f1" strokeWidth={2} dot={false} name="Net monthly effect" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs opacity-70">
            "Net monthly effect" is the combined income delta minus cost delta from all events active in that year — 0
            means no events are running.
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default LifeEventsSimulatorPage;
