import React from 'react';

import StrategyScaffoldPage from './strategy/StrategyScaffoldPage';

const DepositStrategyPage: React.FC = () => {
  return (
    <StrategyScaffoldPage
      title="Deposit Strategy"
      subtitle="Define the contribution plan while inheriting deposit conventions from the assumptions authority layer. This is the first real route scaffold replacing the old placeholder page."
      tab="depositStrategy"
      intentFields={[
        { label: 'Strategy name', kind: 'text', placeholder: 'Steady monthly accumulation' },
        { label: 'Primary mode', kind: 'select', options: ['steady', 'front-load', 'step-up', 'defensive'] },
        { label: 'Target monthly contribution', kind: 'number', placeholder: '6000' },
        { label: 'Pause rule', kind: 'text', placeholder: 'Pause when emergency buffer < target' },
      ]}
      actionCards={[
        { title: 'Contribution cadence', body: 'Match the strategy cadence to the deposit defaults unless the plan explicitly deviates.' },
        { title: 'Escalation path', body: 'Model how increases happen over time, then compare that plan with the baseline default escalation.' },
        { title: 'Routing policy', body: 'Keep routing decisions visible so future scenario overrides can target only the exceptions.' },
      ]}
      futureSections={[
        'Add actual deposit schedule builder with one-offs and pause windows.',
        'Persist strategy drafts separately from assumptions defaults.',
        'Connect the strategy output to scenario composition and compare flows.',
      ]}
    />
  );
};

export default DepositStrategyPage;
