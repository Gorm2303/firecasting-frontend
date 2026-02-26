import React from 'react';
import SkeletonPage from './skeleton/SkeletonPage';

const ProgressTrackerPage: React.FC = () => {
  return (
    <SkeletonPage
      title="Progress Tracker"
      subtitle="A lightweight operational dashboard (placeholder UI)."
      sections={[
        {
          title: 'Today (placeholder)',
          fields: [
            { label: 'Plan health', placeholder: 'green / yellow / red (placeholder)' },
            { label: 'FI date range', placeholder: 'computed' },
            { label: 'This month surplus', placeholder: 'computed' },
            { label: 'Buffer status', placeholder: 'computed' },
          ],
          widgets: [{ kind: 'chart', title: 'Progress over time', subtitle: 'Chart placeholder: FI range + net worth trend.' }],
        },
        {
          title: 'Weekly checklist (placeholder)',
          bullets: ['A small set of “keep the plan on rails” checks.'],
          widgets: [
            {
              kind: 'table',
              title: 'Checks',
              columns: ['Check', 'Status', 'Last done', 'Notes'],
              rows: 6,
            },
          ],
          actions: ['Mark done (placeholder)', 'Edit checklist (placeholder)'],
        },
        {
          title: 'Milestones (placeholder)',
          widgets: [
            {
              kind: 'cards',
              title: 'Next milestones',
              cards: [
                { title: 'Buffer target', body: 'Progress toward emergency buffer target (placeholder).' },
                { title: 'Coast FIRE', body: 'When you can stop contributions (placeholder).' },
                { title: 'FIRE', body: 'Full FI milestone status (placeholder).' },
              ],
            },
          ],
        },
        {
          title: 'Alerts (placeholder)',
          bullets: ['Only shows meaningful alerts; no notification spam (placeholder).'],
          widgets: [
            { kind: 'table', title: 'Alerts', columns: ['Severity', 'Alert', 'Suggested action', 'Status'], rows: 5 },
          ],
        },
      ]}
    />
  );
};

export default ProgressTrackerPage;
