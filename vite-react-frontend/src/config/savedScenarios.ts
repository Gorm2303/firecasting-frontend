import type { SimulationRequest } from '../models/types';

export type SavedScenario = {
  id: string;
  name: string;
  savedAt: string;
  request: SimulationRequest;
};

const STORAGE_KEY = 'firecasting:savedScenarios:v1';

function newId(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function toArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export function listSavedScenarios(): SavedScenario[] {
  if (typeof window === 'undefined') return [];
  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY));
  return toArray(raw)
    .map((x) => x as SavedScenario)
    .filter((x) => !!x && typeof x.id === 'string' && typeof x.name === 'string' && !!x.request);
}

export function saveScenario(name: string, request: SimulationRequest, id?: string): SavedScenario {
  if (typeof window === 'undefined') throw new Error('Cannot save scenario outside browser');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Scenario name is required');

  const scenarios = listSavedScenarios();
  const now = new Date().toISOString();

  const scenario: SavedScenario = {
    id: id ?? newId(),
    name: trimmed,
    savedAt: now,
    request,
  };

  const withoutSameId = scenarios.filter((s) => s.id !== scenario.id);
  const next = [scenario, ...withoutSameId].slice(0, 50);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return scenario;
}

export function deleteScenario(id: string): void {
  if (typeof window === 'undefined') return;
  const scenarios = listSavedScenarios();
  const next = scenarios.filter((s) => s.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function findScenarioById(id: string): SavedScenario | undefined {
  return listSavedScenarios().find((s) => s.id === id);
}

export function findScenarioByName(name: string): SavedScenario | undefined {
  const trimmed = name.trim().toLowerCase();
  return listSavedScenarios().find((s) => s.name.trim().toLowerCase() === trimmed);
}
