const STORAGE_KEY = 'firecasting:localUserId:v1';

const randomId = (): string => {
  try {
    // Modern browsers
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* ignore */
  }

  // Fallback
  return `u_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
};

export const getOrCreateLocalUserId = (): string => {
  if (typeof window === 'undefined') return 'server';

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.trim()) return existing;

    const created = randomId();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // If localStorage is blocked, fall back to per-session id.
    return randomId();
  }
};
