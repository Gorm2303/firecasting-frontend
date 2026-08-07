import { useEffect, useState } from 'react';
import { getCompletedSummaries } from '../api/simulation';
import { listSimulationSnapshots, type SimulationSnapshot } from './simulationSnapshots';
import type { YearlySummary } from '../models/YearlySummary';

export type LatestSimulationResult = {
  snapshot: SimulationSnapshot | null;
  summaries: YearlySummary[] | null;
  loading: boolean;
  error: string | null;
};

/** The most recent locally-known simulation run, with its real yearly summaries fetched from the backend (if still available). */
export const useLatestSimulationResult = (): LatestSimulationResult => {
  const [snapshot] = useState<SimulationSnapshot | null>(() => listSimulationSnapshots()[0] ?? null);
  const [summaries, setSummaries] = useState<YearlySummary[] | null>(null);
  const [loading, setLoading] = useState<boolean>(!!snapshot);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCompletedSummaries(snapshot.runId)
      .then((data) => {
        if (cancelled) return;
        setSummaries(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load results.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  return { snapshot, summaries, loading, error };
};

/** Groups yearly summary rows by their final (last-reported) year per phase, for a single end-of-plan snapshot. */
export const latestYearRow = (summaries: YearlySummary[] | null): YearlySummary | null => {
  if (!summaries || summaries.length === 0) return null;
  return summaries.reduce((latest, row) => (row.year > latest.year ? row : latest), summaries[0]);
};
