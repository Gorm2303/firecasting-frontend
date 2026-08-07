import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';
import { Button, Card, Input, PageHeader, Textarea } from '../components/ui';

export type DecisionStatus = 'open' | 'resolved';

export type DecisionJournalEntry = {
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

export const DECISION_JOURNAL_STORAGE_KEY = 'firecasting:decisionJournal:v1';
const STORAGE_KEY = DECISION_JOURNAL_STORAGE_KEY;

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

export const listDecisionJournalEntries = (): DecisionJournalEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    return safeParseEntries(window.localStorage.getItem(DECISION_JOURNAL_STORAGE_KEY));
  } catch {
    return [];
  }
};

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

const fieldLabelClass = 'flex flex-col gap-1.5';
const fieldLabelTextClass = 'font-bold';

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
      <div className="flex flex-col gap-3">
        <PageHeader title="Decision Journal" subtitle="Local-only decision log with check-in dates (no backend)." />

        <Card>
          <div className="text-base font-black">New entry</div>
          <div className="mt-1.5 leading-snug opacity-80">
            Capture the decision, why you believe it's correct, and what would falsify it. Review later.
          </div>

          <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <label className={fieldLabelClass}>
              <div className={fieldLabelTextClass}>Decision</div>
              <Input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="What are you deciding?" />
            </label>

            <label className={fieldLabelClass}>
              <div className={fieldLabelTextClass}>Confidence (%)</div>
              <Input
                type="number"
                min={1}
                max={99}
                value={confidencePct}
                onChange={(e) => setConfidencePct(Number(e.target.value))}
              />
            </label>

            <label className={fieldLabelClass}>
              <div className={fieldLabelTextClass}>Check-in date</div>
              <Input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
            </label>

            <label className={fieldLabelClass + ' col-span-full'}>
              <div className={fieldLabelTextClass}>Thesis</div>
              <Textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="Why is this likely correct? What evidence supports it?"
                rows={3}
              />
            </label>

            <label className={fieldLabelClass + ' col-span-full'}>
              <div className={fieldLabelTextClass}>Expected outcome</div>
              <Textarea
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                placeholder="What do you expect to happen? How will you know it worked?"
                rows={2}
              />
            </label>

            <label className={fieldLabelClass + ' col-span-full'}>
              <div className={fieldLabelTextClass}>Key risk / falsifier</div>
              <Textarea
                value={keyRisk}
                onChange={(e) => setKeyRisk(e.target.value)}
                placeholder="What would make this decision wrong? What's the biggest risk?"
                rows={2}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={addEntry} disabled={!canAdd}>
              Add entry
            </Button>
            <Button variant="secondary" onClick={clearAll} disabled={entries.length === 0}>
              Clear all
            </Button>
            <div className="ml-auto self-center opacity-80">
              {entries.length} total · {openCount} open
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-base font-black">Entries</div>

          {sorted.length === 0 ? (
            <div className="mt-2.5 opacity-80">No entries yet.</div>
          ) : (
            <div className="mt-2.5 overflow-x-auto">
              <table className="w-full min-w-210 border-collapse">
                <thead>
                  <tr className="text-left opacity-85">
                    <th className="px-2 pb-2">Status</th>
                    <th className="px-2 pb-2">Decision</th>
                    <th className="px-2 pb-2">Confidence</th>
                    <th className="px-2 pb-2">Check-in</th>
                    <th className="px-2 pb-2">Thesis</th>
                    <th className="px-2 pb-2">Risk</th>
                    <th className="px-2 pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => (
                    <tr key={e.id}>
                      <td className="border-t border-card-border p-2.5 align-top">{e.status}</td>
                      <td className="border-t border-card-border p-2.5 align-top">
                        <div className="font-extrabold">{e.decision}</div>
                        <div className="mt-1 text-xs opacity-75">
                          Created {new Date(e.createdAt).toLocaleString()}
                        </div>
                        {e.expectedOutcome ? (
                          <div className="mt-1.5 opacity-85">{e.expectedOutcome}</div>
                        ) : null}
                      </td>
                      <td className="border-t border-card-border p-2.5 align-top">{e.confidencePct}%</td>
                      <td className="border-t border-card-border p-2.5 align-top">{e.checkInDate || '—'}</td>
                      <td className="border-t border-card-border p-2.5 align-top">
                        <div className="whitespace-pre-wrap">{e.thesis}</div>
                      </td>
                      <td className="border-t border-card-border p-2.5 align-top">
                        <div className="whitespace-pre-wrap">{e.keyRisk || '—'}</div>
                      </td>
                      <td className="border-t border-card-border p-2.5 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => toggleResolved(e.id)}>
                            {e.status === 'open' ? 'Mark resolved' : 'Re-open'}
                          </Button>
                          <Button variant="secondary" onClick={() => removeEntry(e.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
};

export default DecisionJournalPage;
