import React from 'react';
import PageLayout from '../components/PageLayout';
import { useNavigate } from 'react-router-dom';
import { NAV_GROUPS, type NavGroup } from '../components/AppNavDrawer';

import { MiniPreview, getPageMeta } from './catalog/pageCatalog';
import { Button, Card } from '../components/ui';

const GroupSection: React.FC<{ group: NavGroup; onGo: (to: string) => void }> = ({ group, onGo }) => {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="text-lg font-black">{group.title}</div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {group.items.map((it) => {
          const meta = getPageMeta(it.to, it.label, group.title);
          const isHere = it.to === '/';
          return (
            <Card key={it.to}>
              <div className="flex items-baseline justify-between gap-2.5">
                <div className="text-base font-black">{it.label}</div>
                <div className="text-xs opacity-75">{it.to}</div>
              </div>
              <div className="mt-1.5 leading-snug opacity-85">{meta.description}</div>
              <MiniPreview kind={meta.preview.kind} label={meta.preview.label} />
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => onGo(it.to)} disabled={isHere} className={isHere ? 'opacity-65' : ''}>
                  {isHere ? 'You are here' : 'Open'}
                </Button>
              </div>
            </Card>
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
      <div className="flex flex-col gap-3.5">
        <header className="text-center">
          <h1 className="m-0 text-4xl font-extrabold tracking-tight sm:text-5xl">Firecasting</h1>
          <div className="mt-1.5 opacity-85">Own your time. Or rent your life out.</div>
          <div className="mt-2.5 text-[13px] leading-tight opacity-75">
            Your best hours. Your best days. Yours — or theirs?
          </div>
        </header>

        <Card>
          <div className="text-lg font-black">Start here</div>
          <div className="mt-1.5 leading-snug opacity-85">
            This Home page showcases every module. Each card explains what the page is for and shows a small visual preview.
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => navigate('/simulation')}>
              Open simulator
            </Button>
            <Button variant="secondary" onClick={() => navigate('/assumptions')}>
              Review assumptions
            </Button>
            <Button variant="secondary" onClick={() => navigate('/plan-report')}>
              Open plan report
            </Button>
          </div>
        </Card>

        {NAV_GROUPS.filter((g) => g.items.length > 0).map((g) => (
          <GroupSection key={g.title} group={g} onGo={(to) => navigate(to)} />
        ))}
      </div>
    </PageLayout>
  );
};

export default LandingPage;
