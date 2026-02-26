import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { MasterSeedMode } from '../models/advancedSimulation';

export type ExecutionDefaults = {
  paths: number;
  batchSize: number;
  seedMode: MasterSeedMode;
};

const STORAGE_KEY_V1 = 'firecasting:executionDefaults:v1';
const LEGACY_ADVANCED_OPTIONS_KEY_V1 = 'firecasting:advancedOptions:v1';

const DEFAULT_EXECUTION_DEFAULTS: ExecutionDefaults = {
  paths: 10_000,
  batchSize: 10_000,
  seedMode: 'default',
};

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const asNumber = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const clampPositiveInt = (n: number, fallback: number): number => {
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i <= 0) return fallback;
  // Keep in a reasonable range; backend also clamps/validates.
  return Math.min(i, 100_000);
};

const asSeedMode = (v: unknown, fallback: MasterSeedMode): MasterSeedMode => {
  return v === 'default' || v === 'custom' || v === 'random' ? v : fallback;
};

const normalize = (raw: unknown): ExecutionDefaults => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    paths: clampPositiveInt(asNumber(r.paths, DEFAULT_EXECUTION_DEFAULTS.paths), DEFAULT_EXECUTION_DEFAULTS.paths),
    batchSize: clampPositiveInt(
      asNumber(r.batchSize, DEFAULT_EXECUTION_DEFAULTS.batchSize),
      DEFAULT_EXECUTION_DEFAULTS.batchSize
    ),
    seedMode: asSeedMode(r.seedMode, DEFAULT_EXECUTION_DEFAULTS.seedMode),
  };
};

const maybeMigrateFromLegacyAdvancedOptions = (): ExecutionDefaults | null => {
  if (typeof window === 'undefined') return null;
  const legacy = safeParse(window.localStorage.getItem(LEGACY_ADVANCED_OPTIONS_KEY_V1));
  if (!legacy || typeof legacy !== 'object') return null;
  const r = legacy as Record<string, unknown>;

  const candidate: ExecutionDefaults = normalize({
    paths: r.paths,
    batchSize: r.batchSize,
    seedMode: r.seedMode,
  });

  // Only migrate if legacy had at least one relevant field.
  const hasAny = r.paths !== undefined || r.batchSize !== undefined || r.seedMode !== undefined;
  return hasAny ? candidate : null;
};

export function getDefaultExecutionDefaults(): ExecutionDefaults {
  // Return a copy so callers can mutate safely.
  return { ...DEFAULT_EXECUTION_DEFAULTS };
}

export function loadCurrentExecutionDefaultsFromStorage(): ExecutionDefaults {
  if (typeof window === 'undefined') return getDefaultExecutionDefaults();

  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY_V1));
  if (raw) return normalize(raw);

  const migrated = maybeMigrateFromLegacyAdvancedOptions();
  if (migrated) {
    try {
      window.localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(migrated));
    } catch {
      // ignore
    }
    return migrated;
  }

  return getDefaultExecutionDefaults();
}

type ExecutionDefaultsContextValue = {
  executionDefaults: ExecutionDefaults;
  setExecutionDefaults: (next: ExecutionDefaults) => void;
  updateExecutionDefaults: (patch: Partial<ExecutionDefaults>) => void;
  resetExecutionDefaults: () => void;
};

const ExecutionDefaultsContext = React.createContext<ExecutionDefaultsContextValue | null>(null);

export const ExecutionDefaultsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [executionDefaults, setExecutionDefaultsState] = useState<ExecutionDefaults>(() => loadCurrentExecutionDefaultsFromStorage());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(executionDefaults));
    } catch {
      // ignore
    }
  }, [executionDefaults]);

  const setExecutionDefaults = useCallback((next: ExecutionDefaults) => {
    setExecutionDefaultsState(normalize(next));
  }, []);

  const updateExecutionDefaults = useCallback((patch: Partial<ExecutionDefaults>) => {
    setExecutionDefaultsState((prev) => normalize({ ...prev, ...patch }));
  }, []);

  const resetExecutionDefaults = useCallback(() => {
    setExecutionDefaultsState(getDefaultExecutionDefaults());
  }, []);

  const value = useMemo<ExecutionDefaultsContextValue>(
    () => ({ executionDefaults, setExecutionDefaults, updateExecutionDefaults, resetExecutionDefaults }),
    [executionDefaults, resetExecutionDefaults, setExecutionDefaults, updateExecutionDefaults]
  );

  return <ExecutionDefaultsContext.Provider value={value}>{children}</ExecutionDefaultsContext.Provider>;
};

export function useExecutionDefaults(): ExecutionDefaultsContextValue {
  const ctx = React.useContext(ExecutionDefaultsContext);
  if (!ctx) throw new Error('useExecutionDefaults must be used within ExecutionDefaultsProvider');
  return ctx;
}
