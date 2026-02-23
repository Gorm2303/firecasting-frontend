import React from 'react';

export type SkeletonWidget =
  | {
      kind: 'chart';
      title: string;
      subtitle?: string;
    }
  | {
      kind: 'table';
      title: string;
      columns: string[];
      rows?: number;
    }
  | {
      kind: 'sliders';
      title: string;
      sliders: { label: string; min: number; max: number; value: number; unit?: string }[];
    }
  | {
      kind: 'timeline';
      title: string;
      rows: { label: string; range: string; note?: string }[];
    }
  | {
      kind: 'cards';
      title: string;
      cards: { title: string; body: string }[];
    }
  | {
      kind: 'calendar';
      title: string;
      months: { label: string; note?: string }[];
    };

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--fc-card-border)',
  borderRadius: 12,
  padding: 12,
};

const titleStyle: React.CSSProperties = { fontWeight: 850, marginBottom: 8 };

export const SkeletonWidgets: React.FC<{ widgets: SkeletonWidget[] }> = ({ widgets }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {widgets.map((w, idx) => {
        if (w.kind === 'chart') {
          return (
            <div key={`${w.kind}-${idx}`} style={panelStyle}>
              <div style={titleStyle}>{w.title}</div>
              {w.subtitle && <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 10 }}>{w.subtitle}</div>}
              <div
                aria-label="Chart placeholder"
                style={{
                  height: 160,
                  borderRadius: 10,
                  border: '1px dashed var(--fc-card-border)',
                  background: 'var(--fc-subtle-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.9,
                  fontWeight: 700,
                }}
              >
                Chart placeholder
              </div>
            </div>
          );
        }

        if (w.kind === 'table') {
          const rows = Math.max(1, Math.min(8, w.rows ?? 4));
          return (
            <div key={`${w.kind}-${idx}`} style={panelStyle}>
              <div style={titleStyle}>{w.title}</div>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {w.columns.map((c) => (
                        <th
                          key={c}
                          style={{
                            textAlign: 'left',
                            fontSize: 12,
                            opacity: 0.85,
                            padding: '8px 10px',
                            borderBottom: '1px solid var(--fc-card-border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                      <tr key={r}>
                        {w.columns.map((c, ci) => (
                          <td
                            key={`${c}-${ci}`}
                            style={{
                              padding: '10px 10px',
                              borderBottom: '1px solid var(--fc-card-border)',
                              opacity: 0.7,
                            }}
                          >
                            —
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        if (w.kind === 'sliders') {
          return (
            <div key={`${w.kind}-${idx}`} style={panelStyle}>
              <div style={titleStyle}>{w.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {w.sliders.map((s) => (
                  <div key={s.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 2fr', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, opacity: 0.95 }}>{s.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="range" min={s.min} max={s.max} value={s.value} disabled style={{ width: '100%' }} />
                      <div style={{ minWidth: 70, textAlign: 'right', opacity: 0.85 }}>
                        {s.value}
                        {s.unit ?? ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (w.kind === 'timeline') {
          return (
            <div key={`${w.kind}-${idx}`} style={panelStyle}>
              <div style={titleStyle}>{w.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {w.rows.map((r) => (
                  <div key={`${r.label}-${r.range}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(140px, 0.7fr) minmax(0, 1.2fr)', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontWeight: 750 }}>{r.label}</div>
                    <div style={{ opacity: 0.85, fontFamily: 'monospace' }}>{r.range}</div>
                    <div style={{ opacity: 0.75 }}>{r.note ?? ''}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (w.kind === 'cards') {
          return (
            <div key={`${w.kind}-${idx}`} style={panelStyle}>
              <div style={titleStyle}>{w.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {w.cards.map((c) => (
                  <div key={c.title} style={{ border: '1px solid var(--fc-card-border)', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 850, marginBottom: 6 }}>{c.title}</div>
                    <div style={{ opacity: 0.85 }}>{c.body}</div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" disabled style={{ opacity: 0.65 }}>
                        Apply (placeholder)
                      </button>
                      <button type="button" disabled style={{ opacity: 0.65 }}>
                        Edit (placeholder)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // calendar
        return (
          <div key={`${w.kind}-${idx}`} style={panelStyle}>
            <div style={titleStyle}>{w.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {w.months.map((m) => (
                <div
                  key={m.label}
                  style={{
                    border: '1px solid var(--fc-card-border)',
                    borderRadius: 12,
                    padding: 10,
                    minHeight: 70,
                    background: 'var(--fc-subtle-bg)',
                  }}
                >
                  <div style={{ fontWeight: 850 }}>{m.label}</div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>{m.note ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
