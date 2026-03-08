import React from 'react';

import StrategyScaffoldPage from './strategy/StrategyScaffoldPage';

const PolicyBuilderPage: React.FC = () => {
  return (
    <StrategyScaffoldPage
      title="Policy Builder"
      subtitle="Scaffold the actual policy-authoring route around signals, actions, and governance while inheriting policy defaults from the authority layer."
      tab="policyBuilder"
      intentFields={[
        { label: 'Policy set name', kind: 'text', placeholder: 'Downturn defense v1' },
        { label: 'Evaluation cadence', kind: 'select', options: ['monthly', 'quarterly', 'yearly'] },
        { label: 'Primary signal', kind: 'text', placeholder: 'Funded ratio < 0.9' },
        { label: 'Primary action cap', kind: 'number', placeholder: '10' },
      ]}
      actionCards={[
        { title: 'Signals', body: 'Separate the signal definitions from the actions so the policy model stays debuggable.' },
        { title: 'Actions', body: 'Keep actions explicit and capped so scenario comparisons can explain why a policy fired.' },
        { title: 'Governance', body: 'Cooldowns and conflict resolution should remain visible and tied back to assumptions defaults.' },
      ]}
      futureSections={[
        'Add policy rule table with trigger simulation preview.',
        'Connect signals to percentile and runway metrics from the simulator.',
        'Persist and compare policy sets independently of scenario inputs.',
      ]}
    />
  );
};

export default PolicyBuilderPage;
