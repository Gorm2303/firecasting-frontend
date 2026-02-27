import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';

type DecisionStatus = 'open' | 'resolved';

type DecisionJournalEntry = {
  id: string;
  createdAt: string; // ISO
  decision: string;
  thesis: string;
  confidencePct: number;
  keyRisk: string;
  checkInDate: string; // YYYY-MM-DD
  expectedOutcome: string;
  status: DecisionStatus;
};

const STORAGE_KEY = 'firecasting:decisionJournal:v1';

function safeParseEntries(raw: string | null): DecisionJournalEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as DecisionJournalEntry[];
  } catch {
    return [];
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function newId(): string {
  // local-only: good enough uniqueness
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const tableCell: React.CSSProperties = {
  borderTop: '1px solid var(--fc-card-border)',
  padding: '10px 8px',
  verticalAlign: 'top',
};

const DecisionJournalPage: React.FC = () => {
  const [entries, setEntries] = useState<DecisionJournalEntry[]>(() => {
    try {
      return safeParseEntries(localStorage.getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  });

  const [decision, setDecision] = useState('');
  const [thesis, setThesis] = useState('');
  const [confidencePct, setConfidencePct] = useState(65);
  const [keyRisk, setKeyRisk] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => todayYmd());
  const [expectedOutcome, setExpectedOutcome] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // storage unavailable or quota exceeded; UI continues without persistence
    }
  }, [entries]);

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [entries]);

  const openCount = useMemo(() => entries.filter((e) => e.status === 'open').length, [entries]);

  const canAdd = decision.trim().length > 0 && thesis.trim().length > 0;

  function addEntry() {
    if (!canAdd) return;
    const entry: DecisionJournalEntry = {
      id: newId(),
      createdAt: nowIso(),
      decision: decision.trim(),
      thesis: thesis.trim(),
      confidencePct: Math.max(1, Math.min(99, Math.round(confidencePct))),
      keyRisk: keyRisk.trim(),
      checkInDate,
      expectedOutcome: expectedOutcome.trim(),
      status: 'open',
    };

    setEntries((prev) => [entry, ...prev]);
    setDecision('');
    setThesis('');
    setKeyRisk('');
    setExpectedOutcome('');
  }

  function toggleResolved(id: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: e.status === 'open' ? 'resolved' : 'open' } : e)),
    );
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function clearAll() {
    if (!window.confirm('Clear all decision journal entries? (Local-only)')) return;
    setEntries([]);
  }

  return (
    <PageLayout variant="wide">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <header>
          <h1 style={{ margin: 0 }}>Decision Journal</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Local-only decision log with check-in dates (no backend).
          </div>
        </header>

        <section
          style={{
            background: 'var(--fc-card-bg)',
            border: '1px solid var(--fc-card-border)',
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>New entry</div>
          <div style={{ opacity: 0.8, marginTop: 6, lineHeight: 1.35 }}>
            Capture the decision, why you believe it’s correct, and what would falsify it. Review later.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 700 }}>Decision</div>
              <input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="What are you deciding?" />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 700 }}>Confidence (%)</div>
              <input
                type="number"
                min={1}
                max={99}
                value={confidencePct}
                onChange={(e) => setConfidencePct(Number(e.target.value))}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 700 }}>Check-in date</div>
              <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700 }}>Thesis</div>
              <textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="Why is this likely correct? What evidence supports it?"
                rows={3}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700 }}>Expected outcome</div>
              <textarea
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                placeholder="What do you expect to happen? How will you know it worked?"
                rows={2}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700 }}>Key risk / falsifier</div>
              <textarea
                value={keyRisk}
                onChange={(e) => setKeyRisk(e.target.value)}
                placeholder="What would make this decision wrong? What’s the biggest risk?"
                rows={2}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" onClick={addEntry} disabled={!canAdd}>
              Add entry
            </button>
            <button type="button" onClick={clearAll} disabled={entries.length === 0}>
              Clear all
            </button>
            <div style={{ marginLeft: 'auto', opacity: 0.8, alignSelf: 'center' }}>
              {entries.length} total · {openCount} open
            </div>
          </div>
        </section>

        <section
          style={{
            background: 'var(--fc-card-bg)',
            border: '1px solid var(--fc-card-border)',
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>Entries</div>

          {sorted.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.8 }}>No entries yet.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.85 }}>
                    <th style={{ padding: '0 8px 8px 8px' }}>Status</th>
                    <th style={{ padding: '0 8px 8px 8px' }}>Decision</th>
                    <th style={{ padding: '0 8px 8px 8px' }}>Confidence</th>
                    <th style={{ padding: '0 8px 8px 8px' }}>Check-in</th>
                    <th style={{ padding: '0 8px 8px 8px' }}>Thesis</th>
                    <th style={{ padding: '0 8px 8px 8px' }}>Risk</th>
                    <th style={{ padding: '0 8px 8px 8px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => (
                    <tr key={e.id}>
                      <td style={tableCell}>{e.status}</td>
                      <td style={tableCell}>
                        <div style={{ fontWeight: 800 }}>{e.decision}</div>
                        <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
                          Created {new Date(e.createdAt).toLocaleString()}
                        </div>
                        {e.expectedOutcome ? (
                          <div style={{ opacity: 0.85, marginTop: 6 }}>{e.expectedOutcome}</div>
                        ) : null}
                      </td>
                      <td style={tableCell}>{e.confidencePct}%</td>
                      <td style={tableCell}>{e.checkInDate || '—'}</td>
                      <td style={tableCell}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{e.thesis}</div>
                      </td>
                      <td style={tableCell}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{e.keyRisk || '—'}</div>
                      </td>
                      <td style={tableCell}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => toggleResolved(e.id)}>
                            {e.status === 'open' ? 'Mark resolved' : 'Re-open'}
                          </button>
                          <button type="button" onClick={() => removeEntry(e.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
};

export default DecisionJournalPage;
