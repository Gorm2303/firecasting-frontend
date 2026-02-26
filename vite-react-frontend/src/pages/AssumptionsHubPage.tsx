import React, { useMemo } from 'react';
import PageLayout from '../components/PageLayout';
import { normalizeAssumptions, useAssumptions } from '../state/assumptions';
import { useUiPreferences } from '../state/uiPreferences';
import { getDefaultExecutionDefaults, useExecutionDefaults } from '../state/executionDefaults';
import { listRegistryByTab } from '../state/assumptionsRegistry';
import { listConventionsByGroup } from '../state/conventionsRegistry';
import { listAssumptionsHistory } from '../state/assumptionsHistory';
import { SkeletonWidgets, type SkeletonWidget } from './skeleton/SkeletonWidgets';

const fieldRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 0.9fr) minmax(0, 1.2fr)',
  gap: 10,
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--fc-card-border)',
  background: 'transparent',
  color: 'inherit',
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 14,
  padding: 14,
};

type HubTabId = 'baseline' | 'execution' | 'conventions' | 'preview';

const AssumptionsHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<HubTabId>('baseline');
  const [showAssumptionsChangeLog, setShowAssumptionsChangeLog] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState<string>('');
  const {
    currentAssumptions,
    draftAssumptions,
    isDraftDirty,
    updateDraftAssumptions,
    setDraftAssumptions,
    resetDraftToCurrent,
    resetDraftToDefaults,
    saveDraft,
  } = useAssumptions();
  const { uiPrefs, updateUiPrefs } = useUiPreferences();
  const { executionDefaults, updateExecutionDefaults, resetExecutionDefaults } = useExecutionDefaults();

  const timingConventions = useMemo(() => listConventionsByGroup('timing'), []);
  const executionRegistryItems = useMemo(() => listRegistryByTab('execution'), []);
  const worldModelRegistryItems = useMemo(() => listRegistryByTab('worldModel'), []);
  const simulatorTaxRegistryItems = useMemo(() => listRegistryByTab('simulatorTax'), []);
  const salaryTaxatorRegistryItems = useMemo(() => listRegistryByTab('salaryTaxator'), []);
  const moneyPerspectiveRegistryItems = useMemo(() => listRegistryByTab('moneyPerspective'), []);

  const previewRegistryItems = useMemo(
    () => [
      ...worldModelRegistryItems,
      ...simulatorTaxRegistryItems,
      ...salaryTaxatorRegistryItems,
      ...moneyPerspectiveRegistryItems,
    ],
    [moneyPerspectiveRegistryItems, salaryTaxatorRegistryItems, simulatorTaxRegistryItems, worldModelRegistryItems]
  );

  const jsonPreview = useMemo(() => JSON.stringify(draftAssumptions, null, 2), [draftAssumptions]);

  const assumptionsHistory = useMemo(() => {
    if (!showAssumptionsChangeLog) return [];
    return listAssumptionsHistory();
  }, [showAssumptionsChangeLog]);

  const exportAssumptionsJson = useMemo(() => {
    return () => {
      const payload = {
        current: currentAssumptions,
        draft: draftAssumptions,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'assumptions-export.json';
      a.click();
      URL.revokeObjectURL(url);
    };
  }, [currentAssumptions, draftAssumptions]);

  const importAssumptionsJson = useMemo(() => {
    return async (file: File | null) => {
      setImportStatus('');
      if (!file) return;

      try {
        const text = await file.text();
        const raw = JSON.parse(text);

        const candidate = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        const imported = (candidate.draft ?? candidate.current ?? raw) as unknown;

        setDraftAssumptions(normalizeAssumptions(imported));
        setImportStatus('Imported into draft. Review and click Save to apply.');
      } catch {
        setImportStatus('Import failed: invalid JSON.');
      }
    };
  }, [setDraftAssumptions]);

  const formatValue = useMemo(() => {
    const stringify = (v: unknown): string => {
      if (v === null) return 'null';
      if (v === undefined) return '—';
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    };

    return (unit: string, value: unknown): string => {
      if (value === undefined) return '—';

      if (unit === 'pct') {
        return typeof value === 'number' ? `${value}%` : `${stringify(value)}%`;
      }
      if (unit === 'dkk' || unit === 'dkkPerMonth' || unit === 'dkkPerYear') {
        return typeof value === 'number' ? `${value}` : stringify(value);
      }
      return stringify(value);
    };
  }, []);

  const getValueAtKeyPath = useMemo(() => {
    return (root: unknown, keyPath: string): unknown => {
      const parts = keyPath.split('.').filter(Boolean);
      let cursor: unknown = root;
      for (const part of parts) {
        if (!cursor || typeof cursor !== 'object') return undefined;
        cursor = (cursor as Record<string, unknown>)[part];
      }
      return cursor;
    };
  }, []);

  const assumptionsDiffRows = useMemo(() => {
    const rows = previewRegistryItems
      .map((item) => {
        const from = getValueAtKeyPath(currentAssumptions, item.keyPath);
        const to = getValueAtKeyPath(draftAssumptions, item.keyPath);
        const same = Object.is(from, to) || JSON.stringify(from) === JSON.stringify(to);
        if (same) return null;
        return {
          keyPath: item.keyPath,
          label: item.label,
          unit: item.unit,
          usedBy: item.usedBy,
          from,
          to,
        };
      })
      .filter(Boolean) as Array<{
      keyPath: string;
      label: string;
      unit: string;
      usedBy: string[];
      from: unknown;
      to: unknown;
    }>;

    rows.sort((a, b) => a.keyPath.localeCompare(b.keyPath));
    return rows;
  }, [currentAssumptions, draftAssumptions, getValueAtKeyPath, previewRegistryItems]);

  const executionOverridesRows = useMemo(() => {
    const defaults = getDefaultExecutionDefaults();

    const rows = executionRegistryItems
      .map((item) => {
        const prop = item.keyPath.replace('executionDefaults.', '');
        const from = (defaults as Record<string, unknown>)[prop];
        const to = (executionDefaults as Record<string, unknown>)[prop];
        const same = Object.is(from, to) || JSON.stringify(from) === JSON.stringify(to);
        if (same) return null;
        return {
          keyPath: item.keyPath,
          label: item.label,
          unit: item.unit,
          usedBy: item.usedBy,
          from,
          to,
        };
      })
      .filter(Boolean) as Array<{
      keyPath: string;
      label: string;
      unit: string;
      usedBy: string[];
      from: unknown;
      to: unknown;
    }>;

    rows.sort((a, b) => a.keyPath.localeCompare(b.keyPath));
    return rows;
  }, [executionDefaults, executionRegistryItems]);

  const setObjectValueAtPath = useMemo(() => {
    const setAt = (root: unknown, parts: string[], value: unknown): unknown => {
      if (parts.length === 0) return root;
      const base = root && typeof root === 'object' ? (root as Record<string, unknown>) : {};
      const [head, ...rest] = parts;

      if (rest.length === 0) {
        return { ...base, [head]: value };
      }

      return { ...base, [head]: setAt(base[head], rest, value) };
    };

    return setAt;
  }, []);

  const updateDraftValueAtKeyPath = useMemo(() => {
    return (keyPath: string, nextValue: unknown) => {
      const parts = keyPath.split('.').filter(Boolean);
      if (parts.length === 0) return;

      if (parts.length === 1) {
        updateDraftAssumptions({ [parts[0]]: nextValue } as Partial<typeof draftAssumptions>);
        return;
      }

      const [top, ...rest] = parts;
      const nextTop = setObjectValueAtPath((draftAssumptions as Record<string, unknown>)[top], rest, nextValue);
      updateDraftAssumptions({ [top]: nextTop } as Partial<typeof draftAssumptions>);
    };
  }, [draftAssumptions, setObjectValueAtPath, updateDraftAssumptions]);

  const getStepForUnit = useMemo(() => {
    return (unit: string): number => {
      if (unit === 'pct') return 0.1;
      return 1;
    };
  }, []);

  const renderAssumptionRegistryField = useMemo(() => {
    const isNumericUnit = (unit: string): boolean => {
      return (
        unit === 'pct' ||
        unit === 'dkk' ||
        unit === 'dkkPerMonth' ||
        unit === 'dkkPerYear' ||
        unit === 'hoursPerMonth' ||
        unit === 'months' ||
        unit === 'years' ||
        unit === 'count'
      );
    };

    return (item: { keyPath: string; label: string; unit: string; usedBy: string[] }) => {
      const inputId = `assumptions-${item.keyPath.replace(/\./g, '-')}`;
      const value = getValueAtKeyPath(draftAssumptions, item.keyPath);

      const labelNode = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div>{item.label}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Used by: {item.usedBy.join(', ')}</div>
        </div>
      );

      if (item.unit === 'boolean') {
        return (
          <div key={item.keyPath} style={fieldRowStyle}>
            <label htmlFor={inputId} style={{ fontWeight: 700 }}>
              {labelNode}
            </label>
            <input
              id={inputId}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => updateDraftValueAtKeyPath(item.keyPath, e.target.checked)}
            />
          </div>
        );
      }

      if (item.unit === 'string') {
        const placeholder =
          item.keyPath === 'currency'
            ? 'e.g. DKK'
            : item.keyPath === 'salaryTaxatorDefaults.municipalityId'
              ? 'average or municipality id'
              : undefined;

        return (
          <div key={item.keyPath} style={fieldRowStyle}>
            <label htmlFor={inputId} style={{ fontWeight: 700 }}>
              {labelNode}
            </label>
            <input
              id={inputId}
              value={typeof value === 'string' ? value : value == null ? '' : String(value)}
              onChange={(e) => updateDraftValueAtKeyPath(item.keyPath, e.target.value)}
              style={inputStyle}
              placeholder={placeholder}
            />
          </div>
        );
      }

      if (isNumericUnit(item.unit)) {
        return (
          <div key={item.keyPath} style={fieldRowStyle}>
            <label htmlFor={inputId} style={{ fontWeight: 700 }}>
              {labelNode}
            </label>
            <input
              id={inputId}
              type="number"
              step={getStepForUnit(item.unit)}
              value={typeof value === 'number' ? value : value == null ? '' : Number(value)}
              onChange={(e) => updateDraftValueAtKeyPath(item.keyPath, Number(e.target.value))}
              style={inputStyle}
            />
          </div>
        );
      }

      // Fallback: render as text.
      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>
            {labelNode}
          </label>
          <input
            id={inputId}
            value={value == null ? '' : String(value)}
            onChange={(e) => updateDraftValueAtKeyPath(item.keyPath, e.target.value)}
            style={inputStyle}
          />
        </div>
      );
    };
  }, [draftAssumptions, getStepForUnit, getValueAtKeyPath, updateDraftValueAtKeyPath]);

  const updateExecutionValueAtKeyPath = useMemo(() => {
    return (keyPath: string, nextValue: unknown) => {
      const prefix = 'executionDefaults.';
      if (!keyPath.startsWith(prefix)) return;
      const prop = keyPath.slice(prefix.length);
      if (!prop) return;

      updateExecutionDefaults({ [prop]: nextValue } as Partial<typeof executionDefaults>);
    };
  }, [executionDefaults, updateExecutionDefaults]);

  const renderExecutionRegistryField = useMemo(() => {
    const labelNode = (label: string, usedBy: string[]) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Used by: {usedBy.join(', ')}</div>
      </div>
    );

    return (item: { keyPath: string; label: string; unit: string; usedBy: string[] }) => {
      const inputId = `execution-${item.keyPath.replace(/\./g, '-')}`;
      const prop = item.keyPath.replace('executionDefaults.', '');
      const value = (executionDefaults as Record<string, unknown>)[prop];

      if (item.unit === 'enum' && item.keyPath === 'executionDefaults.seedMode') {
        return (
          <div key={item.keyPath} style={fieldRowStyle}>
            <label htmlFor={inputId} style={{ fontWeight: 700 }}>
              {labelNode(item.label, item.usedBy)}
            </label>
            <select
              id={inputId}
              value={typeof value === 'string' ? value : String(value ?? '')}
              onChange={(e) => updateExecutionValueAtKeyPath(item.keyPath, e.target.value)}
              style={inputStyle}
            >
              <option value="default">Default</option>
              <option value="custom">Custom</option>
              <option value="random">Random</option>
            </select>
          </div>
        );
      }

      // Treat execution numeric fields as positive integers.
      return (
        <div key={item.keyPath} style={fieldRowStyle}>
          <label htmlFor={inputId} style={{ fontWeight: 700 }}>
            {labelNode(item.label, item.usedBy)}
          </label>
          <input
            id={inputId}
            type="number"
            min={1}
            step={1}
            value={typeof value === 'number' ? value : value == null ? '' : Number(value)}
            onChange={(e) => updateExecutionValueAtKeyPath(item.keyPath, Number(e.target.value))}
            style={inputStyle}
          />
        </div>
      );
    };
  }, [executionDefaults, updateExecutionValueAtKeyPath]);

  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Assumptions Hub</h1>
          <div style={{ opacity: 0.78, marginTop: 6 }}>
            Single source of truth for the app’s baseline assumptions (stored locally for now).
          </div>
          {isDraftDirty && (
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
              You have unsaved draft changes.
            </div>
          )}
        </div>

        <div role="tablist" aria-label="Assumptions Hub sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              { id: 'baseline' as const, label: 'Baseline' },
              { id: 'execution' as const, label: 'Execution' },
              { id: 'conventions' as const, label: 'Conventions' },
              { id: 'preview' as const, label: 'Preview' },
            ] satisfies Array<{ id: HubTabId; label: string }>
          ).map((t) => {
            const isActive = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '8px 10px',
                  fontWeight: isActive ? 850 : 700,
                  opacity: isActive ? 1 : 0.82,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'baseline' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontWeight: 850, fontSize: 18 }}>Baseline assumptions</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={saveDraft} disabled={!isDraftDirty} style={{ padding: '8px 10px' }}>
                Save
              </button>
              <button type="button" onClick={resetDraftToCurrent} disabled={!isDraftDirty} style={{ padding: '8px 10px' }}>
                Cancel
              </button>
              <button type="button" onClick={resetDraftToDefaults} style={{ padding: '8px 10px' }}>
                Reset to defaults
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
            Current (saved): {currentAssumptions.currency} · Inflation {currentAssumptions.inflationPct}% · Fee {currentAssumptions.yearlyFeePct}% · Return {currentAssumptions.expectedReturnPct}% · SWR {currentAssumptions.safeWithdrawalPct}%
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 750 }}>
              <input
                type="checkbox"
                checked={uiPrefs.showAssumptionsBar}
                onChange={(e) => updateUiPrefs({ showAssumptionsBar: e.target.checked })}
              />
              Show assumptions bar at top
            </label>
            <div style={{ opacity: 0.75, fontSize: 13, textAlign: 'right' }}>
              Default is hidden.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {worldModelRegistryItems.map(renderAssumptionRegistryField)}

            <div style={{ marginTop: 6, fontWeight: 850, fontSize: 16 }}>
              Simulator tax exemption defaults
            </div>
            <div style={{ marginTop: -2, fontSize: 13, opacity: 0.78 }}>
              Defaults used when tax exemption rules are enabled in simulator phases.
            </div>

            {simulatorTaxRegistryItems.map(renderAssumptionRegistryField)}

            <div style={{ marginTop: 6, fontWeight: 850, fontSize: 16 }}>
              Salary Taxator defaults
            </div>
            <div style={{ marginTop: -2, fontSize: 13, opacity: 0.78 }}>
              Baseline inputs used to prefill Salary Taxator.
            </div>

            {salaryTaxatorRegistryItems.map(renderAssumptionRegistryField)}

            <div style={{ marginTop: 6, fontWeight: 850, fontSize: 16 }}>
              Money Perspectivator defaults
            </div>
            <div style={{ marginTop: -2, fontSize: 13, opacity: 0.78 }}>
              Baseline inputs used to prefill Money Perspectivator.
            </div>

            {moneyPerspectiveRegistryItems.map(renderAssumptionRegistryField)}
          </div>

          <div style={{ marginTop: 14, opacity: 0.78, fontSize: 13 }}>
            This page is intentionally “offline-first”: assumptions are stored in your browser for now.
          </div>
        </div>

        )}

        {activeTab === 'execution' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontWeight: 850, fontSize: 18 }}>Execution defaults</div>
            <button type="button" onClick={resetExecutionDefaults} style={{ padding: '8px 10px' }}>
              Reset to defaults
            </button>
          </div>
          <div style={{ opacity: 0.78, marginTop: 6, fontSize: 13 }}>
            Defaults used when running simulations (paths/batching/seeding). Stored locally.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {executionRegistryItems.map(renderExecutionRegistryField)}
          </div>
        </div>

        )}

        {activeTab === 'baseline' && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Assumption profiles (placeholder)</div>
          <div style={{ opacity: 0.8, marginBottom: 10 }}>
            Later: switch between sets like “Baseline”, “Conservative”, “Aggressive”, “Partner view”.
          </div>
          <SkeletonWidgets
            widgets={
              [
                {
                  kind: 'table',
                  title: 'Profiles',
                  columns: ['Profile', 'Inflation', 'Return', 'SWR', 'Notes'],
                  rows: 4,
                },
                {
                  kind: 'cards',
                  title: 'Quick picks',
                  cards: [
                    { title: 'Baseline', body: 'Your default set for most pages and reports.' },
                    { title: 'Conservative', body: 'Lower return / lower SWR. Stress-test friendly.' },
                    { title: 'Aggressive', body: 'Higher return assumptions; used for upside exploration.' },
                  ],
                },
              ] satisfies SkeletonWidget[]
            }
          />
        </div>

        )}

        {activeTab === 'conventions' && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 6 }}>Simulation conventions</div>
          <div style={{ opacity: 0.8, marginBottom: 10, fontSize: 13 }}>
            Fixed modeling conventions used by normal-mode UI copy (not editable yet).
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {timingConventions.map((c) => (
              <div key={c.id}>
                <div style={{ fontWeight: 800 }}>{c.label}</div>
                <div style={{ opacity: 0.85, fontSize: 13 }}>
                  {c.description} <span style={{ opacity: 0.85 }}>(Token: {c.token})</span>
                </div>
                <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>Used by: {c.usedBy.join(', ')}</div>
              </div>
            ))}
          </div>
        </div>

        )}

        {activeTab === 'baseline' && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Governance & guardrails (placeholder)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={fieldRowStyle}>
              <label htmlFor="assumptions-source" style={{ fontWeight: 700 }}>
                Source note
              </label>
              <textarea
                id="assumptions-source"
                value={''}
                readOnly
                placeholder="Where did these assumptions come from? (links, rationale, date…)"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={fieldRowStyle}>
              <label htmlFor="assumptions-lock" style={{ fontWeight: 700 }}>
                Lock baseline
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input id="assumptions-lock" type="checkbox" checked={false} disabled />
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  Placeholder: prevents accidental edits when generating reports.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={exportAssumptionsJson}>
                Export JSON
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files && e.target.files.length ? e.target.files[0] : null;
                    void importAssumptionsJson(file);
                    e.target.value = '';
                  }}
                />
                <span
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--fc-card-border)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Import JSON
                </span>
              </label>
              <button type="button" onClick={() => setShowAssumptionsChangeLog((v) => !v)}>
                {showAssumptionsChangeLog ? 'Hide change log' : 'View change log'}
              </button>
            </div>

            {importStatus && <div style={{ fontSize: 13, opacity: 0.85 }}>{importStatus}</div>}

            {showAssumptionsChangeLog && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Change log</div>
                {assumptionsHistory.length === 0 ? (
                  <div style={{ opacity: 0.8, fontSize: 13 }}>No saved snapshots yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assumptionsHistory.slice(0, 20).map((e) => (
                      <div
                        key={e.id}
                        style={{
                          padding: '10px 12px',
                          border: '1px solid var(--fc-card-border)',
                          borderRadius: 12,
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{new Date(e.createdAt).toLocaleString()}</div>
                        <div style={{ opacity: 0.82, fontSize: 13, marginTop: 2 }}>
                          {e.assumptions.currency} · Inflation {e.assumptions.inflationPct}% · Fee {e.assumptions.yearlyFeePct}% · Return{' '}
                          {e.assumptions.expectedReturnPct}% · SWR {e.assumptions.safeWithdrawalPct}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        )}

        {activeTab === 'baseline' && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Impact preview (placeholder)</div>
          <div style={{ opacity: 0.8, marginBottom: 10 }}>
            Later: show how changes to inflation/return/SWR shift FI date range and safe spending.
          </div>
          <SkeletonWidgets
            widgets={
              [
                { kind: 'chart', title: 'FI date range sensitivity', subtitle: 'Chart placeholder: sliders → range shifts.' },
                { kind: 'chart', title: 'Safe monthly spending sensitivity', subtitle: 'Chart placeholder: SWR changes.' },
                {
                  kind: 'table',
                  title: 'Sensitivity table',
                  columns: ['Change', 'FI date shift', 'Safe spend shift', 'Risk note'],
                  rows: 5,
                },
              ] satisfies SkeletonWidget[]
            }
          />
        </div>

        )}

        {activeTab === 'preview' && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 8 }}>Preview</div>

            <div style={{ opacity: 0.82, fontSize: 13, marginBottom: 10 }}>
              Draft changes are shown as current → draft. Execution defaults are shown as default → current.
            </div>

            <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6 }}>Baseline changes</div>
            {assumptionsDiffRows.length === 0 ? (
              <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>No baseline changes.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {assumptionsDiffRows.map((r) => (
                  <div key={r.keyPath} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                    <div style={{ fontWeight: 800 }}>{r.label}</div>
                    <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2 }}>
                      {formatValue(r.unit, r.from)} → {formatValue(r.unit, r.to)}
                    </div>
                    <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>Used by: {r.usedBy.join(', ')}</div>
                    <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{r.keyPath}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6 }}>Execution overrides</div>
            {executionOverridesRows.length === 0 ? (
              <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>No execution overrides.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {executionOverridesRows.map((r) => (
                  <div key={r.keyPath} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                    <div style={{ fontWeight: 800 }}>{r.label}</div>
                    <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2 }}>
                      {formatValue(r.unit, r.from)} → {formatValue(r.unit, r.to)}
                    </div>
                    <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>Used by: {r.usedBy.join(', ')}</div>
                    <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{r.keyPath}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6 }}>Raw draft JSON</div>
            <pre style={{ margin: 0, overflow: 'auto', opacity: 0.92 }}>{jsonPreview}</pre>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default AssumptionsHubPage;
