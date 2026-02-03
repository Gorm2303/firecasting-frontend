export type BackendDateLike =
  | string
  | { date?: string; year?: number; month?: number; dayOfMonth?: number; epochDay?: number }
  | null
  | undefined;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Backend `dk.gormkrings.simulation.data.Date` uses epochDay = days since 1900-01-01.
 */
export function backendEpochDayToIsoDate(epochDay: number): string | null {
  if (!Number.isFinite(epochDay)) return null;
  const base = Date.UTC(1900, 0, 1);
  const dt = new Date(base + Math.trunc(epochDay) * MS_PER_DAY);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

export function toIsoDateString(v: BackendDateLike): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v?.date === 'string') return v.date;

  // Backend may persist/echo LocalDate-like objects.
  const y = Number((v as any)?.year);
  const m = Number((v as any)?.month);
  const d = Number((v as any)?.dayOfMonth);
  if (
    Number.isFinite(y) &&
    Number.isFinite(m) &&
    Number.isFinite(d) &&
    y > 0 &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= 31
  ) {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  const epochDay = Number((v as any)?.epochDay);
  if (Number.isFinite(epochDay)) {
    return backendEpochDayToIsoDate(epochDay);
  }

  return null;
}
