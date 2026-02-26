import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { NAV_GROUPS } from '../components/AppNavDrawer';
import { MiniPreview, cardStyle, getPageMeta } from './catalog/pageCatalog';

const CategoryLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const categoryId = params.categoryId ?? '';

  const group = useMemo(() => NAV_GROUPS.find((g) => g.id === categoryId) ?? null, [categoryId]);

  if (!group) {
    return (
      <PageLayout variant="constrained">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ margin: 0 }}>Category not found</h1>
          <div style={{ opacity: 0.8 }}>No such category: {categoryId}</div>
          <div>
            <button type="button" onClick={() => navigate('/')}>Go home</button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>{group.title}</h1>
            <div style={{ opacity: 0.8, marginTop: 6 }}>
              A focused catalog of pages in this category (including skeleton pages).
            </div>
          </div>
          <div>
            <button type="button" onClick={() => navigate('/')}>Back to Home</button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {group.items.map((it) => {
            const meta = getPageMeta(it.to, it.label, group.title);
            return (
              <div key={it.to} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{it.label}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>{it.to}</div>
                </div>
                <div style={{ marginTop: 6, opacity: 0.85, lineHeight: 1.35 }}>{meta.description}</div>
                <MiniPreview kind={meta.preview.kind} label={meta.preview.label} />
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => navigate(it.to)}>Open</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
};

export default CategoryLandingPage;
