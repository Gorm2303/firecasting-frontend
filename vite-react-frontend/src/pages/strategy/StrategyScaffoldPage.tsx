import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageLayout from '../../components/PageLayout';
import { useAssumptions } from '../../state/assumptions';
import {
  ASSUMPTIONS_TAB_LABELS,
  filterUsedByForAssumptionsHub,
  listStrategyRegistryItems,
  type AssumptionsTabId,
} from '../../state/assumptionsRegistry';
import {
  applyStrategyProfile,
  clearStrategyDraft,
  deleteStrategyProfile,
  exportStrategyProfilesJson,
  importStrategyProfilesJson,
  loadStrategyProfileState,
  persistStrategyDraft,
  saveStrategyProfile,
  saveStrategyProfileState,
  type StrategyProfileState,
} from './strategyProfiles';

type StrategyField = {
  label: string;
  placeholder?: string;
};

type StrategyWidget =
  | {
      kind: 'table';
      title: string;
      columns: string[];
      rows: number;
      subtitle?: string;
    }
  | {
      kind: 'chart';
      title: string;
      subtitle?: string;
    };

export type StrategySection = {
  title: string;
  bullets?: string[];
  fields?: StrategyField[];
  actions?: string[];
  widgets?: StrategyWidget[];
};

type Props = {
  title: string;
  subtitle: string;
  tab: AssumptionsTabId;
  sections: StrategySection[];
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--fc-card-border)',
  borderRadius: 16,
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  padding: 16,
};

const chipStyle: React.CSSProperties = {
  border: '1px solid var(--fc-card-border)',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 12,
  opacity: 0.9,
};

const buildFieldStateKey = (sectionTitle: string, fieldLabel: string, fieldIndex: number): string =>
  `${sectionTitle}:${fieldLabel}:${fieldIndex}`;

const buildEmptyStrategyDraft = (fieldKeys: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  fieldKeys.forEach((key) => {
    out[key] = '';
  });
  return out;
};

const normalizeDraftValues = (value: unknown, fieldKeys: string[]): Record<string, string> => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  fieldKeys.forEach((key) => {
    out[key] = typeof source[key] === 'string' ? String(source[key]) : '';
  });
  return out;
};

const getByPath = (obj: unknown, keyPath: string): unknown => {
  let cur: any = obj;
  for (const segment of keyPath.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[segment];
  }
  return cur;
};

const formatValue = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
};

const StrategyScaffoldPage: React.FC<Props> = ({
  title,
  subtitle,
  tab,
  sections,
}) => {
  const { currentAssumptions } = useAssumptions();
  const fieldKeys = useMemo(() => {
    const keys: string[] = [];
    sections.forEach((section) => {
      section.fields?.forEach((field, index) => {
        keys.push(buildFieldStateKey(section.title, field.label, index));
      });
    });
    return keys;
  }, [sections]);
  const emptyDraft = useMemo(() => buildEmptyStrategyDraft(fieldKeys), [fieldKeys]);
  const [profileState, setProfileState] = useState<StrategyProfileState<Record<string, string>>>(() =>
    loadStrategyProfileState(tab, emptyDraft, (value) => normalizeDraftValues(value, fieldKeys))
  );
  const [formState, setFormState] = useState<Record<string, string>>(() => profileState.draft);
  const [selectedProfileId, setSelectedProfileId] = useState(profileState.activeProfileId ?? '');
  const [profileName, setProfileName] = useState(
    () => profileState.profiles.find((profile) => profile.id === profileState.activeProfileId)?.name ?? ''
  );
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    const next = loadStrategyProfileState(tab, emptyDraft, (value) => normalizeDraftValues(value, fieldKeys));
    setProfileState(next);
    setFormState(next.draft);
    setSelectedProfileId(next.activeProfileId ?? '');
    setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
  }, [emptyDraft, fieldKeys, tab]);

  const registryItems = useMemo(() => listStrategyRegistryItems(tab), [tab]);
  const usedByCount = useMemo(
    () => new Set(registryItems.flatMap((item) => filterUsedByForAssumptionsHub(item.usedBy))).size,
    [registryItems]
  );
  const isDirty = JSON.stringify(formState) !== JSON.stringify(profileState.draft);
  const lastSavedLabel = profileState.draftSavedAt ? new Date(profileState.draftSavedAt).toLocaleString() : 'Not saved yet';

  const persistState = (next: StrategyProfileState<Record<string, string>>) => {
    setProfileState(next);
    saveStrategyProfileState(tab, next);
  };

  return (
    <PageLayout variant="wide">
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={chipStyle}>Slice E scaffold</span>
              <span style={chipStyle}>Defaults tab: {ASSUMPTIONS_TAB_LABELS[tab]}</span>
              <span style={chipStyle}>{isDirty ? 'Unsaved draft' : 'Saved draft'}</span>
              <span style={chipStyle}>Profiles: {profileState.profiles.length}</span>
            </div>
            <h1 style={{ margin: 0 }}>{title}</h1>
            <div style={{ opacity: 0.8, maxWidth: 900 }}>{subtitle}</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Local draft persistence: {lastSavedLabel}</div>
          </div>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Profile</span>
                <select
                  aria-label="Strategy profile"
                  value={selectedProfileId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setSelectedProfileId(nextId);
                    setProfileName(profileState.profiles.find((profile) => profile.id === nextId)?.name ?? '');
                  }}
                  style={{ minWidth: 220, padding: '8px 10px', borderRadius: 10 }}
                >
                  <option value="">Scratch draft</option>
                  {profileState.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Profile name</span>
                <input
                  aria-label="Profile name"
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="e.g. Steady monthly"
                  style={{ minWidth: 220, padding: '8px 10px', borderRadius: 10 }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                const next = persistStrategyDraft(profileState, { ...formState });
                persistState(next);
              }}
              style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={!profileName.trim()}
              onClick={() => {
                const next = saveStrategyProfile(profileState, {
                  id: selectedProfileId || null,
                  name: profileName,
                  data: { ...formState },
                });
                persistState(next);
                setSelectedProfileId(next.activeProfileId ?? '');
                setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? profileName);
              }}
              style={{ ...chipStyle, cursor: profileName.trim() ? 'pointer' : 'default', background: 'transparent' }}
            >
              {selectedProfileId ? 'Update profile' : 'Save as profile'}
            </button>
            <button
              type="button"
              disabled={!selectedProfileId}
              onClick={() => {
                if (!selectedProfileId) return;
                const next = applyStrategyProfile(profileState, selectedProfileId);
                persistState(next);
                setFormState(next.draft);
                setProfileName(next.profiles.find((profile) => profile.id === selectedProfileId)?.name ?? '');
              }}
              style={{ ...chipStyle, cursor: selectedProfileId ? 'pointer' : 'default', background: 'transparent' }}
            >
              Load selected
            </button>
            <button
              type="button"
              disabled={!selectedProfileId}
              onClick={() => {
                if (!selectedProfileId) return;
                const next = deleteStrategyProfile(profileState, selectedProfileId);
                persistState(next);
                setSelectedProfileId(next.activeProfileId ?? '');
                setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
              }}
              style={{ ...chipStyle, cursor: selectedProfileId ? 'pointer' : 'default', background: 'transparent' }}
            >
              Delete profile
            </button>
            <button
              type="button"
              onClick={() => exportStrategyProfilesJson(tab, { ...profileState, draft: formState })}
              style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}
            >
              Export profiles
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center' }}>
              <input
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files && event.target.files.length ? event.target.files[0] : null;
                  void importStrategyProfilesJson(file, emptyDraft, (value) => normalizeDraftValues(value, fieldKeys)).then((next) => {
                    if (!next) {
                      setImportStatus('Import failed. The file could not be parsed as valid strategy profile JSON.');
                      return;
                    }
                    persistState(next);
                    setFormState(next.draft);
                    setSelectedProfileId(next.activeProfileId ?? '');
                    setProfileName(next.profiles.find((profile) => profile.id === next.activeProfileId)?.name ?? '');
                    setImportStatus('Strategy profiles imported into the current page.');
                  }).catch(() => {
                    setImportStatus('Import failed. The file could not be parsed as valid strategy profile JSON.');
                  });
                  event.target.value = '';
                }}
              />
              <span style={{ ...chipStyle, cursor: 'pointer' }}>Import profiles</span>
            </label>
            <button
              type="button"
              onClick={() => setFormState(profileState.draft)}
              disabled={!isDirty}
              style={{ ...chipStyle, cursor: isDirty ? 'pointer' : 'default', background: 'transparent' }}
            >
              Reset to saved
            </button>
            <button
              type="button"
              onClick={() => {
                const next = clearStrategyDraft(profileState, emptyDraft);
                persistState(next);
                setFormState(next.draft);
                setSelectedProfileId('');
                setProfileName('');
              }}
              style={{ ...chipStyle, cursor: 'pointer', background: 'transparent' }}
            >
              Clear draft
            </button>
            <Link to="/assumptions" style={{ ...chipStyle, textDecoration: 'none', color: 'inherit' }}>Open Assumptions Hub</Link>
            <Link to="/simulation" style={{ ...chipStyle, textDecoration: 'none', color: 'inherit' }}>Back to simulator</Link>
            </div>
            {importStatus && <div style={{ fontSize: 12, opacity: 0.78 }}>{importStatus}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Registry defaults</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{registryItems.length}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Connected pages</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{usedByCount}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Authority source</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Current assumptions</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {sections.map((section) => (
              <div key={section.title} style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{section.title}</div>
                  {section.bullets && section.bullets.length > 0 && (
                    <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                      {section.bullets.map((bullet) => (
                        <div key={bullet} style={{ fontSize: 13, opacity: 0.78 }}>• {bullet}</div>
                      ))}
                    </div>
                  )}
                </div>

                {section.fields && section.fields.length > 0 && (
                  <div style={{ display: 'grid', gap: 10 }}>
                      {section.fields.map((field, index) => {
                        const stateKey = buildFieldStateKey(section.title, field.label, index);
                      return (
                        <label key={stateKey} style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{field.label}</span>
                          <input
                            type="text"
                            aria-label={`${section.title}: ${field.label}`}
                            value={formState[stateKey] ?? ''}
                            placeholder={field.placeholder}
                            onChange={(event) => setFormState((prev) => ({ ...prev, [stateKey]: event.target.value }))}
                            style={{ padding: '10px 12px', borderRadius: 10 }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}

                {section.actions && section.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {section.actions.map((action) => (
                      <button key={action} type="button" style={{ padding: '10px 14px', borderRadius: 10 }}>{action}</button>
                    ))}
                  </div>
                )}

                {section.widgets && section.widgets.length > 0 && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {section.widgets.map((widget) => (
                      <div key={`${section.title}:${widget.title}`} style={{ border: '1px dashed var(--fc-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                        <div style={{ fontWeight: 700 }}>{widget.title}</div>
                        {widget.subtitle && <div style={{ fontSize: 12, opacity: 0.72 }}>{widget.subtitle}</div>}
                        {widget.kind === 'table' ? (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${widget.columns.length}, minmax(0, 1fr))`, gap: 8, fontSize: 12, fontWeight: 700, opacity: 0.78 }}>
                              {widget.columns.map((column) => (
                                <div key={column}>{column}</div>
                              ))}
                            </div>
                            {Array.from({ length: widget.rows }).map((_, index) => (
                              <div key={`${widget.title}:${index}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${widget.columns.length}, minmax(0, 1fr))`, gap: 8, fontSize: 12, opacity: 0.55 }}>
                                {widget.columns.map((column) => (
                                  <div key={column}>{column} {index + 1}</div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ height: 140, borderRadius: 10, border: '1px dashed var(--fc-card-border)', display: 'grid', placeItems: 'center', opacity: 0.65 }}>
                            {widget.title}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12, position: 'sticky', top: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Inherited defaults from assumptions</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>These defaults come from the authority layer today. Strategy-specific config can later override them explicitly, but this skeleton keeps them visible for traceability.</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {registryItems.map((item) => {
                const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
                return (
                  <div key={item.keyPath} style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{item.label}</div>
                      <span style={chipStyle}>{formatValue(getByPath(currentAssumptions, item.keyPath))}</span>
                    </div>
                    {usedBy.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {usedBy.map((label) => (
                          <span key={label} style={chipStyle}>Used by: {label}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 12, opacity: 0.72 }}>{item.keyPath}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default StrategyScaffoldPage;
