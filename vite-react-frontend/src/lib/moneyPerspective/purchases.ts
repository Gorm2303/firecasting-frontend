import { futureValueNominal, futureValueNominalRecurringMonthly } from './calculations';

export type PurchaseAmountType = 'oneTime' | 'weekly' | 'monthly' | 'yearly';

export type PurchaseAmountItem = {
  amount: number;
  type: PurchaseAmountType;
};

export function purchaseMonthlyEquivalent(amount: number, purchaseType: PurchaseAmountType): number {
  switch (purchaseType) {
    case 'oneTime':
      return amount;
    case 'weekly':
      return (amount * 52) / 12;
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / 12;
  }
}

export function purchaseYearlyEquivalent(amount: number, purchaseType: PurchaseAmountType): number {
  switch (purchaseType) {
    case 'oneTime':
      return amount;
    case 'weekly':
      return amount * 52;
    case 'monthly':
      return amount * 12;
    case 'yearly':
      return amount;
  }
}

export function futureValueNominalForPurchaseItem(
  item: PurchaseAmountItem,
  annualReturnPct: number,
  years: number,
  feeDragPct?: number | null,
): number | null {
  if (!(typeof years === 'number' && Number.isFinite(years) && years >= 0)) return null;
  if (!(typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount > 0)) return null;

  if (item.type === 'oneTime') {
    if (years === 0) return item.amount;
    // Keep compounding consistent with recurring contributions: monthly compounding.
    return futureValueNominal(item.amount, annualReturnPct, 12, years, feeDragPct);
  }

  const monthly = purchaseMonthlyEquivalent(item.amount, item.type);
  return futureValueNominalRecurringMonthly(monthly, annualReturnPct, years, feeDragPct);
}

export function futureValueNominalTotalForItems(
  items: PurchaseAmountItem[],
  annualReturnPct: number,
  years: number,
  feeDragPct?: number | null,
): number | null {
  let total = 0;
  for (const item of items) {
    const fv = futureValueNominalForPurchaseItem(item, annualReturnPct, years, feeDragPct);
    if (fv == null) return null;
    total += fv;
  }
  return total;
}
