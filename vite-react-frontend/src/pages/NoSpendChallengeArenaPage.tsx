import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';
import { Button, Card, Input, PageHeader, Select, Textarea } from '../components/ui';

type NoSpendLog = {
  date: string; // YYYY-MM-DD
  didSpend: boolean;
  category: string;
  note: string;
};

type NoSpendChallenge = {
  id: string;
  createdAt: string; // ISO
  startedAt: string; // YYYY-MM-DD
  durationDays: number;
  rules: string;
  rewardFraming: string;
  logs: NoSpendLog[];
};

const STORAGE_KEY = 'firecasting:no-spend-challenge:v1';

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeParseChallenge(raw: string | null): NoSpendChallenge | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as NoSpendChallenge;
  } catch {
    return null;
  }
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((x) => Number(x));
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function cmpYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

const fieldLabelClass = 'flex flex-col gap-1.5';
const fieldLabelTextClass = 'font-bold';
const noteBoxClass = 'rounded-xl border border-dashed border-card-border bg-subtle p-2.5';

const NoSpendChallengeArenaPage: React.FC = () => {
  const [challenge, setChallenge] = useState<NoSpendChallenge | null>(() => {
    try {
      return safeParseChallenge(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  });

  const [durationDays, setDurationDays] = useState(14);
  const [startedAt, setStartedAt] = useState(() => todayYmd());
  const [rules, setRules] = useState('No discretionary spending. Allowed: groceries, transportation, bills.');
  const [rewardFraming, setRewardFraming] = useState('If I complete the streak, I will: (small reward)');

  const [logDate, setLogDate] = useState(() => todayYmd());
  const [didSpend, setDidSpend] = useState(false);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    try {
      if (!challenge) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(challenge));
    } catch {
      // storage unavailable or quota exceeded; UI continues without persistence
    }
  }, [challenge]);

  const endDate = useMemo(() => {
    if (!challenge) return null;
    return addDays(challenge.startedAt, challenge.durationDays - 1);
  }, [challenge]);

  const logsSorted = useMemo(() => {
    if (!challenge) return [];
    return [...challenge.logs].sort((a, b) => cmpYmd(b.date, a.date));
  }, [challenge]);

  const progress = useMemo(() => {
    if (!challenge) return null;

    const today = todayYmd();
    const lastDay = addDays(challenge.startedAt, challenge.durationDays - 1);

    const daysElapsed = cmpYmd(today, challenge.startedAt) < 0 ? 0 : Math.min(challenge.durationDays, 1 + daysBetween(challenge.startedAt, today));
    const daysRemaining = Math.max(0, challenge.durationDays - daysElapsed);

    const streak = computeStreak(challenge);

    const isComplete = cmpYmd(today, lastDay) > 0;

    return { today, lastDay, daysElapsed, daysRemaining, streak, isComplete };
  }, [challenge]);

  function daysBetween(startYmd: string, endYmd: string): number {
    const [sy, sm, sd] = startYmd.split('-').map((x) => Number(x));
    const [ey, em, ed] = endYmd.split('-').map((x) => Number(x));
    const startMs = Date.UTC(sy, sm - 1, sd);
    const endMs = Date.UTC(ey, em - 1, ed);
    const ms = endMs - startMs;
    return Math.floor(ms / (24 * 60 * 60 * 1000));
  }

  function computeStreak(ch: NoSpendChallenge): number {
    // streak = consecutive successful days from startedAt up to the latest logged day (or today) where didSpend is false.
    const byDate = new Map(ch.logs.map((l) => [l.date, l] as const));
    let streak = 0;

    for (let i = 0; i < ch.durationDays; i++) {
      const date = addDays(ch.startedAt, i);
      const log = byDate.get(date);
      if (!log) break;
      if (log.didSpend) break;
      streak += 1;
    }

    return streak;
  }

  function startChallenge() {
    const ch: NoSpendChallenge = {
      id: newId(),
      createdAt: new Date().toISOString(),
      startedAt,
      durationDays: clampInt(durationDays, 3, 60),
      rules: rules.trim(),
      rewardFraming: rewardFraming.trim(),
      logs: [],
    };
    setChallenge(ch);
  }

  function endChallengeNow() {
    if (!window.confirm('End and clear this challenge? (Local-only)')) return;
    setChallenge(null);
  }

  function upsertLog() {
    if (!challenge) return;
    const nextLog: NoSpendLog = {
      date: logDate,
      didSpend,
      category: category.trim(),
      note: note.trim(),
    };

    setChallenge((prev) => {
      if (!prev) return prev;
      const without = prev.logs.filter((l) => l.date !== logDate);
      return { ...prev, logs: [nextLog, ...without] };
    });

    setCategory('');
    setNote('');
  }

  function removeLog(date: string) {
    setChallenge((prev) => {
      if (!prev) return prev;
      return { ...prev, logs: prev.logs.filter((l) => l.date !== date) };
    });
  }

  return (
    <PageLayout variant="wide">
      <div className="flex flex-col gap-3">
        <PageHeader title="No-Spend Challenge Arena" subtitle="Local-only streak + daily log (no backend)." />

        {!challenge ? (
          <Card>
            <div className="text-base font-black">Start a challenge</div>
            <div className="mt-1.5 leading-snug opacity-80">
              Define a simple no-spend sprint, then log each day. Everything stays in this browser.
            </div>

            <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <label className={fieldLabelClass}>
                <div className={fieldLabelTextClass}>Start date</div>
                <Input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
              </label>

              <label className={fieldLabelClass}>
                <div className={fieldLabelTextClass}>Duration (days)</div>
                <Input
                  type="number"
                  min={3}
                  max={60}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                />
              </label>

              <label className={fieldLabelClass + ' col-span-full'}>
                <div className={fieldLabelTextClass}>Rules</div>
                <Textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3} />
              </label>

              <label className={fieldLabelClass + ' col-span-full'}>
                <div className={fieldLabelTextClass}>Reward framing</div>
                <Textarea value={rewardFraming} onChange={(e) => setRewardFraming(e.target.value)} rows={2} />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={startChallenge}>Start</Button>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="text-base font-black">Challenge</div>
                  <div className="mt-1.5 opacity-80">
                    {challenge.startedAt} → {endDate}
                  </div>
                </div>

                <div className="opacity-85">
                  <div>
                    Streak: <span className="font-black">{progress?.streak ?? 0}</span> days
                  </div>
                  <div>
                    Logged: <span className="font-black">{challenge.logs.length}</span> days
                  </div>
                  <div>
                    Remaining: <span className="font-black">{progress?.daysRemaining ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                <div className={noteBoxClass}>
                  <div className="font-extrabold">Rules</div>
                  <div className="mt-1.5 whitespace-pre-wrap opacity-85">{challenge.rules || '—'}</div>
                </div>
                <div className={noteBoxClass}>
                  <div className="font-extrabold">Reward</div>
                  <div className="mt-1.5 whitespace-pre-wrap opacity-85">{challenge.rewardFraming || '—'}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={endChallengeNow}>End & clear</Button>
              </div>
            </Card>

            <Card>
              <div className="text-base font-black">Daily log</div>
              <div className="mt-1.5 leading-snug opacity-80">
                Log the day. "Spent" breaks the streak. You can overwrite a day by logging it again.
              </div>

              <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                <label className={fieldLabelClass}>
                  <div className={fieldLabelTextClass}>Date</div>
                  <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                </label>

                <label className={fieldLabelClass}>
                  <div className={fieldLabelTextClass}>Did you spend?</div>
                  <Select value={String(didSpend)} onChange={(e) => setDidSpend(e.target.value === 'true')}>
                    <option value="false">No (success day)</option>
                    <option value="true">Yes (break day)</option>
                  </Select>
                </label>

                <label className={fieldLabelClass}>
                  <div className={fieldLabelTextClass}>Category (optional)</div>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. coffee, delivery" />
                </label>

                <label className={fieldLabelClass + ' col-span-full'}>
                  <div className={fieldLabelTextClass}>Note (optional)</div>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What happened? What will you do tomorrow?" />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" onClick={upsertLog}>Save log</Button>
              </div>
            </Card>

            <Card>
              <div className="text-base font-black">Logs</div>
              {logsSorted.length === 0 ? (
                <div className="mt-2.5 opacity-80">No logs yet.</div>
              ) : (
                <div className="mt-2.5 overflow-x-auto">
                  <table className="w-full min-w-190 border-collapse">
                    <thead>
                      <tr className="text-left opacity-85">
                        <th className="px-2 pb-2">Date</th>
                        <th className="px-2 pb-2">Result</th>
                        <th className="px-2 pb-2">Category</th>
                        <th className="px-2 pb-2">Note</th>
                        <th className="px-2 pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsSorted.map((l) => (
                        <tr key={l.date}>
                          <td className="border-t border-card-border p-2.5 align-top">{l.date}</td>
                          <td className="border-t border-card-border p-2.5 align-top">{l.didSpend ? 'Spent' : 'No-spend'}</td>
                          <td className="border-t border-card-border p-2.5 align-top">{l.category || '—'}</td>
                          <td className="border-t border-card-border p-2.5 align-top">
                            <div className="whitespace-pre-wrap">{l.note || '—'}</div>
                          </td>
                          <td className="border-t border-card-border p-2.5 align-top">
                            <Button variant="secondary" onClick={() => removeLog(l.date)}>Delete</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default NoSpendChallengeArenaPage;
