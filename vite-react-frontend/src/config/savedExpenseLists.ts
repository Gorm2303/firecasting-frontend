import type { PurchaseAmountType } from '../lib/moneyPerspective/purchases';

export type ExpenseListItem = {
  id: string;
  name?: string;
  type: PurchaseAmountType;
  amount: number;
  currency: string;
};

export type SavedExpenseList = {
  id: string;
  name: string;
  savedAt: string;
  currency: string;
  items: ExpenseListItem[];
};

const STORAGE_KEY = 'firecasting:moneyPerspective:savedExpenseLists:v1';

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null;
  if (Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function asPurchaseAmountType(v: unknown): PurchaseAmountType | null {
  return v === 'oneTime' || v === 'weekly' || v === 'monthly' || v === 'yearly' ? v : null;
}

function normalizeCurrencyDraft(currency: string): string {
  const trimmed = currency.trim().toUpperCase();
  return trimmed || 'DKK';
}

function newId(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asExpenseListItems(v: unknown): ExpenseListItem[] {
  if (!Array.isArray(v)) return [];
  const out: ExpenseListItem[] = [];
  for (const raw of v) {
    const r = asRecord(raw);
    if (!r) continue;
    const id = asString(r.id) ?? newId();
    const type = asPurchaseAmountType(asString(r.type)) ?? 'oneTime';
    const currency = normalizeCurrencyDraft(asString(r.currency) ?? 'DKK');
    const amountRaw = r.amount;
    const amount = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? amountRaw : 0;
    // Allow 0 amounts (represents an "empty" list).
    if (amount < 0) continue;
    const name = asString(r.name) ?? undefined;
    out.push({ id, name, type, amount, currency });
  }
  return out;
}

export function listSavedExpenseLists(): SavedExpenseList[] {
  if (typeof window === 'undefined') return [];
  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(raw)) return [];

  return raw
    .map((x) => x as SavedExpenseList)
    .filter((x) => !!x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.savedAt === 'string' && Array.isArray((x as any).items));
}

export function saveExpenseList(name: string, currency: string, items: ExpenseListItem[], id?: string): SavedExpenseList {
  if (typeof window === 'undefined') throw new Error('Cannot save expense list outside browser');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Expense list name is required');

  const lists = listSavedExpenseLists();
  const now = new Date().toISOString();
  const normalizedCurrency = normalizeCurrencyDraft(currency);

  // Normalize items (keep only safe fields).
  const normalizedItems = asExpenseListItems(items);

  const entry: SavedExpenseList = {
    id: id ?? newId(),
    name: trimmed,
    savedAt: now,
    currency: normalizedCurrency,
    items: normalizedItems.map((it) => ({ ...it, currency: normalizedCurrency })),
  };

  const withoutSameId = lists.filter((x) => x.id !== entry.id);
  const next = [entry, ...withoutSameId].slice(0, 50);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return entry;
}

export function deleteExpenseList(id: string): void {
  if (typeof window === 'undefined') return;
  const lists = listSavedExpenseLists();
  const next = lists.filter((x) => x.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function findExpenseListById(id: string): SavedExpenseList | undefined {
  return listSavedExpenseLists().find((x) => x.id === id);
}

export function normalizeSavedExpenseList(raw: unknown): SavedExpenseList | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = asString(r.id);
  const name = asString(r.name);
  const savedAt = asString(r.savedAt) ?? new Date().toISOString();
  if (!id || !name) return null;
  const currency = normalizeCurrencyDraft(asString(r.currency) ?? 'DKK');
  const items = asExpenseListItems(r.items);
  return {
    id,
    name,
    savedAt,
    currency,
    items: items.map((it) => ({ ...it, currency })),
  };
}
