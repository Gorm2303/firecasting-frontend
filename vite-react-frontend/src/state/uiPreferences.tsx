import React, { useCallback, useEffect, useMemo, useState } from 'react';

export type UiPreferences = {
  showAssumptionsBar: boolean;
};

const STORAGE_KEY = 'firecasting:uiPrefs:v1';

const DEFAULT_UI_PREFERENCES: UiPreferences = {
  showAssumptionsBar: false,
};

type UiPreferencesContextValue = {
  uiPrefs: UiPreferences;
  setUiPrefs: (next: UiPreferences) => void;
  updateUiPrefs: (patch: Partial<UiPreferences>) => void;
  resetUiPrefs: () => void;
};

const UiPreferencesContext = React.createContext<UiPreferencesContextValue | null>(null);

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalize = (raw: unknown): UiPreferences => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    showAssumptionsBar: r.showAssumptionsBar === true,
  };
};

export const UiPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uiPrefs, setUiPrefsState] = useState<UiPreferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_UI_PREFERENCES;
    const raw = safeParse(window.localStorage.getItem(STORAGE_KEY));
    return normalize(raw);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(uiPrefs));
    } catch {
      /* ignore */
    }
  }, [uiPrefs]);

  const setUiPrefs = useCallback((next: UiPreferences) => setUiPrefsState(normalize(next)), []);
  const updateUiPrefs = useCallback(
    (patch: Partial<UiPreferences>) => setUiPrefsState((prev) => normalize({ ...prev, ...patch })),
    []
  );
  const resetUiPrefs = useCallback(() => setUiPrefsState(DEFAULT_UI_PREFERENCES), []);

  const value = useMemo<UiPreferencesContextValue>(
    () => ({ uiPrefs, setUiPrefs, updateUiPrefs, resetUiPrefs }),
    [uiPrefs, resetUiPrefs, setUiPrefs, updateUiPrefs]
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
};

export const useUiPreferences = (): UiPreferencesContextValue => {
  const ctx = React.useContext(UiPreferencesContext);
  if (ctx) return ctx;

  return {
    uiPrefs: DEFAULT_UI_PREFERENCES,
    setUiPrefs: () => {},
    updateUiPrefs: () => {},
    resetUiPrefs: () => {},
  };
};
