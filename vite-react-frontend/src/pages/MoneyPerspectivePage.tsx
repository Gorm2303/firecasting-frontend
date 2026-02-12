import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import {
  defaultMoneyPerspectiveSettings,
  loadMoneyPerspectiveSettings,
  saveMoneyPerspectiveSettings,
  type MoneyPerspectiveSettingsV3,
  type MoneyPerspectiveSalaryPeriod,
} from "../config/moneyPerspectiveSettings";
import { draftToNumberOrZero, isValidDecimalDraft } from "../utils/numberInput";
import {
  DAYS_PER_MONTH,
  applySimpleFeeDragToAnnualReturn,
  breakEvenMonths,
  coreExpenseDays,
  equivalentCoreExpenseDaysInYearN,
  futureValueReal,
  monthlyBenefitMoneyFromHours,
  workHours,
} from "../lib/moneyPerspective/calculations";
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

const formatRunwayDmy = (runwayDays: number): string => {
  if (!Number.isFinite(runwayDays)) return "—";

  const totalDays = Math.max(0, Math.round(runwayDays));
  const daysPerYear = 365;

  let remaining = totalDays;
  let years = Math.floor(remaining / daysPerYear);
  remaining -= years * daysPerYear;

  let months = Math.floor(remaining / DAYS_PER_MONTH);
  remaining -= months * DAYS_PER_MONTH;

  let days = Math.round(remaining);

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
  parts.push(`${days}d`);
  return parts.join(" ");
};

const formatSignedRunwayDmy = (runwayDays: number): string => {
  if (!Number.isFinite(runwayDays)) return "—";
  if (runwayDays === 0) return "0d";
  const sign = runwayDays < 0 ? "-" : "";
  return sign + formatRunwayDmy(Math.abs(runwayDays));
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

  const days = dayDigits > 0 ? roundTo1Decimal(remaining) : Math.round(remaining);

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

const HORIZON_TABLE_YEARS: number[] = Array.from(
  { length: 10 },
  (_, i) => (i + 1) * 5,
); // 5..50

const EXTRA_DETAIL_YEARS: number[] = [1, 2, 3, 4, 6, 7, 8, 9];

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
  return v === "oneTime" || v === "weekly" || v === "monthly" || v === "yearly"
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
    const amount = typeof amountRaw === "number" && Number.isFinite(amountRaw) ? amountRaw : 0;
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

  const [newItemCurrency, setNewItemCurrency] = useState<string>(
    () => normalizeCurrencyDraft(initialDraft?.newItemCurrency ?? settings.currency),
  );
  const [items, setItems] = useState<PurchaseItem[]>(
    () => {
      const fromDraft = initialDraft?.items ?? [];
      if (fromDraft.length > 0) return fromDraft;

      const currency = normalizeCurrencyDraft(initialDraft?.newItemCurrency ?? settings.currency);
      return [
        {
          id: newId(),
          name: undefined,
          type: "oneTime",
          amount: 1000,
          currency,
        },
      ];
    },
  );

  const [itemAmountDrafts, setItemAmountDrafts] = useState<Record<string, string>>(
    () => {
      const list = initialDraft?.items ?? [];
      const out: Record<string, string> = {};
      for (const it of list) out[it.id] = toDraft(it.amount);
      return out;
    },
  );

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
      .reduce((sum, it) => sum + purchaseYearlyEquivalent(it.amount, it.type), 0);
  }, [itemsWithAmount]);

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
    setItems((current) => current.map((it) => ({ ...it, currency: normalized })));
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
            : ([{ id: newId(), name: undefined, type: "oneTime" as const, amount: 0, currency }] satisfies PurchaseItem[]);

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
            : ([{ id: newId(), name: undefined, type: "oneTime" as const, amount: 0, currency }] satisfies PurchaseItem[]);
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
      setItems((current) => current.map((x, i) => (i === 0 ? { ...x, type: parsedType } : x)));
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
  }, [
    benefitMode,
    monthlyBenefitDraft,
    items,
    newItemCurrency,
  ]);

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

  const results = useMemo(() => {
    const amount = oneTimeExpenseTotal;
    const hourly = effectiveHourlyRate;
    const workHrs = hourly ? (amount > 0 ? workHours(amount, hourly) : 0) : null;
    return { workHrs };
  }, [effectiveHourlyRate, oneTimeExpenseTotal]);

  const repetitiveWorkHoursPerYear = useMemo(() => {
    const amount = recurringYearlyExpenseTotal;
    const hourly = effectiveHourlyRate;
    if (hourly == null) return null;
    if (!(amount > 0)) return 0;
    if (!(hourly > 0)) return null;
    return amount / hourly;
  }, [effectiveHourlyRate, recurringYearlyExpenseTotal]);

  const recurringYear0FirstInstanceAmount = useMemo(() => {
    return itemsWithAmount
      .filter((it) => it.type !== "oneTime")
      .reduce((sum, it) => sum + it.amount, 0);
  }, [itemsWithAmount]);

  const workTimeProjectionTable = useMemo(() => {
    const hourly0 = effectiveHourlyRate;
    if (hourly0 == null) return null;

    const year0Hours = hourly0 > 0 ? recurringYear0FirstInstanceAmount / hourly0 : null;
    if (year0Hours == null) return null;

    const repetitiveYearlyAmount0 = recurringYearlyExpenseTotal;
    const baseYearlyHours0 = hourly0 > 0 ? repetitiveYearlyAmount0 / hourly0 : null;
    if (baseYearlyHours0 == null) return null;

    const inflationPct = Number(settings.investing.inflationPct ?? 0);
    const payRaisePct = Number(settings.compensation.payRaisePct ?? 0);
    const i = Number.isFinite(inflationPct) ? inflationPct / 100 : 0;
    const r = Number.isFinite(payRaisePct) ? payRaisePct / 100 : 0;

    const ratio = (1 + i) / (1 + r);
    const ratioOk = Number.isFinite(ratio) && ratio > 0;
    if (!ratioOk) return null;

    const workingHoursPerMonth = settings.compensation.workingHoursPerMonth;
    const annualWorkCapacityHours =
      typeof workingHoursPerMonth === "number" && Number.isFinite(workingHoursPerMonth) && workingHoursPerMonth > 0
        ? workingHoursPerMonth * 12
        : null;

    const projectionYears = [...HORIZON_TABLE_YEARS, ...EXTRA_DETAIL_YEARS]
      .filter((x, idx, arr) => arr.indexOf(x) === idx)
      .filter((x) => Number.isFinite(x) && x > 0)
      .sort((a, b) => a - b);

    const careerYears = projectionYears.length ? projectionYears[projectionYears.length - 1] : null;
    const careerWorkCapacityHours =
      annualWorkCapacityHours != null && careerYears != null ? annualWorkCapacityHours * careerYears : null;

    const cumulativeHoursFromYearly = (years: number): number => {
      if (years <= 0) return 0;
      if (ratio === 1) return baseYearlyHours0 * years;
      // Sum_{k=1..years} base * ratio^k
      return (
        baseYearlyHours0 *
        ratio *
        (Math.pow(ratio, years) - 1) /
        (ratio - 1)
      );
    };

    return projectionYears.map((years) => {
      const thisYearHours = baseYearlyHours0 * Math.pow(ratio, years);
      const cumulativeTotalHours = year0Hours + cumulativeHoursFromYearly(years);

      return {
        years,
        thisYearHours,
        cumulativeTotalHours,
        workPctThisYear:
          annualWorkCapacityHours != null ? thisYearHours / annualWorkCapacityHours : null,
        careerPctTotal:
          careerWorkCapacityHours != null ? cumulativeTotalHours / careerWorkCapacityHours : null,
      };
    });
  }, [effectiveHourlyRate, recurringYear0FirstInstanceAmount, recurringYearlyExpenseTotal, settings.compensation.payRaisePct, settings.compensation.workingHoursPerMonth, settings.investing.inflationPct]);

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
      if (fvNominal == null) return { years, fvNominal: null, fvReal: null, runwayDays: null };
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
    year0Cost,
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
      .reduce((sum, it) => sum + purchaseMonthlyEquivalent(it.amount, it.type), 0);
    const costForBreakEven = upfront + recurringMonthly;
    return breakEvenMonths(costForBreakEven, monthlyBenefitMoney);
  }, [itemsWithAmount, monthlyBenefitMoney, year0Cost]);

  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [breakEvenOpen, setBreakEvenOpen] = useState(false);
  const [workTimeProjectionOpen, setWorkTimeProjectionOpen] = useState(false);

  const [useWorkDaysInYmd, setUseWorkDaysInYmd] = useState(false);
  const [showNominalFv, setShowNominalFv] = useState(false);

  const futureValueThisYearRows = useMemo(() => {
    const daily = dailyCoreExpense;
    const inflationOk =
      Number.isFinite(settings.investing.inflationPct) &&
      settings.investing.inflationPct >= 0;

    const fvNominalAtYear = (years: number): number | null => {
      if (years === 0) return year0Cost;
      return futureValueNominalTotalForItems(
        itemsWithAmount,
        settings.investing.annualReturnPct,
        years,
        settings.investing.feeDragPct,
      );
    };

    const fvRealAtYear = (years: number): number | null => {
      const nom = fvNominalAtYear(years);
      if (nom == null) return null;
      if (years === 0) return nom;
      if (!inflationOk) return null;
      return futureValueReal(nom, settings.investing.inflationPct, years);
    };

    const runwayDaysAtYear = (years: number): number | null => {
      if (daily == null) return null;
      const real = fvRealAtYear(years);
      if (real == null) return null;
      if (years === 0) return coreExpenseDays(real, daily);
      return equivalentCoreExpenseDaysInYearN(real, daily);
    };

    return horizonTable.map((r) => {
      const years = r.years;
      const totalNominal = fvNominalAtYear(years);
      const totalReal = fvRealAtYear(years);
      const totalRunwayDays = runwayDaysAtYear(years);

      const prevYears = years - 1;
      const prevNominal = fvNominalAtYear(prevYears);
      const prevReal = fvRealAtYear(prevYears);
      const prevRunwayDays = runwayDaysAtYear(prevYears);

      return {
        years,
        nominalThisYear:
          totalNominal != null && prevNominal != null
            ? totalNominal - prevNominal
            : null,
        totalNominal,
        realThisYear:
          totalReal != null && prevReal != null ? totalReal - prevReal : null,
        totalReal,
        runwayThisYearDays:
          totalRunwayDays != null && prevRunwayDays != null
            ? totalRunwayDays - prevRunwayDays
            : null,
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
    year0Cost,
  ]);

  const [savedListsOpen, setSavedListsOpen] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedExpenseList[]>(() => listSavedExpenseLists());
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
      <h1 style={{ textAlign: "center", fontSize: 34 }}>
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
              <div style={{ ...subtleTextStyle, fontSize: 13, fontWeight: 800 }}>
                Currency
              </div>
              <div style={{ ...inputGroupStyle, height: 34, fontSize: 14, width: 80 }}>
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
                style={{ ...btn(), height: 34, display: "flex", alignItems: "center", gap: 8 }}
                onClick={() => {
                  refreshSavedLists();
                  setSavedListsOpen(true);
                }}
              >
                <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                  📁
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>Saved lists</span>
              </button>
            </div>
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
                            borderBottom:
                              "1px solid var(--fc-subtle-border)",
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
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </td>
                        <td
                          style={{
                            padding: "6px 3px",
                            borderBottom:
                              "1px solid var(--fc-subtle-border)",
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
                              value={itemAmountDrafts[it.id] ?? toDraft(it.amount)}
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
                            borderBottom:
                              "1px solid var(--fc-subtle-border)",
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

          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 800 }}>One Time Expenses to Work Time</div>
                {effectiveHourlyRate == null ? (
                  <div style={subtleTextStyle}>Missing</div>
                ) : (
                  <div style={{ fontWeight: 900, fontSize: 22 }}>
                    {formatNumber(results.workHrs ?? 0, 2)} hours
                  </div>
                )}
              </div>
              {effectiveHourlyRate == null ? (
                <div style={subtleTextStyle}>
                  Set net salary to compute work time.
                </div>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 800 }}>Repetitive Expenses to Work Time</div>
                {effectiveHourlyRate == null ? (
                  <div style={subtleTextStyle}>Missing</div>
                ) : (
                  <div style={{ fontWeight: 900, fontSize: 22 }}>
                    {formatNumber(repetitiveWorkHoursPerYear ?? 0, 2)} hours/year
                  </div>
                )}
              </div>
              {effectiveHourlyRate == null ? (
                <div style={subtleTextStyle}>
                  Set net salary to compute work time.
                </div>
              ) : null}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--fc-subtle-border)",
                paddingTop: 10,
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
                aria-label={workTimeProjectionOpen ? "Collapse work time projection" : "Expand work time projection"}
              >
                {workTimeProjectionOpen
                  ? "Work Time Projection of Repetitive Expenses ▾"
                  : "Work Time Projection of Repetitive Expenses ▸"}
              </button>

              {workTimeProjectionOpen ? (
                <>
                  <div style={{ ...subtleTextStyle, fontSize: 12, marginTop: 4 }}>
                    Projects work hours after inflation increases expenses and pay raise increases wage. Values are shown as Y/M/D where 1d = 8 hours.
                  </div>

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
                      checked={useWorkDaysInYmd}
                      onChange={(e) => setUseWorkDaysInYmd(e.target.checked)}
                      aria-label="Use only working days"
                    />
                    Use only working days (no weekends, no holidays, 1d = 8h, 1m = 20 work days, 1y = 240 work days)
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
                            % of Work (This year)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Work (This year)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Career % (Total)
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            Total (Y/M/D)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {workTimeProjectionTable?.map((r) => (
                          <tr key={r.years}>
                            <td
                              style={{
                                padding: "6px 8px",
                                borderBottom: "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {r.years}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom: "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {r.workPctThisYear != null
                                ? `${(r.workPctThisYear * 100).toFixed(1)}%`
                                : "—"}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom: "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {r.thisYearHours != null
                                ? formatHoursAsYmd(r.thisYearHours, 1, useWorkDaysInYmd)
                                : "—"}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom: "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {r.careerPctTotal != null
                                ? `${(r.careerPctTotal * 100).toFixed(1)}%`
                                : "—"}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom: "1px solid var(--fc-subtle-border)",
                              }}
                            >
                              {r.cumulativeTotalHours != null
                                ? formatHoursAsYmd(r.cumulativeTotalHours, 1, useWorkDaysInYmd)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {effectiveHourlyRate == null ? (
                      <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                        Set net salary to show projected work time.
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--fc-subtle-border)",
                paddingTop: 10,
              }}
            >
              <div style={{ fontWeight: 900 }}>Future Value Projection of All Expenses</div>
              <div style={{ ...subtleTextStyle, fontSize: 12, marginTop: 4 }}>
                Includes one-time and repetitive expenses (converted to monthly equivalents) and compounds monthly.
              </div>

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
                  aria-label="Show nominal future value"
                />
                Show nominal (instead of real). Runway stays real.
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
                        {showNominalFv ? "Nominal this year" : "Real this year"}
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      >
                        {showNominalFv ? "Total Nominal" : "Total Real"}
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      >
                        Runway this year
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      >
                        Runway (Y/M/D)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {futureValueThisYearRows.map((r) => (
                      <tr key={r.years}>
                        <td
                          style={{
                            padding: "6px 8px",
                            borderBottom: "1px solid var(--fc-subtle-border)",
                          }}
                        >
                          {r.years}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "6px 8px",
                            borderBottom: "1px solid var(--fc-subtle-border)",
                          }}
                        >
                          {showNominalFv
                            ? r.nominalThisYear != null
                              ? formatCurrencyNoDecimals(r.nominalThisYear, displayCurrency)
                              : "—"
                            : r.realThisYear != null
                              ? formatCurrencyNoDecimals(r.realThisYear, displayCurrency)
                              : "—"}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "6px 8px",
                            borderBottom: "1px solid var(--fc-subtle-border)",
                          }}
                        >
                          {showNominalFv
                            ? r.totalNominal != null
                              ? formatCurrencyNoDecimals(r.totalNominal, displayCurrency)
                              : "—"
                            : r.totalReal != null
                              ? formatCurrencyNoDecimals(r.totalReal, displayCurrency)
                              : "—"}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "6px 8px",
                            borderBottom: "1px solid var(--fc-subtle-border)",
                          }}
                        >
                          {dailyCoreExpense == null
                            ? "—"
                            : r.runwayThisYearDays != null
                              ? formatSignedRunwayDmy(r.runwayThisYearDays)
                              : "—"}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            padding: "6px 8px",
                            borderBottom: "1px solid var(--fc-subtle-border)",
                          }}
                        >
                          {dailyCoreExpense == null
                            ? "—"
                            : r.totalRunwayDays != null
                              ? formatRunwayDmy(r.totalRunwayDays)
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
              </div>
            </div>
          </div>

          <div style={{ ...subtleTextStyle, fontSize: 13, marginTop: 12 }}>
            Notes: The table assumes monthly compounding (12×/year). For
            weekly/monthly/yearly items, it converts each amount into an
            equivalent monthly contribution. Year 0 is the first purchase.
            Future values can be interpreted as the median (50th percentile)
            outcome in a simulation.
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
                aria-label={assumptionsOpen ? "Collapse assumptions" : "Expand assumptions"}
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
                      setCoreExpensesDraft(toDraft(coreExpenseValueForSource(next.coreExpenses)));
                      setAnnualReturnDraft(toDraft(next.investing.annualReturnPct));
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
                      const effectiveHourly = effectiveHourlyFromSalarySettings(current);
                      if (effectiveHourly == null) {
                        const nextComp = { ...current, period: next };
                        setSettings((s) => ({ ...s, compensation: nextComp }));
                        return;
                      }

                      const hours = current.workingHoursPerMonth > 0 ? current.workingHoursPerMonth : 160;
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
                  <div style={{ ...inputGroupStyle, width: "100%", gridColumn: "2 / span 2" }}>
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
                      const next =
                        e.target.value as MoneyPerspectiveSettingsV3["coreExpenses"]["source"];
                      const current = settings.coreExpenses;
                      const daily = dailyCoreExpenseFromSettings(current);
                      const nextCore =
                        daily == null
                          ? { ...current, source: next }
                          : setCoreExpenseFromDaily(current, next, daily);

                      setSettings((s) => ({ ...s, coreExpenses: nextCore }));
                      setCoreExpensesDraft(toDraft(coreExpenseValueForSource(nextCore)));
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

                  <div style={{ ...subtleTextStyle, fontSize: 13, gridColumn: "1 / span 3" }}>
                    Net annual return: {formatNumber(netAnnualReturnPct, 2)}%
                  </div>
                  <div style={{ ...subtleTextStyle, fontSize: 13, gridColumn: "1 / span 3" }}>
                    Compounding: 12 times a year (monthly)
                  </div>
                </div>

                <div style={{ ...subtleTextStyle, fontSize: 13 }}>
                  Notes: Core expenses are meant to cover necessities (rent, food,
                  utilities; excludes discretionary). Monthly↔daily conversion uses{" "}
                  {formatNumber(DAYS_PER_MONTH, 3)} days/month.
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
              aria-label={breakEvenOpen ? "Collapse break-even framing" : "Expand break-even framing"}
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
                    placeholder={benefitMode === "money" ? "e.g. 200" : "e.g. 3"}
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
                guessed). If you pick “hours”, it converts hours→money using your
                net salary (hourly-equivalent).
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Saved lists</div>
              <button
                type="button"
                aria-label="Close saved lists"
                title="Close"
                onClick={closeSavedListsModal}
                style={savedModalBtn("ghost")}
              >
                <span aria-hidden style={{ fontSize: 20, lineHeight: 1, display: "inline-block" }}>
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
                style={{ width: "100%", boxSizing: "border-box", fontSize: "0.95rem", padding: "0.35rem" }}
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
              <span style={{ fontSize: "0.95rem", opacity: 0.9 }}>Compare to</span>
              <select
                aria-label="Compare to saved expense list"
                value={compareSavedListId}
                onChange={(e) => {
                  setCompareSavedListId(e.target.value);
                  setShowComparePlaceholder(false);
                }}
                style={{ width: "100%", boxSizing: "border-box", fontSize: "0.95rem", padding: "0.35rem" }}
              >
                <option value="">— Select —</option>
                {savedLists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                aria-label="Compare expense lists"
                title="Compare (coming soon)"
                onClick={() => {
                  if (!selectedSavedListId || !compareSavedListId) return;
                  if (selectedSavedListId === compareSavedListId) return;
                  setShowComparePlaceholder(true);
                }}
                disabled={!selectedSavedListId || !compareSavedListId || selectedSavedListId === compareSavedListId}
                style={savedModalBtn(!selectedSavedListId || !compareSavedListId || selectedSavedListId === compareSavedListId ? "disabled" : "ghost")}
              >
                <span aria-hidden style={{ fontSize: 22, lineHeight: 1, display: "inline-block" }}>
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
                style={savedModalBtn(!selectedSavedListId ? "disabled" : "ghost")}
              >
                <span aria-hidden style={{ fontSize: 22, lineHeight: 1, display: "inline-block" }}>
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
                  setItems(nextItems.map((it) => ({ ...it, currency: list.currency })));
                  setNewItemCurrency(list.currency);
                  setShareUrl(null);
                  closeSavedListsModal();
                }}
                disabled={!selectedSavedListId}
                style={savedModalBtn(!selectedSavedListId ? "disabled" : "ghost")}
              >
                <span aria-hidden style={{ fontSize: 22, lineHeight: 1, display: "inline-block" }}>
                  ▶
                </span>
              </button>
              <button
                type="button"
                aria-label="Save expense list"
                title="Save"
                onClick={() => {
                  const selected = selectedSavedListId ? findExpenseListById(selectedSavedListId) : undefined;
                  const name = window.prompt("Expense list name:", selected?.name ?? "");
                  if (!name) return;
                  try {
                    const trimmedLower = name.trim().toLowerCase();
                    const existingByName = listSavedExpenseLists().find(
                      (x) => x.name.trim().toLowerCase() === trimmedLower,
                    );
                    const saved = saveExpenseList(name, displayCurrency, items, existingByName?.id);
                    refreshSavedLists();
                    setSelectedSavedListId(saved.id);
                  } catch (e) {
                    window.alert((e as Error).message || "Failed to save expense list.");
                  }
                }}
                style={savedModalBtn("ghost")}
              >
                <span aria-hidden style={{ fontSize: 22, lineHeight: 1, display: "inline-block" }}>
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
                <span aria-hidden style={{ fontSize: 22, lineHeight: 1, display: "inline-block" }}>
                  🗑
                </span>
              </button>
            </div>

            {showComparePlaceholder ? (
              <div style={{ fontSize: 12, opacity: 0.9 }}>Comparison coming soon.</div>
            ) : null}

            {shareUrl ? (
              <div style={{ marginTop: 6, borderTop: "1px solid #2a2a2a", paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  This link encodes your expense list in the URL (anyone with it can decode them).
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: "0.95rem", opacity: 0.9 }}>Share link</span>
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
