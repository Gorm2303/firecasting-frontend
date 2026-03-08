import React, { useMemo, useState } from 'react';
import {
  applyAssumptionsOverride,
  hasMeaningfulAssumptionsOverride,
  type Assumptions,
  type AssumptionsOverride,
} from '../../state/assumptions';
import {
  ASSUMPTIONS_TAB_LABELS,
  filterUsedByForAssumptionsHub,
  getRegistryEnumOptions,
  isNumericRegistryUnit,
  listScenarioOverrideRegistryItems,
  type AssumptionsTabId,
  type AssumptionRegistryItem,
} from '../../state/assumptionsRegistry';
import { computeAssumptionsImpact } from '../../utils/assumptionsImpact';

type Props = {
  baselineAssumptions: Assumptions;
  overrideDraft: AssumptionsOverride | null;
  disabled?: boolean;
  onChange: (next: AssumptionsOverride | null) => void;
  onSave: () => void;
  onClear: () => void;
  onOpenAssumptionsHub: () => void;
};

const TAB_ORDER: AssumptionsTabId[] = [
  'worldModel',
  'incomeSetup',
  'depositStrategy',
  'passiveStrategy',
  'simulatorTax',
  'salaryTaxator',
  'moneyPerspective',
  'withdrawalStrategy',
  'policyBuilder',
  'milestones',
  'goalPlanner',
];

const cardStyle: React.CSSProperties = {
  marginTop: 8,
  borderTop: '1px solid #2a2a2a',
  paddingTop: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const chipStyle: React.CSSProperties = {
  border: '1px solid #444',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 11,
  opacity: 0.9,
};

const provenanceChipStyle: React.CSSProperties = {
  ...chipStyle,
  opacity: 1,
};

const panelStyle: React.CSSProperties = {
  border: '1px solid #252525',
  borderRadius: 12,
  padding: 10,
  display: 'grid',
  gap: 10,
};

const fieldCardStyle: React.CSSProperties = {
  border: '1px solid #252525',
  borderRadius: 10,
  padding: 10,
  display: 'grid',
  gap: 8,
};

const getByPath = (obj: unknown, keyPath: string): unknown => {
  let cur: any = obj;
  for (const segment of keyPath.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[segment];
  }
  return cur;
};

const setByPath = (obj: Record<string, unknown>, keyPath: string, value: unknown): Record<string, unknown> => {
  const segments = keyPath.split('.');
  const out: Record<string, unknown> = { ...obj };
  let cur: Record<string, unknown> = out;

  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    const next = cur[segment];
    cur[segment] = next && typeof next === 'object' && !Array.isArray(next) ? { ...(next as Record<string, unknown>) } : {};
    cur = cur[segment] as Record<string, unknown>;
  }

  cur[segments[segments.length - 1]] = value;
  return out;
};

const deleteByPath = (obj: Record<string, unknown>, keyPath: string): Record<string, unknown> => {
  const segments = keyPath.split('.');
  const out: Record<string, unknown> = { ...obj };
  const stack: Array<{ parent: Record<string, unknown>; key: string }> = [];
  let cur: Record<string, unknown> | null = out;

  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    const next = cur?.[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return out;
    cur![segment] = { ...(next as Record<string, unknown>) };
    stack.push({ parent: cur!, key: segment });
    cur = cur![segment] as Record<string, unknown>;
  }

  if (cur) delete cur[segments[segments.length - 1]];

  for (let index = stack.length - 1; index >= 0; index--) {
    const { parent, key } = stack[index];
    const value = parent[key] as Record<string, unknown>;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
      delete parent[key];
    }
  }

  return out;
};

const formatValue = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
};

const getStepForUnit = (unit: AssumptionRegistryItem['unit']): string => {
  switch (unit) {
    case 'pct':
      return '0.1';
    case 'dkk':
    case 'dkkPerMonth':
    case 'dkkPerYear':
    case 'count':
    case 'months':
    case 'years':
    case 'hoursPerMonth':
      return '1';
    default:
      return '1';
  }
};

const getPlaceholderForItem = (item: AssumptionRegistryItem): string | undefined => {
  if (item.keyPath === 'currency') return 'e.g. DKK';
  if (item.keyPath === 'salaryTaxatorDefaults.municipalityId') return 'average or municipality id';
  return undefined;
};

const buildWarnings = (assumptions: Assumptions): string[] => {
  const warnings: string[] = [];
  const realDrift = Number(assumptions.expectedReturnPct) - Number(assumptions.yearlyFeePct) - Number(assumptions.inflationPct);
  if (realDrift <= 0) warnings.push('Expected return minus fees is at or below inflation, which implies non-positive real drift.');
  if (assumptions.withdrawalStrategyDefaults.guardrailFloorPct > assumptions.withdrawalStrategyDefaults.guardrailCeilingPct) {
    warnings.push('Withdrawal guardrail floor is above the ceiling.');
  }
  if (assumptions.policyBuilderDefaults.evaluationFrequency === 'monthly' && assumptions.policyBuilderDefaults.cooldownMonths >= 12) {
    warnings.push('Policies evaluate monthly but cooldown is a year or more, which may make rules feel unresponsive.');
  }
  if (assumptions.safeWithdrawalPct <= 0) warnings.push('Safe withdrawal rate should be above 0%.');
  return warnings;
};

const ScenarioOverrideEditor: React.FC<Props> = ({
  baselineAssumptions,
  overrideDraft,
  disabled,
  onChange,
  onSave,
  onClear,
  onOpenAssumptionsHub,
}) => {
  const [activeTab, setActiveTab] = useState<AssumptionsTabId>('worldModel');

  const effectiveAssumptions = useMemo(
    () => applyAssumptionsOverride(baselineAssumptions, overrideDraft),
    [baselineAssumptions, overrideDraft]
  );
  const impact = useMemo(() => computeAssumptionsImpact(effectiveAssumptions), [effectiveAssumptions]);
  const warnings = useMemo(() => buildWarnings(effectiveAssumptions), [effectiveAssumptions]);
  const hasOverride = hasMeaningfulAssumptionsOverride(overrideDraft);

  const registryByTab = useMemo(() => {
    const grouped = new Map<AssumptionsTabId, AssumptionRegistryItem[]>();
    for (const item of listScenarioOverrideRegistryItems()) {
      const existing = grouped.get(item.tab) ?? [];
      existing.push(item);
      grouped.set(item.tab, existing);
    }
    return grouped;
  }, []);

  const activeItems = registryByTab.get(activeTab) ?? [];

  const overrideCountByTab = useMemo(() => {
    const counts = new Map<AssumptionsTabId, number>();
    for (const tab of TAB_ORDER) counts.set(tab, 0);
    for (const item of listScenarioOverrideRegistryItems()) {
      if (getByPath(overrideDraft ?? {}, item.keyPath) !== undefined) {
        counts.set(item.tab, (counts.get(item.tab) ?? 0) + 1);
      }
    }
    return counts;
  }, [overrideDraft]);

  const updateOverrideValue = (keyPath: string, value: unknown) => {
    const current = { ...((overrideDraft ?? {}) as Record<string, unknown>) };
    onChange(setByPath(current, keyPath, value) as AssumptionsOverride);
  };

  const clearOverrideValue = (keyPath: string) => {
    onChange(deleteByPath({ ...((overrideDraft ?? {}) as Record<string, unknown>) }, keyPath) as AssumptionsOverride);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Scenario assumptions</div>
          <div style={{ fontSize: 12, opacity: 0.78 }}>
            This editor is registry-driven and can override shared baseline assumptions for the current scenario without changing the Assumptions Hub baseline.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              ...provenanceChipStyle,
              borderColor: hasOverride ? '#d39b2a' : '#3a8f5d',
              color: hasOverride ? '#f0c96b' : '#8ce0a8',
            }}
          >
            {hasOverride ? 'Scenario override active' : 'Inherited from shared baseline'}
          </span>
          <button type="button" onClick={onOpenAssumptionsHub} style={{ padding: '6px 10px', borderRadius: 8 }}>
            Open Assumptions Hub
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TAB_ORDER.map((tab) => {
          const count = overrideCountByTab.get(tab) ?? 0;
          return (
            <button
              key={tab}
              type="button"
              disabled={disabled && activeTab !== tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: activeTab === tab ? '1px solid #8ce0a8' : '1px solid #444',
                background: activeTab === tab ? 'rgba(58,143,93,0.12)' : 'transparent',
                color: 'inherit',
              }}
            >
              {ASSUMPTIONS_TAB_LABELS[tab]}
              {count > 0 ? ` · ${count}` : ''}
            </button>
          );
        })}
      </div>

      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{ASSUMPTIONS_TAB_LABELS[activeTab]}</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>
              Override only the fields this scenario genuinely needs. Everything else continues to inherit the shared baseline.
            </div>
          </div>
          <div style={{ ...chipStyle, borderColor: '#555' }}>{activeItems.length} registry fields</div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {activeItems.map((item) => {
            const usedBy = filterUsedByForAssumptionsHub(item.usedBy);
            const baselineValue = getByPath(baselineAssumptions, item.keyPath);
            const overrideValue = getByPath(overrideDraft ?? {}, item.keyPath);
            const effectiveValue = getByPath(effectiveAssumptions, item.keyPath);
            const isOverridden = overrideValue !== undefined;
            const enumOptions = item.unit === 'enum' ? getRegistryEnumOptions(item.keyPath) : null;

            return (
              <div key={item.keyPath} style={fieldCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        ...provenanceChipStyle,
                        borderColor: isOverridden ? '#d39b2a' : '#3a8f5d',
                        color: isOverridden ? '#f0c96b' : '#8ce0a8',
                      }}
                    >
                      {isOverridden ? 'Scenario override' : 'Using shared baseline'}
                    </span>
                    <span style={provenanceChipStyle}>{item.overrideableByStrategy ? 'Strategy can override' : 'Strategy-locked'}</span>
                  </div>
                </div>

                {usedBy.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {usedBy.map((label) => (
                      <span key={label} style={chipStyle}>Used by: {label}</span>
                    ))}
                  </div>
                )}

                {item.unit === 'boolean' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Baseline: {formatValue(baselineValue)}</div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input
                        aria-label={`${item.label} override`}
                        type="checkbox"
                        checked={Boolean(overrideValue ?? false)}
                        disabled={disabled}
                        onChange={(event) => updateOverrideValue(item.keyPath, event.target.checked)}
                      />
                      <span>Override value</span>
                    </label>
                    <button type="button" disabled={disabled || !isOverridden} onClick={() => clearOverrideValue(item.keyPath)} style={{ padding: '8px 10px', borderRadius: 8 }}>
                      Clear
                    </button>
                  </div>
                ) : item.unit === 'enum' && enumOptions && enumOptions.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Shared baseline</span>
                      <input disabled value={formatValue(baselineValue)} style={{ padding: '8px 10px', borderRadius: 8 }} readOnly />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Scenario override</span>
                      <select
                        aria-label={`${item.label} override`}
                        disabled={disabled}
                        value={typeof overrideValue === 'string' ? overrideValue : ''}
                        onChange={(event) => {
                          if (!event.target.value) {
                            clearOverrideValue(item.keyPath);
                            return;
                          }
                          updateOverrideValue(item.keyPath, event.target.value);
                        }}
                        style={{ padding: '8px 10px', borderRadius: 8 }}
                      >
                        <option value="">Use baseline</option>
                        {enumOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" disabled={disabled || !isOverridden} onClick={() => clearOverrideValue(item.keyPath)} style={{ padding: '8px 10px', borderRadius: 8 }}>
                      Clear
                    </button>
                  </div>
                ) : isNumericRegistryUnit(item.unit) ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Shared baseline</span>
                      <input disabled value={formatValue(baselineValue)} style={{ padding: '8px 10px', borderRadius: 8 }} readOnly />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Scenario override</span>
                      <input
                        aria-label={`${item.label} override`}
                        type="number"
                        inputMode="decimal"
                        step={getStepForUnit(item.unit)}
                        disabled={disabled}
                        placeholder="Use baseline"
                        value={overrideValue === undefined ? '' : String(overrideValue)}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (!raw.trim()) {
                            clearOverrideValue(item.keyPath);
                            return;
                          }
                          updateOverrideValue(item.keyPath, Number(raw));
                        }}
                        style={{ padding: '8px 10px', borderRadius: 8 }}
                      />
                    </label>
                    <button type="button" disabled={disabled || !isOverridden} onClick={() => clearOverrideValue(item.keyPath)} style={{ padding: '8px 10px', borderRadius: 8 }}>
                      Clear
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Shared baseline</span>
                      <input disabled value={formatValue(baselineValue)} style={{ padding: '8px 10px', borderRadius: 8 }} readOnly />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Scenario override</span>
                      <input
                        aria-label={`${item.label} override`}
                        disabled={disabled}
                        placeholder={getPlaceholderForItem(item) ?? 'Use baseline'}
                        value={overrideValue === undefined ? '' : String(overrideValue)}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (!raw.trim()) {
                            clearOverrideValue(item.keyPath);
                            return;
                          }
                          updateOverrideValue(item.keyPath, raw);
                        }}
                        style={{ padding: '8px 10px', borderRadius: 8 }}
                      />
                    </label>
                    <button type="button" disabled={disabled || !isOverridden} onClick={() => clearOverrideValue(item.keyPath)} style={{ padding: '8px 10px', borderRadius: 8 }}>
                      Clear
                    </button>
                  </div>
                )}

                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  Effective: {formatValue(effectiveValue)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={panelStyle}>
        <div style={{ fontWeight: 700 }}>Impact preview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Nominal net return</div>
            <div style={{ fontWeight: 700 }}>{impact.nominalNetReturnPct.toFixed(2)}%</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Approx real return</div>
            <div style={{ fontWeight: 700 }}>{impact.approxRealReturnPct.toFixed(2)}%</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Safe spend per 1M</div>
            <div style={{ fontWeight: 700 }}>{Math.round(impact.safeMonthlySpendPer1MDkk).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>FI number</div>
            <div style={{ fontWeight: 700 }}>{impact.fiNumberDkk === null ? '—' : Math.round(impact.fiNumberDkk).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div style={{ border: '1px solid #6b4f19', background: 'rgba(179, 121, 0, 0.12)', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Consistency</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {warnings.map((warning) => (
              <li key={warning} style={{ fontSize: 12 }}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" disabled={disabled || !hasOverride} onClick={onClear} style={{ padding: '8px 12px', borderRadius: 8 }}>
          Clear overrides
        </button>
        <button type="button" disabled={disabled} onClick={onSave} style={{ padding: '8px 12px', borderRadius: 8 }}>
          Save overrides
        </button>
      </div>
    </div>
  );
};

export default ScenarioOverrideEditor;
