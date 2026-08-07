import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageLayout from '../components/PageLayout';
import { listDecisionJournalEntries, type DecisionJournalEntry } from './DecisionJournalPage';
import { Card, PageHeader, Textarea } from '../components/ui';

type ReplayNote = {
  decisionId: string;
  actualOutcome: string;
  whatWentRight: string;
  whatWentWrong: string;
  whatWasLuck: string;
  whatWasSkill: string;
};

const STORAGE_KEY = 'firecasting:decisionReplays:v1';

const loadReplays = (): Record<string, ReplayNote> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const emptyReplay = (decisionId: string): ReplayNote => ({
  decisionId,
  actualOutcome: '',
  whatWentRight: '',
  whatWentWrong: '',
  whatWasLuck: '',
  whatWasSkill: '',
});

const DecisionReplayPage: React.FC = () => {
  const [entries] = useState<DecisionJournalEntry[]>(() => listDecisionJournalEntries());
  const [replays, setReplays] = useState<Record<string, ReplayNote>>(() => loadReplays());
  const [selectedId, setSelectedId] = useState<string>(() => entries[0]?.id ?? '');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(replays));
  }, [replays]);

  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);
  const replay = replays[selectedId] ?? emptyReplay(selectedId);

  const updateReplay = (patch: Partial<ReplayNote>) => {
    if (!selectedId) return;
    setReplays((prev) => ({ ...prev, [selectedId]: { ...emptyReplay(selectedId), ...prev[selectedId], ...patch } }));
  };

  return (
    <PageLayout variant="wide">
      <div className="mx-auto grid max-w-330 gap-4">
        <PageHeader title="Decision Replay / Postmortem" subtitle="Pick a logged decision, compare expected vs actual, and capture what to do differently next time." />

        {entries.length === 0 ? (
          <Card className="grid gap-2">
            <div className="font-bold">No decisions logged yet</div>
            <div className="text-sm opacity-80">
              Log a decision in the{' '}
              <Link to="/decision-journal" className="underline">
                Decision Journal
              </Link>{' '}
              first, then come back here to replay it once you know how it played out.
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <Card className="grid gap-2">
              <div className="font-extrabold">Candidate decisions</div>
              <div className="grid gap-1.5">
                {entries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={`rounded-lg border p-3 text-left ${e.id === selectedId ? 'border-accent' : 'border-card-border'}`}
                  >
                    <div className="font-bold">{e.decision || '(untitled decision)'}</div>
                    <div className="text-xs opacity-70">{new Date(e.createdAt).toLocaleDateString()} · confidence {e.confidencePct}% · {e.status}</div>
                  </button>
                ))}
              </div>
            </Card>

            {selected && (
              <Card className="grid gap-3">
                <div>
                  <div className="font-extrabold">{selected.decision}</div>
                  <div className="mt-1 text-sm opacity-80">{selected.thesis}</div>
                </div>

                <div className="grid gap-2 rounded-lg border border-card-border p-3 sm:grid-cols-2">
                  <div><div className="text-xs opacity-70">Expected outcome</div><div className="text-sm">{selected.expectedOutcome || '—'}</div></div>
                  <div><div className="text-xs opacity-70">Key risk flagged</div><div className="text-sm">{selected.keyRisk || '—'}</div></div>
                </div>

                <label className="grid gap-1 text-xs">
                  Actual outcome
                  <Textarea value={replay.actualOutcome} onChange={(e) => updateReplay({ actualOutcome: e.target.value })} rows={2} />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs">
                    What went right
                    <Textarea value={replay.whatWentRight} onChange={(e) => updateReplay({ whatWentRight: e.target.value })} rows={2} />
                  </label>
                  <label className="grid gap-1 text-xs">
                    What went wrong
                    <Textarea value={replay.whatWentWrong} onChange={(e) => updateReplay({ whatWentWrong: e.target.value })} rows={2} />
                  </label>
                  <label className="grid gap-1 text-xs">
                    What was luck
                    <Textarea value={replay.whatWasLuck} onChange={(e) => updateReplay({ whatWasLuck: e.target.value })} rows={2} />
                  </label>
                  <label className="grid gap-1 text-xs">
                    What was skill
                    <Textarea value={replay.whatWasSkill} onChange={(e) => updateReplay({ whatWasSkill: e.target.value })} rows={2} />
                  </label>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default DecisionReplayPage;
