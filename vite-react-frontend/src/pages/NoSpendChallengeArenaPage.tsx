import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';

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

const STORAGE_KEY = 'firecasting.noSpendChallenge.v1';

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

const cardStyle: React.CSSProperties = {
  background: 'var(--fc-card-bg)',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 14,
  padding: 14,
};

const tableCell: React.CSSProperties = {
  borderTop: '1px solid var(--fc-card-border)',
  padding: '10px 8px',
  verticalAlign: 'top',
};

const NoSpendChallengeArenaPage: React.FC = () => {
  const [challenge, setChallenge] = useState<NoSpendChallenge | null>(() => safeParseChallenge(localStorage.getItem(STORAGE_KEY)));

  const [durationDays, setDurationDays] = useState(14);
  const [startedAt, setStartedAt] = useState(() => todayYmd());
  const [rules, setRules] = useState('No discretionary spending. Allowed: groceries, transportation, bills.');
  const [rewardFraming, setRewardFraming] = useState('If I complete the streak, I will: (small reward)');

  const [logDate, setLogDate] = useState(() => todayYmd());
  const [didSpend, setDidSpend] = useState(false);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!challenge) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(challenge));
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
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const ms = end.getTime() - start.getTime();
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <header>
          <h1 style={{ margin: 0 }}>No-Spend Challenge Arena</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>Local-only streak + daily log (no backend).</div>
        </header>

        {!challenge ? (
          <section style={cardStyle}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Start a challenge</div>
            <div style={{ opacity: 0.8, marginTop: 6, lineHeight: 1.35 }}>
              Define a simple no-spend sprint, then log each day. Everything stays in this browser.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight: 700 }}>Start date</div>
                <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight: 700 }}>Duration (days)</div>
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 700 }}>Rules</div>
                <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 700 }}>Reward framing</div>
                <textarea value={rewardFraming} onChange={(e) => setRewardFraming(e.target.value)} rows={2} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" onClick={startChallenge}>Start</button>
            </div>
          </section>
        ) : (
          <>
            <section style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Challenge</div>
                  <div style={{ opacity: 0.8, marginTop: 6 }}>
                    {challenge.startedAt} → {endDate}
                  </div>
                </div>

                <div style={{ opacity: 0.85 }}>
                  <div>
                    Streak: <span style={{ fontWeight: 900 }}>{progress?.streak ?? 0}</span> days
                  </div>
                  <div>
                    Logged: <span style={{ fontWeight: 900 }}>{challenge.logs.length}</span> days
                  </div>
                  <div>
                    Remaining: <span style={{ fontWeight: 900 }}>{progress?.daysRemaining ?? 0}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                <div style={{ border: '1px dashed var(--fc-card-border)', borderRadius: 12, padding: 10, background: 'var(--fc-subtle-bg)' }}>
                  <div style={{ fontWeight: 800 }}>Rules</div>
                  <div style={{ opacity: 0.85, marginTop: 6, whiteSpace: 'pre-wrap' }}>{challenge.rules || '—'}</div>
                </div>
                <div style={{ border: '1px dashed var(--fc-card-border)', borderRadius: 12, padding: 10, background: 'var(--fc-subtle-bg)' }}>
                  <div style={{ fontWeight: 800 }}>Reward</div>
                  <div style={{ opacity: 0.85, marginTop: 6, whiteSpace: 'pre-wrap' }}>{challenge.rewardFraming || '—'}</div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={endChallengeNow}>End & clear</button>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Daily log</div>
              <div style={{ opacity: 0.8, marginTop: 6, lineHeight: 1.35 }}>
                Log the day. “Spent” breaks the streak. You can overwrite a day by logging it again.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>Date</div>
                  <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>Did you spend?</div>
                  <select value={String(didSpend)} onChange={(e) => setDidSpend(e.target.value === 'true')}>
                    <option value="false">No (success day)</option>
                    <option value="true">Yes (break day)</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontWeight: 700 }}>Category (optional)</div>
                  <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. coffee, delivery" />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                  <div style={{ fontWeight: 700 }}>Note (optional)</div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What happened? What will you do tomorrow?" />
                </label>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={upsertLog}>Save log</button>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Logs</div>
              {logsSorted.length === 0 ? (
                <div style={{ marginTop: 10, opacity: 0.8 }}>No logs yet.</div>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', opacity: 0.85 }}>
                        <th style={{ padding: '0 8px 8px 8px' }}>Date</th>
                        <th style={{ padding: '0 8px 8px 8px' }}>Result</th>
                        <th style={{ padding: '0 8px 8px 8px' }}>Category</th>
                        <th style={{ padding: '0 8px 8px 8px' }}>Note</th>
                        <th style={{ padding: '0 8px 8px 8px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsSorted.map((l) => (
                        <tr key={l.date}>
                          <td style={tableCell}>{l.date}</td>
                          <td style={tableCell}>{l.didSpend ? 'Spent' : 'No-spend'}</td>
                          <td style={tableCell}>{l.category || '—'}</td>
                          <td style={tableCell}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{l.note || '—'}</div>
                          </td>
                          <td style={tableCell}>
                            <button type="button" onClick={() => removeLog(l.date)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default NoSpendChallengeArenaPage;
