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
  const [formState, setFormState] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    sections.forEach((section) => {
      section.fields?.forEach((field) => {
        init[`${section.title}:${field.label}`] = '';
      });
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
                    {section.fields.map((field) => {
                      const stateKey = `${section.title}:${field.label}`;
                      return (
                        <label key={field.label} style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{field.label}</span>
                          <input
                            type="text"
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
