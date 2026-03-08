import React from 'react';

import StrategyScaffoldPage from './strategy/StrategyScaffoldPage';

const WithdrawalStrategyPage: React.FC = () => {
  return (
    <StrategyScaffoldPage
      title="Withdrawal Strategy"
      subtitle="Define the withdrawal-plan skeleton with the requested retirement, guardrail, routing, and bad-year sections while keeping inherited defaults visible beside the plan."
      tab="withdrawalStrategy"
      sections={[
        {
          title: 'Strategy Header',
          bullets: ['Name + description', 'Preset selector (placeholder)'],
        },
        {
          title: 'Retirement timing',
          fields: [
            { label: 'Withdrawal start', placeholder: 'age/date' },
            { label: 'Horizon', placeholder: 'until age X / indefinite' },
          ],
        },
        {
          title: 'Base withdrawal rule',
          bullets: ['Pick one (placeholder).'],
          fields: [
            { label: 'Rule', placeholder: 'fixed % / fixed spending / guardrails / floor-ceiling / variable' },
            { label: 'Inflation adjust', placeholder: 'toggle (placeholder)' },
          ],
        },
        {
          title: 'Guardrails & limits',
          fields: [
            { label: 'Spending floor', placeholder: 'e.g. 18,000 DKK/mo' },
            { label: 'Spending ceiling', placeholder: 'e.g. 35,000 DKK/mo' },
            { label: 'Max cut per year', placeholder: 'e.g. 8%' },
            { label: 'Triggers', placeholder: 'drawdown / percentile (placeholder)' },
          ],
        },
        {
          title: 'Income blending',
          fields: [
            { label: 'Include pension', placeholder: 'toggle (placeholder)' },
            { label: 'Include part-time', placeholder: 'toggle (placeholder)' },
            { label: 'Include side hustle', placeholder: 'toggle (placeholder)' },
            { label: 'Income schedule', placeholder: 'from-to + monthly amount (placeholder)' },
          ],
        },
        {
          title: 'Withdrawal routing & buffer',
          fields: [
            { label: 'Routing order', placeholder: 'cash → taxable → wrappers/pension' },
            { label: 'Cash buffer target', placeholder: 'months' },
            { label: 'Refill threshold', placeholder: 'months' },
          ],
        },
        {
          title: 'Bad-year playbook',
          bullets: ['P10/P25/P50/P75/P90 action cards with editable adjustments (placeholder).'],
          actions: ['Generate action cards (placeholder)'],
        },
        {
          title: 'Preview',
          bullets: ['Timeline preview table + charts placeholders.'],
          fields: [
            { label: 'Initial withdrawal', placeholder: 'computed' },
            { label: 'Floor / ceiling band', placeholder: 'computed' },
            { label: 'Buffer months', placeholder: 'computed' },
          ],
          widgets: [
            {
              kind: 'table',
              title: 'Timeline preview (placeholder)',
              columns: ['Year', 'Spending target', 'Income', 'Withdrawals', 'Mode'],
              rows: 5,
            },
            { kind: 'chart', title: 'Withdrawals over time', subtitle: 'Chart placeholder.' },
            { kind: 'chart', title: 'Floor/Ceiling band', subtitle: 'Chart placeholder.' },
          ],
        },
      ]}
    />
  );
};

export default WithdrawalStrategyPage;
