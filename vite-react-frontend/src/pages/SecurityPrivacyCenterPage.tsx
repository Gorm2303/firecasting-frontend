import React from 'react';
import SkeletonPage from './skeleton/SkeletonPage';

const SecurityPrivacyCenterPage: React.FC = () => {
  return (
    <SkeletonPage
      title="Security & Privacy Center"
      sections={[
        {
          title: 'Data permissions',
          bullets: ['What the app can access (placeholder)', 'Granular toggles + audit log (placeholder)'],
        },
        {
          title: 'Export / Delete',
          bullets: ['Export your data (placeholder)', 'Delete account and/or specific datasets (placeholder)'],
        },
        {
          title: 'Session / Device history',
          bullets: ['Active sessions list (placeholder)', 'Device list + revoke access (placeholder)'],
        },
        {
          title: 'Encryption transparency',
          bullets: ['What is encrypted at rest/in transit (placeholder)', 'Key handling (placeholder)'],
        },
      ]}
    />
  );
};

export default SecurityPrivacyCenterPage;
