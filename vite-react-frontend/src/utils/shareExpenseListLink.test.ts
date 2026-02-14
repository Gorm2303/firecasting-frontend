import { describe, expect, it } from 'vitest';
import { decodeExpenseListFromShareParam, encodeExpenseListToShareParam } from './shareExpenseListLink';

describe('shareExpenseListLink', () => {
  it('roundtrips an expense list', () => {
    const encoded = encodeExpenseListToShareParam({
      v: 1,
      currency: 'dkk',
      items: [
        { name: 'Coffee', type: 'weekly', amount: 50 },
        { name: 'Laptop', type: 'oneTime', amount: 2000 },
      ],
    });

    expect(encoded).toMatch(/^z:/);

    const decoded = decodeExpenseListFromShareParam(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.currency).toBe('DKK');
    expect(decoded?.items.length).toBe(2);
    expect(decoded?.items[0]?.type).toBe('weekly');
  });

  it('returns null for invalid input', () => {
    expect(decodeExpenseListFromShareParam('z:')).toBeNull();
    expect(decodeExpenseListFromShareParam('not-a-real-share-param')).toBeNull();
  });
});
