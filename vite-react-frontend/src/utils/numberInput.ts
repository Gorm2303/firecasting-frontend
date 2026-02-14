export const parseLocaleNumber = (raw: string): number => {
  const s0 = String(raw ?? '').trim();
  if (!s0) return Number.NaN;

  // Remove whitespace (including NBSP) used as thousand separators in some locales.
  let s = s0.replace(/[\s\u00A0]/g, '');

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const hasDot = lastDot !== -1;
  const hasComma = lastComma !== -1;

  // If both exist, treat whichever appears last as the decimal separator and
  // strip the other as a thousands separator.
  if (hasDot && hasComma) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandSep = decimalSep === '.' ? ',' : '.';
    s = s.split(thousandSep).join('');
    if (decimalSep === ',') s = s.replace(',', '.');
    return Number(s);
  }

  // Only comma: treat as decimal separator.
  if (hasComma && !hasDot) {
    s = s.replace(',', '.');
    return Number(s);
  }

  // Only dot (or neither): Number() can handle it.
  return Number(s);
};

// Allows: "", "1", "1.", "1,", "1.2", "1,2", ".2", ",2"
export const isValidDecimalDraft = (raw: string): boolean => {
  const s = String(raw ?? '').trim();
  return /^(?:\d+(?:[.,]\d*)?|[.,]\d*)?$/.test(s);
};

// Allows: "", "0", "123"
export const isValidIntegerDraft = (raw: string): boolean => {
  const s = String(raw ?? '').trim();
  return /^\d*$/.test(s);
};

export const draftToNumberOrZero = (raw: string): number => {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  const n = parseLocaleNumber(s);
  return Number.isFinite(n) ? n : 0;
};

export const draftToIntOrZero = (raw: string): number => {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  // Integer-only: tolerate users typing decimals by parsing locale number then truncating.
  const n = parseLocaleNumber(s);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
};
