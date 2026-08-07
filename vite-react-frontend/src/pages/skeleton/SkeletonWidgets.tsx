import React from 'react';
import { Button, Panel } from '../../components/ui';

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

const WidgetTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-2 font-extrabold">{children}</div>
);

export const SkeletonWidgets: React.FC<{ widgets: SkeletonWidget[] }> = ({ widgets }) => {
  return (
    <div className="flex flex-col gap-2.5">
      {widgets.map((w, idx) => {
        if (w.kind === 'chart') {
          return (
            <Panel key={`${w.kind}-${idx}`}>
              <WidgetTitle>{w.title}</WidgetTitle>
              {w.subtitle && <div className="mb-2.5 text-sm opacity-75">{w.subtitle}</div>}
              <div
                aria-label="Chart placeholder"
                className="flex h-40 items-center justify-center rounded-md border border-dashed border-card-border bg-subtle font-bold opacity-90"
              >
                Chart placeholder
              </div>
            </Panel>
          );
        }

        if (w.kind === 'table') {
          const rows = Math.max(1, Math.min(8, w.rows ?? 4));
          return (
            <Panel key={`${w.kind}-${idx}`}>
              <WidgetTitle>{w.title}</WidgetTitle>
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {w.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap border-b border-card-border px-2.5 py-2 text-left text-xs opacity-85">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                      <tr key={r}>
                        {w.columns.map((c, ci) => (
                          <td key={`${c}-${ci}`} className="border-b border-card-border px-2.5 py-2.5 opacity-70">
                            —
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        }

        if (w.kind === 'sliders') {
          return (
            <Panel key={`${w.kind}-${idx}`}>
              <WidgetTitle>{w.title}</WidgetTitle>
              <div className="flex flex-col gap-2.5">
                {w.sliders.map((s) => (
                  <div key={s.label} className="grid grid-cols-[minmax(160px,1fr)_2fr] items-center gap-2.5">
                    <div className="font-bold opacity-95">{s.label}</div>
                    <div className="flex items-center gap-2.5">
                      <input type="range" min={s.min} max={s.max} value={s.value} disabled className="w-full" />
                      <div className="min-w-17.5 text-right opacity-85">
                        {s.value}
                        {s.unit ?? ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          );
        }

        if (w.kind === 'timeline') {
          return (
            <Panel key={`${w.kind}-${idx}`}>
              <WidgetTitle>{w.title}</WidgetTitle>
              <div className="flex flex-col gap-2">
                {w.rows.map((r) => (
                  <div
                    key={`${r.label}-${r.range}`}
                    className="grid grid-cols-[minmax(180px,1fr)_minmax(140px,0.7fr)_minmax(0,1.2fr)] items-center gap-2.5"
                  >
                    <div className="font-bold">{r.label}</div>
                    <div className="font-mono opacity-85">{r.range}</div>
                    <div className="opacity-75">{r.note ?? ''}</div>
                  </div>
                ))}
              </div>
            </Panel>
          );
        }

        if (w.kind === 'cards') {
          return (
            <Panel key={`${w.kind}-${idx}`}>
              <WidgetTitle>{w.title}</WidgetTitle>
              <div className="flex flex-col gap-2.5">
                {w.cards.map((c) => (
                  <div key={c.title} className="rounded-lg border border-card-border p-3">
                    <div className="mb-1.5 font-extrabold">{c.title}</div>
                    <div className="opacity-85">{c.body}</div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button disabled className="opacity-65">
                        Apply (placeholder)
                      </Button>
                      <Button disabled className="opacity-65">
                        Edit (placeholder)
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          );
        }

        // calendar
        return (
          <Panel key={`${w.kind}-${idx}`}>
            <WidgetTitle>{w.title}</WidgetTitle>
            <div className="grid grid-cols-3 gap-2">
              {w.months.map((m) => (
                <div key={m.label} className="min-h-17.5 rounded-lg border border-card-border bg-subtle p-2.5">
                  <div className="font-extrabold">{m.label}</div>
                  <div className="mt-1 text-xs opacity-75">{m.note ?? '—'}</div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
};
