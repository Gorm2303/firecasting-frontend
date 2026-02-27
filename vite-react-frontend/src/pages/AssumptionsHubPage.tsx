import React, { useMemo } from 'react';
import PageLayout from '../components/PageLayout';
import { normalizeAssumptions, useAssumptions } from '../state/assumptions';
import { useUiPreferences } from '../state/uiPreferences';
import { getDefaultExecutionDefaults, type ExecutionDefaults, useExecutionDefaults } from '../state/executionDefaults';
import { filterUsedByForAssumptionsHub, listRegistryByTab } from '../state/assumptionsRegistry';
import { listConventionsByGroup } from '../state/conventionsRegistry';
import { clearAssumptionsHistory, listAssumptionsHistory } from '../state/assumptionsHistory';
import { deleteAssumptionsProfile, listAssumptionsProfiles, saveAssumptionsProfile } from '../state/assumptionsProfiles';
import { loadAssumptionsGovernance, saveAssumptionsGovernance, type AssumptionsGovernance } from '../state/assumptionsGovernance';
import { listSimulationSnapshots } from '../state/simulationSnapshots';
import { computeAssumptionsImpact } from '../utils/assumptionsImpact';

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
  const [selectedSnapshotId, setSelectedSnapshotId] = React.useState<string>('');
  const [profilesRefresh, setProfilesRefresh] = React.useState(0);
  const [historyRefresh, setHistoryRefresh] = React.useState(0);
  const [profileName, setProfileName] = React.useState('');
  const [governance, setGovernance] = React.useState<AssumptionsGovernance>(() => loadAssumptionsGovernance());
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

  const baselineLocked = governance.lockBaseline;

  const persistGovernance = React.useCallback((patch: Partial<AssumptionsGovernance>) => {
    const next: AssumptionsGovernance = {
      ...governance,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setGovernance(next);
    saveAssumptionsGovernance(next);
  }, [governance]);

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

  const simulationSnapshots = useMemo(() => {
    if (activeTab !== 'preview') return [];
    return listSimulationSnapshots();
  }, [activeTab]);

  const selectedSnapshot = useMemo(() => {
    if (activeTab !== 'preview') return null;
    if (!selectedSnapshotId) return null;
    return simulationSnapshots.find((s) => s.id === selectedSnapshotId) ?? null;
  }, [activeTab, selectedSnapshotId, simulationSnapshots]);

  const selectedSnapshotAssumptions = useMemo(() => {
    if (!selectedSnapshot) return null;
    return normalizeAssumptions(selectedSnapshot.assumptions);
  }, [selectedSnapshot]);

  const assumptionsHistory = useMemo(() => {
    if (!showAssumptionsChangeLog) return [];
    void historyRefresh;
    return listAssumptionsHistory();
  }, [showAssumptionsChangeLog, historyRefresh]);

  const assumptionsProfiles = useMemo(() => {
    if (activeTab !== 'baseline') return [];
    void profilesRefresh;
    return listAssumptionsProfiles();
  }, [activeTab, profilesRefresh]);

  const exportAssumptionsJson = useMemo(() => {
    return () => {
      const payload = {
        governance,
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
  }, [currentAssumptions, draftAssumptions, governance]);

  const importAssumptionsJson = useMemo(() => {
    return async (file: File | null) => {
      setImportStatus('');
      if (!file) return;

      if (baselineLocked) {
        setImportStatus('Baseline is locked. Unlock baseline to import into draft.');
        return;
      }

      try {
        const text = await file.text();
        const raw = JSON.parse(text);

        const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

        const maybeGov = root.governance;
        if (maybeGov && typeof maybeGov === 'object') {
          const g = maybeGov as Record<string, unknown>;
          persistGovernance({
            sourceNote: typeof g.sourceNote === 'string' ? g.sourceNote : governance.sourceNote,
            lockBaseline: typeof g.lockBaseline === 'boolean' ? g.lockBaseline : governance.lockBaseline,
          });
        }

        const imported = (root.draft ?? root.current ?? raw) as unknown;

        setDraftAssumptions(normalizeAssumptions(imported));
        setImportStatus('Imported into draft. Review and click Save to apply.');
      } catch {
        setImportStatus('Import failed: invalid JSON.');
      }
    };
  }, [baselineLocked, governance.lockBaseline, governance.sourceNote, persistGovernance, setDraftAssumptions]);

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

  const currentImpact = useMemo(() => computeAssumptionsImpact(currentAssumptions), [currentAssumptions]);
  const draftImpact = useMemo(() => computeAssumptionsImpact(draftAssumptions), [draftAssumptions]);

  const snapshotDiffRows = useMemo(() => {
    if (!selectedSnapshotAssumptions) return [];

    const rows = previewRegistryItems
      .map((item) => {
        const from = getValueAtKeyPath(selectedSnapshotAssumptions, item.keyPath);
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
  }, [draftAssumptions, getValueAtKeyPath, previewRegistryItems, selectedSnapshotAssumptions]);

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
      if (baselineLocked) return;
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
  }, [baselineLocked, draftAssumptions, setObjectValueAtPath, updateDraftAssumptions]);

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
      const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
      const disabled = baselineLocked;

      const labelNode = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div>{item.label}</div>
          {usedBy.length > 0 && <div style={{ fontSize: 12, opacity: 0.75 }}>Used by: {usedBy.join(', ')}</div>}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
            disabled={disabled}
            onChange={(e) => updateDraftValueAtKeyPath(item.keyPath, e.target.value)}
            style={inputStyle}
          />
        </div>
      );
    };
  }, [baselineLocked, draftAssumptions, getStepForUnit, getValueAtKeyPath, updateDraftValueAtKeyPath]);

  const updateExecutionValueAtKeyPath = useMemo(() => {
    return (keyPath: string, nextValue: unknown) => {
      const prefix = 'executionDefaults.';
      if (!keyPath.startsWith(prefix)) return;
      const prop = keyPath.slice(prefix.length);
      if (!prop) return;

      updateExecutionDefaults({ [prop]: nextValue } as Partial<ExecutionDefaults>);
    };
  }, [updateExecutionDefaults]);

  const renderExecutionRegistryField = useMemo(() => {
    const labelNode = (label: string, usedBy: string[]) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div>{label}</div>
        {usedBy.length > 0 && <div style={{ fontSize: 12, opacity: 0.75 }}>Used by: {usedBy.join(', ')}</div>}
      </div>
    );

    return (item: { keyPath: string; label: string; unit: string; usedBy: string[] }) => {
      const inputId = `execution-${item.keyPath.replace(/\./g, '-')}`;
      const prop = item.keyPath.replace('executionDefaults.', '');
      const value = (executionDefaults as Record<string, unknown>)[prop];
      const usedBy = filterUsedByForAssumptionsHub(item.usedBy);

      if (item.unit === 'enum' && item.keyPath === 'executionDefaults.seedMode') {
        return (
          <div key={item.keyPath} style={fieldRowStyle}>
            <label htmlFor={inputId} style={{ fontWeight: 700 }}>
              {labelNode(item.label, usedBy)}
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
            {labelNode(item.label, usedBy)}
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
          {baselineLocked && (
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
              Baseline is locked.
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
              <button type="button" onClick={saveDraft} disabled={baselineLocked || !isDraftDirty} style={{ padding: '8px 10px' }}>
                Save
              </button>
              <button type="button" onClick={resetDraftToCurrent} disabled={baselineLocked || !isDraftDirty} style={{ padding: '8px 10px' }}>
                Cancel
              </button>
              <button type="button" onClick={resetDraftToDefaults} disabled={baselineLocked} style={{ padding: '8px 10px' }}>
                Reset to defaults
              </button>
            </div>
          </div>

          {baselineLocked && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
              Baseline edits are disabled while locked.
            </div>
          )}

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
            <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Assumption profiles</div>
            <div style={{ opacity: 0.8, marginBottom: 10, fontSize: 13 }}>
              Save named baseline assumption sets locally. Load copies into draft.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={fieldRowStyle}>
                <label htmlFor="assumptions-profile-name" style={{ fontWeight: 700 }}>
                  Profile name
                </label>
                <input
                  id="assumptions-profile-name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Baseline, Conservative"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={!profileName.trim()}
                  onClick={() => {
                    saveAssumptionsProfile(profileName, normalizeAssumptions(draftAssumptions));
                    setProfileName('');
                    setProfilesRefresh((v) => v + 1);
                  }}
                >
                  Save draft as profile
                </button>
              </div>

              {assumptionsProfiles.length === 0 ? (
                <div style={{ opacity: 0.8, fontSize: 13 }}>No profiles yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assumptionsProfiles.slice(0, 20).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--fc-card-border)',
                        borderRadius: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 800 }}>{p.name}</div>
                        <div style={{ opacity: 0.75, fontSize: 12 }}>{new Date(p.createdAt).toLocaleString()}</div>
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        {p.assumptions.currency} · Inflation {p.assumptions.inflationPct}% · Fee {p.assumptions.yearlyFeePct}% · Return{' '}
                        {p.assumptions.expectedReturnPct}% · SWR {p.assumptions.safeWithdrawalPct}%
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={baselineLocked}
                          onClick={() => {
                            setDraftAssumptions(normalizeAssumptions(p.assumptions));
                          }}
                        >
                          Load into draft
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteAssumptionsProfile(p.id);
                            setProfilesRefresh((v) => v + 1);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                {filterUsedByForAssumptionsHub(c.usedBy).length > 0 && (
                  <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>
                    Used by: {filterUsedByForAssumptionsHub(c.usedBy).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        )}

        {activeTab === 'baseline' && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Governance & guardrails</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={fieldRowStyle}>
              <label htmlFor="assumptions-source" style={{ fontWeight: 700 }}>
                Source note
              </label>
              <textarea
                id="assumptions-source"
                value={governance.sourceNote}
                onChange={(e) => persistGovernance({ sourceNote: e.target.value })}
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
                <input
                  id="assumptions-lock"
                  type="checkbox"
                  checked={governance.lockBaseline}
                  onChange={(e) => persistGovernance({ lockBaseline: e.target.checked })}
                />
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  Prevents accidental edits/imports into draft.
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
                  disabled={baselineLocked}
                />
                <span
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--fc-card-border)',
                    cursor: baselineLocked ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    opacity: baselineLocked ? 0.55 : 1,
                  }}
                >
                  Import JSON
                </span>
              </label>
              <button type="button" onClick={() => setShowAssumptionsChangeLog((v) => !v)}>
                {showAssumptionsChangeLog ? 'Hide change log' : 'View change log'}
              </button>
              {showAssumptionsChangeLog && (
                <button
                  type="button"
                  onClick={() => {
                    clearAssumptionsHistory();
                    setHistoryRefresh((v) => v + 1);
                  }}
                >
                  Clear change log
                </button>
              )}
            </div>

            {importStatus && <div style={{ fontSize: 13, opacity: 0.85 }}>{importStatus}</div>}

            {showAssumptionsChangeLog && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Change log</div>
                {assumptionsHistory.length === 0 ? (
                  <div style={{ opacity: 0.8, fontSize: 13 }}>No saved entries yet.</div>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 800 }}>{new Date(e.createdAt).toLocaleString()}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              disabled={baselineLocked}
                              onClick={() => {
                                setDraftAssumptions(normalizeAssumptions(e.assumptions));
                              }}
                            >
                              Use as draft
                            </button>
                          </div>
                        </div>
                        <div style={{ opacity: 0.82, fontSize: 13, marginTop: 2 }}>
                          {e.assumptions.currency} · Inflation {e.assumptions.inflationPct}% · Fee {e.assumptions.yearlyFeePct}% · Return{' '}
                          {e.assumptions.expectedReturnPct}% · SWR {e.assumptions.safeWithdrawalPct}%
                        </div>
                        {e.sourceNote && (
                          <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{e.sourceNote}</div>
                        )}
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
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 10 }}>Impact preview</div>
          <div style={{ opacity: 0.8, marginBottom: 10 }}>
            Quick derived metrics for current vs draft. This is intentionally approximate (no sequence-of-returns effects).
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.7fr)', gap: 10 }}>
            <div style={{ fontWeight: 800, opacity: 0.9 }}>Metric</div>
            <div style={{ fontWeight: 800, opacity: 0.9 }}>Current</div>
            <div style={{ fontWeight: 800, opacity: 0.9 }}>Draft</div>
            <div style={{ fontWeight: 800, opacity: 0.9 }}>Δ</div>

            {(
              () => {
                const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
                const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

                const fmtMoney = (v: number | null): string => (v === null ? '—' : nf0.format(v));
                const fmtPct = (v: number): string => `${nf2.format(v)}%`;
                const fmtX = (v: number): string => `${nf2.format(v)}×`;
                const fmtCount = (v: number): string => nf0.format(v);

                const rows: Array<{
                  label: string;
                  cur: string;
                  draft: string;
                  delta: string;
                }> = [
                  {
                    label: 'Net nominal return (return − fee)',
                    cur: fmtPct(currentImpact.nominalNetReturnPct),
                    draft: fmtPct(draftImpact.nominalNetReturnPct),
                    delta: fmtPct(draftImpact.nominalNetReturnPct - currentImpact.nominalNetReturnPct),
                  },
                  {
                    label: 'Approx real return (net / inflation)',
                    cur: fmtPct(currentImpact.approxRealReturnPct),
                    draft: fmtPct(draftImpact.approxRealReturnPct),
                    delta: fmtPct(draftImpact.approxRealReturnPct - currentImpact.approxRealReturnPct),
                  },
                  {
                    label: 'Horizon (years)',
                    cur: fmtCount(currentImpact.horizonYears),
                    draft: fmtCount(draftImpact.horizonYears),
                    delta: fmtCount(draftImpact.horizonYears - currentImpact.horizonYears),
                  },
                  {
                    label: 'Inflation multiplier over horizon',
                    cur: fmtX(currentImpact.inflationFactorOverHorizon),
                    draft: fmtX(draftImpact.inflationFactorOverHorizon),
                    delta: '—',
                  },
                  {
                    label: 'Real growth multiplier over horizon',
                    cur: fmtX(currentImpact.realGrowthFactorOverHorizon),
                    draft: fmtX(draftImpact.realGrowthFactorOverHorizon),
                    delta: '—',
                  },
                  {
                    label: 'Core expense (monthly, today)',
                    cur: fmtMoney(currentImpact.coreExpenseMonthlyDkk),
                    draft: fmtMoney(draftImpact.coreExpenseMonthlyDkk),
                    delta: fmtMoney(draftImpact.coreExpenseMonthlyDkk - currentImpact.coreExpenseMonthlyDkk),
                  },
                  {
                    label: 'Core expense (monthly, nominal at horizon)',
                    cur: fmtMoney(currentImpact.coreExpenseMonthlyNominalAtHorizonDkk),
                    draft: fmtMoney(draftImpact.coreExpenseMonthlyNominalAtHorizonDkk),
                    delta: '—',
                  },
                  {
                    label: 'Safe monthly spend per 1,000,000 (SWR)',
                    cur: fmtMoney(currentImpact.safeMonthlySpendPer1MDkk),
                    draft: fmtMoney(draftImpact.safeMonthlySpendPer1MDkk),
                    delta: fmtMoney(draftImpact.safeMonthlySpendPer1MDkk - currentImpact.safeMonthlySpendPer1MDkk),
                  },
                  {
                    label: 'FI number (core expense / SWR)',
                    cur: fmtMoney(currentImpact.fiNumberDkk),
                    draft: fmtMoney(draftImpact.fiNumberDkk),
                    delta:
                      currentImpact.fiNumberDkk !== null && draftImpact.fiNumberDkk !== null
                        ? fmtMoney(draftImpact.fiNumberDkk - currentImpact.fiNumberDkk)
                        : '—',
                  },
                ];

                return rows.map((r) => (
                  <React.Fragment key={r.label}>
                    <div style={{ opacity: 0.92 }}>{r.label}</div>
                    <div style={{ fontWeight: 750 }}>{r.cur}</div>
                    <div style={{ fontWeight: 750 }}>{r.draft}</div>
                    <div style={{ opacity: 0.85 }}>{r.delta}</div>
                  </React.Fragment>
                ));
              }
            )()}
          </div>
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
                {assumptionsDiffRows.map((r) => {
                  const usedBy = filterUsedByForAssumptionsHub(r.usedBy);
                  return (
                    <div key={r.keyPath} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                      <div style={{ fontWeight: 800 }}>{r.label}</div>
                      <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2 }}>
                        {formatValue(r.unit, r.from)} → {formatValue(r.unit, r.to)}
                      </div>
                      {usedBy.length > 0 && <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>Used by: {usedBy.join(', ')}</div>}
                      <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{r.keyPath}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedSnapshot && selectedSnapshotAssumptions && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6 }}>Selected snapshot → draft changes</div>
                  <button type="button" onClick={() => setSelectedSnapshotId('')}>
                    Clear snapshot compare
                  </button>
                </div>
                <div style={{ opacity: 0.82, fontSize: 13, marginBottom: 10 }}>
                  Snapshot run <span style={{ fontWeight: 800 }}>{selectedSnapshot.runId}</span> ({new Date(selectedSnapshot.createdAt).toLocaleString()}) → current draft.
                </div>
                {snapshotDiffRows.length === 0 ? (
                  <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>No changes vs selected snapshot.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {snapshotDiffRows.map((r) => {
                      const usedBy = filterUsedByForAssumptionsHub(r.usedBy);
                      return (
                        <div
                          key={r.keyPath}
                          style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}
                        >
                          <div style={{ fontWeight: 800 }}>{r.label}</div>
                          <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2 }}>
                            {formatValue(r.unit, r.from)} → {formatValue(r.unit, r.to)}
                          </div>
                          {usedBy.length > 0 && (
                            <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>Used by: {usedBy.join(', ')}</div>
                          )}
                          <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{r.keyPath}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6 }}>Execution overrides</div>
            {executionOverridesRows.length === 0 ? (
              <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>No execution overrides.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {executionOverridesRows.map((r) => {
                  const usedBy = filterUsedByForAssumptionsHub(r.usedBy);
                  return (
                    <div key={r.keyPath} style={{ padding: '10px 12px', border: '1px solid var(--fc-card-border)', borderRadius: 12 }}>
                      <div style={{ fontWeight: 800 }}>{r.label}</div>
                      <div style={{ opacity: 0.85, fontSize: 13, marginTop: 2 }}>
                        {formatValue(r.unit, r.from)} → {formatValue(r.unit, r.to)}
                      </div>
                      {usedBy.length > 0 && <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>Used by: {usedBy.join(', ')}</div>}
                      <div style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>{r.keyPath}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontWeight: 850, fontSize: 16, marginBottom: 6 }}>Raw draft JSON</div>
            <pre style={{ margin: 0, overflow: 'auto', opacity: 0.92 }}>{jsonPreview}</pre>

            <div style={{ fontWeight: 850, fontSize: 16, marginTop: 14, marginBottom: 6 }}>Recent simulation snapshots</div>
            <div style={{ opacity: 0.82, fontSize: 13, marginBottom: 10 }}>
              Saved automatically when you start a simulation.
            </div>
            {simulationSnapshots.length === 0 ? (
              <div style={{ opacity: 0.8, fontSize: 13 }}>No snapshots yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {simulationSnapshots.slice(0, 10).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '10px 12px',
                      border: '1px solid var(--fc-card-border)',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800 }}>Run: {s.runId}</div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>{new Date(s.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ opacity: 0.85, fontSize: 13 }}>
                      Assumptions: {s.assumptions.currency} · Inflation {s.assumptions.inflationPct}% · Fee {s.assumptions.yearlyFeePct}% · Return{' '}
                      {s.assumptions.expectedReturnPct}% · SWR {s.assumptions.safeWithdrawalPct}%
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setSelectedSnapshotId(s.id)}>
                        Compare snapshot → draft
                      </button>
                      <button
                        type="button"
                        disabled={baselineLocked}
                        onClick={() => {
                          setDraftAssumptions(normalizeAssumptions(s.assumptions));
                          setActiveTab('baseline');
                        }}
                      >
                        Use snapshot assumptions as draft
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default AssumptionsHubPage;
