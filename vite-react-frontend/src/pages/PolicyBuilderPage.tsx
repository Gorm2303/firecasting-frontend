import React from 'react';

import StrategyScaffoldPage from './strategy/StrategyScaffoldPage';

const PolicyBuilderPage: React.FC = () => {
  return (
    <StrategyScaffoldPage
      title="Policy Builder"
      subtitle="Define adaptive IF/THEN guardrails and inspect placeholder trigger behavior while keeping the inherited policy defaults visible beside the draft policy structure."
      tab="policyBuilder"
      sections={[
        {
          title: 'Adaptive rules',
          bullets: ['Define IF/THEN guardrails to automate behavior.'],
          fields: [
            { label: 'Rule', placeholder: 'If funded ratio < 0.9 AND percentile < 25 → cut discretionary 10%' },
            { label: 'Rule', placeholder: 'If percentile > 80 for 12 months → rebalance + increase giving' },
            { label: 'Rule', placeholder: 'If drawdown > 20% early retirement → apply guardrail withdrawals' },
          ],
          actions: ['Add rule (placeholder)', 'Validate policy (placeholder)'],
        },
        {
          title: 'Policy simulator (placeholder)',
          bullets: ['Show how rules would have triggered under different percentile tracks.'],
          actions: ['Simulate triggers (placeholder)'],
        },
      ]}
    />
  );
};

export default PolicyBuilderPage;
