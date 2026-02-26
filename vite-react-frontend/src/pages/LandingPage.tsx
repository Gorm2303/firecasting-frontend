import React from 'react';
import PageLayout from '../components/PageLayout';
import { useNavigate } from 'react-router-dom';
import { NAV_GROUPS, type NavGroup } from '../components/AppNavDrawer';

import { MiniPreview, cardStyle, getPageMeta } from './catalog/pageCatalog';

const GroupSection: React.FC<{ group: NavGroup; onGo: (to: string) => void }> = ({ group, onGo }) => {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{group.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {group.items.map((it) => {
          const meta = getPageMeta(it.to, it.label, group.title);
          const isHere = it.to === '/';
          return (
            <div key={it.to} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{it.label}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>{it.to}</div>
              </div>
              <div style={{ marginTop: 6, opacity: 0.85, lineHeight: 1.35 }}>{meta.description}</div>
              <MiniPreview kind={meta.preview.kind} label={meta.preview.label} />
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onGo(it.to)} disabled={isHere} style={{ opacity: isHere ? 0.65 : 1 }}>
                  {isHere ? 'You are here' : 'Open'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageLayout variant="constrained">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <header style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0 }}>Firecasting</h1>
          <div style={{ opacity: 0.85, marginTop: 6 }}>Own your time. Or rent your life out.</div>
          <div style={{ opacity: 0.75, marginTop: 10, fontSize: 13, lineHeight: 1.2 }}>
            Your best hours. Your best days. Yours — or theirs?
          </div>
        </header>

        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Start here</div>
          <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.4 }}>
            This Home page showcases every module. Each card explains what the page is for and shows a small visual preview.
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => navigate('/simulation')}>Open simulator</button>
            <button type="button" onClick={() => navigate('/assumptions')}>Review assumptions</button>
            <button type="button" onClick={() => navigate('/plan-report')}>Open plan report</button>
          </div>
        </div>

        {NAV_GROUPS.filter((g) => g.items.length > 0).map((g) => (
          <GroupSection key={g.title} group={g} onGo={(to) => navigate(to)} />
        ))}
      </div>
    </PageLayout>
  );
};

export default LandingPage;
