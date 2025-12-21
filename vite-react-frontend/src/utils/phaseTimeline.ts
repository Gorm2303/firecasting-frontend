export function parseIsoDateLocal(isoDate: string): Date | null {
  // Expect YYYY-MM-DD from <input type="date" />
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(isoDate ?? ''));
  if (!m) return null;
  const year = Number(m[1]);
  const month1 = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month1) || !Number.isFinite(day)) return null;
  if (month1 < 1 || month1 > 12) return null;
  if (day < 1 || day > 31) return null;
  return new Date(year, month1 - 1, day);
}

export function addMonthsClamped(date: Date, monthsToAdd: number): Date {
  const d = new Date(date.getTime());
  const months = Math.trunc(Number(monthsToAdd) || 0);
  if (months === 0) return d;

  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);

  const maxDayInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, maxDayInTargetMonth));
  return d;
}

export function getPhaseStartMonth(
  startDateIso: string,
  phaseDurationsInMonths: number[],
  phaseIndex: number
): number | null {
  const start = parseIsoDateLocal(startDateIso);
  if (!start) return null;
  const idx = Math.max(0, Math.trunc(Number(phaseIndex) || 0));
  const offsetMonths = phaseDurationsInMonths
    .slice(0, idx)
    .reduce((sum, m) => sum + (Number(m) || 0), 0);
  const phaseStart = addMonthsClamped(start, offsetMonths);
  return phaseStart.getMonth() + 1; // 1..12
}
