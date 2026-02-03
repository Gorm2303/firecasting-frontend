import { describe, expect, it } from 'vitest';
import { backendEpochDayToIsoDate, toIsoDateString } from './backendDate';

const epochDayFromIso1900 = (iso: string): number => {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(iso);
  if (!m) throw new Error(`Bad ISO date: ${iso}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const base = Date.UTC(1900, 0, 1);
  const dt = Date.UTC(y, mo - 1, d);
  return Math.round((dt - base) / (24 * 60 * 60 * 1000));
};

describe('backendDate', () => {
  it('converts backend epochDay using 1900-01-01 base', () => {
    expect(backendEpochDayToIsoDate(0)).toBe('1900-01-01');

    const target = '2027-06-18';
    const epochDay = epochDayFromIso1900(target);
    expect(backendEpochDayToIsoDate(epochDay)).toBe(target);
  });

  it('parses backend Date-like shapes', () => {
    expect(toIsoDateString('2027-06-18')).toBe('2027-06-18');
    expect(toIsoDateString({ date: '2027-06-18' })).toBe('2027-06-18');
    expect(toIsoDateString({ year: 2027, month: 6, dayOfMonth: 18 })).toBe('2027-06-18');

    const epochDay = epochDayFromIso1900('2027-06-18');
    expect(toIsoDateString({ epochDay })).toBe('2027-06-18');
  });
});
