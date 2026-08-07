import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { NAV_GROUPS } from '../components/AppNavDrawer';
import { MiniPreview, getPageMeta } from './catalog/pageCatalog';
import { Button, Card } from '../components/ui';

const CategoryLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const categoryId = params.categoryId ?? '';

  const group = useMemo(() => NAV_GROUPS.find((g) => g.id === categoryId) ?? null, [categoryId]);

  if (!group) {
    return (
      <PageLayout variant="constrained">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 text-2xl font-extrabold">Category not found</h1>
          <div className="opacity-80">No such category: {categoryId}</div>
          <div>
            <Button variant="secondary" onClick={() => navigate('/')}>
              Go home
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout variant="constrained">
      <div className="flex flex-col gap-3.5">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-extrabold">{group.title}</h1>
            <div className="mt-1.5 opacity-80">A focused catalog of pages in this category (including skeleton pages).</div>
          </div>
          <div>
            <Button variant="secondary" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </div>
        </header>

        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {group.items.map((it) => {
            const meta = getPageMeta(it.to, it.label, group.title);
            return (
              <Card key={it.to}>
                <div className="flex items-baseline justify-between gap-2.5">
                  <div className="text-base font-black">{it.label}</div>
                  <div className="text-xs opacity-75">{it.to}</div>
                </div>
                <div className="mt-1.5 leading-snug opacity-85">{meta.description}</div>
                <MiniPreview kind={meta.preview.kind} label={meta.preview.label} />
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => navigate(it.to)}>
                    Open
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
};

export default CategoryLandingPage;
