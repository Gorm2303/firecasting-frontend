import type { Assumptions } from './assumptions';

export type AssumptionsProfile = {
  id: string;
  name: string;
  createdAt: string;
  assumptions: Assumptions;
};

const STORAGE_KEY_V1 = 'firecasting:assumptionsProfiles:v1';
const MAX_PROFILES = 25;

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const newId = (): string => {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readAll = (): AssumptionsProfile[] => {
  if (typeof window === 'undefined') return [];
  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY_V1));
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => x as AssumptionsProfile)
    .filter((p) => typeof p?.id === 'string' && typeof p?.name === 'string' && !!p.assumptions);
};

const writeAll = (items: AssumptionsProfile[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(items));
  } catch {
    /* ignore */
  }
};

export const listAssumptionsProfiles = (): AssumptionsProfile[] => {
  const items = readAll();
  return items.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const findAssumptionsProfileByName = (name: string): AssumptionsProfile | null => {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return null;
  return readAll().find((p) => String(p.name).trim().toLowerCase() === trimmed) ?? null;
};

export const saveAssumptionsProfile = (name: string, assumptions: Assumptions): AssumptionsProfile => {
  if (typeof window === 'undefined') throw new Error('Cannot save assumptions profile outside browser');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Profile name is required');

  const existing = findAssumptionsProfileByName(trimmed);
  const now = new Date().toISOString();

  const profile: AssumptionsProfile = {
    id: existing?.id ?? newId(),
    name: trimmed,
    createdAt: now,
    assumptions,
  };

  const withoutSameId = readAll().filter((p) => p.id !== profile.id);
  const next = [profile, ...withoutSameId].slice(0, MAX_PROFILES);
  writeAll(next);
  return profile;
};

export const deleteAssumptionsProfile = (id: string): void => {
  if (typeof window === 'undefined') return;
  if (!id) return;
  const next = readAll().filter((p) => p.id !== id);
  writeAll(next);
};
