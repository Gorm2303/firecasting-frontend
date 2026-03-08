export type StrategyProfile<T> = {
  id: string;
  name: string;
  data: T;
  savedAt: string;
};

export type StrategyProfileTab = 'depositStrategy' | 'withdrawalStrategy' | 'policyBuilder';

export type StrategyProfileAttachment<T = unknown> = {
  id: string;
  name: string;
  savedAt: string;
  data: T;
};

export type StrategyProfileAttachments = Partial<Record<StrategyProfileTab, StrategyProfileAttachment>>;

export type StrategyProfileState<T> = {
  draft: T;
  draftSavedAt: string | null;
  activeProfileId: string | null;
  profiles: StrategyProfile<T>[];
};

type StrategyProfileTransport<T> = {
  kind: 'firecasting-strategy-profiles';
  version: 1;
  tab: string;
  exportedAt: string;
  state: StrategyProfileState<T>;
};

type RawStrategyProfileState = {
  draft?: unknown;
  draftSavedAt?: unknown;
  activeProfileId?: unknown;
  profiles?: unknown;
};

export const STRATEGY_PROFILE_TABS: StrategyProfileTab[] = ['depositStrategy', 'withdrawalStrategy', 'policyBuilder'];

const strategyProfileStorageKey = (tab: string): string => `firecasting:strategyProfiles:${tab}:v1`;

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const buildProfileId = (): string => `strategy-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const saveStrategyProfileState = <T,>(tab: string, state: StrategyProfileState<T>): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(strategyProfileStorageKey(tab), JSON.stringify(state));
};

const loadRawStrategyProfileState = (tab: string): RawStrategyProfileState | null => {
  if (typeof window === 'undefined') return null;
  const raw = safeParse(window.localStorage.getItem(strategyProfileStorageKey(tab)));
  return raw && typeof raw === 'object' ? (raw as RawStrategyProfileState) : null;
};

const saveRawStrategyProfileState = (tab: string, state: RawStrategyProfileState): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(strategyProfileStorageKey(tab), JSON.stringify(state));
};

const normalizeStrategyProfileState = <T,>(
  raw: unknown,
  fallbackDraft: T,
  normalizeDraft: (value: unknown) => T
): StrategyProfileState<T> => {
  if (!raw || typeof raw !== 'object') {
    return { draft: fallbackDraft, draftSavedAt: null, activeProfileId: null, profiles: [] };
  }

  const maybeTransport = raw as Partial<StrategyProfileTransport<T>>;
  const parsed = (maybeTransport.kind === 'firecasting-strategy-profiles' && maybeTransport.state && typeof maybeTransport.state === 'object'
    ? maybeTransport.state
    : raw) as RawStrategyProfileState;

  const profiles = Array.isArray(parsed.profiles)
    ? parsed.profiles
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const profile = item as Record<string, unknown>;
          return {
            id: isNonEmptyString(profile.id) ? profile.id : buildProfileId(),
            name: isNonEmptyString(profile.name) ? profile.name.trim() : 'Unnamed profile',
            data: normalizeDraft(profile.data),
            savedAt: isNonEmptyString(profile.savedAt) ? profile.savedAt : new Date().toISOString(),
          } satisfies StrategyProfile<T>;
        })
    : [];

  const activeProfileId = isNonEmptyString(parsed.activeProfileId)
    && profiles.some((profile) => profile.id === parsed.activeProfileId)
    ? parsed.activeProfileId
    : null;

  return {
    draft: normalizeDraft(parsed.draft ?? fallbackDraft),
    draftSavedAt: isNonEmptyString(parsed.draftSavedAt) ? parsed.draftSavedAt : null,
    activeProfileId,
    profiles,
  };
};

export const loadStrategyProfileState = <T,>(
  tab: string,
  fallbackDraft: T,
  normalizeDraft: (value: unknown) => T
): StrategyProfileState<T> => {
  if (typeof window === 'undefined') {
    return { draft: fallbackDraft, draftSavedAt: null, activeProfileId: null, profiles: [] };
  }

  const raw = safeParse(window.localStorage.getItem(strategyProfileStorageKey(tab)));
  return normalizeStrategyProfileState(raw, fallbackDraft, normalizeDraft);
};

export const exportStrategyProfilesJson = <T,>(tab: string, state: StrategyProfileState<T>): void => {
  const payload: StrategyProfileTransport<T> = {
    kind: 'firecasting-strategy-profiles',
    version: 1,
    tab,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${tab}-strategy-profiles.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const importStrategyProfilesJson = async <T,>(
  file: File | null,
  fallbackDraft: T,
  normalizeDraft: (value: unknown) => T
): Promise<StrategyProfileState<T> | null> => {
  if (!file) return null;
  const text = await file.text();
  const raw = safeParse(text);
  if (!raw) return null;
  return normalizeStrategyProfileState(raw, fallbackDraft, normalizeDraft);
};

export const captureActiveStrategyProfileAttachments = (): StrategyProfileAttachments | null => {
  const out: StrategyProfileAttachments = {};

  STRATEGY_PROFILE_TABS.forEach((tab) => {
    const state = loadRawStrategyProfileState(tab);
    if (!state || !isNonEmptyString(state.activeProfileId) || !Array.isArray(state.profiles)) return;
    const active = state.profiles.find((item) => {
      const profile = item as Record<string, unknown>;
      return profile && typeof profile === 'object' && profile.id === state.activeProfileId;
    }) as Record<string, unknown> | undefined;
    if (!active || !isNonEmptyString(active.id) || !isNonEmptyString(active.name)) return;

    out[tab] = {
      id: active.id,
      name: active.name.trim(),
      savedAt: isNonEmptyString(active.savedAt) ? active.savedAt : new Date().toISOString(),
      data: active.data,
    };
  });

  return Object.keys(out).length > 0 ? out : null;
};

export const applyStrategyProfileAttachments = (attachments?: StrategyProfileAttachments | null): void => {
  if (typeof window === 'undefined' || !attachments) return;

  STRATEGY_PROFILE_TABS.forEach((tab) => {
    const attachment = attachments[tab];
    if (!attachment) return;

    const current = loadRawStrategyProfileState(tab) ?? {};
    const currentProfiles = Array.isArray(current.profiles) ? current.profiles.filter((item) => item && typeof item === 'object') : [];
    const nextProfile = {
      id: attachment.id,
      name: attachment.name,
      data: attachment.data,
      savedAt: attachment.savedAt,
    };
    const nextProfiles = currentProfiles.some((item) => (item as Record<string, unknown>).id === attachment.id)
      ? currentProfiles.map((item) => ((item as Record<string, unknown>).id === attachment.id ? nextProfile : item))
      : [nextProfile, ...currentProfiles];

    saveRawStrategyProfileState(tab, {
      draft: attachment.data,
      draftSavedAt: attachment.savedAt,
      activeProfileId: attachment.id,
      profiles: nextProfiles,
    });
  });
};

export const persistStrategyDraft = <T,>(state: StrategyProfileState<T>, draft: T): StrategyProfileState<T> => ({
  ...state,
  draft,
  draftSavedAt: new Date().toISOString(),
});

export const clearStrategyDraft = <T,>(state: StrategyProfileState<T>, emptyDraft: T): StrategyProfileState<T> => ({
  ...state,
  draft: emptyDraft,
  draftSavedAt: null,
  activeProfileId: null,
});

export const saveStrategyProfile = <T,>(
  state: StrategyProfileState<T>,
  input: { id?: string | null; name: string; data: T }
): StrategyProfileState<T> => {
  const trimmedName = input.name.trim();
  if (!trimmedName) return state;

  const savedAt = new Date().toISOString();
  const nextId = input.id && state.profiles.some((profile) => profile.id === input.id) ? input.id : buildProfileId();
  const nextProfile: StrategyProfile<T> = {
    id: nextId,
    name: trimmedName,
    data: input.data,
    savedAt,
  };

  const nextProfiles = state.profiles.some((profile) => profile.id === nextId)
    ? state.profiles.map((profile) => (profile.id === nextId ? nextProfile : profile))
    : [nextProfile, ...state.profiles];

  return {
    draft: input.data,
    draftSavedAt: savedAt,
    activeProfileId: nextId,
    profiles: nextProfiles,
  };
};

export const applyStrategyProfile = <T,>(state: StrategyProfileState<T>, profileId: string): StrategyProfileState<T> => {
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile) return state;
  return {
    ...state,
    draft: profile.data,
    draftSavedAt: profile.savedAt,
    activeProfileId: profile.id,
  };
};

export const deleteStrategyProfile = <T,>(state: StrategyProfileState<T>, profileId: string): StrategyProfileState<T> => {
  const nextProfiles = state.profiles.filter((profile) => profile.id !== profileId);
  return {
    ...state,
    profiles: nextProfiles,
    activeProfileId: state.activeProfileId === profileId ? null : state.activeProfileId,
  };
};