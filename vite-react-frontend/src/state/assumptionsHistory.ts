import type { Assumptions } from './assumptions';

export type AssumptionsHistoryEntry = {
  id: string;
  createdAt: string;
  assumptions: Assumptions;
  sourceNote?: string;
};

const STORAGE_KEY_V1 = 'firecasting:assumptionsHistory:v1';
const MAX_ENTRIES = 50;

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readAll = (): AssumptionsHistoryEntry[] => {
  if (typeof window === 'undefined') return [];
  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY_V1));
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => x as AssumptionsHistoryEntry)
    .filter((e) => typeof e?.id === 'string' && typeof e?.createdAt === 'string');
};

const writeAll = (items: AssumptionsHistoryEntry[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(items));
  } catch {
    /* ignore */
  }
};

export const listAssumptionsHistory = (): AssumptionsHistoryEntry[] => {
  const items = readAll();
  return items.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const appendAssumptionsHistory = (assumptions: Assumptions, meta?: { sourceNote?: string }) => {
  const createdAt = new Date().toISOString();
  const id = `${createdAt}:${Math.random().toString(16).slice(2)}`;

  const sourceNote = meta?.sourceNote ? String(meta.sourceNote) : undefined;
  const entry: AssumptionsHistoryEntry = { id, createdAt, assumptions, sourceNote };
  const existing = readAll();

  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  writeAll(next);
};

export const clearAssumptionsHistory = () => {
  writeAll([]);
};
