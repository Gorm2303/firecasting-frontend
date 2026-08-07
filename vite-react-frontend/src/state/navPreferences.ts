import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'firecasting:navPrefs:v1';

type NavPreferences = {
  /** Explicit user overrides only. Groups not present here fall back to a route-derived default. */
  expandedGroups: Record<string, boolean>;
};

const DEFAULT_PREFS: NavPreferences = { expandedGroups: {} };

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalize = (raw: unknown): NavPreferences => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const expandedGroups = r.expandedGroups && typeof r.expandedGroups === 'object' ? (r.expandedGroups as Record<string, unknown>) : {};
  const out: Record<string, boolean> = {};
  Object.entries(expandedGroups).forEach(([key, value]) => {
    if (typeof value === 'boolean') out[key] = value;
  });
  return { expandedGroups: out };
};

/** Persists which nav groups the user has explicitly expanded/collapsed. */
export const useNavPreferences = () => {
  const [prefs, setPrefs] = useState<NavPreferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFS;
    return normalize(safeParse(window.localStorage.getItem(STORAGE_KEY)));
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const setGroupExpanded = useCallback((groupId: string, expanded: boolean) => {
    setPrefs((prev) => ({ expandedGroups: { ...prev.expandedGroups, [groupId]: expanded } }));
  }, []);

  return { expandedGroups: prefs.expandedGroups, setGroupExpanded };
};
