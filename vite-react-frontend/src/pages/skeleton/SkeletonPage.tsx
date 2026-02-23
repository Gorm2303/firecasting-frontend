import React from 'react';
import PageLayout from '../../components/PageLayout';

export type SkeletonSection = {
  title: string;
  bullets?: string[];
  fields?: { label: string; placeholder: string }[];
  actions?: string[];
};

type Props = {
  title: string;
  subtitle?: string;
  sections?: SkeletonSection[];
};

const cardStyle: React.CSSProperties = {
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
  border: '1px solid var(--fc-card-border)',
  borderRadius: 14,
  padding: 14,
};

const SkeletonPage: React.FC<Props> = ({ title, subtitle, sections = [] }) => {
  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <div style={{ opacity: 0.78, marginTop: 6 }}>
            {subtitle ?? 'Skeleton page: UI outline only (no backend calls yet).'}
          </div>
        </div>

        {sections.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sections.map((s) => (
              <section key={s.title} style={cardStyle} aria-label={s.title}>
                <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 8 }}>{s.title}</div>
                {s.bullets && s.bullets.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
                    {s.bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>

                ) : null}

                {s.fields && s.fields.length > 0 && (
                  <div style={{ marginTop: s.bullets && s.bullets.length > 0 ? 12 : 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {s.fields.map((f) => (
                      <div
                        key={f.label}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(160px, 0.9fr) minmax(0, 1.2fr)',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontWeight: 700, opacity: 0.95 }}>{f.label}</div>
                        <input
                          value=""
                          readOnly
                          placeholder={f.placeholder}
                          aria-label={f.label}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--fc-card-border)',
                            background: 'transparent',
                            color: 'inherit',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {s.actions && s.actions.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {s.actions.map((a) => (
                      <button key={a} type="button" disabled style={{ opacity: 0.65 }}>
                        {a}
                      </button>
                    ))}
                  </div>
                )}

                {!s.bullets?.length && !s.fields?.length && !s.actions?.length && (
                  <div style={{ opacity: 0.8 }}>Placeholder content.</div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Coming soon</div>
            <div style={{ opacity: 0.85 }}>
              This page is intentionally a skeleton.
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default SkeletonPage;
