import React from 'react';

import StrategyScaffoldPage from './strategy/StrategyScaffoldPage';

const WithdrawalStrategyPage: React.FC = () => {
  return (
    <StrategyScaffoldPage
      title="Withdrawal Strategy"
      subtitle="Define spending rules, guardrails, and retirement behavior while staying anchored to the withdrawal defaults from the assumptions hub."
      tab="withdrawalStrategy"
      intentFields={[
        { label: 'Strategy name', kind: 'text', placeholder: 'Guardrails with cash buffer' },
        { label: 'Primary rule', kind: 'select', options: ['fixedPct', 'fixedReal', 'guardrails'] },
        { label: 'Target monthly spend', kind: 'number', placeholder: '25000' },
        { label: 'Volatility tolerance', kind: 'select', options: ['low', 'balanced', 'high'] },
      ]}
      actionCards={[
        { title: 'Spending philosophy', body: 'Keep the rule template explicit so scenario overrides can change only the worldview, not the plan intent.' },
        { title: 'Guardrails', body: 'Compare strategy guardrails against the authority-layer defaults and surface any conflicts early.' },
        { title: 'Buffer behavior', body: 'Model refill thresholds and fallback actions as part of the strategy page, not the assumptions hub.' },
      ]}
      futureSections={[
        'Add withdrawal timeline and income blending editor.',
        'Connect spending-volatility tolerance to actual guardrail presets.',
        'Surface strategy vs assumptions diffs in scenario previews.',
      ]}
    />
  );
};

export default WithdrawalStrategyPage;
