import { describe, expect, it } from 'vitest';
import { futureValueNominalRecurringMonthly } from './calculations';
import {
  futureValueNominalForPurchaseItem,
  futureValueNominalTotalForItems,
  purchaseMonthlyEquivalent,
  purchaseYearlyEquivalent,
} from './purchases';

describe('moneyPerspective/purchases', () => {
  it('converts purchase amounts to monthly/yearly equivalents', () => {
    expect(purchaseMonthlyEquivalent(10, 'daily')).toBeCloseTo(10 * (365 / 12), 10);
    expect(purchaseMonthlyEquivalent(1200, 'yearly')).toBeCloseTo(100, 12);
    expect(purchaseMonthlyEquivalent(100, 'weekly')).toBeCloseTo((100 * 52) / 12, 12);

    expect(purchaseYearlyEquivalent(10, 'daily')).toBe(3650);
    expect(purchaseYearlyEquivalent(100, 'monthly')).toBe(1200);
    expect(purchaseYearlyEquivalent(100, 'weekly')).toBe(5200);
  });

  it('computes FV for one-time purchase (grows with years)', () => {
    const fv0 = futureValueNominalForPurchaseItem({ amount: 2000, type: 'oneTime' }, 5, 0, 0);
    const fv5 = futureValueNominalForPurchaseItem({ amount: 2000, type: 'oneTime' }, 5, 5, 0);
    const fv10 = futureValueNominalForPurchaseItem({ amount: 2000, type: 'oneTime' }, 5, 10, 0);

    expect(fv0).toBe(2000);
    expect(fv5).not.toBeNull();
    expect(fv10).not.toBeNull();
    expect(fv10 as number).toBeGreaterThan(fv5 as number);
  });

  it('computes FV for recurring purchases via monthly equivalent', () => {
    const fvMonthly = futureValueNominalForPurchaseItem({ amount: 100, type: 'monthly' }, 6, 10, 0);
    const fvYearly = futureValueNominalForPurchaseItem({ amount: 1200, type: 'yearly' }, 6, 10, 0);

    // yearly 1200 == monthly 100
    expect(fvMonthly).not.toBeNull();
    expect(fvYearly).not.toBeNull();
    expect(fvYearly as number).toBeCloseTo(fvMonthly as number, 6);

    const fvWeekly = futureValueNominalForPurchaseItem({ amount: 100, type: 'weekly' }, 6, 10, 0);
    const expectedWeekly = futureValueNominalRecurringMonthly((100 * 52) / 12, 6, 10, 0);
    expect(fvWeekly).not.toBeNull();
    expect(expectedWeekly).not.toBeNull();
    expect(fvWeekly as number).toBeCloseTo(expectedWeekly as number, 10);
  });

  it('sums FV across multiple items', () => {
    const total = futureValueNominalTotalForItems(
      [
        { amount: 2000, type: 'oneTime' },
        { amount: 100, type: 'monthly' },
      ],
      6,
      10,
      0,
    );

    const a = futureValueNominalForPurchaseItem({ amount: 2000, type: 'oneTime' }, 6, 10, 0);
    const b = futureValueNominalForPurchaseItem({ amount: 100, type: 'monthly' }, 6, 10, 0);

    expect(total).not.toBeNull();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(total as number).toBeCloseTo((a as number) + (b as number), 10);
  });

  it('returns null for invalid inputs (edge cases)', () => {
    expect(futureValueNominalForPurchaseItem({ amount: 0, type: 'oneTime' }, 6, 10, 0)).toBeNull();
    expect(futureValueNominalForPurchaseItem({ amount: 100, type: 'monthly' }, 6, -1, 0)).toBeNull();
  });
});
