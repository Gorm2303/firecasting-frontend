import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { PurchaseAmountType } from '../lib/moneyPerspective/purchases';

export type SharedExpenseListV1 = {
  v: 1;
  currency: string;
  items: Array<{
    name?: string;
    type: PurchaseAmountType;
    amount: number;
  }>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

const asPurchaseAmountType = (v: unknown): PurchaseAmountType | null =>
  v === 'oneTime' || v === 'weekly' || v === 'monthly' || v === 'yearly' ? v : null;

const normalizeCurrencyDraft = (currency: string): string => {
  const trimmed = currency.trim().toUpperCase();
  return trimmed || 'DKK';
};

export function encodeExpenseListToShareParam(payload: SharedExpenseListV1): string {
  const json = JSON.stringify(payload);
  return `z:${compressToEncodedURIComponent(json)}`;
}

export function decodeExpenseListFromShareParam(param: string): SharedExpenseListV1 | null {
  try {
    const raw = typeof param === 'string' ? param : '';
    const withoutPrefix = raw.startsWith('z:') ? raw.slice(2) : raw;

    const decompressed = decompressFromEncodedURIComponent(withoutPrefix);
    if (typeof decompressed !== 'string' || decompressed.length === 0) return null;

    const parsed = JSON.parse(decompressed) as unknown;
    return normalizeDecodedExpenseList(parsed);
  } catch {
    return null;
  }
}

export function normalizeDecodedExpenseList(decoded: unknown): SharedExpenseListV1 | null {
  if (!isRecord(decoded)) return null;
  const v = decoded.v;
  if (v !== 1) return null;

  const currency = normalizeCurrencyDraft(asString(decoded.currency) ?? 'DKK');
  const itemsRaw = decoded.items;
  const itemsArr = Array.isArray(itemsRaw) ? itemsRaw : [];

  const items = itemsArr
    .map((x): SharedExpenseListV1['items'][number] | null => {
      if (!isRecord(x)) return null;
      const type = asPurchaseAmountType(asString(x.type)) ?? 'oneTime';
      const amountRaw = x.amount;
      const amount = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? amountRaw : 0;
      if (amount < 0) return null;
      const name = asString(x.name) ?? undefined;
      return { name, type, amount };
    })
    .filter((x): x is SharedExpenseListV1['items'][number] => x !== null);

  return { v: 1, currency, items };
}
