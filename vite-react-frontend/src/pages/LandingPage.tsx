import React from 'react';
import PageLayout from '../components/PageLayout';

const LandingPage: React.FC = () => {
  return (
    <PageLayout variant="constrained">
      <h1 style={{ textAlign: 'center' }}>Firecasting</h1>
      <div style={{ opacity: 0.85, textAlign: 'center' }}>Welcome.</div>
    </PageLayout>
  );
};

export default LandingPage;
