import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAssumptionsHistory } from './assumptionsHistory';
import { loadAssumptionsGovernance } from './assumptionsGovernance';

export type Assumptions = {
  currency: string;
  inflationPct: number;
  yearlyFeePct: number;
  expectedReturnPct: number;
  safeWithdrawalPct: number;

  /** Income assumptions and conventions shared across cashflow/tax/simulator views. */
  incomeSetupDefaults: {
    incomeModelType: 'grossFirst' | 'netFirst';
    payCadence: 'monthly' | 'biweekly' | 'yearly';
    salaryGrowthRule: 'fixedPct' | 'inflationLinked';
    bonusFrequency: 'none' | 'yearly' | 'monthly';
    bonusPct: number;
    taxEnabled: boolean;
    taxRegime: 'DK' | 'none';
  };

  /** Deposit strategy conventions (defaults used when a strategy does not specify). */
  depositStrategyDefaults: {
    depositTiming: 'startOfMonth' | 'endOfMonth';
    contributionCadence: 'monthly' | 'yearly';
    escalationMode: 'none' | 'pctYearly' | 'fixedDkkYearly';
    escalationPct: number;
    escalationDkkPerYear: number;
    inflationAdjustContributions: boolean;
    emergencyBufferTargetMonths: number;
    routingPriority: 'buffer>debt>wrappers>taxable' | 'buffer>goals>debt>wrappers>taxable';
  };

  /** Passive (market/portfolio) conventions beyond the core world-model knobs. */
  passiveStrategyDefaults: {
    returnModel: 'fixed' | 'normal' | 'historical';
    volatilityPct: number;
    rebalancing: 'none' | 'annual' | 'threshold';
    cashDragPct: number;
  };

  /** Withdrawal conventions (templates/philosophy defaults, not a full strategy editor). */
  withdrawalStrategyDefaults: {
    withdrawalRule: 'fixedPct' | 'fixedReal' | 'guardrails';
    inflationAdjustSpending: boolean;
    guardrailFloorPct: number;
    guardrailCeilingPct: number;
    maxCutPctPerYear: number;
    cashBufferTargetMonths: number;
  };

  /** Policy builder conventions (signals/governance defaults). */
  policyBuilderDefaults: {
    evaluationFrequency: 'monthly' | 'quarterly' | 'yearly';
    conflictResolution: 'priority' | 'mostConservative' | 'firstMatch';
    cooldownMonths: number;
    maxSpendingCutPctPerYear: number;
    maxDepositIncreasePctPerYear: number;
    warnFailureRiskPct: number;
    criticalFailureRiskPct: number;
  };

  /** FIRE milestone definitions and conventions. */
  fireMilestonesDefaults: {
    confidenceTarget: 'P50' | 'P90' | 'P95';
    milestoneStability: 'instant' | 'sustained';
    sustainedMonths: number;
    baristaFireRequiredMonthlyIncomeDkk: number;
    leanSpendingMonthlyDkk: number;
    fatSpendingMonthlyDkk: number;
  };

  /** Goal planner conventions and defaults. */
  goalPlannerDefaults: {
    fundingOrder: 'buffer>debt>goals>fi' | 'buffer>goals>debt>fi';
    goalInflationHandling: 'nominal' | 'real';
    goalRiskHandling: 'default' | 'highCertainty';
  };

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

  incomeSetupDefaults: {
    incomeModelType: 'grossFirst',
    payCadence: 'monthly',
    salaryGrowthRule: 'fixedPct',
    bonusFrequency: 'none',
    bonusPct: 0,
    taxEnabled: true,
    taxRegime: 'DK',
  },

  depositStrategyDefaults: {
    depositTiming: 'endOfMonth',
    contributionCadence: 'monthly',
    escalationMode: 'none',
    escalationPct: 0,
    escalationDkkPerYear: 0,
    inflationAdjustContributions: false,
    emergencyBufferTargetMonths: 6,
    routingPriority: 'buffer>debt>wrappers>taxable',
  },

  passiveStrategyDefaults: {
    returnModel: 'fixed',
    volatilityPct: 15,
    rebalancing: 'none',
    cashDragPct: 0,
  },

  withdrawalStrategyDefaults: {
    withdrawalRule: 'fixedPct',
    inflationAdjustSpending: true,
    guardrailFloorPct: 3,
    guardrailCeilingPct: 5,
    maxCutPctPerYear: 10,
    cashBufferTargetMonths: 6,
  },

  policyBuilderDefaults: {
    evaluationFrequency: 'monthly',
    conflictResolution: 'priority',
    cooldownMonths: 3,
    maxSpendingCutPctPerYear: 10,
    maxDepositIncreasePctPerYear: 10,
    warnFailureRiskPct: 10,
    criticalFailureRiskPct: 20,
  },

  fireMilestonesDefaults: {
    confidenceTarget: 'P90',
    milestoneStability: 'instant',
    sustainedMonths: 12,
    baristaFireRequiredMonthlyIncomeDkk: 0,
    leanSpendingMonthlyDkk: 12_000,
    fatSpendingMonthlyDkk: 30_000,
  },

  goalPlannerDefaults: {
    fundingOrder: 'buffer>debt>goals>fi',
    goalInflationHandling: 'real',
    goalRiskHandling: 'default',
  },

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

const asEnum = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = typeof v === 'string' ? (v as string).trim() : '';
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
};

export const normalizeAssumptions = (raw: unknown): Assumptions => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const incomeDefaults = (r.incomeSetupDefaults && typeof r.incomeSetupDefaults === 'object'
    ? (r.incomeSetupDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const depositDefaults = (r.depositStrategyDefaults && typeof r.depositStrategyDefaults === 'object'
    ? (r.depositStrategyDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const passiveDefaults = (r.passiveStrategyDefaults && typeof r.passiveStrategyDefaults === 'object'
    ? (r.passiveStrategyDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const withdrawalDefaults = (r.withdrawalStrategyDefaults && typeof r.withdrawalStrategyDefaults === 'object'
    ? (r.withdrawalStrategyDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const policyDefaults = (r.policyBuilderDefaults && typeof r.policyBuilderDefaults === 'object'
    ? (r.policyBuilderDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const milestoneDefaults = (r.fireMilestonesDefaults && typeof r.fireMilestonesDefaults === 'object'
    ? (r.fireMilestonesDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const goalDefaults = (r.goalPlannerDefaults && typeof r.goalPlannerDefaults === 'object'
    ? (r.goalPlannerDefaults as Record<string, unknown>)
    : {}) as Record<string, unknown>;

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

    incomeSetupDefaults: {
      incomeModelType: asEnum(incomeDefaults.incomeModelType, ['grossFirst', 'netFirst'] as const, DEFAULT_ASSUMPTIONS.incomeSetupDefaults.incomeModelType),
      payCadence: asEnum(incomeDefaults.payCadence, ['monthly', 'biweekly', 'yearly'] as const, DEFAULT_ASSUMPTIONS.incomeSetupDefaults.payCadence),
      salaryGrowthRule: asEnum(incomeDefaults.salaryGrowthRule, ['fixedPct', 'inflationLinked'] as const, DEFAULT_ASSUMPTIONS.incomeSetupDefaults.salaryGrowthRule),
      bonusFrequency: asEnum(incomeDefaults.bonusFrequency, ['none', 'yearly', 'monthly'] as const, DEFAULT_ASSUMPTIONS.incomeSetupDefaults.bonusFrequency),
      bonusPct: asNumber(incomeDefaults.bonusPct, DEFAULT_ASSUMPTIONS.incomeSetupDefaults.bonusPct),
      taxEnabled: incomeDefaults.taxEnabled === true,
      taxRegime: asEnum(incomeDefaults.taxRegime, ['DK', 'none'] as const, DEFAULT_ASSUMPTIONS.incomeSetupDefaults.taxRegime),
    },

    depositStrategyDefaults: {
      depositTiming: asEnum(depositDefaults.depositTiming, ['startOfMonth', 'endOfMonth'] as const, DEFAULT_ASSUMPTIONS.depositStrategyDefaults.depositTiming),
      contributionCadence: asEnum(depositDefaults.contributionCadence, ['monthly', 'yearly'] as const, DEFAULT_ASSUMPTIONS.depositStrategyDefaults.contributionCadence),
      escalationMode: asEnum(depositDefaults.escalationMode, ['none', 'pctYearly', 'fixedDkkYearly'] as const, DEFAULT_ASSUMPTIONS.depositStrategyDefaults.escalationMode),
      escalationPct: asNumber(depositDefaults.escalationPct, DEFAULT_ASSUMPTIONS.depositStrategyDefaults.escalationPct),
      escalationDkkPerYear: asNumber(depositDefaults.escalationDkkPerYear, DEFAULT_ASSUMPTIONS.depositStrategyDefaults.escalationDkkPerYear),
      inflationAdjustContributions: depositDefaults.inflationAdjustContributions === true,
      emergencyBufferTargetMonths: Math.max(0, Math.trunc(asNumber(depositDefaults.emergencyBufferTargetMonths, DEFAULT_ASSUMPTIONS.depositStrategyDefaults.emergencyBufferTargetMonths))),
      routingPriority: asEnum(depositDefaults.routingPriority, ['buffer>debt>wrappers>taxable', 'buffer>goals>debt>wrappers>taxable'] as const, DEFAULT_ASSUMPTIONS.depositStrategyDefaults.routingPriority),
    },

    passiveStrategyDefaults: {
      returnModel: asEnum(passiveDefaults.returnModel, ['fixed', 'normal', 'historical'] as const, DEFAULT_ASSUMPTIONS.passiveStrategyDefaults.returnModel),
      volatilityPct: asNumber(passiveDefaults.volatilityPct, DEFAULT_ASSUMPTIONS.passiveStrategyDefaults.volatilityPct),
      rebalancing: asEnum(passiveDefaults.rebalancing, ['none', 'annual', 'threshold'] as const, DEFAULT_ASSUMPTIONS.passiveStrategyDefaults.rebalancing),
      cashDragPct: asNumber(passiveDefaults.cashDragPct, DEFAULT_ASSUMPTIONS.passiveStrategyDefaults.cashDragPct),
    },

    withdrawalStrategyDefaults: {
      withdrawalRule: asEnum(withdrawalDefaults.withdrawalRule, ['fixedPct', 'fixedReal', 'guardrails'] as const, DEFAULT_ASSUMPTIONS.withdrawalStrategyDefaults.withdrawalRule),
      inflationAdjustSpending: withdrawalDefaults.inflationAdjustSpending !== false,
      guardrailFloorPct: asNumber(withdrawalDefaults.guardrailFloorPct, DEFAULT_ASSUMPTIONS.withdrawalStrategyDefaults.guardrailFloorPct),
      guardrailCeilingPct: asNumber(withdrawalDefaults.guardrailCeilingPct, DEFAULT_ASSUMPTIONS.withdrawalStrategyDefaults.guardrailCeilingPct),
      maxCutPctPerYear: asNumber(withdrawalDefaults.maxCutPctPerYear, DEFAULT_ASSUMPTIONS.withdrawalStrategyDefaults.maxCutPctPerYear),
      cashBufferTargetMonths: Math.max(0, Math.trunc(asNumber(withdrawalDefaults.cashBufferTargetMonths, DEFAULT_ASSUMPTIONS.withdrawalStrategyDefaults.cashBufferTargetMonths))),
    },

    policyBuilderDefaults: {
      evaluationFrequency: asEnum(policyDefaults.evaluationFrequency, ['monthly', 'quarterly', 'yearly'] as const, DEFAULT_ASSUMPTIONS.policyBuilderDefaults.evaluationFrequency),
      conflictResolution: asEnum(policyDefaults.conflictResolution, ['priority', 'mostConservative', 'firstMatch'] as const, DEFAULT_ASSUMPTIONS.policyBuilderDefaults.conflictResolution),
      cooldownMonths: Math.max(0, Math.trunc(asNumber(policyDefaults.cooldownMonths, DEFAULT_ASSUMPTIONS.policyBuilderDefaults.cooldownMonths))),
      maxSpendingCutPctPerYear: asNumber(policyDefaults.maxSpendingCutPctPerYear, DEFAULT_ASSUMPTIONS.policyBuilderDefaults.maxSpendingCutPctPerYear),
      maxDepositIncreasePctPerYear: asNumber(policyDefaults.maxDepositIncreasePctPerYear, DEFAULT_ASSUMPTIONS.policyBuilderDefaults.maxDepositIncreasePctPerYear),
      warnFailureRiskPct: asNumber(policyDefaults.warnFailureRiskPct, DEFAULT_ASSUMPTIONS.policyBuilderDefaults.warnFailureRiskPct),
      criticalFailureRiskPct: asNumber(policyDefaults.criticalFailureRiskPct, DEFAULT_ASSUMPTIONS.policyBuilderDefaults.criticalFailureRiskPct),
    },

    fireMilestonesDefaults: {
      confidenceTarget: asEnum(milestoneDefaults.confidenceTarget, ['P50', 'P90', 'P95'] as const, DEFAULT_ASSUMPTIONS.fireMilestonesDefaults.confidenceTarget),
      milestoneStability: asEnum(milestoneDefaults.milestoneStability, ['instant', 'sustained'] as const, DEFAULT_ASSUMPTIONS.fireMilestonesDefaults.milestoneStability),
      sustainedMonths: Math.max(0, Math.trunc(asNumber(milestoneDefaults.sustainedMonths, DEFAULT_ASSUMPTIONS.fireMilestonesDefaults.sustainedMonths))),
      baristaFireRequiredMonthlyIncomeDkk: asNumber(milestoneDefaults.baristaFireRequiredMonthlyIncomeDkk, DEFAULT_ASSUMPTIONS.fireMilestonesDefaults.baristaFireRequiredMonthlyIncomeDkk),
      leanSpendingMonthlyDkk: asNumber(milestoneDefaults.leanSpendingMonthlyDkk, DEFAULT_ASSUMPTIONS.fireMilestonesDefaults.leanSpendingMonthlyDkk),
      fatSpendingMonthlyDkk: asNumber(milestoneDefaults.fatSpendingMonthlyDkk, DEFAULT_ASSUMPTIONS.fireMilestonesDefaults.fatSpendingMonthlyDkk),
    },

    goalPlannerDefaults: {
      fundingOrder: asEnum(goalDefaults.fundingOrder, ['buffer>debt>goals>fi', 'buffer>goals>debt>fi'] as const, DEFAULT_ASSUMPTIONS.goalPlannerDefaults.fundingOrder),
      goalInflationHandling: asEnum(goalDefaults.goalInflationHandling, ['nominal', 'real'] as const, DEFAULT_ASSUMPTIONS.goalPlannerDefaults.goalInflationHandling),
      goalRiskHandling: asEnum(goalDefaults.goalRiskHandling, ['default', 'highCertainty'] as const, DEFAULT_ASSUMPTIONS.goalPlannerDefaults.goalRiskHandling),
    },

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
  const current = normalizeAssumptions(r.current);
  const draft = normalizeAssumptions(r.draft);
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
  return normalizeAssumptions(v1Raw);
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
    const current = normalizeAssumptions(v1Raw);
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
    (next: Assumptions) => setStore((prev) => ({ ...prev, draft: normalizeAssumptions(next) })),
    []
  );
  const updateDraftAssumptions = useCallback(
    (patch: Partial<Assumptions>) =>
      setStore((prev) => ({ ...prev, draft: normalizeAssumptions({ ...prev.draft, ...patch }) })),
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
  const saveDraft = useCallback(() => {
    setStore((prev) => {
      try {
        const g = loadAssumptionsGovernance();
        appendAssumptionsHistory(prev.draft, { sourceNote: g.sourceNote });
      } catch {
        /* ignore */
      }
      return { current: prev.draft, draft: prev.draft };
    });
  }, []);
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
