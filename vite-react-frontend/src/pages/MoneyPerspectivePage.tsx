import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import {
  defaultMoneyPerspectiveSettings,
  loadMoneyPerspectiveSettings,
  saveMoneyPerspectiveSettings,
  type MoneyPerspectiveSettingsV3,
  type MoneyPerspectiveSalaryPeriod,
} from "../config/moneyPerspectiveSettings";
import {
  futureValueNominalTotalForItems,
  purchaseMonthlyEquivalent,
  purchaseYearlyEquivalent,
  type PurchaseAmountType,
} from "../lib/moneyPerspective/purchases";
import {
  deleteExpenseList,
  findExpenseListById,
  listSavedExpenseLists,
  saveExpenseList,
  type SavedExpenseList,
} from "../config/savedExpenseLists";
import {
  decodeExpenseListFromShareParam,
  encodeExpenseListToShareParam,
} from "../utils/shareExpenseListLink";
import {
  draftToNumberOrZero,
  isValidDecimalDraft,
} from "../utils/numberInput";
import {
  DAYS_PER_MONTH,
  applySimpleFeeDragToAnnualReturn,
  breakEvenMonths,
  equivalentCoreExpenseDaysInYearN,
  futureValueReal,
  monthlyBenefitMoneyFromHours,
  workHours,
} from "../lib/moneyPerspective/calculations";

const controlStyle: React.CSSProperties = {
  height: 44,
  padding: "0 10px",
  border: "1px solid var(--fc-card-border)",
  borderRadius: 4,
  background: "var(--fc-card-bg)",
  color: "var(--fc-card-text)",
  fontSize: 18,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--fc-card-border)",
  background: "var(--fc-card-bg)",
  color: "var(--fc-card-text)",
  borderRadius: 10,
  padding: 14,
};

const subtleTextStyle: React.CSSProperties = {
  color: "var(--fc-card-muted)",
};

// Match the Salary Taxator "Net salary" summary-card pattern.
const perspectivesCardStyle: React.CSSProperties = {
  border: "1px solid var(--fc-card-border)",
  background: "var(--fc-card-bg)",
  color: "var(--fc-card-text)",
  padding: 14,
  borderRadius: 4,
  display: "grid",
  gap: 10,
};

const perspectivesHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "baseline",
};

const perspectivesTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 26,
};

const perspectivesBigValueStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 32,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  textAlign: "right",
};

const perspectivesLineRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const assumptionsDetailsStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid var(--fc-subtle-border)",
  borderRadius: 6,
  padding: 10,
  background: "var(--fc-card-bg)",
  color: "var(--fc-card-text)",
};

const assumptionsSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};

const breakdownMainDetailsStyle: React.CSSProperties = {
  marginTop: 14,
};

const breakdownMainSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 16,
};

const breakdownSelectStyle: React.CSSProperties = {
  ...controlStyle,
  height: 34,
  fontSize: 14,
  padding: "0 8px",
};

const savedModalBtn = (variant: "ghost" | "disabled"): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #444",
    cursor: "pointer",
    fontSize: 14,
    background: "transparent",
    color: "#ddd",
  };
  if (variant === "disabled") {
    return {
      ...base,
      opacity: 0.5,
      background: "#222",
      color: "#bbb",
      cursor: "not-allowed",
    };
  }
  return base;
};

const btn = (): React.CSSProperties => ({
  height: 36,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--fc-subtle-border)",
  cursor: "pointer",
  background: "transparent",
  color: "inherit",
  fontWeight: 800,
});

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  height: 44,
  border: "1px solid var(--fc-card-border)",
  borderRadius: 4,
  overflow: "hidden",
  background: "var(--fc-card-bg)",
  color: "var(--fc-card-text)",
  fontSize: 18,
  minWidth: 0,
  boxSizing: "border-box",
};

const inputGroupInputStyle: React.CSSProperties = {
  flex: "1 1 auto",
  width: "100%",
  padding: "0 10px",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  minWidth: 0,
  boxSizing: "border-box",
};

const inputGroupUnitStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "0 10px",
  borderLeft: "1px solid var(--fc-subtle-border)",
  background: "var(--fc-subtle-bg)",
  color: "var(--fc-card-muted)",
  fontSize: 18,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const formatCurrencyNoDecimals = (value: number, currency: string): string => {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `${Math.round(safe)} ${currency}`;
  }
};

const formatNumber = (value: number, digits = 2): string => {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const formatRunwayDmy = (runwayDays: number, dayDigits = 0): string => {
  if (!Number.isFinite(runwayDays)) return "—";

  const totalDays = Math.max(0, runwayDays);
  const daysPerYear = 365;

  let remaining = totalDays;
  let years = Math.floor(remaining / daysPerYear);
  remaining -= years * daysPerYear;

  let months = Math.floor(remaining / DAYS_PER_MONTH);
  remaining -= months * DAYS_PER_MONTH;

  let days = dayDigits > 0 ? roundTo1Decimal(remaining) : Math.round(remaining);

  // Guard against floating rounding nudging us over the boundary.
  const maxDaysInMonth = Math.ceil(DAYS_PER_MONTH);
  if (days >= maxDaysInMonth) {
    months += 1;
    days = 0;
  }
  if (months >= 12) {
    years += Math.floor(months / 12);
    months = months % 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0 || years > 0) parts.push(`${months}m`);
  parts.push(`${days.toFixed(dayDigits)}d`);
  return parts.join(" ");
};

const formatSignedRunwayDmy = (runwayDays: number, dayDigits = 0): string => {
  if (!Number.isFinite(runwayDays)) return "—";
  if (runwayDays === 0) return `0${dayDigits > 0 ? ".0" : ""}d`;
  const sign = runwayDays < 0 ? "-" : "";
  return sign + formatRunwayDmy(Math.abs(runwayDays), dayDigits);
};

const formatHoursAsYmd = (
  hours: number,
  dayDigits = 0,
  useWorkDays = false,
): string => {
  if (!Number.isFinite(hours)) return "—";

  const sign = hours < 0 ? "-" : "";
  const totalDays = Math.abs(hours) / 8;

  // "Work days" mode uses:
  // - no weekends
  // - 1 month = 20 work days
  // - 1 year = 12 * 20 = 240 work days
  const workDaysPerYear = 12 * 20;
  const daysPerYear = useWorkDays ? workDaysPerYear : 365;
  const daysPerMonth = useWorkDays ? 20 : DAYS_PER_MONTH;
  let remaining = totalDays;
  const years = Math.floor(remaining / daysPerYear);
  remaining -= years * daysPerYear;

  const months = Math.floor(remaining / daysPerMonth);
  remaining -= months * daysPerMonth;

  const days =
    dayDigits > 0 ? roundTo1Decimal(remaining) : Math.round(remaining);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0 || years > 0) parts.push(`${months}m`);
  parts.push(`${days.toFixed(dayDigits)}d`);
  return sign + parts.join(" ");
};

const toDraft = (value: number): string => {
  if (!Number.isFinite(value)) return "";
  return String(value);
};

type MonthlyBenefitMode = "money" | "hours";

type WorkProjectionBreakdownColumn =
  | "workThisYear"
  | "workTotal"
  | "investedThisYear"
  | "investedTotal";

type FutureValueProjectionBreakdownColumn =
  | "valueThisYear"
  | "valueTotal"
  | "investedThisYear"
  | "investedTotal";

type FutureRunwayProjectionBreakdownColumn =
  | "runwayThisYear"
  | "runwayTotal"
  | "investedRunwayThisYear"
  | "investedRunwayTotal";

type CashflowFvRowsParams = {
  yearsList: number[];
  upfront: number;
  recurringMonthlyBase: number;
  annualReturnPct: number;
  feeDragPct: number;
  inflationPct: number;
};

function computeCashflowFvRows(params: CashflowFvRowsParams): Array<{
  years: number;
  valueThisYearNominal: number;
  valueTotalNominal: number;
  valueThisYearReal: number;
  valueTotalReal: number;
  nominalThisYear: number | null;
  totalNominal: number | null;
  realThisYear: number | null;
  totalReal: number | null;
}> {
  const {
    yearsList,
    upfront,
    recurringMonthlyBase,
    annualReturnPct,
    feeDragPct,
    inflationPct,
  } = params;

  const annualReturnPctLocal = Number(annualReturnPct ?? 0);
  const annualReturnRate = Number.isFinite(annualReturnPctLocal)
    ? annualReturnPctLocal / 100
    : 0;
  const stepRMonthly = 1 + annualReturnRate / 12;

  const feeDragPctLocal = Number(feeDragPct ?? 0);
  const feeRate = Number.isFinite(feeDragPctLocal)
    ? Math.max(0, Math.min(0.99, feeDragPctLocal / 100))
    : 0;

  const inflationPctLocal = Number(inflationPct ?? 0);
  const inflationOk = Number.isFinite(inflationPctLocal) && inflationPctLocal >= 0;
  const inflationRate = inflationOk ? inflationPctLocal / 100 : 0;
  const stepInflationYearly = 1 + inflationRate;

  const yearsSorted = [...yearsList]
    .filter((y) => Number.isFinite(y) && y > 0)
    .sort((a, b) => a - b);
  const maxYear = yearsSorted.length ? yearsSorted[yearsSorted.length - 1]! : 0;

  // Counterfactual “if invested” mechanics:
  // - upfront (one-time) is deposited at the start of Year 1 (so Year 1 “this year” includes it)
  // - for each month in a year: add monthly spending, then apply monthly return
  // - after 12 months: subtract annual fee, then apply yearly inflation to next year's monthly spending
  const investedEndOfYearNominal: Array<number | null> = Array.from(
    { length: maxYear + 1 },
    () => null,
  );
  investedEndOfYearNominal[0] = 0;

  if (!Number.isFinite(stepRMonthly) || !(stepRMonthly > 0)) {
    // Invalid return settings (e.g., r so negative that 1+r/12 <= 0) => invested values are undefined.
    for (let y = 1; y <= maxYear; y += 1) investedEndOfYearNominal[y] = null;
  } else {
    let balance = 0;
    let monthlySpend = recurringMonthlyBase;
    for (let year = 1; year <= maxYear; year += 1) {
      if (year === 1 && upfront > 0) balance += upfront;
      for (let m = 1; m <= 12; m += 1) {
        if (monthlySpend > 0) balance += monthlySpend;
        balance *= stepRMonthly;
      }
      if (feeRate > 0) balance *= 1 - feeRate;
      investedEndOfYearNominal[year] = balance;
      if (inflationOk && inflationRate > 0) monthlySpend *= stepInflationYearly;
    }
  }

  const investedEndOfYearReal: Array<number | null> = investedEndOfYearNominal.map(
    (nominal, year) => {
      if (nominal == null) return null;
      if (year === 0) return nominal;
      if (!inflationOk || stepInflationYearly === 1) return nominal;
      const denom = Math.pow(stepInflationYearly, Math.max(0, year - 1));
      return denom > 0 ? nominal / denom : null;
    },
  );

  const recurringYearlyBase = recurringMonthlyBase * 12;
  const sumInflatedYearlyRecurring = (years: number): number => {
    if (!(years > 0)) return 0;
    if (!(recurringYearlyBase > 0)) return 0;
    if (!inflationOk || inflationRate === 0) return recurringYearlyBase * years;
    // Sum_{k=0..years-1} (1+i)^k = ((1+i)^years - 1)/i
    return (
      recurringYearlyBase *
      ((Math.pow(stepInflationYearly, years) - 1) / inflationRate)
    );
  };

  return yearsSorted.map((years) => {
    const totalNominal = investedEndOfYearNominal[years];
    const totalReal = investedEndOfYearReal[years];

    const prevNominal = investedEndOfYearNominal[years - 1] ?? null;
    const prevReal = investedEndOfYearReal[years - 1] ?? null;

    const nominalThisYear =
      totalNominal != null && prevNominal != null
        ? totalNominal - prevNominal
        : null;
    const realThisYear =
      totalReal != null && prevReal != null ? totalReal - prevReal : null;

    const recurringYearlyInYearN =
      years >= 1 && recurringYearlyBase > 0
        ? inflationOk
          ? recurringYearlyBase *
            Math.pow(stepInflationYearly, Math.max(0, years - 1))
          : recurringYearlyBase
        : 0;

    // “Expenses” (formerly “Value”) is the non-invested cost of the expenses.
    // Nominal: in the money of that year. Real: deflated back to Year 1 (today) money.
    const valueThisYearNominal = (years === 1 ? upfront : 0) + recurringYearlyInYearN;
    const valueTotalNominal = upfront + sumInflatedYearlyRecurring(years);
    const denom = !inflationOk || stepInflationYearly === 1
      ? 1
      : Math.pow(stepInflationYearly, Math.max(0, years - 1));
    const valueThisYearReal = denom > 0 ? valueThisYearNominal / denom : 0;
    const valueTotalReal = denom > 0 ? valueTotalNominal / denom : 0;

    return {
      years,
      valueThisYearNominal,
      valueTotalNominal,
      valueThisYearReal,
      valueTotalReal,
      nominalThisYear,
      totalNominal,
      realThisYear,
      totalReal,
    };
  });
}

const HORIZON_TABLE_YEARS: number[] = Array.from(
  { length: 10 },
  (_, i) => (i + 1) * 5,
); // 5..50

const EXTRA_DETAIL_YEARS: number[] = [1, 2, 3, 4];

const PAGE_DRAFT_STORAGE_KEY = "firecasting:moneyPerspective:pageDraft:v3";

type PurchaseItem = {
  id: string;
  name?: string;
  type: PurchaseAmountType;
  amount: number;
  currency: string;
};

type PageDraftV3 = {
  version: 3;
  newItemName?: string;
  newItemType?: PurchaseAmountType;
  newItemAmountDraft?: string;
  newItemCurrency?: string;
  items?: PurchaseItem[];
  benefitMode?: MonthlyBenefitMode;
  monthlyBenefitDraft?: string;
};

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asMonthlyBenefitMode(v: unknown): MonthlyBenefitMode | null {
  return v === "money" || v === "hours" ? v : null;
}

function asPurchaseAmountType(v: unknown): PurchaseAmountType | null {
  return v === "oneTime" ||
    v === "daily" ||
    v === "weekly" ||
    v === "monthly" ||
    v === "yearly"
    ? v
    : null;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeCurrencyDraft(currency: string): string {
  const trimmed = currency.trim().toUpperCase();
  return trimmed || "DKK";
}

function asPurchaseItemArray(v: unknown): PurchaseItem[] | null {
  if (!Array.isArray(v)) return null;
  const items: PurchaseItem[] = [];
  for (const raw of v) {
    const r = asRecord(raw);
    if (!r) continue;
    const id = asString(r.id) ?? newId();
    const type = asPurchaseAmountType(asString(r.type)) ?? "oneTime";
    const currency = normalizeCurrencyDraft(asString(r.currency) ?? "DKK");
    const amountRaw = r.amount;
    const amount =
      typeof amountRaw === "number" && Number.isFinite(amountRaw)
        ? amountRaw
        : 0;
    if (!(amount > 0)) continue;
    const name = asString(r.name) ?? undefined;
    items.push({ id, name, type, amount, currency });
  }
  return items;
}

function periodToMonthlyEquivalent(
  amount: number,
  period: MoneyPerspectiveSalaryPeriod,
): number {
  switch (period) {
    case "hourly":
      return amount;
    case "daily":
      return amount * DAYS_PER_MONTH;
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
  }
}

function salaryAmountFromEffectiveHourly(
  effectiveHourly: number,
  workingHoursPerMonth: number,
  period: MoneyPerspectiveSalaryPeriod,
): number {
  if (!(effectiveHourly > 0) || !(workingHoursPerMonth > 0)) return 0;
  if (period === "hourly") return effectiveHourly;

  const monthlyIncome = effectiveHourly * workingHoursPerMonth;
  if (period === "daily") return monthlyIncome / DAYS_PER_MONTH;
  if (period === "weekly") return (monthlyIncome * 12) / 52;
  if (period === "monthly") return monthlyIncome;
  return monthlyIncome * 12;
}

function effectiveHourlyFromSalarySettings(
  comp: MoneyPerspectiveSettingsV3["compensation"],
): number | null {
  const { period, amount, workingHoursPerMonth } = comp;
  if (!(typeof amount === "number" && Number.isFinite(amount) && amount > 0))
    return null;
  if (period === "hourly") return amount;
  if (
    !(
      typeof workingHoursPerMonth === "number" &&
      Number.isFinite(workingHoursPerMonth) &&
      workingHoursPerMonth > 0
    )
  )
    return null;
  const monthlyEq = periodToMonthlyEquivalent(amount, period);
  return monthlyEq / workingHoursPerMonth;
}

function coreExpenseValueForSource(
  core: MoneyPerspectiveSettingsV3["coreExpenses"],
): number {
  switch (core.source) {
    case "daily":
      return core.dailyCoreExpense;
    case "weekly":
      return core.weeklyCoreExpense;
    case "monthly":
      return core.monthlyCoreExpense;
    case "yearly":
      return core.yearlyCoreExpense;
    default:
      return 0;
  }
}

function dailyCoreExpenseFromSettings(
  core: MoneyPerspectiveSettingsV3["coreExpenses"],
): number | null {
  const amount = coreExpenseValueForSource(core);
  if (!(typeof amount === "number" && Number.isFinite(amount) && amount > 0))
    return null;

  if (core.source === "daily") return amount;
  if (core.source === "weekly") return amount / 7;
  if (core.source === "monthly") return amount / DAYS_PER_MONTH;
  return amount / 365;
}

function setCoreExpenseFromDaily(
  core: MoneyPerspectiveSettingsV3["coreExpenses"],
  source: MoneyPerspectiveSettingsV3["coreExpenses"]["source"],
  daily: number,
): MoneyPerspectiveSettingsV3["coreExpenses"] {
  const nextDaily = daily;
  const nextWeekly = nextDaily * 7;
  const nextMonthly = nextDaily * DAYS_PER_MONTH;
  const nextYearly = nextDaily * 365;

  return {
    ...core,
    source,
    dailyCoreExpense: nextDaily,
    weeklyCoreExpense: nextWeekly,
    monthlyCoreExpense: nextMonthly,
    yearlyCoreExpense: nextYearly,
  };
}

function setCoreExpenseForSource(
  core: MoneyPerspectiveSettingsV3["coreExpenses"],
  source: MoneyPerspectiveSettingsV3["coreExpenses"]["source"],
  amountForSource: number,
): MoneyPerspectiveSettingsV3["coreExpenses"] {
  const v = amountForSource;
  if (!(typeof v === "number" && Number.isFinite(v) && v > 0)) {
    return { ...core, source };
  }

  let daily = v;
  if (source === "weekly") daily = v / 7;
  if (source === "monthly") daily = v / DAYS_PER_MONTH;
  if (source === "yearly") daily = v / 365;
  return setCoreExpenseFromDaily(core, source, daily);
}

const MoneyPerspectivePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [settings, setSettings] = useState<MoneyPerspectiveSettingsV3>(() =>
    loadMoneyPerspectiveSettings(),
  );

  const initialDraft = useMemo((): PageDraftV3 | null => {
    if (typeof window === "undefined") return null;
    const raw = asRecord(
      safeParse(window.localStorage.getItem(PAGE_DRAFT_STORAGE_KEY)),
    );
    if (raw && raw.version === 3) {
      return {
        version: 3,
        newItemName: asString(raw.newItemName) ?? undefined,
        newItemType: asPurchaseAmountType(raw.newItemType) ?? undefined,
        newItemAmountDraft: asString(raw.newItemAmountDraft) ?? undefined,
        newItemCurrency: asString(raw.newItemCurrency) ?? undefined,
        items: asPurchaseItemArray(raw.items) ?? undefined,
        benefitMode: asMonthlyBenefitMode(raw.benefitMode) ?? undefined,
        monthlyBenefitDraft: asString(raw.monthlyBenefitDraft) ?? undefined,
      };
    }

    // Best-effort migrate from older draft v2 if present under its old key.
    const rawV2 = asRecord(
      safeParse(
        window.localStorage.getItem(
          "firecasting:moneyPerspective:pageDraft:v2",
        ),
      ),
    );
    if (!rawV2 || rawV2.version !== 2) return null;
    const purchaseCurrency = normalizeCurrencyDraft(
      asString(rawV2.purchaseCurrency) ?? "DKK",
    );
    const purchaseAmountDraft = asString(rawV2.purchaseAmountDraft) ?? "";
    const purchaseType =
      asPurchaseAmountType(rawV2.purchaseType) ?? ("oneTime" as const);
    const parsedAmount =
      purchaseAmountDraft && isValidDecimalDraft(purchaseAmountDraft)
        ? draftToNumberOrZero(purchaseAmountDraft)
        : 0;
    const items: PurchaseItem[] =
      parsedAmount > 0
        ? [
            {
              id: newId(),
              name: undefined,
              type: purchaseType,
              amount: parsedAmount,
              currency: purchaseCurrency,
            },
          ]
        : [];
    return {
      version: 3,
      newItemName: undefined,
      newItemType: purchaseType,
      newItemAmountDraft: purchaseAmountDraft,
      newItemCurrency: purchaseCurrency,
      items,
      benefitMode: asMonthlyBenefitMode(rawV2.benefitMode) ?? undefined,
      monthlyBenefitDraft: asString(rawV2.monthlyBenefitDraft) ?? undefined,
    };
  }, []);

  const [newItemCurrency, setNewItemCurrency] = useState<string>(() =>
    normalizeCurrencyDraft(initialDraft?.newItemCurrency ?? settings.currency),
  );
  const [items, setItems] = useState<PurchaseItem[]>(() => {
    const fromDraft = initialDraft?.items ?? [];
    if (fromDraft.length > 0) return fromDraft;

    const currency = normalizeCurrencyDraft(
      initialDraft?.newItemCurrency ?? settings.currency,
    );
    return [
      {
        id: newId(),
        name: undefined,
        type: "oneTime",
        amount: 1000,
        currency,
      },
    ];
  });

  const [itemAmountDrafts, setItemAmountDrafts] = useState<
    Record<string, string>
  >(() => {
    const list = initialDraft?.items ?? [];
    const out: Record<string, string> = {};
    for (const it of list) out[it.id] = toDraft(it.amount);
    return out;
  });

  useEffect(() => {
    setItemAmountDrafts((prev) => {
      const next: Record<string, string> = { ...prev };
      const ids = new Set(items.map((it) => it.id));
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      for (const it of items) {
        if (next[it.id] == null) next[it.id] = toDraft(it.amount);
      }
      return next;
    });
  }, [items]);

  const itemsWithAmount = useMemo(() => {
    return items.filter((it) => it.amount > 0);
  }, [items]);

  const year0Cost = useMemo(() => {
    return itemsWithAmount.reduce((sum, it) => sum + it.amount, 0);
  }, [itemsWithAmount]);

  const oneTimeExpenseTotal = useMemo(() => {
    return itemsWithAmount
      .filter((it) => it.type === "oneTime")
      .reduce((sum, it) => sum + it.amount, 0);
  }, [itemsWithAmount]);

  const recurringYearlyExpenseTotal = useMemo(() => {
    return itemsWithAmount
      .filter((it) => it.type !== "oneTime")
      .reduce(
        (sum, it) => sum + purchaseYearlyEquivalent(it.amount, it.type),
        0,
      );
  }, [itemsWithAmount]);

  const valueThisYearExpenseTotal = useMemo(() => {
    return oneTimeExpenseTotal + recurringYearlyExpenseTotal;
  }, [oneTimeExpenseTotal, recurringYearlyExpenseTotal]);

  const oneTimeItemCount = useMemo(() => {
    return itemsWithAmount.filter((it) => it.type === "oneTime").length;
  }, [itemsWithAmount]);

  const recurringItemCount = useMemo(() => {
    return itemsWithAmount.filter((it) => it.type !== "oneTime").length;
  }, [itemsWithAmount]);

  const displayCurrency = useMemo(() => {
    if (items.length > 0) return items[0].currency;
    return normalizeCurrencyDraft(newItemCurrency);
  }, [items, newItemCurrency]);

  const setCurrencyForAllItems = (currencyDraft: string) => {
    const normalized = normalizeCurrencyDraft(currencyDraft);
    setNewItemCurrency(normalized);
    setItems((current) =>
      current.map((it) => ({ ...it, currency: normalized })),
    );
  };

  const addItem = () => {
    const listCurrency =
      items.length > 0
        ? normalizeCurrencyDraft(items[0].currency)
        : normalizeCurrencyDraft(newItemCurrency);
    const id = newId();
    const amount = 1000;

    setItems((current) => [
      ...current,
      { id, name: undefined, type: "oneTime", amount, currency: listCurrency },
    ]);
    setItemAmountDrafts((prev) => ({ ...prev, [id]: toDraft(amount) }));
    setNewItemCurrency(listCurrency);
  };

  const prefillAppliedRef = useRef(false);
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;

    // New (share/import): /money-perspective?expenseList=<encoded>
    const shared = searchParams.get("expenseList");
    if (shared) {
      const decoded = decodeExpenseListFromShareParam(shared);
      if (decoded) {
        const currency = normalizeCurrencyDraft(decoded.currency);
        const imported: PurchaseItem[] =
          decoded.items.length > 0
            ? decoded.items.map((it) => ({
                id: newId(),
                name: it.name?.trim() ? it.name.trim() : undefined,
                type: it.type,
                amount: it.amount,
                currency,
              }))
            : ([
                {
                  id: newId(),
                  name: undefined,
                  type: "oneTime" as const,
                  amount: 0,
                  currency,
                },
              ] satisfies PurchaseItem[]);

        setItems(imported);
        setNewItemCurrency(currency);
        return;
      }
      // If corrupted, ignore and fall back to old params.
    }

    // Supports prefill when launched from another view:
    // /money-perspective?amount=5000&currency=DKK&type=oneTime
    const amountRaw = searchParams.get("amount");
    const currencyRaw = searchParams.get("currency");
    const typeRaw = searchParams.get("type");

    const parsedType = typeRaw ? asPurchaseAmountType(typeRaw.trim()) : null;
    const currency = normalizeCurrencyDraft(currencyRaw ?? "DKK");
    if (currencyRaw && currencyRaw.trim()) {
      setNewItemCurrency(currency);
      setItems((current) => current.map((it) => ({ ...it, currency })));
    }

    if (amountRaw && isValidDecimalDraft(amountRaw)) {
      const parsed = draftToNumberOrZero(amountRaw);
      setItems((current) => {
        const base: PurchaseItem[] =
          current.length > 0
            ? current
            : ([
                {
                  id: newId(),
                  name: undefined,
                  type: "oneTime" as const,
                  amount: 0,
                  currency,
                },
              ] satisfies PurchaseItem[]);
        const first = base[0]!;
        const nextFirst: PurchaseItem = {
          ...first,
          currency,
          type: parsedType ?? first.type,
          amount: parsed,
        };
        return [nextFirst, ...base.slice(1).map((x) => ({ ...x, currency }))];
      });
    } else if (parsedType) {
      setItems((current) =>
        current.map((x, i) => (i === 0 ? { ...x, type: parsedType } : x)),
      );
    }
  }, [searchParams]);

  const [benefitMode, setBenefitMode] = useState<MonthlyBenefitMode>(
    () => initialDraft?.benefitMode ?? "money",
  );
  const [monthlyBenefitDraft, setMonthlyBenefitDraft] = useState<string>(
    () => initialDraft?.monthlyBenefitDraft ?? "",
  );

  const [netSalaryDraft, setNetSalaryDraft] = useState<string>(() =>
    toDraft(settings.compensation.amount),
  );
  const [payRaiseDraft, setPayRaiseDraft] = useState<string>(() =>
    toDraft(settings.compensation.payRaisePct),
  );
  const [coreExpensesDraft, setCoreExpensesDraft] = useState<string>(() =>
    toDraft(coreExpenseValueForSource(settings.coreExpenses)),
  );
  const [annualReturnDraft, setAnnualReturnDraft] = useState<string>(() =>
    toDraft(settings.investing.annualReturnPct),
  );
  const [inflationDraft, setInflationDraft] = useState<string>(() =>
    toDraft(settings.investing.inflationPct),
  );
  const [feeDragDraft, setFeeDragDraft] = useState<string>(() =>
    toDraft(settings.investing.feeDragPct),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft: PageDraftV3 = {
      version: 3,
      newItemCurrency,
      items,
      benefitMode,
      monthlyBenefitDraft,
    };
    try {
      window.localStorage.setItem(
        PAGE_DRAFT_STORAGE_KEY,
        JSON.stringify(draft),
      );
    } catch {
      // ignore
    }
  }, [benefitMode, monthlyBenefitDraft, items, newItemCurrency]);

  useEffect(() => {
    saveMoneyPerspectiveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const normalized = normalizeCurrencyDraft(newItemCurrency);
    setSettings((s) => ({ ...s, currency: normalized }));
  }, [newItemCurrency]);

  const effectiveHourlyRate = useMemo(() => {
    return effectiveHourlyFromSalarySettings(settings.compensation);
  }, [settings.compensation]);

  const dailyCoreExpense = useMemo(() => {
    return dailyCoreExpenseFromSettings(settings.coreExpenses);
  }, [settings.coreExpenses]);

  const netAnnualReturnPct = useMemo(() => {
    return applySimpleFeeDragToAnnualReturn(
      settings.investing.annualReturnPct,
      settings.investing.feeDragPct,
    );
  }, [settings.investing.annualReturnPct, settings.investing.feeDragPct]);

  const workTimeProjectionTable = useMemo(() => {
    const hourly0 = effectiveHourlyRate;
    if (hourly0 == null) return null;
    if (!(hourly0 > 0)) return null;

    const inflationPct = Number(settings.investing.inflationPct ?? 0);
    const payRaisePct = Number(settings.compensation.payRaisePct ?? 0);
    const annualReturnPct = Number(settings.investing.annualReturnPct ?? 0);
    const feeDragPct = Number(settings.investing.feeDragPct ?? 0);

    const inflationRate =
      Number.isFinite(inflationPct) && inflationPct >= 0
        ? inflationPct / 100
        : 0;
    const payRaiseRate = Number.isFinite(payRaisePct) ? payRaisePct / 100 : 0;

    const baseMonthly = recurringYearlyExpenseTotal / 12;
    const baseYearly = recurringYearlyExpenseTotal;
    const stepInflationYearly = 1 + inflationRate;

    const expenseMoneyInYearN = (yearN: number): number => {
      if (!(yearN > 0)) return 0;

      const recurringInYearN =
        baseYearly > 0
          ? stepInflationYearly === 1
            ? baseYearly
            : baseYearly * Math.pow(stepInflationYearly, Math.max(0, yearN - 1))
          : 0;

      // One-time expenses apply only in Year 1.
      const oneTimeInYearN = yearN === 1 ? oneTimeExpenseTotal : 0;
      return oneTimeInYearN + recurringInYearN;
    };

    const projectionYears = [...HORIZON_TABLE_YEARS, ...EXTRA_DETAIL_YEARS]
      .filter((x, idx, arr) => arr.indexOf(x) === idx)
      .filter((x) => Number.isFinite(x) && x > 0)
      .sort((a, b) => a - b);

    const maxYear = projectionYears.length
      ? projectionYears[projectionYears.length - 1]!
      : 0;

    const investedRows = computeCashflowFvRows({
      yearsList: Array.from({ length: maxYear }, (_, i) => i + 1),
      upfront: oneTimeExpenseTotal,
      recurringMonthlyBase: baseMonthly,
      annualReturnPct: annualReturnPct,
      feeDragPct: feeDragPct,
      inflationPct: inflationPct,
    });
    const investedByYear = new Map<
      number,
      { totalNominal: number | null; totalReal: number | null }
    >(
      investedRows.map((r) => [
        r.years,
        { totalNominal: r.totalNominal, totalReal: r.totalReal },
      ]),
    );

    const hourlyRateInYearN = (yearN: number): number => {
      const factor = Math.pow(1 + payRaiseRate, Math.max(0, yearN - 1));
      return hourly0 * factor;
    };

    const expenseMoneyInYearNLocal = (yearN: number): number =>
      expenseMoneyInYearN(yearN);

    let workTotalHours = 0;
    let emitIdx = 0;
    const rows: Array<{
      years: number;
      workThisYearHours: number;
      workTotalHours: number;
      investedThisYearHours: number;
      investedTotalHours: number;
      investedTotalMoneyNominal: number;
      investedTotalMoneyReal: number;
      investedContributedMoneyReal: number;
    }> = [];

    for (let year = 1; year <= maxYear; year += 1) {
      const wageHourly = hourlyRateInYearN(year);
      if (!Number.isFinite(wageHourly) || !(wageHourly > 0)) return null;

      const expenseMoney = expenseMoneyInYearNLocal(year);
      const workThisYearHours =
        expenseMoney > 0 ? (workHours(expenseMoney, wageHourly) ?? 0) : 0;
      workTotalHours += workThisYearHours;

      const portfolioEndThisYear = investedByYear.get(year)?.totalNominal;
      const portfolioEndPrevYear =
        year > 1
          ? investedByYear.get(year - 1)?.totalNominal
          : 0;
      if (portfolioEndThisYear == null || portfolioEndPrevYear == null)
        return null;
      const deltaThisYearMoney = portfolioEndThisYear - portfolioEndPrevYear;
      const investedThisYearHours =
        deltaThisYearMoney > 0
          ? (workHours(deltaThisYearMoney, wageHourly) ?? 0)
          : 0;
      const investedTotalHours =
        portfolioEndThisYear > 0
          ? (workHours(portfolioEndThisYear, wageHourly) ?? 0)
          : 0;

      const investedTotalMoneyNominal = portfolioEndThisYear;
      const investedTotalMoneyReal = investedByYear.get(year)?.totalReal;
      const investedContributedMoneyReal =
        (oneTimeExpenseTotal > 0 ? oneTimeExpenseTotal : 0) +
        (baseMonthly > 0 ? baseMonthly * 12 * year : 0);
      if (investedTotalMoneyReal == null) return null;

      if (projectionYears[emitIdx] === year) {
        rows.push({
          years: year,
          workThisYearHours,
          workTotalHours,
          investedThisYearHours,
          investedTotalHours,
          investedTotalMoneyNominal,
          investedTotalMoneyReal,
          investedContributedMoneyReal,
        });
        emitIdx += 1;
      }
    }

    return rows;
  }, [
    effectiveHourlyRate,
    oneTimeExpenseTotal,
    recurringYearlyExpenseTotal,
    settings.compensation.payRaisePct,
    settings.investing.annualReturnPct,
    settings.investing.feeDragPct,
    settings.investing.inflationPct,
  ]);

  const horizonTable = useMemo(() => {
    const daily = dailyCoreExpense;

    const projectionYears = [...HORIZON_TABLE_YEARS, ...EXTRA_DETAIL_YEARS]
      .filter((x, idx, arr) => arr.indexOf(x) === idx)
      .filter((x) => Number.isFinite(x) && x > 0)
      .sort((a, b) => a - b);

    const futureRows = projectionYears.map((years) => {
      const fvNominal = futureValueNominalTotalForItems(
        itemsWithAmount,
        settings.investing.annualReturnPct,
        years,
        settings.investing.feeDragPct,
      );
      if (fvNominal == null)
        return { years, fvNominal: null, fvReal: null, runwayDays: null };
      const fvReal =
        fvNominal != null &&
        Number.isFinite(settings.investing.inflationPct) &&
        settings.investing.inflationPct >= 0
          ? futureValueReal(fvNominal, settings.investing.inflationPct, years)
          : null;
      const runwayDays =
        daily && fvReal != null
          ? equivalentCoreExpenseDaysInYearN(fvReal, daily)
          : null;
      return { years, fvNominal, fvReal, runwayDays };
    });

    return futureRows;
  }, [
    dailyCoreExpense,
    itemsWithAmount,
    settings.investing.annualReturnPct,
    settings.investing.feeDragPct,
    settings.investing.inflationPct,
  ]);

  const monthlyBenefitMoney = useMemo(() => {
    const raw = draftToNumberOrZero(monthlyBenefitDraft);
    if (!(raw > 0)) return null;
    if (benefitMode === "money") return raw;
    if (effectiveHourlyRate == null) return null;
    return monthlyBenefitMoneyFromHours(raw, effectiveHourlyRate);
  }, [benefitMode, effectiveHourlyRate, monthlyBenefitDraft]);

  const breakEven = useMemo(() => {
    if (year0Cost < 0) return null;
    if (monthlyBenefitMoney == null) return null;

    // If the expense list is effectively empty (0 cost), break-even is immediate.
    if (year0Cost === 0) return 0;
    const upfront = itemsWithAmount
      .filter((it) => it.type === "oneTime")
      .reduce((sum, it) => sum + it.amount, 0);
    const recurringMonthly = itemsWithAmount
      .filter((it) => it.type !== "oneTime")
      .reduce(
        (sum, it) => sum + purchaseMonthlyEquivalent(it.amount, it.type),
        0,
      );
    const costForBreakEven = upfront + recurringMonthly;
    return breakEvenMonths(costForBreakEven, monthlyBenefitMoney);
  }, [itemsWithAmount, monthlyBenefitMoney, year0Cost]);

  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [breakEvenOpen, setBreakEvenOpen] = useState(false);
  const [workTimeProjectionOpen, setWorkTimeProjectionOpen] = useState(false);
  const [futureValueProjectionOpen, setFutureValueProjectionOpen] =
    useState(false);
  const [futureRunwayProjectionOpen, setFutureRunwayProjectionOpen] =
    useState(false);

  const [useWorkDaysInYmd, setUseWorkDaysInYmd] = useState(false);
  const [showNominalFv, setShowNominalFv] = useState(false);

  const [valuePerspectiveBreakdownOpen, setValuePerspectiveBreakdownOpen] =
    useState(false);
  const [workPerspectiveBreakdownOpen, setWorkPerspectiveBreakdownOpen] =
    useState(false);
  const [runwayPerspectiveBreakdownOpen, setRunwayPerspectiveBreakdownOpen] =
    useState(false);

  const valuePerspectiveBreakdown = useMemo(() => {
    const oneTime = itemsWithAmount
      .filter((it) => it.type === "oneTime")
      .map((it) => ({
        name: it.name,
        value: it.amount,
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => a.value - b.value);

    const perYear = itemsWithAmount
      .filter((it) => it.type !== "oneTime")
      .map((it) => {
        const baseYearly = purchaseYearlyEquivalent(it.amount, it.type);
        return {
          name: it.name,
          value: baseYearly,
        };
      })
      .filter((x) => x.value > 0)
      .sort((a, b) => a.value - b.value);

    return { oneTime, perYear };
  }, [itemsWithAmount]);

  const workPerspectiveBreakdown = useMemo(() => {
    const hourly = effectiveHourlyRate;
    if (hourly == null || !(hourly > 0)) return null;

    const oneTime = itemsWithAmount
      .filter((it) => it.type === "oneTime")
      .map((it) => ({
        name: it.name,
        hours: workHours(it.amount, hourly) ?? 0,
      }))
      .filter((x) => x.hours > 0)
      .sort((a, b) => a.hours - b.hours);

    const perYear = itemsWithAmount
      .filter((it) => it.type !== "oneTime")
      .map((it) => {
        const baseYearly = purchaseYearlyEquivalent(it.amount, it.type);
        return {
          name: it.name,
          hours: workHours(baseYearly, hourly) ?? 0,
        };
      })
      .filter((x) => x.hours > 0)
      .sort((a, b) => a.hours - b.hours);

    return { oneTime, perYear };
  }, [effectiveHourlyRate, itemsWithAmount]);

  const runwayPerspectiveBreakdown = useMemo(() => {
    const daily = dailyCoreExpense;
    if (daily == null || !(daily > 0)) return null;

    const oneTime = itemsWithAmount
      .filter((it) => it.type === "oneTime")
      .map((it) => ({
        name: it.name,
        days: it.amount / daily,
      }))
      .filter((x) => x.days > 0)
      .sort((a, b) => a.days - b.days);

    const perYear = itemsWithAmount
      .filter((it) => it.type !== "oneTime")
      .map((it) => {
        const baseYearly = purchaseYearlyEquivalent(it.amount, it.type);
        return {
          name: it.name,
          days: baseYearly / daily,
        };
      })
      .filter((x) => x.days > 0)
      .sort((a, b) => a.days - b.days);

    return { oneTime, perYear };
  }, [dailyCoreExpense, itemsWithAmount]);

  const [workProjectionBreakdownColumn, setWorkProjectionBreakdownColumn] =
    useState<WorkProjectionBreakdownColumn>("workThisYear");
  const [
    futureValueProjectionBreakdownColumn,
    setFutureValueProjectionBreakdownColumn,
  ] = useState<FutureValueProjectionBreakdownColumn>("valueThisYear");
  const [
    futureRunwayProjectionBreakdownColumn,
    setFutureRunwayProjectionBreakdownColumn,
  ] = useState<FutureRunwayProjectionBreakdownColumn>("runwayThisYear");

  const futureValueThisYearRows = useMemo(() => {
    const daily = dailyCoreExpense;

    const inflationPctLocal = Number(settings.investing.inflationPct ?? 0);
    const inflationOk =
      Number.isFinite(inflationPctLocal) && inflationPctLocal >= 0;
    const inflationRate = inflationOk ? inflationPctLocal / 100 : 0;
    const stepInflationYearly = 1 + inflationRate;
    const dailyCoreExpenseInYearN = (yearN: number): number | null => {
      if (daily == null) return null;
      if (!(yearN > 0)) return daily;
      if (!inflationOk || stepInflationYearly === 1) return daily;
      return daily * Math.pow(stepInflationYearly, Math.max(0, yearN - 1));
    };

    const upfront = itemsWithAmount
      .filter((it) => it.type === "oneTime")
      .reduce((sum, it) => sum + it.amount, 0);

    const recurringMonthlyBase = itemsWithAmount
      .filter((it) => it.type !== "oneTime")
      .reduce(
        (sum, it) => sum + purchaseMonthlyEquivalent(it.amount, it.type),
        0,
      );

    const rows = computeCashflowFvRows({
      yearsList: horizonTable.map((r) => r.years),
      upfront,
      recurringMonthlyBase,
      annualReturnPct: settings.investing.annualReturnPct,
      feeDragPct: settings.investing.feeDragPct,
      inflationPct: settings.investing.inflationPct,
    });

    return rows.map((r) => {
      // Runway values are a ratio; when both money and core expenses are inflation-adjusted,
      // nominal vs real yields the same runway. For consistency, compute runway in "Year N" terms.
      const dailyInYear = dailyCoreExpenseInYearN(r.years);
      const investedCore = dailyInYear;
      const investedThisYearMoney = r.nominalThisYear;
      const investedTotalMoney = r.totalNominal;

      const totalRunwayDays =
        investedCore != null && investedTotalMoney != null
          ? equivalentCoreExpenseDaysInYearN(investedTotalMoney, investedCore)
          : null;
      const runwayThisYearDays =
        investedCore != null && investedThisYearMoney != null
          ? equivalentCoreExpenseDaysInYearN(
              investedThisYearMoney,
              investedCore,
            )
          : null;

      return {
        years: r.years,
        valueThisYearNominal: r.valueThisYearNominal,
        valueTotalNominal: r.valueTotalNominal,
        valueThisYearReal: r.valueThisYearReal,
        valueTotalReal: r.valueTotalReal,
        nominalThisYear: r.nominalThisYear,
        totalNominal: r.totalNominal,
        realThisYear: r.realThisYear,
        totalReal: r.totalReal,
        runwayThisYearDays,
        totalRunwayDays,
      };
    });
  }, [
    dailyCoreExpense,
    horizonTable,
    itemsWithAmount,
    settings.investing.annualReturnPct,
    settings.investing.feeDragPct,
    settings.investing.inflationPct,
  ]);

  const futureRunwayProjectionRows = useMemo(() => {
    const daily = dailyCoreExpense;

    const inflationPctLocal = Number(settings.investing.inflationPct ?? 0);
    const inflationOk =
      Number.isFinite(inflationPctLocal) && inflationPctLocal >= 0;
    const inflationRate = inflationOk ? inflationPctLocal / 100 : 0;
    const stepInflationYearly = 1 + inflationRate;
    const dailyCoreExpenseInYearN = (yearN: number): number | null => {
      if (daily == null) return null;
      if (!(yearN > 0)) return daily;
      if (!inflationOk || stepInflationYearly === 1) return daily;
      return daily * Math.pow(stepInflationYearly, Math.max(0, yearN - 1));
    };

    return futureValueThisYearRows.map((r) => {
      const dailyInYear = dailyCoreExpenseInYearN(r.years);
      const core = dailyInYear;
      const valueThisYear = r.valueThisYearNominal;
      const valueTotal = r.valueTotalNominal;
      const runwayThisYearDays =
        core != null
          ? equivalentCoreExpenseDaysInYearN(valueThisYear, core)
          : null;
      const runwayTotalDays =
        core != null
          ? equivalentCoreExpenseDaysInYearN(valueTotal, core)
          : null;
      return {
        years: r.years,
        runwayThisYearDays,
        runwayTotalDays,
        investedRunwayThisYearDays: r.runwayThisYearDays,
        investedRunwayTotalDays: r.totalRunwayDays,
      };
    });
  }, [
    dailyCoreExpense,
    futureValueThisYearRows,
    settings.investing.inflationPct,
  ]);

  const workTimeProjectionYear1 = useMemo(() => {
    return workTimeProjectionTable?.find((r) => r.years === 1) ?? null;
  }, [workTimeProjectionTable]);

  const workTimeProjectionYear20 = useMemo(() => {
    return workTimeProjectionTable?.find((r) => r.years === 20) ?? null;
  }, [workTimeProjectionTable]);

  const workTotalSummary20 = useMemo(() => {
    const row = workTimeProjectionYear20;
    if (!row) return null;
    const workEquivalentPct =
      row.workTotalHours > 0
        ? (100 * row.investedTotalHours) / row.workTotalHours
        : null;
    const roiReal =
      row.investedContributedMoneyReal > 0
        ? 100 *
          (row.investedTotalMoneyReal / row.investedContributedMoneyReal - 1)
        : null;
    return { workEquivalentPct, roiReal };
  }, [workTimeProjectionYear20]);

  const workThisYear1PctOfWorkYear = useMemo(() => {
    const hoursThisYear = workTimeProjectionYear1?.workThisYearHours;
    if (hoursThisYear == null) return null;

    const workYearHours = useWorkDaysInYmd ? 1920 : 2920;
    if (!(workYearHours > 0)) return null;
    return (100 * hoursThisYear) / workYearHours;
  }, [useWorkDaysInYmd, workTimeProjectionYear1]);

  const workTimeProjectionYear2 = useMemo(() => {
    return workTimeProjectionTable?.find((r) => r.years === 2) ?? null;
  }, [workTimeProjectionTable]);

  const futureValueProjectionYear1 = useMemo(() => {
    return futureValueThisYearRows.find((r) => r.years === 1) ?? null;
  }, [futureValueThisYearRows]);

  const futureValueProjectionYear20 = useMemo(() => {
    return futureValueThisYearRows.find((r) => r.years === 20) ?? null;
  }, [futureValueThisYearRows]);

  const futureValueProjectionYear2 = useMemo(() => {
    return futureValueThisYearRows.find((r) => r.years === 2) ?? null;
  }, [futureValueThisYearRows]);

  const futureRunwayProjectionYear1 = useMemo(() => {
    return futureRunwayProjectionRows.find((r) => r.years === 1) ?? null;
  }, [futureRunwayProjectionRows]);

  const futureRunwayProjectionYear20 = useMemo(() => {
    return futureRunwayProjectionRows.find((r) => r.years === 20) ?? null;
  }, [futureRunwayProjectionRows]);

  const [savedListsOpen, setSavedListsOpen] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedExpenseList[]>(() =>
    listSavedExpenseLists(),
  );
  const [selectedSavedListId, setSelectedSavedListId] = useState<string>("");
  const [compareSavedListId, setCompareSavedListId] = useState<string>("");
  const [showComparePlaceholder, setShowComparePlaceholder] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [didCopyShareUrl, setDidCopyShareUrl] = useState(false);

  const refreshSavedLists = useCallback(() => {
    setSavedLists(listSavedExpenseLists());
  }, []);

  const buildShareUrlForItems = useCallback(
    (currency: string, listItems: PurchaseItem[]): string | null => {
      if (typeof window === "undefined") return null;

      const payload = {
        v: 1 as const,
        currency,
        items: listItems.map((it) => ({
          name: it.name,
          type: it.type,
          amount: it.amount,
        })),
      };

      const encoded = encodeExpenseListToShareParam(payload);
      const url = new URL(window.location.href);
      url.searchParams.set("expenseList", encoded);
      url.searchParams.delete("amount");
      url.searchParams.delete("currency");
      url.searchParams.delete("type");
      return url.toString();
    },
    [],
  );

  const copyShareUrl = useCallback(async (url: string) => {
    const writeText = navigator.clipboard?.writeText;
    if (writeText) {
      await writeText.call(navigator.clipboard, url);
      setDidCopyShareUrl(true);
      window.setTimeout(() => setDidCopyShareUrl(false), 1500);
      return;
    }
    window.prompt("Copy share link:", url);
  }, []);

  const closeSavedListsModal = useCallback(() => {
    setSavedListsOpen(false);
    setShareUrl(null);
    setShowComparePlaceholder(false);
  }, []);

  return (
    <PageLayout variant="constrained" maxWidthPx={600}>
      <h1 style={{ textAlign: "center" }}>
        Money Perspectivator
      </h1>

      <div style={{ display: "grid", gap: 14 }}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 22 }}>Expense list</div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{ ...subtleTextStyle, fontSize: 13, fontWeight: 800 }}
              >
                Currency
              </div>
              <div
                style={{
                  ...inputGroupStyle,
                  height: 34,
                  fontSize: 14,
                  width: 80,
                }}
              >
                <input
                  value={normalizeCurrencyDraft(displayCurrency)}
                  onChange={(e) => setCurrencyForAllItems(e.target.value)}
                  placeholder="DKK"
                  style={{ ...inputGroupInputStyle, fontSize: 14 }}
                  aria-label="Currency (ISO 4217)"
                />
              </div>
              <button
                type="button"
                aria-label="Saved lists"
                title="Saved lists"
                style={{
                  ...btn(),
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onClick={() => {
                  refreshSavedLists();
                  setSavedListsOpen(true);
                }}
              >
                <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                  📁
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>
                  Saved lists
                </span>
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px minmax(0, 1fr) 120px",
              gap: 10,
              alignItems: "center",
              marginTop: 10,
              minWidth: 0,
            }}
          >
            <div style={{ ...subtleTextStyle, fontSize: 13, fontWeight: 800 }}>
              Net salary
            </div>
            <div
              style={{
                ...inputGroupStyle,
                height: 34,
                fontSize: 14,
                width: "100%",
                minWidth: 0,
              }}
            >
              <input
                value={netSalaryDraft}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!isValidDecimalDraft(v)) return;
                  setNetSalaryDraft(v);
                  const n = roundTo1Decimal(draftToNumberOrZero(v));
                  setSettings((s) => ({
                    ...s,
                    compensation: { ...s.compensation, amount: n },
                  }));
                }}
                inputMode="decimal"
                style={{ ...inputGroupInputStyle, fontSize: 14 }}
                aria-label="Net salary amount (top)"
              />
              <span
                aria-hidden
                style={{ ...inputGroupUnitStyle, fontSize: 14 }}
              >
                {displayCurrency}
              </span>
            </div>

            <select
              value={settings.compensation.period}
              onChange={(e) => {
                const next = e.target.value as MoneyPerspectiveSalaryPeriod;
                const current = settings.compensation;
                if (next === current.period) return;
                const effectiveHourly = effectiveHourlyFromSalarySettings(current);
                if (effectiveHourly == null) {
                  const nextComp = { ...current, period: next };
                  setSettings((s) => ({ ...s, compensation: nextComp }));
                  return;
                }

                const hours =
                  current.workingHoursPerMonth > 0
                    ? current.workingHoursPerMonth
                    : 160;
                const amount = roundTo1Decimal(
                  salaryAmountFromEffectiveHourly(effectiveHourly, hours, next),
                );
                const nextComp = {
                  ...current,
                  workingHoursPerMonth: hours,
                  period: next,
                  amount,
                };
                setSettings((s) => ({ ...s, compensation: nextComp }));
                setNetSalaryDraft(toDraft(amount));
              }}
              style={{
                ...controlStyle,
                width: "100%",
                minWidth: 0,
                height: 34,
                fontSize: 14,
              }}
              aria-label="Net salary period (top)"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  fontSize: 14,
                }}
              >
                <colgroup>
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "44px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderBottom: "1px solid var(--fc-subtle-border)",
                        background: "var(--fc-subtle-bg)",
                      }}
                    >
                      Description
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderBottom: "1px solid var(--fc-subtle-border)",
                        background: "var(--fc-subtle-bg)",
                      }}
                    >
                      Type
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderBottom: "1px solid var(--fc-subtle-border)",
                        background: "var(--fc-subtle-bg)",
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        width: 44,
                        padding: "6px 8px",
                        borderBottom: "1px solid var(--fc-subtle-border)",
                        background: "var(--fc-subtle-bg)",
                      }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td
                        style={{
                          padding: "6px 3px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      >
                        <input
                          value={it.name ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setItems((current) =>
                              current.map((x) =>
                                x.id !== it.id
                                  ? x
                                  : {
                                      ...x,
                                      name: v.trim() ? v : undefined,
                                    },
                              ),
                            );
                          }}
                          placeholder="Expense description"
                          style={{
                            ...controlStyle,
                            height: 34,
                            fontSize: 14,
                            width: "100%",
                            minWidth: 0,
                            maxWidth: "100%",
                          }}
                          aria-label={`Description for item ${it.id}`}
                        />
                      </td>
                      <td
                        style={{
                          padding: "6px 3px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      >
                        <select
                          value={it.type}
                          onChange={(e) => {
                            const next = e.target.value as PurchaseAmountType;
                            setItems((current) =>
                              current.map((x) =>
                                x.id !== it.id ? x : { ...x, type: next },
                              ),
                            );
                          }}
                          style={{
                            ...controlStyle,
                            height: 34,
                            fontSize: 14,
                            width: "100%",
                            minWidth: 0,
                            maxWidth: "100%",
                          }}
                          aria-label={`Type for item ${it.id}`}
                        >
                          <option value="oneTime">One time</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </td>
                      <td
                        style={{
                          padding: "6px 3px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                          textAlign: "right",
                        }}
                      >
                        <div
                          style={{
                            ...inputGroupStyle,
                            height: 34,
                            fontSize: 14,
                          }}
                        >
                          <input
                            value={
                              itemAmountDrafts[it.id] ?? toDraft(it.amount)
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!isValidDecimalDraft(v)) return;
                              setItemAmountDrafts((prev) => ({
                                ...prev,
                                [it.id]: v,
                              }));
                              const n = draftToNumberOrZero(v);
                              setItems((current) =>
                                current.map((x) =>
                                  x.id !== it.id ? x : { ...x, amount: n },
                                ),
                              );
                            }}
                            inputMode="decimal"
                            style={{
                              ...inputGroupInputStyle,
                              fontSize: 14,
                              textAlign: "right",
                            }}
                            aria-label={`Amount for item ${it.id}`}
                          />
                          <span
                            aria-hidden
                            style={{
                              ...inputGroupUnitStyle,
                              fontSize: 14,
                            }}
                          >
                            {displayCurrency}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "6px 3px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                          textAlign: "center",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setItems((current) => {
                              if (current.length <= 1) {
                                const next = current.map((x) =>
                                  x.id !== it.id
                                    ? x
                                    : {
                                        ...x,
                                        name: undefined,
                                        type: "oneTime" as const,
                                        amount: 0,
                                      },
                                );
                                return next;
                              }
                              return current.filter((x) => x.id !== it.id);
                            });
                            setItemAmountDrafts((prev) => ({
                              ...prev,
                              [it.id]: "0",
                            }));
                          }}
                          style={{
                            ...btn(),
                            height: 34,
                            width: 34,
                            padding: 0,
                            margin: 0,
                            borderRadius: 8,
                            fontSize: 20,
                          }}
                          aria-label={`Remove item ${it.id}`}
                          title="Remove"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              style={{ ...btn(), justifySelf: "start" }}
              onClick={addItem}
            >
              Add Expense
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Perspectives</div>
          <div
            style={{
              opacity: 0.75,
              margin: "2px 0",
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            What will you do with the best hours and the best days of the rest
            of your life?
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <div
              style={{ ...perspectivesCardStyle, cursor: "pointer" }}
              role="button"
              tabIndex={0}
              aria-expanded={valuePerspectiveBreakdownOpen}
              onClick={() => setValuePerspectiveBreakdownOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setValuePerspectiveBreakdownOpen((v) => !v);
                }
              }}
            >
              <div style={perspectivesHeaderRowStyle}>
                <div style={perspectivesTitleStyle}>Expenses</div>
                <div style={perspectivesBigValueStyle}>
                  {formatCurrencyNoDecimals(
                    valueThisYearExpenseTotal,
                    displayCurrency,
                  )}
                </div>
              </div>

              {valuePerspectiveBreakdownOpen ? (
                <div
                  style={{
                    border: "1px solid var(--fc-subtle-border)",
                    borderRadius: 6,
                    padding: 10,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {valuePerspectiveBreakdown.oneTime.length > 0 ? (
                    <>
                      <div style={{ ...subtleTextStyle, fontSize: 12 }}>
                        One time
                      </div>
                      {valuePerspectiveBreakdown.oneTime.map((it) => (
                        <div
                          key={`oneTime-${it.name}`}
                          style={{ ...perspectivesLineRowStyle, opacity: 0.9 }}
                        >
                          <div>{it.name}</div>
                          <div>
                            {formatCurrencyNoDecimals(
                              it.value,
                              displayCurrency,
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : null}

                  {valuePerspectiveBreakdown.perYear.length > 0 ? (
                    <>
                      <div style={{ ...subtleTextStyle, fontSize: 12 }}>
                        Per year
                      </div>
                      {valuePerspectiveBreakdown.perYear.map((it) => (
                        <div
                          key={`perYear-${it.name}`}
                          style={{ ...perspectivesLineRowStyle, opacity: 0.9 }}
                        >
                          <div>{it.name}</div>
                          <div>
                            {formatCurrencyNoDecimals(
                              it.value,
                              displayCurrency,
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ ...perspectivesLineRowStyle, opacity: 0.9 }}>
                  <div>Expenses (20 years)</div>
                  <div
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {futureValueProjectionYear20?.valueTotalReal != null
                      ? formatCurrencyNoDecimals(
                          futureValueProjectionYear20.valueTotalReal,
                          displayCurrency,
                        )
                      : "—"}
                  </div>
                </div>

                <div style={{ ...perspectivesLineRowStyle, opacity: 0.9 }}>
                  <div>If invested (20 years)</div>
                  <div
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(() => {
                      const v = showNominalFv
                        ? futureValueProjectionYear20?.totalNominal
                        : futureValueProjectionYear20?.totalReal;
                      return v != null
                        ? formatCurrencyNoDecimals(v, displayCurrency)
                        : "—";
                    })()}
                  </div>
                </div>

                <div
                  style={{
                    ...perspectivesLineRowStyle,
                    opacity: 0.75,
                    fontSize: 12,
                  }}
                >
                  <div>If invested multiple</div>
                  <div
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(() => {
                      const invested = showNominalFv
                        ? futureValueProjectionYear20?.totalNominal
                        : futureValueProjectionYear20?.totalReal;
                      const valueTotal =
                        futureValueProjectionYear20?.valueTotalReal;
                      if (
                        invested == null ||
                        valueTotal == null ||
                        !(valueTotal > 0)
                      ) {
                        return "—";
                      }
                      return `${formatNumber(invested / valueTotal, 2)}×`;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{ ...perspectivesCardStyle, cursor: "pointer" }}
              role="button"
              tabIndex={0}
              aria-expanded={workPerspectiveBreakdownOpen}
              onClick={() => setWorkPerspectiveBreakdownOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setWorkPerspectiveBreakdownOpen((v) => !v);
                }
              }}
            >
              <div style={perspectivesHeaderRowStyle}>
                <div style={perspectivesTitleStyle}>Work</div>
                {effectiveHourlyRate == null ? (
                  <div
                    style={{ ...perspectivesBigValueStyle, ...subtleTextStyle }}
                  >
                    Missing
                  </div>
                ) : (
                  <div style={perspectivesBigValueStyle}>
                    {formatHoursAsYmd(
                      workTimeProjectionYear1?.workThisYearHours ?? 0,
                      1,
                      useWorkDaysInYmd,
                    )}
                  </div>
                )}
              </div>

              {workPerspectiveBreakdownOpen ? (
                <div
                  style={{
                    border: "1px solid var(--fc-subtle-border)",
                    borderRadius: 6,
                    padding: 10,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {workPerspectiveBreakdown == null ? (
                    <div style={{ ...subtleTextStyle, fontSize: 12 }}>
                      Set net salary to compute work breakdown.
                    </div>
                  ) : (
                    <>
                      {workPerspectiveBreakdown.oneTime.length > 0 ? (
                        <>
                          <div style={{ ...subtleTextStyle, fontSize: 12 }}>
                            One time
                          </div>
                          {workPerspectiveBreakdown.oneTime.map((it) => (
                            <div
                              key={`oneTime-${it.name}`}
                              style={{
                                ...perspectivesLineRowStyle,
                                opacity: 0.9,
                              }}
                            >
                              <div>{it.name}</div>
                              <div>
                                {formatHoursAsYmd(
                                  it.hours,
                                  1,
                                  useWorkDaysInYmd,
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : null}

                      {workPerspectiveBreakdown.perYear.length > 0 ? (
                        <>
                          <div style={{ ...subtleTextStyle, fontSize: 12 }}>
                            Per year
                          </div>
                          {workPerspectiveBreakdown.perYear.map((it) => (
                            <div
                              key={`perYear-${it.name}`}
                              style={{
                                ...perspectivesLineRowStyle,
                                opacity: 0.9,
                              }}
                            >
                              <div>{it.name}</div>
                              <div>
                                {formatHoursAsYmd(
                                  it.hours,
                                  1,
                                  useWorkDaysInYmd,
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {effectiveHourlyRate == null ? (
                <div style={subtleTextStyle}>
                  Set net salary to compute work.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      ...subtleTextStyle,
                      fontSize: 12,
                      textAlign: "right",
                    }}
                  >
                    {workThisYear1PctOfWorkYear == null
                      ? "—"
                      : `${formatNumber(workThisYear1PctOfWorkYear, 0)}% of work year`}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ ...perspectivesLineRowStyle, opacity: 0.9 }}>
                      <div>Work (20 years)</div>
                      <div
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {workTimeProjectionYear20
                          ? formatHoursAsYmd(
                              workTimeProjectionYear20.workTotalHours,
                              1,
                              useWorkDaysInYmd,
                            )
                          : "—"}
                      </div>
                    </div>

                    <div style={{ ...perspectivesLineRowStyle, opacity: 0.9 }}>
                      <div>If invested (20 years)</div>
                      <div
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {workTimeProjectionYear20
                          ? formatHoursAsYmd(
                              workTimeProjectionYear20.investedTotalHours,
                              1,
                              useWorkDaysInYmd,
                            )
                          : "—"}
                      </div>
                    </div>

                    <div
                      style={{
                        ...perspectivesLineRowStyle,
                        opacity: 0.75,
                        fontSize: 12,
                      }}
                    >
                      <div>Work-equivalent %</div>
                      <div>
                        {workTotalSummary20?.workEquivalentPct == null
                          ? "—"
                          : `${formatNumber(workTotalSummary20.workEquivalentPct, 1)}% of Work (20 years)`}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div
              style={{ ...perspectivesCardStyle, cursor: "pointer" }}
              role="button"
              tabIndex={0}
              aria-expanded={runwayPerspectiveBreakdownOpen}
              onClick={() => setRunwayPerspectiveBreakdownOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setRunwayPerspectiveBreakdownOpen((v) => !v);
                }
              }}
            >
              <div style={perspectivesHeaderRowStyle}>
                <div style={perspectivesTitleStyle}>Runway</div>
                {dailyCoreExpense == null ? (
                  <div
                    style={{ ...perspectivesBigValueStyle, ...subtleTextStyle }}
                  >
                    Missing
                  </div>
                ) : (
                  <div style={perspectivesBigValueStyle}>
                    {futureRunwayProjectionYear1?.runwayThisYearDays != null
                      ? formatRunwayDmy(
                          futureRunwayProjectionYear1.runwayThisYearDays,
                          1,
                        )
                      : "—"}
                  </div>
                )}
              </div>

              {runwayPerspectiveBreakdownOpen ? (
                <div
                  style={{
                    border: "1px solid var(--fc-subtle-border)",
                    borderRadius: 6,
                    padding: 10,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {runwayPerspectiveBreakdown == null ? (
                    <div style={{ ...subtleTextStyle, fontSize: 12 }}>
                      Set core expenses to compute runway breakdown.
                    </div>
                  ) : (
                    <>
                      {runwayPerspectiveBreakdown.oneTime.length > 0 ? (
                        <>
                          <div style={{ ...subtleTextStyle, fontSize: 12 }}>
                            One time
                          </div>
                          {runwayPerspectiveBreakdown.oneTime.map((it) => (
                            <div
                              key={`oneTime-${it.name}`}
                              style={{
                                ...perspectivesLineRowStyle,
                                opacity: 0.9,
                              }}
                            >
                              <div>{it.name}</div>
                              <div>{formatRunwayDmy(it.days, 1)}</div>
                            </div>
                          ))}
                        </>
                      ) : null}

                      {runwayPerspectiveBreakdown.perYear.length > 0 ? (
                        <>
                          <div style={{ ...subtleTextStyle, fontSize: 12 }}>
                            Per year
                          </div>
                          {runwayPerspectiveBreakdown.perYear.map((it) => (
                            <div
                              key={`perYear-${it.name}`}
                              style={{
                                ...perspectivesLineRowStyle,
                                opacity: 0.9,
                              }}
                            >
                              <div>{it.name}</div>
                              <div>{formatRunwayDmy(it.days, 1)}</div>
                            </div>
                          ))}
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {dailyCoreExpense == null ? (
                <div style={subtleTextStyle}>
                  Set core expenses to compute runway.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ ...perspectivesLineRowStyle, opacity: 0.9 }}>
                    <div>Runway (20 years)</div>
                    <div
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {futureRunwayProjectionYear20?.runwayTotalDays != null
                        ? formatRunwayDmy(
                            futureRunwayProjectionYear20.runwayTotalDays,
                            1,
                          )
                        : "—"}
                    </div>
                  </div>

                  <div style={{ ...perspectivesLineRowStyle, opacity: 0.9 }}>
                    <div>If invested (20 years)</div>
                    <div
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {futureRunwayProjectionYear20?.investedRunwayTotalDays !=
                      null
                        ? formatRunwayDmy(
                            futureRunwayProjectionYear20.investedRunwayTotalDays,
                            1,
                          )
                        : "—"}
                    </div>
                  </div>

                  <div
                    style={{
                      ...perspectivesLineRowStyle,
                      opacity: 0.7,
                      fontSize: 12,
                    }}
                  >
                    <div>Runway multiple</div>
                    <div>
                      {(() => {
                        const runwayDays =
                          futureRunwayProjectionYear20?.investedRunwayTotalDays;
                        if (runwayDays == null) return "—";
                        const runwayYears = runwayDays / 365;
                        const multiple = runwayYears / 20;
                        return Number.isFinite(multiple)
                          ? `${formatNumber(multiple, 2)}× 20 years`
                          : "—";
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--fc-subtle-border)",
                paddingTop: 10,
                order: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setWorkTimeProjectionOpen((v) => !v)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "inherit",
                  fontWeight: 900,
                  textAlign: "left",
                }}
                aria-expanded={workTimeProjectionOpen}
                aria-label={
                  workTimeProjectionOpen
                    ? "Collapse work projection"
                    : "Expand work projection"
                }
              >
                {workTimeProjectionOpen
                  ? "Future Work Projection ▾"
                  : "Future Work Projection ▸"}
              </button>

              {workTimeProjectionOpen ? (
                <>
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    <div
                      style={{ fontWeight: 800, fontSize: 13, opacity: 0.8 }}
                    >
                      Calendar
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        ...subtleTextStyle,
                        fontSize: 12,
                      }}
                    >
                      <input
                        type="radio"
                        name="moneyPerspectiveCalendarMode"
                        checked={!useWorkDaysInYmd}
                        onChange={() => setUseWorkDaysInYmd(false)}
                        aria-label="Use calendar year for Y/M/D"
                      />
                      <span>
                        Years/Months/Days: 1y = 12m = 365d = 2920h, 1m =
                        30.417d, 1d = 8h work.
                      </span>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        ...subtleTextStyle,
                        fontSize: 12,
                      }}
                    >
                      <input
                        type="radio"
                        name="moneyPerspectiveCalendarMode"
                        checked={useWorkDaysInYmd}
                        onChange={() => setUseWorkDaysInYmd(true)}
                        aria-label="Use work calendar for Y/M/D"
                      />
                      <span>
                        Use work calendar: 1y = 12m = 240d = 1920h, 1m = 20d, 1d
                        = 8h work.
                      </span>
                    </label>
                  </div>

                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 14,
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Year
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Work (year)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Work (total)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            If invested (year)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            If invested (total)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {workTimeProjectionTable?.map((r) => (
                          <tr key={r.years}>
                            <td
                              style={{
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {r.years}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {formatHoursAsYmd(
                                r.workThisYearHours,
                                1,
                                useWorkDaysInYmd,
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {formatHoursAsYmd(
                                r.workTotalHours,
                                1,
                                useWorkDaysInYmd,
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {formatHoursAsYmd(
                                r.investedThisYearHours,
                                1,
                                useWorkDaysInYmd,
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {formatHoursAsYmd(
                                r.investedTotalHours,
                                1,
                                useWorkDaysInYmd,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                          {effectiveHourlyRate == null ? (
                            <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                              Set net salary to show projected work.
                            </div>
                          ) : (
                            <div
                              style={{
                                ...subtleTextStyle,
                                marginTop: 6,
                                fontSize: 12,
                              }}
                            >
                              Note: “Nominal vs real” doesn’t change hours if your wage
                              is inflation-adjusted too (hours = money / wage, and both
                              scale with inflation).
                            </div>
                          )}
                  </div>

                  <details style={breakdownMainDetailsStyle}>
                    <summary style={breakdownMainSummaryStyle}>
                      Breakdown + calculation
                    </summary>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginTop: 10,
                      }}
                    >
                      <div
                        style={{ fontSize: 13, fontWeight: 800, opacity: 0.8 }}
                      >
                        Break down column:
                      </div>
                      <select
                        value={workProjectionBreakdownColumn}
                        onChange={(e) =>
                          setWorkProjectionBreakdownColumn(
                            e.target.value as WorkProjectionBreakdownColumn,
                          )
                        }
                        style={breakdownSelectStyle}
                        aria-label="Select work projection breakdown column"
                      >
                        <option value="workThisYear">Work (year)</option>
                        <option value="workTotal">Work (total)</option>
                        <option value="investedThisYear">
                          If invested (year)
                        </option>
                        <option value="investedTotal">
                          If invested (total)
                        </option>
                      </select>
                    </div>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <colgroup>
                        <col style={{ width: "38%" }} />
                        <col style={{ width: "18%" }} />
                        <col style={{ width: "44%" }} />
                      </colgroup>
                      <tbody>
                        {(() => {
                          const iPct = Number(
                            settings.investing.inflationPct ?? 0,
                          );
                          const pPct = Number(
                            settings.compensation.payRaisePct ?? 0,
                          );
                          const rPct = Number(
                            settings.investing.annualReturnPct ?? 0,
                          );
                          const fPct = Number(
                            settings.investing.feeDragPct ?? 0,
                          );
                          const i =
                            Number.isFinite(iPct) && iPct >= 0 ? iPct / 100 : 0;
                          const p = Number.isFinite(pPct) ? pPct / 100 : 0;
                          const r = Number.isFinite(rPct) ? rPct / 100 : 0;
                          const f = Number.isFinite(fPct)
                            ? Math.max(0, fPct / 100)
                            : 0;

                          // Keep the breakdown consistent with the table above:
                          // - spending (Work) inflates yearly; one-time applies only in Year 1
                          // - “If invested” deposits upfront at start, then for each month: add contribution then apply return
                          // - after 12 months: subtract annual fee, then increase next year's monthly amount by inflation
                          const baseMonthlySpend =
                            recurringYearlyExpenseTotal / 12;
                          const baseYearlySpend = baseMonthlySpend * 12;
                          const stepInflationYearly = 1 + i;
                          const spend1 =
                            (oneTimeExpenseTotal > 0
                              ? oneTimeExpenseTotal
                              : 0) + baseYearlySpend;
                          const spend2 =
                            baseYearlySpend *
                            (stepInflationYearly === 1
                              ? 1
                              : stepInflationYearly);

                          const investedRows = computeCashflowFvRows({
                            yearsList: [1, 2],
                            upfront: oneTimeExpenseTotal,
                            recurringMonthlyBase: baseMonthlySpend,
                            annualReturnPct: rPct,
                            feeDragPct: fPct,
                            inflationPct: iPct,
                          });
                          const invested1 =
                            investedRows.find((x) => x.years === 1) ?? null;
                          const invested2 =
                            investedRows.find((x) => x.years === 2) ?? null;

                          const wage1 = effectiveHourlyRate;
                          const wage2 = wage1 != null ? wage1 * (1 + p) : null;
                          const balance1 = invested1?.totalNominal ?? null;
                          const balance2 = invested2?.totalNominal ?? null;
                          const delta1 = invested1?.nominalThisYear ?? null;
                          const delta2 = invested2?.nominalThisYear ?? null;

                          const inputsRows = [
                            { label: "Inputs", value: "", note: "" },
                            {
                              label: "Year 1 spending (E1)",
                              value: formatCurrencyNoDecimals(
                                spend1,
                                displayCurrency,
                              ),
                              note: "Year 1 includes one-time + the 12 monthly recurring amounts",
                            },
                            {
                              label: "Year 1 wage (w1)",
                              value:
                                wage1 != null
                                  ? `${formatNumber(wage1, 2)} ${displayCurrency}/h`
                                  : "—",
                              note: "effective hourly wage (derived from net salary settings)",
                            },
                            {
                              label: "Inflation rate (i)",
                              value: Number.isFinite(iPct)
                                ? formatNumber(i, 4)
                                : "—",
                              note: "applied yearly to recurring spending and to the invested monthly amount",
                            },
                            {
                              label: "Pay raise rate (p)",
                              value: Number.isFinite(pPct)
                                ? formatNumber(p, 4)
                                : "—",
                              note: "used to grow wage each year",
                            },
                            {
                              label: "Gross annual return",
                              value: Number.isFinite(rPct)
                                ? formatNumber(r, 4)
                                : "—",
                              note: "applied monthly in the invested path",
                            },
                            {
                              label: "Annual fee drag",
                              value: Number.isFinite(fPct)
                                ? formatNumber(f, 4)
                                : "—",
                              note: "subtracted after 12 monthly additions",
                            },
                          ] as const;

                          const year1RowsByColumn: Record<
                            WorkProjectionBreakdownColumn,
                            readonly {
                              label: string;
                              value: string;
                              note: string;
                            }[]
                          > = {
                            workThisYear: [
                              {
                                label: "Year 1",
                                value: "",
                                note: "",
                              },
                              {
                                label: "Work (year)_1",
                                value:
                                  workTimeProjectionYear1 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear1.workThisYearHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: `Work hours in Year 1 = E1 / w1 = ${formatCurrencyNoDecimals(spend1, displayCurrency)} / ${wage1 != null ? `${formatNumber(wage1, 2)} ${displayCurrency}/h` : "—"}`,
                              },
                            ],
                            workTotal: [
                              { label: "Year 1", value: "", note: "" },
                              {
                                label: "Work (year)_1",
                                value:
                                  workTimeProjectionYear1 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear1.workThisYearHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: `Work hours in Year 1 = E1 / w1 = ${formatCurrencyNoDecimals(spend1, displayCurrency)} / ${wage1 != null ? `${formatNumber(wage1, 2)} ${displayCurrency}/h` : "—"}`,
                              },
                              {
                                label: "Work (total)_1",
                                value:
                                  workTimeProjectionYear1 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear1.workTotalHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: "Total to date = Total_0 + Work_1 (Total_0 is 0)",
                              },
                            ],
                            investedThisYear: [
                              { label: "Year 1", value: "", note: "" },
                              {
                                label: "Invested balance end of Year 1 (B1)",
                                value:
                                  balance1 != null
                                    ? formatCurrencyNoDecimals(
                                        balance1,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "Counterfactual: invest the same monthly amounts instead of spending them (each month: add then apply return; after 12 months: subtract annual fee; then inflate the monthly amount for next year)",
                              },
                              {
                                label: "Change during Year 1 (ΔB1)",
                                value:
                                  delta1 != null
                                    ? formatCurrencyNoDecimals(
                                        delta1,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "ΔB1 = B1 − B0, where B0 = 0 and the upfront (one-time) amount is deposited at the start of Year 1",
                              },
                              {
                                label: "If invested (year)_1",
                                value:
                                  workTimeProjectionYear1 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear1.investedThisYearHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: "Equivalent work hours = ΔB1 / w1",
                              },
                            ],
                            investedTotal: [
                              { label: "Year 1", value: "", note: "" },
                              {
                                label: "Invested balance end of Year 1 (B1)",
                                value:
                                  balance1 != null
                                    ? formatCurrencyNoDecimals(
                                        balance1,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "Counterfactual: invest the same monthly amounts instead of spending them (each month: add then apply return; after 12 months: subtract annual fee; then inflate the monthly amount for next year)",
                              },
                              {
                                label: "If invested (total)_1",
                                value:
                                  workTimeProjectionYear1 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear1.investedTotalHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: "Equivalent work hours = B1 / w1",
                              },
                            ],
                          };

                          const year2CommonRows: readonly {
                            label: string;
                            value: string;
                            note: string;
                          }[] = [
                            { label: "Year 2", value: "", note: "" },
                            {
                              label: "Year 2 spending (E2)",
                              value: formatCurrencyNoDecimals(
                                spend2,
                                displayCurrency,
                              ),
                              note: "total recurring spending in Year 2 (monthly amounts inflated from Year 1)",
                            },
                            {
                              label: "Year 2 wage (w2)",
                              value:
                                wage2 != null
                                  ? `${formatNumber(wage2, 2)} ${displayCurrency}/h`
                                  : "—",
                              note: `w2 = w1 × (1 + p) = ${wage1 != null ? `${formatNumber(wage1, 2)} ${displayCurrency}/h` : "—"} × (1 + ${Number.isFinite(pPct) ? formatNumber(p, 4) : "—"})`,
                            },
                          ];

                          const year2RowsByColumn: Record<
                            WorkProjectionBreakdownColumn,
                            readonly {
                              label: string;
                              value: string;
                              note: string;
                            }[]
                          > = {
                            workThisYear: [
                              ...year2CommonRows,
                              {
                                label: "Work (year)_2",
                                value:
                                  workTimeProjectionYear2 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear2.workThisYearHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: "expense_2 / wage_2",
                              },
                            ],
                            workTotal: [
                              ...year2CommonRows,
                              {
                                label: "Work (year)_2",
                                value:
                                  workTimeProjectionYear2 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear2.workThisYearHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: "expense_2 / wage_2",
                              },
                              {
                                label: "Work (total)_2",
                                value:
                                  workTimeProjectionYear2 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear2.workTotalHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: "Work (total)_1 + Work (year)_2",
                              },
                            ],
                            investedThisYear: [
                              ...year2CommonRows,
                              {
                                label: "Invested balance end of Year 1 (B1)",
                                value:
                                  balance1 != null
                                    ? formatCurrencyNoDecimals(
                                        balance1,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "from the same monthly model as above",
                              },
                              {
                                label: "Invested balance end of Year 2 (B2)",
                                value:
                                  balance2 != null
                                    ? formatCurrencyNoDecimals(
                                        balance2,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "counterfactual invested balance after 24 months",
                              },
                              {
                                label: "Change during Year 2 (ΔB2)",
                                value:
                                  delta2 != null
                                    ? formatCurrencyNoDecimals(
                                        delta2,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "ΔB2 = B2 − B1",
                              },
                              {
                                label: "If invested (year)_2",
                                value:
                                  workTimeProjectionYear2 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear2.investedThisYearHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: "Equivalent work hours = ΔB2 / w2",
                              },
                            ],
                            investedTotal: [
                              ...year2CommonRows,
                              {
                                label: "Invested balance end of Year 2 (B2)",
                                value:
                                  balance2 != null
                                    ? formatCurrencyNoDecimals(
                                        balance2,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "counterfactual invested balance after 24 months",
                              },
                              {
                                label: "If invested (total)_2",
                                value:
                                  workTimeProjectionYear2 != null
                                    ? `${formatHoursAsYmd(workTimeProjectionYear2.investedTotalHours, 1, useWorkDaysInYmd)}`
                                    : "—",
                                note: "Equivalent work hours = B2 / w2",
                              },
                            ],
                          };

                          const rows = [
                            ...inputsRows,
                            ...year1RowsByColumn[workProjectionBreakdownColumn],
                            ...year2RowsByColumn[workProjectionBreakdownColumn],
                          ] as const;

                          const milestoneLabels = new Set([
                            "Inputs",
                            "Year 1",
                            "Year 2",
                          ]);

                          return rows.map(({ label, value, note }, idx) => {
                            const isMilestone = milestoneLabels.has(label);
                            const showTopSeparator = isMilestone && idx !== 0;
                            const paddingTop = showTopSeparator ? 14 : 7;
                            return (
                              <tr key={`${label}-${idx}`}>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 0`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    fontWeight: isMilestone ? 700 : 400,
                                  }}
                                >
                                  {label}
                                </td>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 0`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontWeight: isMilestone ? 700 : 400,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {value}
                                </td>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 26px`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    opacity: 0.75,
                                  }}
                                >
                                  {note}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>

                    <details style={assumptionsDetailsStyle}>
                      <summary style={assumptionsSummaryStyle}>
                        Assumptions
                      </summary>
                      <div
                        style={{
                          marginTop: 12,
                          opacity: 0.75,
                          fontSize: 13,
                          lineHeight: 1.35,
                          display: "grid",
                          gap: 14,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Year indexing assumption
                          </div>
                          <div>
                            Year 1 is the current year. “(year)” deltas use a
                            year 0 baseline of <strong>0</strong>. One-time
                            expenses are deposited at the <strong>start of Year 1</strong>
                            (recurring items contribute monthly).
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Projection modes assumption
                          </div>
                          <div>
                            <strong>Expenses</strong> is the money-value of
                            expenses in that year (inflates with inflation).
                            <strong> Work</strong> converts those expenses into
                            time using the wage in that year (with pay raise;
                            one-time applies only in Year 1).
                            <strong> Runway</strong> converts money into runway
                            days using core expenses in that year (core expenses
                            also inflate).
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Inflation and pay raise assumption
                          </div>
                          <div>
                            Repetitive expenses inflate by <strong>i</strong>{" "}
                            each year; wage grows by <strong>p</strong> each
                            year.
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Return and contribution timing assumption
                          </div>
                          <div>
                            The “if invested” path deposits{" "}
                            <strong>upfront</strong> at the start (Year 0
                            baseline), then repeats a yearly loop: for each of
                            12 months, add the (inflated) monthly amount and
                            apply monthly return; after month 12, subtract the
                            annual fee and increase next year’s monthly amount
                            by inflation.
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Money → hours conversion assumption
                          </div>
                          <div>
                            Hours are computed as{" "}
                            <strong>money / wage in that year</strong>. The
                            Y/M/D formatting uses 8h/day; optional “work-days”
                            mode uses 20 work days/month and 240 work days/year.
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Interpretation assumption
                          </div>
                          <div>
                            “If invested” is a counterfactual based on fixed
                            rates; it can be interpreted as a median (50th
                            percentile) outcome in a simulation.
                          </div>
                        </div>
                      </div>
                    </details>
                  </details>
                </>
              ) : null}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--fc-subtle-border)",
                paddingTop: 10,
                order: 1,
              }}
            >
              <button
                type="button"
                onClick={() => setFutureValueProjectionOpen((v) => !v)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "inherit",
                  fontWeight: 900,
                  textAlign: "left",
                }}
                aria-expanded={futureValueProjectionOpen}
                aria-label={
                  futureValueProjectionOpen
                    ? "Collapse expenses projection"
                    : "Expand expenses projection"
                }
              >
                {futureValueProjectionOpen
                  ? "Future Expenses Projection ▾"
                  : "Future Expenses Projection ▸"}
              </button>

              {futureValueProjectionOpen ? (
                <>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                      ...subtleTextStyle,
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showNominalFv}
                      onChange={(e) => setShowNominalFv(e.target.checked)}
                      aria-label="Show nominal values for expenses and invested projections"
                    />
                    Show nominal (non-inflation-adjusted) instead of real
                    (inflation-adjusted)
                  </label>

                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 14,
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Year
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Expenses (year)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Expenses (total)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            If invested (year)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            If invested (total)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {futureValueThisYearRows.map((r) => (
                          <tr key={r.years}>
                            <td
                              style={{
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {r.years}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {formatCurrencyNoDecimals(
                                showNominalFv
                                  ? r.valueThisYearNominal
                                  : r.valueThisYearReal,
                                displayCurrency,
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {formatCurrencyNoDecimals(
                                showNominalFv
                                  ? r.valueTotalNominal
                                  : r.valueTotalReal,
                                displayCurrency,
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {showNominalFv
                                ? r.nominalThisYear != null
                                  ? formatCurrencyNoDecimals(
                                      r.nominalThisYear,
                                      displayCurrency,
                                    )
                                  : "—"
                                : r.realThisYear != null
                                  ? formatCurrencyNoDecimals(
                                      r.realThisYear,
                                      displayCurrency,
                                    )
                                  : "—"}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {showNominalFv
                                ? r.totalNominal != null
                                  ? formatCurrencyNoDecimals(
                                      r.totalNominal,
                                      displayCurrency,
                                    )
                                  : "—"
                                : r.totalReal != null
                                  ? formatCurrencyNoDecimals(
                                      r.totalReal,
                                      displayCurrency,
                                    )
                                  : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <details style={breakdownMainDetailsStyle}>
                    <summary style={breakdownMainSummaryStyle}>
                      Breakdown + calculation
                    </summary>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginTop: 10,
                      }}
                    >
                      <div
                        style={{ fontSize: 13, fontWeight: 800, opacity: 0.8 }}
                      >
                        Break down column:
                      </div>
                      <select
                        value={futureValueProjectionBreakdownColumn}
                        onChange={(e) =>
                          setFutureValueProjectionBreakdownColumn(
                            e.target
                              .value as FutureValueProjectionBreakdownColumn,
                          )
                        }
                        style={breakdownSelectStyle}
                        aria-label="Select value projection breakdown column"
                      >
                        <option value="valueThisYear">Expenses (year)</option>
                        <option value="valueTotal">Expenses (total)</option>
                        <option value="investedThisYear">
                          If invested (year)
                        </option>
                        <option value="investedTotal">
                          If invested (total)
                        </option>
                      </select>
                    </div>
                    <div
                      style={{
                        opacity: 0.75,
                        margin: "10px 0",
                        fontSize: 13,
                        lineHeight: 1.35,
                      }}
                    >
                      Expenses columns are the non-invested cost of the expense
                      list, shown as either nominal (money of that year) or real
                      (deflated back to Year 1 money) based on the toggle above.
                      “If invested (year)” shows the portfolio change during that
                      year (including the one-time deposit in Year 1).
                    </div>

                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <colgroup>
                        <col style={{ width: "38%" }} />
                        <col style={{ width: "18%" }} />
                        <col style={{ width: "44%" }} />
                      </colgroup>
                      <tbody>
                        {(() => {
                          const annualReturnPct = Number(
                            settings.investing.annualReturnPct ?? 0,
                          );
                          const feeDragPct = Number(
                            settings.investing.feeDragPct ?? 0,
                          );
                          const inflationPct = Number(
                            settings.investing.inflationPct ?? 0,
                          );
                          const i =
                            Number.isFinite(inflationPct) && inflationPct >= 0
                              ? inflationPct / 100
                              : 0;
                          const stepInflationYearly = 1 + i;
                          const upfront = oneTimeExpenseTotal;
                          const recurringMonthly =
                            recurringYearlyExpenseTotal / 12;
                          const recurringYearlyBase = recurringMonthly * 12;

                          const inputsRows = [
                            { label: "Inputs", value: "", note: "" },
                            {
                              label: "Upfront (U)",
                              value: formatCurrencyNoDecimals(
                                upfront,
                                displayCurrency,
                              ),
                              note: "sum of one-time expenses",
                            },
                            {
                              label: "Monthly recurring (m0)",
                              value: formatCurrencyNoDecimals(
                                recurringMonthly,
                                displayCurrency,
                              ),
                              note: `starting monthly amount (Year 1); grows with inflation over time. m0 = yearly recurring / 12 = ${formatCurrencyNoDecimals(recurringYearlyExpenseTotal, displayCurrency)} / 12`,
                            },
                            {
                              label: "Gross annual return",
                              value: Number.isFinite(annualReturnPct)
                                ? formatNumber(annualReturnPct / 100, 4)
                                : "—",
                              note: "gross return applied monthly (from settings)",
                            },
                            {
                              label: "Fee drag",
                              value: Number.isFinite(feeDragPct)
                                ? formatNumber(feeDragPct / 100, 4)
                                : "—",
                              note: "annual fee subtracted after 12 monthly additions (from settings)",
                            },
                            {
                              label: "Inflation rate (i)",
                              value: Number.isFinite(inflationPct)
                                ? formatNumber(i, 4)
                                : "—",
                              note: "applied yearly to the recurring monthly amount, and used to compute real values (in Year 1 money)",
                            },
                          ] as const;

                          const year1ValueThisYear = {
                            label: "Expenses in Year 1",
                            value: formatCurrencyNoDecimals(
                              upfront + recurringYearlyBase,
                              displayCurrency,
                            ),
                            note: "Year 1 expenses = upfront + yearly recurring (Year 1 money)",
                          };

                          const year2ValueThisYear = {
                            label: "Expenses in Year 2",
                            value: formatCurrencyNoDecimals(
                              recurringYearlyBase * stepInflationYearly,
                              displayCurrency,
                            ),
                            note: "Year 2 expenses adds only recurring, inflated once by (1 + i)",
                          };

                          const year1ValueTotal = {
                            label: "Expenses total end of Year 1",
                            value: formatCurrencyNoDecimals(
                              upfront + recurringYearlyBase,
                              displayCurrency,
                            ),
                            note: "Expenses total(Y) = upfront + Σ yearlyRecurring(year k)",
                          };

                          const year2ValueTotal = {
                            label: "Expenses total end of Year 2",
                            value: formatCurrencyNoDecimals(
                              upfront +
                                recurringYearlyBase +
                                recurringYearlyBase * stepInflationYearly,
                              displayCurrency,
                            ),
                            note: "Year 2 total adds Year 2 recurring at the inflated level",
                          };

                          const year1NominalTotal = {
                            label: "Nominal total end of Year 1 (N1)",
                            value:
                              futureValueProjectionYear1?.totalNominal != null
                                ? formatCurrencyNoDecimals(
                                    futureValueProjectionYear1.totalNominal,
                                    displayCurrency,
                                  )
                                : "—",
                            note: "Nominal portfolio at end of Year 1: upfront at start + 12 monthly additions, each followed by monthly return; then annual fee is subtracted",
                          };

                          const year2NominalTotal = {
                            label: "Nominal total end of Year 2 (N2)",
                            value:
                              futureValueProjectionYear2?.totalNominal != null
                                ? formatCurrencyNoDecimals(
                                    futureValueProjectionYear2.totalNominal,
                                    displayCurrency,
                                  )
                                : "—",
                            note: "Nominal portfolio at end of Year 2: monthly amount is inflated at the year boundary, then the same 12-month loop repeats",
                          };

                          const year1RealTotal = {
                            label: "Real total end of Year 1 (R1)",
                            value:
                              futureValueProjectionYear1?.totalReal != null
                                ? formatCurrencyNoDecimals(
                                    futureValueProjectionYear1.totalReal,
                                    displayCurrency,
                                  )
                                : "—",
                            note: `R1 = N1 / (1 + i)^1 = ${futureValueProjectionYear1?.totalNominal != null ? formatCurrencyNoDecimals(futureValueProjectionYear1.totalNominal, displayCurrency) : "—"} / (1 + ${Number.isFinite(inflationPct) ? formatNumber(i, 4) : "—"})^1`,
                          };

                          const year2RealTotal = {
                            label: "Real total end of Year 2 (R2)",
                            value:
                              futureValueProjectionYear2?.totalReal != null
                                ? formatCurrencyNoDecimals(
                                    futureValueProjectionYear2.totalReal,
                                    displayCurrency,
                                  )
                                : "—",
                            note: `R2 = N2 / (1 + i)^2 = ${futureValueProjectionYear2?.totalNominal != null ? formatCurrencyNoDecimals(futureValueProjectionYear2.totalNominal, displayCurrency) : "—"} / (1 + ${Number.isFinite(inflationPct) ? formatNumber(i, 4) : "—"})^2`,
                          };

                          const year1InvestedThisYear = showNominalFv
                            ? {
                                label: "Nominal change in Year 1 (ΔN1)",
                                value:
                                  futureValueProjectionYear1?.nominalThisYear !=
                                  null
                                    ? formatCurrencyNoDecimals(
                                        futureValueProjectionYear1.nominalThisYear,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "ΔN1 = N1 − N0, where N0 = upfront U (baseline is after the one-time deposit)",
                              }
                            : {
                                label: "Real change in Year 1 (ΔR1)",
                                value:
                                  futureValueProjectionYear1?.realThisYear !=
                                  null
                                    ? formatCurrencyNoDecimals(
                                        futureValueProjectionYear1.realThisYear,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "ΔR1 = R1 − R0, where R0 = upfront U (baseline is after the one-time deposit)",
                              };

                          const year2InvestedThisYear = showNominalFv
                            ? {
                                label: "Nominal change in Year 2 (ΔN2)",
                                value:
                                  futureValueProjectionYear2?.nominalThisYear !=
                                  null
                                    ? formatCurrencyNoDecimals(
                                        futureValueProjectionYear2.nominalThisYear,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "ΔN2 = N2 − N1",
                              }
                            : {
                                label: "Real change in Year 2 (ΔR2)",
                                value:
                                  futureValueProjectionYear2?.realThisYear !=
                                  null
                                    ? formatCurrencyNoDecimals(
                                        futureValueProjectionYear2.realThisYear,
                                        displayCurrency,
                                      )
                                    : "—",
                                note: "ΔR2 = R2 − R1",
                              };

                          const year1RowsByColumn: Record<
                            FutureValueProjectionBreakdownColumn,
                            readonly {
                              label: string;
                              value: string;
                              note: string;
                            }[]
                          > = {
                            valueThisYear: [
                              { label: "Year 1", value: "", note: "" },
                              year1ValueThisYear,
                            ],
                            valueTotal: [
                              { label: "Year 1", value: "", note: "" },
                              year1ValueTotal,
                            ],
                            investedThisYear: [
                              { label: "Year 1", value: "", note: "" },
                              ...(showNominalFv
                                ? [year1NominalTotal]
                                : [year1NominalTotal, year1RealTotal]),
                              year1InvestedThisYear,
                            ],
                            investedTotal: [
                              { label: "Year 1", value: "", note: "" },
                              ...(showNominalFv
                                ? [year1NominalTotal]
                                : [year1NominalTotal, year1RealTotal]),
                            ],
                          };

                          const year2RowsByColumn: Record<
                            FutureValueProjectionBreakdownColumn,
                            readonly {
                              label: string;
                              value: string;
                              note: string;
                            }[]
                          > = {
                            valueThisYear: [
                              { label: "Year 2", value: "", note: "" },
                              year2ValueThisYear,
                            ],
                            valueTotal: [
                              { label: "Year 2", value: "", note: "" },
                              year2ValueTotal,
                            ],
                            investedThisYear: [
                              { label: "Year 2", value: "", note: "" },
                              ...(showNominalFv
                                ? [year2NominalTotal]
                                : [year2NominalTotal, year2RealTotal]),
                              year2InvestedThisYear,
                            ],
                            investedTotal: [
                              { label: "Year 2", value: "", note: "" },
                              ...(showNominalFv
                                ? [year2NominalTotal]
                                : [year2NominalTotal, year2RealTotal]),
                            ],
                          };

                          const rows = [
                            ...inputsRows,
                            ...year1RowsByColumn[
                              futureValueProjectionBreakdownColumn
                            ],
                            ...year2RowsByColumn[
                              futureValueProjectionBreakdownColumn
                            ],
                          ] as const;

                          const milestoneLabels = new Set([
                            "Inputs",
                            "Year 1",
                            "Year 2",
                          ]);

                          return rows.map(({ label, value, note }, idx) => {
                            const isMilestone = milestoneLabels.has(label);
                            const showTopSeparator = isMilestone && idx !== 0;
                            const paddingTop = showTopSeparator ? 14 : 7;
                            return (
                              <tr key={`${label}-${idx}`}>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 0`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    fontWeight: isMilestone ? 700 : 400,
                                  }}
                                >
                                  {label}
                                </td>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 0`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontWeight: isMilestone ? 700 : 400,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {value}
                                </td>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 26px`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    opacity: 0.75,
                                  }}
                                >
                                  {note}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>

                    <details style={assumptionsDetailsStyle}>
                      <summary style={assumptionsSummaryStyle}>
                        Assumptions
                      </summary>
                      <div
                        style={{
                          marginTop: 12,
                          opacity: 0.75,
                          fontSize: 13,
                          lineHeight: 1.35,
                          display: "grid",
                          gap: 14,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Compounding assumption
                          </div>
                          <div>
                            One-time and recurring contributions use{" "}
                            <strong>monthly compounding</strong> (12
                            compounds/year). Recurring contributions start at{" "}
                            <strong>m0</strong> and are modeled as monthly
                            contributions that grow with inflation over time.
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Net return assumption
                          </div>
                          <div>
                            Return is applied <strong>monthly</strong> at the
                            gross annual return. Fee drag is applied{" "}
                            <strong>once per year</strong> after 12 monthly
                            additions.
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Inflation adjustment assumption
                          </div>
                          <div>
                            Real values are computed as{" "}
                            <strong>nominal / (1 + i)^(year - 1)</strong> (Year
                            1 money).
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Expenses columns assumption
                          </div>
                          <div>
                            “Expenses” columns show the{" "}
                            <strong>non-invested</strong> cost in the{" "}
                            <strong>money of that year</strong>. Recurring
                            inflates each year; Year 1 includes upfront +
                            recurring; subsequent years add only the inflated
                            recurring amount.
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Interpretation assumption
                          </div>
                          <div>
                            “Expenses” is a deterministic projection using fixed
                            rates; it can be interpreted as a median (50th
                            percentile) outcome in a simulation.
                          </div>
                        </div>
                      </div>
                    </details>
                  </details>
                </>
              ) : null}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--fc-subtle-border)",
                paddingTop: 10,
                order: 3,
              }}
            >
              <button
                type="button"
                onClick={() => setFutureRunwayProjectionOpen((v) => !v)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "inherit",
                  fontWeight: 900,
                  textAlign: "left",
                }}
                aria-expanded={futureRunwayProjectionOpen}
                aria-label={
                  futureRunwayProjectionOpen
                    ? "Collapse runway projection"
                    : "Expand runway projection"
                }
              >
                {futureRunwayProjectionOpen
                  ? "Future Runway Projection ▾"
                  : "Future Runway Projection ▸"}
              </button>

              {futureRunwayProjectionOpen ? (
                <>
                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 14,
                      }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Year
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Runway (year)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Runway (total)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            If invested (year)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            If invested (total)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {futureRunwayProjectionRows.map((r) => (
                          <tr key={r.years}>
                            <td
                              style={{
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {r.years}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {dailyCoreExpense == null
                                ? "—"
                                : r.runwayThisYearDays != null
                                  ? formatSignedRunwayDmy(
                                      r.runwayThisYearDays,
                                      1,
                                    )
                                  : "—"}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {dailyCoreExpense == null
                                ? "—"
                                : r.runwayTotalDays != null
                                  ? formatRunwayDmy(r.runwayTotalDays, 1)
                                  : "—"}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {dailyCoreExpense == null
                                ? "—"
                                : r.investedRunwayThisYearDays != null
                                  ? formatSignedRunwayDmy(
                                      r.investedRunwayThisYearDays,
                                      1,
                                    )
                                  : "—"}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom:
                                  "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {dailyCoreExpense == null
                                ? "—"
                                : r.investedRunwayTotalDays != null
                                  ? formatRunwayDmy(
                                      r.investedRunwayTotalDays,
                                      1,
                                    )
                                  : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {dailyCoreExpense == null ? (
                      <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                        Set core expenses to show runway days.
                      </div>
                    ) : null}

                    <div
                      style={{
                        ...subtleTextStyle,
                        marginTop: 6,
                        fontSize: 12,
                      }}
                    >
                      Note: “Nominal vs real” doesn’t change runway when core
                      expenses are inflation-adjusted too (runway = money / core
                      expenses, and inflation cancels in the ratio).
                    </div>
                  </div>

                  <details style={breakdownMainDetailsStyle}>
                    <summary style={breakdownMainSummaryStyle}>
                      Breakdown + calculation
                    </summary>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginTop: 10,
                      }}
                    >
                      <div
                        style={{ fontSize: 13, fontWeight: 800, opacity: 0.8 }}
                      >
                        Break down column:
                      </div>
                      <select
                        value={futureRunwayProjectionBreakdownColumn}
                        onChange={(e) =>
                          setFutureRunwayProjectionBreakdownColumn(
                            e.target
                              .value as FutureRunwayProjectionBreakdownColumn,
                          )
                        }
                        style={breakdownSelectStyle}
                        aria-label="Select runway projection breakdown column"
                      >
                        <option value="runwayThisYear">
                            Runway (year)
                        </option>
                        <option value="runwayTotal">Runway (total)</option>
                        <option value="investedRunwayThisYear">
                            If invested (year)
                        </option>
                        <option value="investedRunwayTotal">
                          If invested (total)
                        </option>
                      </select>
                    </div>

                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <colgroup>
                        <col style={{ width: "38%" }} />
                        <col style={{ width: "18%" }} />
                        <col style={{ width: "44%" }} />
                      </colgroup>
                      <tbody>
                        {(() => {
                          const d = dailyCoreExpense;
                          const upfront = oneTimeExpenseTotal;
                          const yearlyRecurring = recurringYearlyExpenseTotal;
                          const inflationPct = Number(
                            settings.investing.inflationPct ?? 0,
                          );
                          const i =
                            Number.isFinite(inflationPct) && inflationPct >= 0
                              ? inflationPct / 100
                              : 0;
                          const stepInflationYearly = 1 + i;
                          const yearlyRecurringY2 =
                            yearlyRecurring *
                            (stepInflationYearly === 1
                              ? 1
                              : stepInflationYearly);

                          const year1 =
                            futureRunwayProjectionRows.find(
                              (r) => r.years === 1,
                            ) ?? null;
                          const year2 =
                            futureRunwayProjectionRows.find(
                              (r) => r.years === 2,
                            ) ?? null;

                          const inputsRows = [
                            { label: "Inputs", value: "", note: "" },
                            {
                              label: "Upfront (U)",
                              value: formatCurrencyNoDecimals(
                                upfront,
                                displayCurrency,
                              ),
                              note: "sum of one-time expenses",
                            },
                            {
                              label: "Yearly recurring (Y0)",
                              value: formatCurrencyNoDecimals(
                                yearlyRecurring,
                                displayCurrency,
                              ),
                              note: "recurring yearly total in Year 1 money; inflates yearly",
                            },
                            {
                              label: "Inflation rate (i)",
                              value: Number.isFinite(inflationPct)
                                ? formatNumber(i, 4)
                                : "—",
                              note: "used to inflate recurring expenses and core expenses in Year N",
                            },
                            {
                              label: "Daily core expense (d)",
                              value:
                                d != null
                                  ? `${formatNumber(d, 2)} ${displayCurrency}/day`
                                  : "—",
                              note: "Year 1 daily core expense; Year N core expenses inflate",
                            },
                          ] as const;

                          const year1RowsByColumn: Record<
                            FutureRunwayProjectionBreakdownColumn,
                            readonly {
                              label: string;
                              value: string;
                              note: string;
                            }[]
                          > = {
                            runwayThisYear: [
                              { label: "Year 1", value: "", note: "" },
                              {
                                label: "Expenses in Year 1",
                                value: formatCurrencyNoDecimals(
                                  upfront + yearlyRecurring,
                                  displayCurrency,
                                ),
                                note: "Year 1 expenses = upfront + Year 1 recurring",
                              },
                              {
                                label: "Runway (year)",
                                value:
                                  d != null && year1?.runwayThisYearDays != null
                                    ? formatSignedRunwayDmy(
                                        year1.runwayThisYearDays,
                                        1,
                                      )
                                    : "—",
                                note: "runway(year) = expenses(year) / dailyCoreExpense(year)",
                              },
                            ],
                            runwayTotal: [
                              { label: "Year 1", value: "", note: "" },
                              {
                                label: "Expenses total end of Year 1",
                                value: formatCurrencyNoDecimals(
                                  upfront + yearlyRecurring,
                                  displayCurrency,
                                ),
                                note: "expenses(total,Y) = upfront + Σ yearlyRecurring(year k)",
                              },
                              {
                                label: "Runway (total)",
                                value:
                                  d != null && year1?.runwayTotalDays != null
                                    ? formatRunwayDmy(year1.runwayTotalDays, 1)
                                    : "—",
                                note: "runway(total) = expenses(total) / dailyCoreExpense(year)",
                              },
                            ],
                            investedRunwayThisYear: [
                              { label: "Year 1", value: "", note: "" },
                              {
                                label: "Invested runway change in Year 1",
                                value:
                                  d != null &&
                                  year1?.investedRunwayThisYearDays != null
                                    ? formatSignedRunwayDmy(
                                        year1.investedRunwayThisYearDays,
                                        1,
                                      )
                                    : "—",
                                note: "invested runway(year) = invested nominal(year) / core expenses in that year",
                              },
                            ],
                            investedRunwayTotal: [
                              { label: "Year 1", value: "", note: "" },
                              {
                                label: "Invested runway total end of Year 1",
                                value:
                                  d != null &&
                                  year1?.investedRunwayTotalDays != null
                                    ? formatRunwayDmy(
                                        year1.investedRunwayTotalDays,
                                        1,
                                      )
                                    : "—",
                                note: "invested runway(total) = invested nominal(total) / core expenses in that year",
                              },
                            ],
                          };

                          const year2RowsByColumn: Record<
                            FutureRunwayProjectionBreakdownColumn,
                            readonly {
                              label: string;
                              value: string;
                              note: string;
                            }[]
                          > = {
                            runwayThisYear: [
                              { label: "Year 2", value: "", note: "" },
                              {
                                label: "Expenses in Year 2",
                                value: formatCurrencyNoDecimals(
                                  yearlyRecurringY2,
                                  displayCurrency,
                                ),
                                note: "Year 2 expenses = Year 1 recurring inflated by (1 + i)",
                              },
                              {
                                label: "Runway (year)",
                                value:
                                  d != null && year2?.runwayThisYearDays != null
                                    ? formatSignedRunwayDmy(
                                        year2.runwayThisYearDays,
                                        1,
                                      )
                                    : "—",
                                note: "runway(year) = expenses(year) / dailyCoreExpense(year)",
                              },
                            ],
                            runwayTotal: [
                              { label: "Year 2", value: "", note: "" },
                              {
                                label: "Expenses total end of Year 2",
                                value: formatCurrencyNoDecimals(
                                  upfront + yearlyRecurring + yearlyRecurringY2,
                                  displayCurrency,
                                ),
                                note: "Year 2 total adds Year 2 recurring at the inflated level",
                              },
                              {
                                label: "Runway (total)",
                                value:
                                  d != null && year2?.runwayTotalDays != null
                                    ? formatRunwayDmy(year2.runwayTotalDays, 1)
                                    : "—",
                                note: "runway(total) = expenses(total) / dailyCoreExpense(year)",
                              },
                            ],
                            investedRunwayThisYear: [
                              { label: "Year 2", value: "", note: "" },
                              {
                                label: "Invested runway change in Year 2",
                                value:
                                  d != null &&
                                  year2?.investedRunwayThisYearDays != null
                                    ? formatSignedRunwayDmy(
                                        year2.investedRunwayThisYearDays,
                                        1,
                                      )
                                    : "—",
                                note: "invested runway(year) = invested nominal(year) / core expenses in that year",
                              },
                            ],
                            investedRunwayTotal: [
                              { label: "Year 2", value: "", note: "" },
                              {
                                label: "Invested runway total end of Year 2",
                                value:
                                  d != null &&
                                  year2?.investedRunwayTotalDays != null
                                    ? formatRunwayDmy(
                                        year2.investedRunwayTotalDays,
                                        1,
                                      )
                                    : "—",
                                note: "invested runway(total) = invested nominal(total) / core expenses in that year",
                              },
                            ],
                          };

                          const rows = [
                            ...inputsRows,
                            ...year1RowsByColumn[
                              futureRunwayProjectionBreakdownColumn
                            ],
                            ...year2RowsByColumn[
                              futureRunwayProjectionBreakdownColumn
                            ],
                          ] as const;

                          const milestoneLabels = new Set([
                            "Inputs",
                            "Year 1",
                            "Year 2",
                          ]);

                          return rows.map(({ label, value, note }, idx) => {
                            const isMilestone = milestoneLabels.has(label);
                            const showTopSeparator = isMilestone && idx !== 0;
                            const paddingTop = showTopSeparator ? 14 : 7;
                            return (
                              <tr key={`${label}-${idx}`}>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 0`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    fontWeight: isMilestone ? 700 : 400,
                                  }}
                                >
                                  {label}
                                </td>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 0`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    textAlign: "right",
                                    fontVariantNumeric: "tabular-nums",
                                    fontWeight: isMilestone ? 700 : 400,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {value}
                                </td>
                                <td
                                  style={{
                                    padding: `${paddingTop}px 0 7px 26px`,
                                    borderTop: showTopSeparator
                                      ? "2px solid var(--fc-card-border)"
                                      : undefined,
                                    borderBottom:
                                      "1px solid var(--fc-subtle-border)",
                                    opacity: 0.75,
                                  }}
                                >
                                  {note}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>

                    <details style={assumptionsDetailsStyle}>
                      <summary style={assumptionsSummaryStyle}>
                        Assumptions
                      </summary>
                      <div
                        style={{
                          marginTop: 12,
                          opacity: 0.75,
                          fontSize: 13,
                          lineHeight: 1.35,
                          display: "grid",
                          gap: 14,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Runway basis assumption
                          </div>
                          <div>
                            Runway days are computed as{" "}
                            <strong>
                              money / dailyCoreExpense in that year
                            </strong>{" "}
                            and formatted using 365d/year and 30.417d/month.
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Expenses vs invested assumption
                          </div>
                          <div>
                            “Runway” uses the <strong>Expenses</strong> columns
                            (non-invested). “If invested” uses the invested
                            projection’s values. Nominal vs real does not
                            change runway when core expenses are
                            inflation-adjusted too.
                          </div>
                        </div>
                      </div>
                    </details>
                  </details>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setAssumptionsOpen((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "inherit",
                fontWeight: 900,
                fontSize: 22,
                textAlign: "left",
              }}
              aria-expanded={assumptionsOpen}
              aria-label={
                assumptionsOpen ? "Collapse assumptions" : "Expand assumptions"
              }
            >
              {assumptionsOpen ? "Assumptions ▾" : "Assumptions ▸"}
            </button>

            {assumptionsOpen ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  style={btn()}
                  onClick={() => {
                    const next = defaultMoneyPerspectiveSettings();
                    setSettings(next);
                    setNetSalaryDraft(toDraft(next.compensation.amount));
                    setPayRaiseDraft(toDraft(next.compensation.payRaisePct));
                    setCoreExpensesDraft(
                      toDraft(coreExpenseValueForSource(next.coreExpenses)),
                    );
                    setAnnualReturnDraft(
                      toDraft(next.investing.annualReturnPct),
                    );
                    setInflationDraft(toDraft(next.investing.inflationPct));
                    setFeeDragDraft(toDraft(next.investing.feeDragPct));
                  }}
                  aria-label="Reset assumptions to defaults"
                >
                  Reset defaults
                </button>
              </div>
            ) : null}
          </div>

          {assumptionsOpen ? (
            <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "190px minmax(0, 1fr) 120px",
                  gap: 10,
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <div style={labelStyle}>Expense list (one time)</div>
                <div
                  style={{
                    gridColumn: "2 / span 2",
                    fontWeight: 800,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {`${formatCurrencyNoDecimals(oneTimeExpenseTotal, displayCurrency)} (${oneTimeItemCount} item${oneTimeItemCount === 1 ? "" : "s"})`}
                </div>

                <div style={labelStyle}>Expense list (yearly)</div>
                <div
                  style={{
                    gridColumn: "2 / span 2",
                    fontWeight: 800,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {`${formatCurrencyNoDecimals(recurringYearlyExpenseTotal, displayCurrency)} (${recurringItemCount} item${recurringItemCount === 1 ? "" : "s"})`}
                </div>

                <div style={labelStyle}>Net salary</div>
                <div style={{ ...inputGroupStyle, width: "100%" }}>
                  <input
                    value={netSalaryDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!isValidDecimalDraft(v)) return;
                      setNetSalaryDraft(v);
                      const n = roundTo1Decimal(draftToNumberOrZero(v));
                      setSettings((s) => ({
                        ...s,
                        compensation: { ...s.compensation, amount: n },
                      }));
                    }}
                    inputMode="decimal"
                    style={inputGroupInputStyle}
                    aria-label="Net salary amount"
                  />
                  <span aria-hidden style={inputGroupUnitStyle}>
                    {displayCurrency}
                  </span>
                </div>

                <select
                  value={settings.compensation.period}
                  onChange={(e) => {
                    const next = e.target.value as MoneyPerspectiveSalaryPeriod;
                    const current = settings.compensation;
                    if (next === current.period) return;
                    const effectiveHourly =
                      effectiveHourlyFromSalarySettings(current);
                    if (effectiveHourly == null) {
                      const nextComp = { ...current, period: next };
                      setSettings((s) => ({ ...s, compensation: nextComp }));
                      return;
                    }

                    const hours =
                      current.workingHoursPerMonth > 0
                        ? current.workingHoursPerMonth
                        : 160;
                    const amount = roundTo1Decimal(
                      salaryAmountFromEffectiveHourly(
                        effectiveHourly,
                        hours,
                        next,
                      ),
                    );
                    const nextComp = {
                      ...current,
                      workingHoursPerMonth: hours,
                      period: next,
                      amount,
                    };
                    setSettings((s) => ({ ...s, compensation: nextComp }));
                    setNetSalaryDraft(toDraft(amount));
                  }}
                  style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                  aria-label="Net salary period"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>

                <div style={labelStyle}>Pay raise (yearly)</div>
                <div
                  style={{
                    ...inputGroupStyle,
                    width: "100%",
                    gridColumn: "2 / span 2",
                  }}
                >
                  <input
                    value={payRaiseDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!isValidDecimalDraft(v)) return;
                      setPayRaiseDraft(v);
                      const n = roundTo1Decimal(draftToNumberOrZero(v));
                      setSettings((s) => ({
                        ...s,
                        compensation: { ...s.compensation, payRaisePct: n },
                      }));
                    }}
                    inputMode="decimal"
                    style={inputGroupInputStyle}
                    aria-label="Pay raise (yearly)"
                  />
                  <span aria-hidden style={inputGroupUnitStyle}>
                    %
                  </span>
                </div>

                <div style={labelStyle}>Core expenses</div>
                <div style={{ ...inputGroupStyle, width: "100%" }}>
                  <input
                    value={coreExpensesDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!isValidDecimalDraft(v)) return;
                      setCoreExpensesDraft(v);
                      const n = roundTo1Decimal(draftToNumberOrZero(v));
                      setSettings((s) => ({
                        ...s,
                        coreExpenses: setCoreExpenseForSource(
                          s.coreExpenses,
                          s.coreExpenses.source,
                          n,
                        ),
                      }));
                    }}
                    inputMode="decimal"
                    style={inputGroupInputStyle}
                    aria-label="Core expenses amount"
                  />
                  <span aria-hidden style={inputGroupUnitStyle}>
                    {displayCurrency}
                  </span>
                </div>

                <select
                  value={settings.coreExpenses.source}
                  onChange={(e) => {
                    const next = e.target
                      .value as MoneyPerspectiveSettingsV3["coreExpenses"]["source"];
                    const current = settings.coreExpenses;
                    const daily = dailyCoreExpenseFromSettings(current);
                    const nextCore =
                      daily == null
                        ? { ...current, source: next }
                        : setCoreExpenseFromDaily(current, next, daily);

                    setSettings((s) => ({ ...s, coreExpenses: nextCore }));
                    setCoreExpensesDraft(
                      toDraft(coreExpenseValueForSource(nextCore)),
                    );
                  }}
                  style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                  aria-label="Core expenses period"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>

                <div style={labelStyle}>Expected annual return</div>
                <div style={{ ...inputGroupStyle, gridColumn: "2 / span 2" }}>
                  <input
                    value={annualReturnDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!isValidDecimalDraft(v)) return;
                      setAnnualReturnDraft(v);
                      setSettings((s) => ({
                        ...s,
                        investing: {
                          ...s.investing,
                          annualReturnPct: draftToNumberOrZero(v),
                        },
                      }));
                    }}
                    inputMode="decimal"
                    style={inputGroupInputStyle}
                    aria-label="Expected annual return percent"
                  />
                  <span aria-hidden style={inputGroupUnitStyle}>
                    %
                  </span>
                </div>

                <div style={labelStyle}>Inflation</div>
                <div style={{ ...inputGroupStyle, gridColumn: "2 / span 2" }}>
                  <input
                    value={inflationDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!isValidDecimalDraft(v)) return;
                      setInflationDraft(v);
                      setSettings((s) => ({
                        ...s,
                        investing: {
                          ...s.investing,
                          inflationPct: draftToNumberOrZero(v),
                        },
                      }));
                    }}
                    inputMode="decimal"
                    style={inputGroupInputStyle}
                    aria-label="Inflation percent"
                  />
                  <span aria-hidden style={inputGroupUnitStyle}>
                    %
                  </span>
                </div>

                <div style={labelStyle}>Fee drag</div>
                <div style={{ ...inputGroupStyle, gridColumn: "2 / span 2" }}>
                  <input
                    value={feeDragDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!isValidDecimalDraft(v)) return;
                      setFeeDragDraft(v);
                      setSettings((s) => ({
                        ...s,
                        investing: {
                          ...s.investing,
                          feeDragPct: draftToNumberOrZero(v),
                        },
                      }));
                    }}
                    inputMode="decimal"
                    style={inputGroupInputStyle}
                    aria-label="Fee drag percent"
                  />
                  <span aria-hidden style={inputGroupUnitStyle}>
                    %
                  </span>
                </div>

                <div
                  style={{
                    ...subtleTextStyle,
                    fontSize: 13,
                    gridColumn: "1 / span 3",
                  }}
                >
                  Net annual return: {formatNumber(netAnnualReturnPct, 2)}%
                </div>
                <div
                  style={{
                    ...subtleTextStyle,
                    fontSize: 13,
                    gridColumn: "1 / span 3",
                  }}
                >
                  Compounding: 12 times a year (monthly)
                </div>
              </div>

              <div style={{ ...subtleTextStyle, fontSize: 13 }}>
                Notes: Core expenses are meant to cover necessities (rent, food,
                utilities; excludes discretionary). Monthly↔daily conversion
                uses {formatNumber(DAYS_PER_MONTH, 3)} days/month.
              </div>

              <div style={{ ...subtleTextStyle, fontSize: 13, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Forces</div>
                <strong>Expenses</strong> represents the money-value of the expenses in the year
                they occur, so recurring expenses inflate with inflation.
                <strong> Work</strong> represents the time required to earn that money, so it
                depends on both expense inflation and wage growth (pay raise).
                <strong> Runway</strong> converts money into time covered by core expenses, so
                it depends on inflating core expenses.
                <div style={{ marginTop: 6 }}>
                  The “<strong>If invested</strong>” path deposits one-time expenses at the
                  start of Year 1, then for each month adds the (monthly-equivalent)
                  recurring amount and applies monthly return. After 12 additions, the
                  annual fee is subtracted and next year’s recurring amount is increased
                  by inflation.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setBreakEvenOpen((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "inherit",
                fontWeight: 900,
                fontSize: 22,
                textAlign: "left",
              }}
              aria-expanded={breakEvenOpen}
              aria-label={
                breakEvenOpen
                  ? "Collapse break-even framing"
                  : "Expand break-even framing"
              }
            >
              {breakEvenOpen ? "Break-even framing ▾" : "Break-even framing ▸"}
            </button>
          </div>

          {breakEvenOpen ? (
            <>
              <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={labelStyle}>Monthly benefit type</div>
                  <select
                    value={benefitMode}
                    onChange={(e) =>
                      setBenefitMode(e.target.value as MonthlyBenefitMode)
                    }
                    style={controlStyle}
                  >
                    <option value="money">Earns/saves money (net)</option>
                    <option value="hours">Saves time (hours)</option>
                  </select>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={labelStyle}>
                    {benefitMode === "money"
                      ? "Monthly benefit"
                      : "Hours saved per month"}
                  </div>
                  <input
                    value={monthlyBenefitDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!isValidDecimalDraft(v)) return;
                      setMonthlyBenefitDraft(v);
                    }}
                    inputMode="decimal"
                    style={controlStyle}
                    placeholder={
                      benefitMode === "money" ? "e.g. 200" : "e.g. 3"
                    }
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 800 }}>Break-even</div>
                  {monthlyBenefitMoney == null ? (
                    <div style={subtleTextStyle}>
                      Enter a monthly benefit greater than 0.
                    </div>
                  ) : breakEven == null ? (
                    <div style={subtleTextStyle}>
                      Unable to compute break-even with the current inputs.
                    </div>
                  ) : (
                    <div style={{ fontWeight: 900, fontSize: 22 }}>
                      {formatNumber(breakEven, 2)} months
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...subtleTextStyle, fontSize: 13, marginTop: 12 }}>
                Notes: Break-even uses the monthly benefit you enter (nothing is
                guessed). If you pick “hours”, it converts hours→money using
                your net salary (hourly-equivalent).
              </div>
            </>
          ) : null}
        </div>

        <div style={{ ...cardStyle, ...subtleTextStyle, fontSize: 13 }}>
          Informational only. Returns are assumptions. This does not constitute
          financial advice.
        </div>
      </div>

      {savedListsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saved lists"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSavedListsModal();
          }}
        >
          <div
            style={{
              width: "min(420px, 92vw)",
              background: "#111",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 14,
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 700 }}>Saved lists</div>
              <button
                type="button"
                aria-label="Close saved lists"
                title="Close"
                onClick={closeSavedListsModal}
                style={savedModalBtn("ghost")}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 20,
                    lineHeight: 1,
                    display: "inline-block",
                  }}
                >
                  ✕
                </span>
              </button>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "0.95rem", opacity: 0.9 }}>List</span>
              <select
                aria-label="Saved expense list"
                value={selectedSavedListId}
                onChange={(e) => {
                  setSelectedSavedListId(e.target.value);
                  setShareUrl(null);
                  setShowComparePlaceholder(false);
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: "0.95rem",
                  padding: "0.35rem",
                }}
              >
                <option value="">— Select —</option>
                {savedLists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "0.95rem", opacity: 0.9 }}>
                Compare to
              </span>
              <select
                aria-label="Compare to saved expense list"
                value={compareSavedListId}
                onChange={(e) => {
                  setCompareSavedListId(e.target.value);
                  setShowComparePlaceholder(false);
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: "0.95rem",
                  padding: "0.35rem",
                }}
              >
                <option value="">— Select —</option>
                {savedLists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                aria-label="Compare expense lists"
                title="Compare (coming soon)"
                onClick={() => {
                  if (!selectedSavedListId || !compareSavedListId) return;
                  if (selectedSavedListId === compareSavedListId) return;
                  setShowComparePlaceholder(true);
                }}
                disabled={
                  !selectedSavedListId ||
                  !compareSavedListId ||
                  selectedSavedListId === compareSavedListId
                }
                style={savedModalBtn(
                  !selectedSavedListId ||
                    !compareSavedListId ||
                    selectedSavedListId === compareSavedListId
                    ? "disabled"
                    : "ghost",
                )}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 22,
                    lineHeight: 1,
                    display: "inline-block",
                  }}
                >
                  ⇄
                </span>
              </button>
              <button
                type="button"
                aria-label="Share saved expense list"
                title="Share"
                onClick={async () => {
                  if (!selectedSavedListId) return;
                  const list = findExpenseListById(selectedSavedListId);
                  if (!list) return;
                  const url = buildShareUrlForItems(list.currency, list.items);
                  if (!url) return;
                  setShareUrl(url);
                  await copyShareUrl(url);
                }}
                disabled={!selectedSavedListId}
                style={savedModalBtn(
                  !selectedSavedListId ? "disabled" : "ghost",
                )}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 22,
                    lineHeight: 1,
                    display: "inline-block",
                  }}
                >
                  🔗
                </span>
              </button>
              <button
                type="button"
                aria-label="Load saved expense list"
                title="Load"
                onClick={() => {
                  if (!selectedSavedListId) return;
                  const list = findExpenseListById(selectedSavedListId);
                  if (!list) return;
                  const nextItems: PurchaseItem[] =
                    list.items.length > 0
                      ? list.items
                      : ([
                          {
                            id: newId(),
                            name: undefined,
                            type: "oneTime" as const,
                            amount: 0,
                            currency: list.currency,
                          },
                        ] satisfies PurchaseItem[]);
                  setItems(
                    nextItems.map((it) => ({ ...it, currency: list.currency })),
                  );
                  setNewItemCurrency(list.currency);
                  setShareUrl(null);
                  closeSavedListsModal();
                }}
                disabled={!selectedSavedListId}
                style={savedModalBtn(
                  !selectedSavedListId ? "disabled" : "ghost",
                )}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 22,
                    lineHeight: 1,
                    display: "inline-block",
                  }}
                >
                  ▶
                </span>
              </button>
              <button
                type="button"
                aria-label="Save expense list"
                title="Save"
                onClick={() => {
                  const selected = selectedSavedListId
                    ? findExpenseListById(selectedSavedListId)
                    : undefined;
                  const name = window.prompt(
                    "Expense list name:",
                    selected?.name ?? "",
                  );
                  if (!name) return;
                  try {
                    const trimmedLower = name.trim().toLowerCase();
                    const existingByName = listSavedExpenseLists().find(
                      (x) => x.name.trim().toLowerCase() === trimmedLower,
                    );
                    const saved = saveExpenseList(
                      name,
                      displayCurrency,
                      items,
                      existingByName?.id,
                    );
                    refreshSavedLists();
                    setSelectedSavedListId(saved.id);
                  } catch (e) {
                    window.alert(
                      (e as Error).message || "Failed to save expense list.",
                    );
                  }
                }}
                style={savedModalBtn("ghost")}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 22,
                    lineHeight: 1,
                    display: "inline-block",
                  }}
                >
                  💾
                </span>
              </button>
              <button
                type="button"
                aria-label="Delete expense list"
                title="Delete"
                onClick={() => {
                  if (!selectedSavedListId) return;
                  deleteExpenseList(selectedSavedListId);
                  refreshSavedLists();
                  setSelectedSavedListId("");
                  setCompareSavedListId("");
                  setShareUrl(null);
                }}
                disabled={!selectedSavedListId}
                style={
                  !selectedSavedListId
                    ? savedModalBtn("disabled")
                    : {
                        ...savedModalBtn("ghost"),
                        color: "crimson",
                        borderColor: "crimson",
                      }
                }
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 22,
                    lineHeight: 1,
                    display: "inline-block",
                  }}
                >
                  🗑
                </span>
              </button>
            </div>

            {showComparePlaceholder ? (
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                Comparison coming soon.
              </div>
            ) : null}

            {shareUrl ? (
              <div
                style={{
                  marginTop: 6,
                  borderTop: "1px solid #2a2a2a",
                  paddingTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  This link encodes your expense list in the URL (anyone with it
                  can decode them).
                </div>

                <label
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span style={{ fontSize: "0.95rem", opacity: 0.9 }}>
                    Share link
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      aria-label="Share link"
                      readOnly
                      value={shareUrl}
                      style={{
                        flex: 1,
                        padding: "0.35rem 0.45rem",
                        fontSize: "0.9rem",
                        borderRadius: 8,
                        border: "1px solid #333",
                        background: "#0b0b0b",
                        color: "#fff",
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      aria-label="Copy share link"
                      title="Copy"
                      onClick={() => void copyShareUrl(shareUrl)}
                      style={savedModalBtn("ghost")}
                    >
                      {didCopyShareUrl ? (
                        <span aria-label="Copied" title="Copied">
                          ✓
                        </span>
                      ) : (
                        "Copy"
                      )}
                    </button>
                  </div>
                </label>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default MoneyPerspectivePage;
