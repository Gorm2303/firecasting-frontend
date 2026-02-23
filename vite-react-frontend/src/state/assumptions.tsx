import React, { useCallback, useEffect, useMemo, useState } from 'react';

export type Assumptions = {
  currency: string;
  inflationPct: number;
  expectedReturnPct: number;
  safeWithdrawalPct: number;
  showAssumptionsBar: boolean;
};

const STORAGE_KEY = 'firecasting:assumptions:v1';

const DEFAULT_ASSUMPTIONS: Assumptions = {
  currency: 'DKK',
  inflationPct: 2,
  expectedReturnPct: 5,
  safeWithdrawalPct: 4,
  showAssumptionsBar: false,
};

type AssumptionsContextValue = {
  assumptions: Assumptions;
  setAssumptions: (next: Assumptions) => void;
  updateAssumptions: (patch: Partial<Assumptions>) => void;
  resetAssumptions: () => void;
};

const AssumptionsContext = React.createContext<AssumptionsContextValue | null>(null);

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    /* ignore */
    return null;
  }
};

const asNumber = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const asString = (v: unknown, fallback: string): string => {
  return typeof v === 'string' && v.trim() ? v : fallback;
};

const normalize = (raw: unknown): Assumptions => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    currency: asString(r.currency, DEFAULT_ASSUMPTIONS.currency),
    inflationPct: asNumber(r.inflationPct, DEFAULT_ASSUMPTIONS.inflationPct),
    expectedReturnPct: asNumber(r.expectedReturnPct, DEFAULT_ASSUMPTIONS.expectedReturnPct),
    safeWithdrawalPct: asNumber(r.safeWithdrawalPct, DEFAULT_ASSUMPTIONS.safeWithdrawalPct),
    showAssumptionsBar: r.showAssumptionsBar === true,
  };
};

export const AssumptionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assumptions, setAssumptionsState] = useState<Assumptions>(() => {
    if (typeof window === 'undefined') return DEFAULT_ASSUMPTIONS;
    const raw = safeParse(window.localStorage.getItem(STORAGE_KEY));
    return normalize(raw);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assumptions));
    } catch {
      /* ignore */
    }
  }, [assumptions]);

  const setAssumptions = useCallback((next: Assumptions) => setAssumptionsState(normalize(next)), []);
  const updateAssumptions = useCallback(
    (patch: Partial<Assumptions>) => setAssumptionsState((prev) => normalize({ ...prev, ...patch })),
    []
  );
  const resetAssumptions = useCallback(() => setAssumptionsState(DEFAULT_ASSUMPTIONS), []);

  const value = useMemo<AssumptionsContextValue>(
    () => ({ assumptions, setAssumptions, updateAssumptions, resetAssumptions }),
    [assumptions, resetAssumptions, setAssumptions, updateAssumptions]
  );

  return <AssumptionsContext.Provider value={value}>{children}</AssumptionsContext.Provider>;
};

export const useAssumptions = (): AssumptionsContextValue => {
  const ctx = React.useContext(AssumptionsContext);
  if (ctx) return ctx;

  // Safe fallback for isolated rendering (e.g. unit tests).
  return {
    assumptions: DEFAULT_ASSUMPTIONS,
    setAssumptions: () => {},
    updateAssumptions: () => {},
    resetAssumptions: () => {},
  };
};
