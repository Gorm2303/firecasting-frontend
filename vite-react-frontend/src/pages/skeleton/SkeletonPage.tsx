import React from 'react';
import PageLayout from '../../components/PageLayout';
import { SkeletonWidgets, type SkeletonWidget } from './SkeletonWidgets';
import { Button, Card, PageHeader, Textarea } from '../../components/ui';

export type SkeletonSection = {
  title: string;
  bullets?: string[];
  fields?: { label: string; placeholder: string; multiline?: boolean }[];
  actions?: string[];
  widgets?: SkeletonWidget[];
};

type Props = {
  title: string;
  subtitle?: string;
  sections?: SkeletonSection[];
};

const SkeletonPage: React.FC<Props> = ({ title, subtitle, sections = [] }) => {
  return (
    <PageLayout variant="constrained">
      <div className="flex flex-col gap-3">
        <PageHeader title={title} subtitle={subtitle ?? 'Skeleton page: UI outline only (no backend calls yet).'} />

        {sections.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sections.map((s) => (
              <Card key={s.title} aria-label={s.title}>
                <div className="mb-2 text-lg font-extrabold">{s.title}</div>
                {s.bullets && s.bullets.length > 0 ? (
                  <ul className="m-0 list-disc pl-4.5 opacity-90">
                    {s.bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                ) : null}

                {s.fields && s.fields.length > 0 && (
                  <div className={['flex flex-col gap-2.5', s.bullets && s.bullets.length > 0 ? 'mt-3' : ''].join(' ')}>
                    {s.fields.map((f) => (
                      <div key={f.label} className="grid grid-cols-1 items-center gap-2.5 sm:grid-cols-[minmax(160px,0.9fr)_minmax(0,1.2fr)]">
                        <div className="font-bold opacity-95">{f.label}</div>
                        {f.multiline ? (
                          <Textarea value="" readOnly placeholder={f.placeholder} aria-label={f.label} className="bg-transparent" />
                        ) : (
                          <input
                            value=""
                            readOnly
                            placeholder={f.placeholder}
                            aria-label={f.label}
                            className="w-full box-border rounded-md border border-card-border bg-transparent px-3 py-2.5 text-sm text-card-fg placeholder:text-card-muted"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {s.widgets && s.widgets.length > 0 && (
                  <div className="mt-3">
                    <SkeletonWidgets widgets={s.widgets} />
                  </div>
                )}

                {s.actions && s.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.actions.map((a) => (
                      <Button key={a} disabled className="opacity-65">
                        {a}
                      </Button>
                    ))}
                  </div>
                )}

                {!s.bullets?.length && !s.fields?.length && !s.actions?.length && !s.widgets?.length && (
                  <div className="opacity-80">Placeholder content.</div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="mb-1.5 font-extrabold">Coming soon</div>
            <div className="opacity-85">This page is intentionally a skeleton.</div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};

export default SkeletonPage;
