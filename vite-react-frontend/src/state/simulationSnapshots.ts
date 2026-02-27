import type { AdvancedSimulationRequest } from '../models/advancedSimulation';
import type { Assumptions, AssumptionsOverride } from './assumptions';

export type SimulationSnapshot = {
  /** Local snapshot id (not the simulationId). */
  id: string;
  /** The backend simulation run id. */
  runId: string;
  createdAt: string;
  /** The effective assumptions actually used for the run (baseline + optional overrides). */
  assumptions: Assumptions;
  /** Optional scenario-level overlay that was applied on top of the baseline assumptions. */
  assumptionsOverride?: AssumptionsOverride | null;
  advancedRequest: AdvancedSimulationRequest;
};

const STORAGE_KEY = 'firecasting:simulationSnapshots:v1';
const MAX_SNAPSHOTS = 50;

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readAll = (): SimulationSnapshot[] => {
  if (typeof window === 'undefined') return [];
  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => x as SimulationSnapshot)
    .filter((s) => typeof s?.id === 'string' && typeof s?.runId === 'string');
};

const writeAll = (items: SimulationSnapshot[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
};

export const listSimulationSnapshots = (): SimulationSnapshot[] => {
  const items = readAll();
  return items.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const findSnapshotByRunId = (runId: string): SimulationSnapshot | null => {
  if (!runId) return null;
  return readAll().find((s) => s.runId === runId) ?? null;
};

export const appendSimulationSnapshot = (snapshot: Omit<SimulationSnapshot, 'id'>) => {
  const now = new Date().toISOString();
  const snap: SimulationSnapshot = {
    id: `${snapshot.runId}:${now}`,
    ...snapshot,
    createdAt: snapshot.createdAt || now,
  };

  const existing = readAll();
  const next = [snap, ...existing.filter((s) => s.runId !== snap.runId)].slice(0, MAX_SNAPSHOTS);
  writeAll(next);
};
