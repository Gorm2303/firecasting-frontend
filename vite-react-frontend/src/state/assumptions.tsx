import React, { useCallback, useEffect, useMemo, useState } from 'react';

export type Assumptions = {
  currency: string;
  inflationPct: number;
  yearlyFeePct: number;
  expectedReturnPct: number;
  safeWithdrawalPct: number;

  /** Defaults for simulator tax exemptions (DK-specific modeling inputs). */
  taxExemptionDefaults: {
    exemptionCardLimit: number;
    exemptionCardYearlyIncrease: number;
    stockExemptionTaxRate: number;
    stockExemptionLimit: number;
    stockExemptionYearlyIncrease: number;
  };

  /** Defaults for Salary Taxator (DK model currently). */
  salaryTaxatorDefaults: {
    municipalityId: string;
    /** Used when municipality is not selected / unknown. */
    defaultMunicipalTaxRatePct: number;
    churchMember: boolean;
    employeePensionRatePct: number;
    otherDeductionsAnnualDkk: number;
    /** ATP employee share modeling defaults (used via proxy eligibility rule). */
    atpMonthlyDkk: number;
    atpEligibilityGrossMonthlyThresholdDkk: number;
  };

  /** Defaults for Money Perspectivator (analysis-only). */
  moneyPerspectiveDefaults: {
    workingHoursPerMonth: number;
    payRaisePct: number;
    timeHorizonYears: number;
    coreExpenseMonthlyDkk: number;
  };
};

const STORAGE_KEY_V1 = 'firecasting:assumptions:v1';
const STORAGE_KEY_V2 = 'firecasting:assumptions:v2';
const UI_PREFS_KEY_V1 = 'firecasting:uiPrefs:v1';

const DEFAULT_ASSUMPTIONS: Assumptions = {
  currency: 'DKK',
  inflationPct: 2,
  yearlyFeePct: 0.5,
  expectedReturnPct: 5,
  safeWithdrawalPct: 4,

  taxExemptionDefaults: {
    exemptionCardLimit: 51600,
    exemptionCardYearlyIncrease: 1000,
    stockExemptionTaxRate: 27,
    stockExemptionLimit: 67500,
    stockExemptionYearlyIncrease: 1000,
  },

  salaryTaxatorDefaults: {
    municipalityId: 'average',
    defaultMunicipalTaxRatePct: 25,
    churchMember: false,
    employeePensionRatePct: 0,
    otherDeductionsAnnualDkk: 0,
    atpMonthlyDkk: 99,
    atpEligibilityGrossMonthlyThresholdDkk: 2_340,
  },

  moneyPerspectiveDefaults: {
    workingHoursPerMonth: 160,
    payRaisePct: 2,
    timeHorizonYears: 10,
    coreExpenseMonthlyDkk: 12_000,
  },
};

type AssumptionsContextValue = {
  currentAssumptions: Assumptions;
  draftAssumptions: Assumptions;
  isDraftDirty: boolean;
  setDraftAssumptions: (next: Assumptions) => void;
  updateDraftAssumptions: (patch: Partial<Assumptions>) => void;
  resetDraftToCurrent: () => void;
  resetDraftToDefaults: () => void;
  saveDraft: () => void;
  discardDraft: () => void;
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

  const taxExemptionDefaults = (r.taxExemptionDefaults && typeof r.taxExemptionDefaults === 'object'
    ? (r.taxExemptionDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const salaryDefaults = (r.salaryTaxatorDefaults && typeof r.salaryTaxatorDefaults === 'object'
    ? (r.salaryTaxatorDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const moneyDefaults = (r.moneyPerspectiveDefaults && typeof r.moneyPerspectiveDefaults === 'object'
    ? (r.moneyPerspectiveDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  return {
    currency: asString(r.currency, DEFAULT_ASSUMPTIONS.currency),
    inflationPct: asNumber(r.inflationPct, DEFAULT_ASSUMPTIONS.inflationPct),
    yearlyFeePct: asNumber(r.yearlyFeePct, DEFAULT_ASSUMPTIONS.yearlyFeePct),
    expectedReturnPct: asNumber(r.expectedReturnPct, DEFAULT_ASSUMPTIONS.expectedReturnPct),
    safeWithdrawalPct: asNumber(r.safeWithdrawalPct, DEFAULT_ASSUMPTIONS.safeWithdrawalPct),

    taxExemptionDefaults: {
      exemptionCardLimit: asNumber(
        taxExemptionDefaults.exemptionCardLimit,
        DEFAULT_ASSUMPTIONS.taxExemptionDefaults.exemptionCardLimit
      ),
      exemptionCardYearlyIncrease: asNumber(
        taxExemptionDefaults.exemptionCardYearlyIncrease,
        DEFAULT_ASSUMPTIONS.taxExemptionDefaults.exemptionCardYearlyIncrease
      ),
      stockExemptionTaxRate: asNumber(
        taxExemptionDefaults.stockExemptionTaxRate,
        DEFAULT_ASSUMPTIONS.taxExemptionDefaults.stockExemptionTaxRate
      ),
      stockExemptionLimit: asNumber(
        taxExemptionDefaults.stockExemptionLimit,
        DEFAULT_ASSUMPTIONS.taxExemptionDefaults.stockExemptionLimit
      ),
      stockExemptionYearlyIncrease: asNumber(
        taxExemptionDefaults.stockExemptionYearlyIncrease,
        DEFAULT_ASSUMPTIONS.taxExemptionDefaults.stockExemptionYearlyIncrease
      ),
    },

    salaryTaxatorDefaults: {
      municipalityId: asString(salaryDefaults.municipalityId, DEFAULT_ASSUMPTIONS.salaryTaxatorDefaults.municipalityId),
      defaultMunicipalTaxRatePct: asNumber(
        salaryDefaults.defaultMunicipalTaxRatePct,
        DEFAULT_ASSUMPTIONS.salaryTaxatorDefaults.defaultMunicipalTaxRatePct
      ),
      churchMember: salaryDefaults.churchMember === true,
      employeePensionRatePct: asNumber(
        salaryDefaults.employeePensionRatePct,
        DEFAULT_ASSUMPTIONS.salaryTaxatorDefaults.employeePensionRatePct
      ),
      otherDeductionsAnnualDkk: asNumber(
        salaryDefaults.otherDeductionsAnnualDkk,
        DEFAULT_ASSUMPTIONS.salaryTaxatorDefaults.otherDeductionsAnnualDkk
      ),
      atpMonthlyDkk: asNumber(salaryDefaults.atpMonthlyDkk, DEFAULT_ASSUMPTIONS.salaryTaxatorDefaults.atpMonthlyDkk),
      atpEligibilityGrossMonthlyThresholdDkk: asNumber(
        salaryDefaults.atpEligibilityGrossMonthlyThresholdDkk,
        DEFAULT_ASSUMPTIONS.salaryTaxatorDefaults.atpEligibilityGrossMonthlyThresholdDkk
      ),
    },

    moneyPerspectiveDefaults: {
      workingHoursPerMonth: asNumber(
        moneyDefaults.workingHoursPerMonth,
        DEFAULT_ASSUMPTIONS.moneyPerspectiveDefaults.workingHoursPerMonth
      ),
      payRaisePct: asNumber(moneyDefaults.payRaisePct, DEFAULT_ASSUMPTIONS.moneyPerspectiveDefaults.payRaisePct),
      timeHorizonYears: Math.max(
        0,
        Math.trunc(asNumber(moneyDefaults.timeHorizonYears, DEFAULT_ASSUMPTIONS.moneyPerspectiveDefaults.timeHorizonYears))
      ),
      coreExpenseMonthlyDkk: asNumber(
        moneyDefaults.coreExpenseMonthlyDkk,
        DEFAULT_ASSUMPTIONS.moneyPerspectiveDefaults.coreExpenseMonthlyDkk
      ),
    },
  };
};

type AssumptionsStoreV2 = {
  current: Assumptions;
  draft: Assumptions;
};

const areEqual = (a: Assumptions, b: Assumptions): boolean => {
  // normalize() ensures stable key insertion order, so JSON stringify is stable for comparisons.
  return JSON.stringify(a) === JSON.stringify(b);
};

const normalizeStoreV2 = (raw: unknown): AssumptionsStoreV2 => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const current = normalize(r.current);
  const draft = normalize(r.draft);
  return { current, draft };
};

const migrateShowAssumptionsBarIfPresent = (raw: unknown) => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.showAssumptionsBar !== true) return;
  if (typeof window === 'undefined') return;

  try {
    const existing = safeParse(window.localStorage.getItem(UI_PREFS_KEY_V1));
    const existingObj = (existing && typeof existing === 'object' ? existing : {}) as Record<string, unknown>;
    if (existingObj.showAssumptionsBar === true) return;
    window.localStorage.setItem(UI_PREFS_KEY_V1, JSON.stringify({ ...existingObj, showAssumptionsBar: true }));
  } catch {
    /* ignore */
  }
};

export const getDefaultAssumptions = (): Assumptions => DEFAULT_ASSUMPTIONS;

export const loadCurrentAssumptionsFromStorage = (): Assumptions => {
  if (typeof window === 'undefined') return DEFAULT_ASSUMPTIONS;
  const v2Raw = safeParse(window.localStorage.getItem(STORAGE_KEY_V2));
  if (v2Raw && typeof v2Raw === 'object') {
    const store = normalizeStoreV2(v2Raw);
    return store.current;
  }

  const v1Raw = safeParse(window.localStorage.getItem(STORAGE_KEY_V1));
  return normalize(v1Raw);
};

export const AssumptionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<AssumptionsStoreV2>(() => {
    if (typeof window === 'undefined') {
      return { current: DEFAULT_ASSUMPTIONS, draft: DEFAULT_ASSUMPTIONS };
    }

    const v2Raw = safeParse(window.localStorage.getItem(STORAGE_KEY_V2));
    if (v2Raw) {
      return normalizeStoreV2(v2Raw);
    }

    const v1Raw = safeParse(window.localStorage.getItem(STORAGE_KEY_V1));
    migrateShowAssumptionsBarIfPresent(v1Raw);
    const current = normalize(v1Raw);
    return { current, draft: current };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  }, [store]);

  const setDraftAssumptions = useCallback(
    (next: Assumptions) => setStore((prev) => ({ ...prev, draft: normalize(next) })),
    []
  );
  const updateDraftAssumptions = useCallback(
    (patch: Partial<Assumptions>) => setStore((prev) => ({ ...prev, draft: normalize({ ...prev.draft, ...patch }) })),
    []
  );
  const resetDraftToCurrent = useCallback(
    () => setStore((prev) => ({ ...prev, draft: prev.current })),
    []
  );
  const resetDraftToDefaults = useCallback(
    () => setStore((prev) => ({ ...prev, draft: DEFAULT_ASSUMPTIONS })),
    []
  );
  const saveDraft = useCallback(
    () => setStore((prev) => ({ current: prev.draft, draft: prev.draft })),
    []
  );
  const discardDraft = resetDraftToCurrent;

  const isDraftDirty = useMemo(() => !areEqual(store.current, store.draft), [store.current, store.draft]);

  const value = useMemo<AssumptionsContextValue>(
    () => ({
      currentAssumptions: store.current,
      draftAssumptions: store.draft,
      isDraftDirty,
      setDraftAssumptions,
      updateDraftAssumptions,
      resetDraftToCurrent,
      resetDraftToDefaults,
      saveDraft,
      discardDraft,
    }),
    [
      discardDraft,
      isDraftDirty,
      resetDraftToCurrent,
      resetDraftToDefaults,
      saveDraft,
      setDraftAssumptions,
      store.current,
      store.draft,
      updateDraftAssumptions,
    ]
  );

  return <AssumptionsContext.Provider value={value}>{children}</AssumptionsContext.Provider>;
};

export const useAssumptions = (): AssumptionsContextValue => {
  const ctx = React.useContext(AssumptionsContext);
  if (ctx) return ctx;

  // Safe fallback for isolated rendering (e.g. unit tests).
  return {
    currentAssumptions: DEFAULT_ASSUMPTIONS,
    draftAssumptions: DEFAULT_ASSUMPTIONS,
    isDraftDirty: false,
    setDraftAssumptions: () => {},
    updateDraftAssumptions: () => {},
    resetDraftToCurrent: () => {},
    resetDraftToDefaults: () => {},
    saveDraft: () => {},
    discardDraft: () => {},
  };
};
