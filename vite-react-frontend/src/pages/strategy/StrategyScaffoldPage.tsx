import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageLayout from '../../components/PageLayout';
import { useAssumptions } from '../../state/assumptions';
import {
  ASSUMPTIONS_TAB_LABELS,
  filterUsedByForAssumptionsHub,
  listStrategyRegistryItems,
  type AssumptionsTabId,
} from '../../state/assumptionsRegistry';

type StrategyField = {
  label: string;
  kind: 'text' | 'number' | 'select';
  placeholder?: string;
  options?: string[];
  initialValue?: string;
};

type Props = {
  title: string;
  subtitle: string;
  tab: AssumptionsTabId;
  intentFields: StrategyField[];
  actionCards: Array<{ title: string; body: string }>;
  futureSections: string[];
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
  intentFields,
  actionCards,
  futureSections,
}) => {
  const { currentAssumptions } = useAssumptions();
  const [formState, setFormState] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    intentFields.forEach((field) => {
      init[field.label] = field.initialValue ?? '';
    });
    return init;
  });

  const registryItems = useMemo(() => listStrategyRegistryItems(tab), [tab]);
  const usedByCount = useMemo(
    () => new Set(registryItems.flatMap((item) => filterUsedByForAssumptionsHub(item.usedBy))).size,
    [registryItems]
  );

  return (
    <PageLayout variant="wide">
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={chipStyle}>Slice E scaffold</span>
              <span style={chipStyle}>Defaults tab: {ASSUMPTIONS_TAB_LABELS[tab]}</span>
            </div>
            <h1 style={{ margin: 0 }}>{title}</h1>
            <div style={{ opacity: 0.8, maxWidth: 900 }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/assumptions" style={{ ...chipStyle, textDecoration: 'none', color: 'inherit' }}>Open Assumptions Hub</Link>
            <Link to="/simulation" style={{ ...chipStyle, textDecoration: 'none', color: 'inherit' }}>Back to simulator</Link>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.95fr) minmax(420px, 1.05fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Strategy intent</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>This is the route/page scaffold for the actual user plan. It stays separate from assumptions defaults.</div>
            </div>
            {intentFields.map((field) => (
              <label key={field.label} style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{field.label}</span>
                {field.kind === 'select' ? (
                  <select
                    value={formState[field.label] ?? ''}
                    onChange={(event) => setFormState((prev) => ({ ...prev, [field.label]: event.target.value }))}
                    style={{ padding: '10px 12px', borderRadius: 10 }}
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.kind === 'number' ? 'number' : 'text'}
                    value={formState[field.label] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(event) => setFormState((prev) => ({ ...prev, [field.label]: event.target.value }))}
                    style={{ padding: '10px 12px', borderRadius: 10 }}
                  />
                )}
              </label>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={{ padding: '10px 14px', borderRadius: 10 }}>Save draft scaffold</button>
              <button type="button" style={{ padding: '10px 14px', borderRadius: 10 }}>Run preview later</button>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Inherited defaults from assumptions</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>These defaults come from the authority layer today. Strategy-specific config can later override them explicitly.</div>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {actionCards.map((card) => (
            <div key={card.title} style={cardStyle}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{card.title}</div>
              <div style={{ opacity: 0.8 }}>{card.body}</div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Next scaffolding slices</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {futureSections.map((item) => (
              <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ ...chipStyle, minWidth: 28, textAlign: 'center' }}>→</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default StrategyScaffoldPage;
