import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import PageLayout from '../components/PageLayout';
import { Button, Card, PageHeader, Textarea } from '../components/ui';

type MoodEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  mood: number;
  energy: number;
  stress: number;
  note: string;
};

const STORAGE_KEY = 'firecasting:happinessTracker:v1';
const buildId = (): string => `mood-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayYmd = (): string => new Date().toISOString().slice(0, 10);

const loadEntries = (): MoodEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const clamp010 = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(10, Math.round(n)));
};

const EXPERIMENTS = [
  { title: 'Sleep upgrade', body: 'Earlier bedtime for 14 days. Track energy + mood over that window.' },
  { title: 'No doomscroll', body: 'Limit social apps after 20:00 for 2 weeks. Track stress.' },
  { title: 'Joy budget', body: 'Add a small, planned "joy spend" each week and see net happiness.' },
];

const HappinessTrackerPage: React.FC = () => {
  const [entries, setEntries] = useState<MoodEntry[]>(() => loadEntries());
  const [mood, setMood] = useState(6);
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const addEntry = () => {
    setEntries((prev) => [{ id: buildId(), date: todayYmd(), mood, energy, stress, note }, ...prev].slice(0, 365));
    setNote('');
  };

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const chartData = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ date: e.date, mood: e.mood, energy: e.energy, stress: e.stress })),
    [entries]
  );

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Happiness Tracker" subtitle="Track mood, energy, and stress, and run small experiments — local-only, just for you." />

        <Card className="grid gap-3">
          <div className="font-extrabold">Today's entry</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">Mood (0-10): {mood}<input type="range" min={0} max={10} value={mood} onChange={(e) => setMood(clamp010(e.target.value, mood))} /></label>
            <label className="grid gap-1 text-xs">Energy (0-10): {energy}<input type="range" min={0} max={10} value={energy} onChange={(e) => setEnergy(clamp010(e.target.value, energy))} /></label>
            <label className="grid gap-1 text-xs">Stress (0-10): {stress}<input type="range" min={0} max={10} value={stress} onChange={(e) => setStress(clamp010(e.target.value, stress))} /></label>
          </div>
          <label className="grid gap-1 text-xs">
            Note
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything worth remembering about today" />
          </label>
          <div><Button variant="primary" onClick={addEntry}>Save entry</Button></div>
        </Card>

        {chartData.length > 0 && (
          <Card>
            <div className="mb-2 font-extrabold">Timeline</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} width={30} />
                  <Tooltip />
                  <Line type="monotone" dataKey="mood" stroke="#6366f1" strokeWidth={2} dot={false} name="Mood" />
                  <Line type="monotone" dataKey="energy" stroke="#22c55e" strokeWidth={2} dot={false} name="Energy" />
                  <Line type="monotone" dataKey="stress" stroke="#ef4444" strokeWidth={2} dot={false} name="Stress" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className="grid gap-2">
          <div className="font-extrabold">Log</div>
          <div className="grid gap-1.5">
            {entries.slice(0, 14).map((e) => (
              <div key={e.id} className="grid grid-cols-[100px_60px_60px_60px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <div>{e.date}</div>
                <div>Mood {e.mood}</div>
                <div>Energy {e.energy}</div>
                <div>Stress {e.stress}</div>
                <div className="truncate opacity-80">{e.note}</div>
                <button type="button" onClick={() => removeEntry(e.id)} className="text-xs text-danger hover:underline">Remove</button>
              </div>
            ))}
            {entries.length === 0 && <div className="text-sm opacity-70">No entries yet.</div>}
          </div>
        </Card>

        <Card className="grid gap-2 sm:grid-cols-3">
          {EXPERIMENTS.map((ex) => (
            <div key={ex.title} className="rounded-lg border border-card-border p-3">
              <div className="font-bold">{ex.title}</div>
              <div className="mt-1 text-sm opacity-80">{ex.body}</div>
            </div>
          ))}
        </Card>
      </div>
    </PageLayout>
  );
};

export default HappinessTrackerPage;
