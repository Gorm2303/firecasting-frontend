import React from 'react';

import StrategyScaffoldPage from './strategy/StrategyScaffoldPage';

const DepositStrategyPage: React.FC = () => {
  return (
    <StrategyScaffoldPage
      title="Deposit Strategy"
      subtitle="Build the contribution plan skeleton with the exact deposit sections requested, while keeping inherited deposit defaults visible beside the draft strategy."
      tab="depositStrategy"
      sections={[
        {
          title: 'Strategy Header',
          bullets: ['Name + description', 'Preset selector (placeholder)'],
        },
        {
          title: 'Preset selector (placeholder)',
          fields: [
            { label: 'Preset', placeholder: 'e.g. “Steady monthly”, “Front-load”, “Step-up yearly”' },
            { label: 'Mode', placeholder: 'Normal / Lean / Aggressive / Emergency' },
          ],
          actions: ['Load preset (placeholder)'],
        },
        {
          title: 'Deposit schedule',
          fields: [
            { label: 'Base deposit amount', placeholder: 'e.g. 6,000 DKK' },
            { label: 'Frequency', placeholder: 'monthly / yearly' },
            { label: 'Start condition', placeholder: 'date/age or “until FI”' },
            { label: 'End condition', placeholder: 'date/age or “for N years”' },
            { label: 'Break periods', placeholder: 'pause intervals (placeholder)' },
          ],
        },
        {
          title: 'Step-ups / escalation',
          fields: [
            { label: 'Increase deposits', placeholder: 'none / fixed amount / % per year' },
            { label: 'Inflation adjust', placeholder: 'toggle (placeholder)' },
          ],
        },
        {
          title: 'One-off deposits',
          fields: [
            { label: 'One-time contribution', placeholder: 'date + amount + label' },
            { label: 'Irregular recurring', placeholder: 'e.g. “every March +X”' },
          ],
          actions: ['Add one-off (placeholder)'],
        },
        {
          title: 'Contribution routing (priorities)',
          bullets: ['Drag/drop priority order (placeholder).'],
          fields: [
            { label: 'Priority order', placeholder: 'buffer → debt → wrappers → taxable' },
            { label: 'Caps/targets', placeholder: 'simple numeric fields (placeholder)' },
          ],
        },
        {
          title: 'Preview',
          bullets: ['Avg monthly deposit', 'Total deposits (20y)', 'Pause months count', 'Timeline preview + chart placeholders'],
          fields: [
            { label: 'Avg monthly deposit', placeholder: 'computed' },
            { label: 'Total deposits (20y)', placeholder: 'computed' },
            { label: 'Pause months', placeholder: 'computed' },
          ],
          widgets: [
            {
              kind: 'table',
              title: 'Timeline preview (placeholder)',
              columns: ['Year', 'Planned deposits', 'One-offs', 'Mode'],
              rows: 5,
            },
            { kind: 'chart', title: 'Deposits over time', subtitle: 'Chart placeholder.' },
          ],
        },
      ]}
    />
  );
};

export default DepositStrategyPage;
