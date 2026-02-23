import React from 'react';
import PageLayout from '../../components/PageLayout';

export type SkeletonSection = {
  title: string;
  bullets?: string[];
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
                ) : (
                  <div style={{ opacity: 0.8 }}>
                    Placeholder content.
                  </div>
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
