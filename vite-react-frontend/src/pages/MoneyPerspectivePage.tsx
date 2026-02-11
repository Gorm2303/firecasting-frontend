import React, { useEffect, useMemo, useRef, useState } from "react";
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
  futureValueNominal,
  futureValueNominalRecurringMonthly,
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

const formatCurrency = (value: number, currency: string): string => {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${safe.toFixed(2)} ${currency}`;
  }
};

const formatNumber = (value: number, digits = 2): string => {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const toDraft = (value: number): string => {
  if (!Number.isFinite(value)) return "";
  return String(value);
};

type MonthlyBenefitMode = "money" | "hours";

type PurchaseAmountType = "oneTime" | "weekly" | "monthly" | "yearly";

const HORIZON_TABLE_YEARS: number[] = Array.from(
  { length: 10 },
  (_, i) => (i + 1) * 5,
); // 5..50

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

const toDraftFixed1 = (value: number): string => {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(1);
};

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

function purchaseMonthlyEquivalent(
  amount: number,
  purchaseType: PurchaseAmountType,
): number {
  switch (purchaseType) {
    case "oneTime":
      return amount;
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
  }
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

type EditAssumptionsProps = {
  settings: MoneyPerspectiveSettingsV3;
  setSettings: React.Dispatch<React.SetStateAction<MoneyPerspectiveSettingsV3>>;
  controlStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
};

const EditAssumptions: React.FC<EditAssumptionsProps> = ({
  settings,
  setSettings,
  controlStyle,
  labelStyle,
}) => {
  const [open, setOpen] = useState(false);
  const compensationValue = settings.compensation.amount;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <button
        type="button"
        style={{ ...btn(), justifySelf: "start" }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide assumptions" : "Edit assumptions"}
      </button>

      {open ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px minmax(0, 120px) minmax(0, 1fr)",
                gap: 10,
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <div style={labelStyle}>Net salary</div>
              <select
                value={settings.compensation.period}
                onChange={(e) => {
                  const next = e.target.value as MoneyPerspectiveSalaryPeriod;
                  setSettings((s) => {
                    const current = s.compensation;
                    if (next === current.period) return s;

                    const effectiveHourly =
                      effectiveHourlyFromSalarySettings(current);
                    if (effectiveHourly == null)
                      return {
                        ...s,
                        compensation: { ...current, period: next },
                      };

                    const hours =
                      current.workingHoursPerMonth > 0
                        ? current.workingHoursPerMonth
                        : 160;
                    const amount = salaryAmountFromEffectiveHourly(
                      effectiveHourly,
                      hours,
                      next,
                    );
                    return {
                      ...s,
                      compensation: {
                        ...current,
                        workingHoursPerMonth: hours,
                        period: next,
                        amount,
                      },
                    };
                  });
                }}
                style={{ ...controlStyle, width: "100%", minWidth: 0 }}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                value={toDraftFixed1(compensationValue)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!isValidDecimalDraft(v)) return;
                  const n = roundTo1Decimal(draftToNumberOrZero(v));
                  setSettings((s) => ({
                    ...s,
                    compensation: { ...s.compensation, amount: n },
                  }));
                }}
                inputMode="decimal"
                style={{ ...controlStyle, width: "100%", minWidth: 0 }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 10,
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <div style={labelStyle}>Core expenses</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 180px)",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <input
                  value={toDraftFixed1(
                    coreExpenseValueForSource(settings.coreExpenses),
                  )}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!isValidDecimalDraft(v)) return;
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
                  style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                />
                <select
                  value={settings.coreExpenses.source}
                  onChange={(e) => {
                    const next = e.target
                      .value as MoneyPerspectiveSettingsV3["coreExpenses"]["source"];
                    setSettings((s) => {
                      const daily = dailyCoreExpenseFromSettings(
                        s.coreExpenses,
                      );
                      if (daily == null)
                        return {
                          ...s,
                          coreExpenses: { ...s.coreExpenses, source: next },
                        };
                      return {
                        ...s,
                        coreExpenses: setCoreExpenseFromDaily(
                          s.coreExpenses,
                          next,
                          daily,
                        ),
                      };
                    });
                  }}
                  style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 10,
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <div style={labelStyle}>Expected annual return (%)</div>
              <input
                value={toDraft(settings.investing.annualReturnPct)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!isValidDecimalDraft(v)) return;
                  setSettings((s) => ({
                    ...s,
                    investing: {
                      ...s.investing,
                      annualReturnPct: draftToNumberOrZero(v),
                    },
                  }));
                }}
                inputMode="decimal"
                style={{ ...controlStyle, width: "100%", minWidth: 0 }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 10,
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <div style={labelStyle}>Inflation (%)</div>
              <input
                value={toDraft(settings.investing.inflationPct)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!isValidDecimalDraft(v)) return;
                  setSettings((s) => ({
                    ...s,
                    investing: {
                      ...s.investing,
                      inflationPct: draftToNumberOrZero(v),
                    },
                  }));
                }}
                inputMode="decimal"
                style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                placeholder="e.g. 2"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 10,
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <div style={labelStyle}>Fee drag (%)</div>
              <input
                value={toDraft(settings.investing.feeDragPct)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!isValidDecimalDraft(v)) return;
                  setSettings((s) => ({
                    ...s,
                    investing: {
                      ...s.investing,
                      feeDragPct: draftToNumberOrZero(v),
                    },
                  }));
                }}
                inputMode="decimal"
                style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                placeholder="e.g. 0.5"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

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

  const [newItemName, setNewItemName] = useState<string>(
    () => initialDraft?.newItemName ?? "",
  );
  const [newItemType, setNewItemType] = useState<PurchaseAmountType>(
    () => initialDraft?.newItemType ?? "oneTime",
  );
  const [newItemAmountDraft, setNewItemAmountDraft] = useState<string>(
    () => initialDraft?.newItemAmountDraft ?? "",
  );
  const [newItemCurrency, setNewItemCurrency] = useState<string>(
    () => normalizeCurrencyDraft(initialDraft?.newItemCurrency ?? settings.currency),
  );
  const [items, setItems] = useState<PurchaseItem[]>(
    () => initialDraft?.items ?? [],
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
    if (!isValidDecimalDraft(newItemAmountDraft)) return;
    const amount = draftToNumberOrZero(newItemAmountDraft);
    if (!(amount > 0)) return;

    const listCurrency =
      items.length > 0
        ? normalizeCurrencyDraft(items[0].currency)
        : normalizeCurrencyDraft(newItemCurrency);
    const name = newItemName.trim() ? newItemName.trim() : undefined;
    const id = newId();

    setItems((current) => [
      ...current,
      { id, name, type: newItemType, amount, currency: listCurrency },
    ]);
    setItemAmountDrafts((prev) => ({ ...prev, [id]: toDraft(amount) }));
    setNewItemName("");
    setNewItemAmountDraft("");
    setNewItemCurrency(listCurrency);
  };

  const prefillAppliedRef = useRef(false);
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;

    // Supports prefill when launched from another view:
    // /money-perspective?amount=5000&currency=DKK&type=oneTime
    const amountRaw = searchParams.get("amount");
    const currencyRaw = searchParams.get("currency");
    const typeRaw = searchParams.get("type");

    if (currencyRaw && currencyRaw.trim())
      setNewItemCurrency(normalizeCurrencyDraft(currencyRaw));
    const parsedType = typeRaw ? asPurchaseAmountType(typeRaw.trim()) : null;
    if (parsedType) setNewItemType(parsedType);
    if (amountRaw && isValidDecimalDraft(amountRaw)) {
      const parsed = draftToNumberOrZero(amountRaw);
      if (parsed > 0) {
        setNewItemAmountDraft(toDraft(parsed));
        // If the list is empty, also prefill by adding the item immediately.
        setItems((current) => {
          if (current.length > 0) return current;
          const currency = normalizeCurrencyDraft(currencyRaw ?? newItemCurrency);
          const type = parsedType ?? "oneTime";
          return [{ id: newId(), name: undefined, type, amount: parsed, currency }];
        });
      }
    }
  }, [searchParams]);

  const [benefitMode, setBenefitMode] = useState<MonthlyBenefitMode>(
    () => initialDraft?.benefitMode ?? "money",
  );
  const [monthlyBenefitDraft, setMonthlyBenefitDraft] = useState<string>(
    () => initialDraft?.monthlyBenefitDraft ?? "",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft: PageDraftV3 = {
      version: 3,
      newItemName,
      newItemType,
      newItemAmountDraft,
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
    newItemAmountDraft,
    newItemCurrency,
    newItemName,
    newItemType,
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
    const amount = year0Cost;
    const hourly = effectiveHourlyRate;
    const workHrs = hourly ? workHours(amount, hourly) : null;
    return { workHrs };
  }, [effectiveHourlyRate, year0Cost]);

  const horizonTable = useMemo(() => {
    const daily = dailyCoreExpense;
    if (year0Cost <= 0)
      return [] as Array<{
        years: number;
        fvNominal: number | null;
        fvReal: number | null;
        runwayDays: number | null;
      }>;

    const row0 = {
      years: 0,
      fvNominal: year0Cost,
      fvReal: year0Cost,
      runwayDays: daily ? coreExpenseDays(year0Cost, daily) : null,
    };

    const futureRows = HORIZON_TABLE_YEARS.map((years) => {
      let fvNominalTotal = 0;
      for (const it of itemsWithAmount) {
        if (it.type === "oneTime") {
          const fv = futureValueNominal(
            it.amount,
            settings.investing.annualReturnPct,
            12,
            years,
            settings.investing.feeDragPct,
          );
          if (fv == null) return { years, fvNominal: null, fvReal: null, runwayDays: null };
          fvNominalTotal += fv;
          continue;
        }

        const initial = futureValueNominal(
          it.amount,
          settings.investing.annualReturnPct,
          12,
          years,
          settings.investing.feeDragPct,
        );
        const monthlyEq = purchaseMonthlyEquivalent(it.amount, it.type);
        const recurring = futureValueNominalRecurringMonthly(
          monthlyEq,
          settings.investing.annualReturnPct,
          years,
          settings.investing.feeDragPct,
        );
        if (initial == null || recurring == null) return { years, fvNominal: null, fvReal: null, runwayDays: null };
        fvNominalTotal += initial + recurring;
      }

      const fvNominal = fvNominalTotal;

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

    return [row0, ...futureRows];
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
    if (year0Cost <= 0) return null;
    if (monthlyBenefitMoney == null) return null;
    const upfront = itemsWithAmount
      .filter((it) => it.type === "oneTime")
      .reduce((sum, it) => sum + it.amount, 0);
    const recurringMonthly = itemsWithAmount
      .filter((it) => it.type !== "oneTime")
      .reduce((sum, it) => sum + purchaseMonthlyEquivalent(it.amount, it.type), 0);
    const costForBreakEven = upfront + recurringMonthly;
    return breakEvenMonths(costForBreakEven, monthlyBenefitMoney);
  }, [itemsWithAmount, monthlyBenefitMoney, year0Cost]);

  const showMissingPurchase = year0Cost <= 0;

  const assumptionsSummaryRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];

    rows.push({
      label: "Expense list (year 0)",
      value:
        year0Cost > 0
          ? `${formatCurrency(year0Cost, displayCurrency)} (${itemsWithAmount.length} item${itemsWithAmount.length === 1 ? "" : "s"})`
          : "Missing",
    });

    if (effectiveHourlyRate != null) {
      const salaryLabel =
        settings.compensation.period === "hourly"
          ? `${formatCurrency(settings.compensation.amount, displayCurrency)} / hour`
          : `${formatCurrency(settings.compensation.amount, displayCurrency)} / ${settings.compensation.period}`;
      rows.push({ label: "Net salary", value: salaryLabel });
    } else {
      rows.push({ label: "Net salary", value: "Missing" });
    }

    if (dailyCoreExpense != null) {
      rows.push({
        label: "Core expenses (daily)",
        value: formatCurrency(dailyCoreExpense, displayCurrency),
      });
    } else {
      rows.push({ label: "Core expenses (daily)", value: "Missing" });
    }

    rows.push({
      label: "Expected annual return",
      value: `${formatNumber(settings.investing.annualReturnPct, 2)}%`,
    });
    rows.push({
      label: "Fee drag",
      value: `${formatNumber(settings.investing.feeDragPct, 2)}%`,
    });
    rows.push({
      label: "Net annual return",
      value: `${formatNumber(netAnnualReturnPct, 2)}%`,
    });
    rows.push({
      label: "Inflation",
      value: `${formatNumber(settings.investing.inflationPct, 2)}%`,
    });
    rows.push({ label: "Compounding", value: "12 times a year (monthly)" });

    return rows;
  }, [
    dailyCoreExpense,
    displayCurrency,
    effectiveHourlyRate,
    itemsWithAmount.length,
    netAnnualReturnPct,
    settings.investing.annualReturnPct,
    settings.investing.feeDragPct,
    settings.investing.inflationPct,
    settings.compensation.amount,
    settings.compensation.period,
    year0Cost,
  ]);

  return (
    <PageLayout variant="constrained" maxWidthPx={500}>
      <h1 style={{ textAlign: "center", fontSize: 34 }}>
        Money Perspectivator
      </h1>

      <div style={{ display: "grid", gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Expense list</div>

          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: 10,
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <div style={labelStyle}>Name</div>
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Optional"
                  style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                  aria-label="Expense name"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: 10,
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <div style={labelStyle}>Type</div>
                <select
                  value={newItemType}
                  onChange={(e) =>
                    setNewItemType(e.target.value as PurchaseAmountType)
                  }
                  style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                  aria-label="Expense type"
                >
                  <option value="oneTime">One time</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: 10,
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <div style={labelStyle}>Amount</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 110px",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <input
                    value={newItemAmountDraft}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!isValidDecimalDraft(next)) return;
                      setNewItemAmountDraft(next);
                    }}
                    placeholder="e.g. 1999.9"
                    inputMode="decimal"
                    style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                    aria-label="Expense amount"
                  />
                  <input
                    value={normalizeCurrencyDraft(
                      items.length > 0 ? items[0].currency : newItemCurrency,
                    )}
                    onChange={(e) => setCurrencyForAllItems(e.target.value)}
                    placeholder="DKK"
                    style={{ ...controlStyle, width: "100%", minWidth: 0 }}
                    aria-label="Currency (ISO 4217)"
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div />
                <button
                  type="button"
                  style={{ ...btn(), justifySelf: "start" }}
                  onClick={addItem}
                >
                  Add item
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div style={{ ...subtleTextStyle, fontSize: 13 }}>
                Add one or more items to calculate work time, runway, and future
                value.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
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
                        Name
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      >
                        Type
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      >
                        Amount
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      >
                        Currency
                      </th>
                      <th
                        style={{
                          width: 44,
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--fc-subtle-border)",
                        }}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td
                          style={{
                            padding: "6px 8px",
                            borderBottom:
                              "1px solid var(--fc-subtle-border)",
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
                            placeholder=""
                            style={{
                              ...controlStyle,
                              height: 34,
                              fontSize: 14,
                              width: "100%",
                              minWidth: 0,
                            }}
                            aria-label={`Name for item ${it.id}`}
                          />
                        </td>
                        <td
                          style={{
                            padding: "6px 8px",
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
                            padding: "6px 8px",
                            borderBottom:
                              "1px solid var(--fc-subtle-border)",
                            textAlign: "right",
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
                              ...controlStyle,
                              height: 34,
                              fontSize: 14,
                              width: "100%",
                              minWidth: 0,
                              textAlign: "right",
                            }}
                            aria-label={`Amount for item ${it.id}`}
                          />
                        </td>
                        <td
                          style={{
                            padding: "6px 8px",
                            borderBottom:
                              "1px solid var(--fc-subtle-border)",
                          }}
                        >
                          <input
                            value={displayCurrency}
                            onChange={(e) =>
                              setCurrencyForAllItems(e.target.value)
                            }
                            placeholder="DKK"
                            style={{
                              ...controlStyle,
                              height: 34,
                              fontSize: 14,
                              width: "100%",
                              minWidth: 0,
                            }}
                            aria-label={`Currency for item ${it.id}`}
                          />
                        </td>
                        <td
                          style={{
                            padding: "6px 8px",
                            borderBottom:
                              "1px solid var(--fc-subtle-border)",
                            textAlign: "center",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setItems((current) =>
                                current.filter((x) => x.id !== it.id),
                              )
                            }
                            style={{
                              ...btn(),
                              height: 34,
                              width: 34,
                              padding: 0,
                              borderRadius: 8,
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
            )}
          </div>

          <div style={{ ...subtleTextStyle, fontSize: 13, marginTop: 12 }}>
            Tip: you can prefill via{" "}
            <span style={{ fontFamily: "monospace" }}>
              /money-perspective?amount=5000&amp;currency=DKK&amp;type=oneTime
            </span>
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
            <div style={{ fontWeight: 900, fontSize: 22 }}>Assumptions</div>
            <button
              type="button"
              style={btn()}
              onClick={() => setSettings(defaultMoneyPerspectiveSettings())}
              aria-label="Reset assumptions to defaults"
            >
              Reset defaults
            </button>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              {assumptionsSummaryRows.map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "230px auto",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontWeight: 600 }}>{r.value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--fc-subtle-border)",
                paddingTop: 12,
                display: "grid",
                gap: 12,
              }}
            >
              <EditAssumptions
                settings={settings}
                setSettings={setSettings}
                controlStyle={controlStyle}
                labelStyle={labelStyle}
              />
            </div>
          </div>

          <div style={{ ...subtleTextStyle, fontSize: 13, marginTop: 12 }}>
            Notes: Core expenses are meant to cover necessities (rent, food,
            utilities; excludes discretionary). Monthly↔daily conversion uses{" "}
            {formatNumber(DAYS_PER_MONTH, 3)} days/month.
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
                <div style={{ fontWeight: 800 }}>Work time equivalent</div>
                {showMissingPurchase ? (
                  <div style={subtleTextStyle}>Missing</div>
                ) : effectiveHourlyRate == null ? (
                  <div style={subtleTextStyle}>Missing</div>
                ) : (
                  <div style={{ fontWeight: 900, fontSize: 22 }}>
                    {formatNumber(results.workHrs ?? 0, 2)} hours
                  </div>
                )}
              </div>
              {showMissingPurchase ? (
                <div style={subtleTextStyle}>Missing purchase amount.</div>
              ) : effectiveHourlyRate == null ? (
                <div style={subtleTextStyle}>
                  Set net salary to compute work time equivalent.
                </div>
              ) : null}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--fc-subtle-border)",
                paddingTop: 10,
              }}
            >
              <div style={{ fontWeight: 900 }}>Every 5 years (0–50)</div>

              {showMissingPurchase ? (
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  Enter a purchase amount to show the horizon table.
                </div>
              ) : (
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
                          Future value (nominal)
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "6px 8px",
                            borderBottom: "1px solid var(--fc-subtle-border)",
                          }}
                        >
                          Future value (real)
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "6px 8px",
                            borderBottom: "1px solid var(--fc-subtle-border)",
                          }}
                        >
                          Runway (days)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {horizonTable.map((r) => (
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
                            {r.fvNominal != null
                              ? formatCurrency(r.fvNominal, displayCurrency)
                              : "—"}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              padding: "6px 8px",
                              borderBottom: "1px solid var(--fc-subtle-border)",
                            }}
                          >
                            {r.fvReal != null
                              ? formatCurrency(r.fvReal, displayCurrency)
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
                              : r.runwayDays != null
                                ? formatNumber(r.runwayDays, 2)
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
              )}
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
          <div style={{ fontWeight: 900, fontSize: 22 }}>
            Break-even framing
          </div>

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
              {showMissingPurchase ? (
                <div style={subtleTextStyle}>Add at least one expense item.</div>
              ) : monthlyBenefitMoney == null ? (
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
        </div>

        <div style={{ ...cardStyle, ...subtleTextStyle, fontSize: 13 }}>
          Informational only. Returns are assumptions. This does not constitute
          financial advice.
        </div>
      </div>
    </PageLayout>
  );
};

export default MoneyPerspectivePage;
