export type AssumptionsGovernance = {
  sourceNote: string;
  lockBaseline: boolean;
  updatedAt: string;
};

const STORAGE_KEY_V1 = 'firecasting:assumptionsGovernance:v1';

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalize = (raw: unknown): AssumptionsGovernance => {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    sourceNote: typeof obj.sourceNote === 'string' ? obj.sourceNote : '',
    lockBaseline: Boolean(obj.lockBaseline),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : '',
  };
};

export const loadAssumptionsGovernance = (): AssumptionsGovernance => {
  if (typeof window === 'undefined') {
    return { sourceNote: '', lockBaseline: false, updatedAt: '' };
  }

  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY_V1));
  return normalize(raw);
};

export const saveAssumptionsGovernance = (next: AssumptionsGovernance): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(next));
  } catch {
    /* ignore */
  }
};
