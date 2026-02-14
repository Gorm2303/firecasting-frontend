import React from 'react';
import PageLayout from '../components/PageLayout';

const LandingPage: React.FC = () => {
  return (
    <PageLayout variant="constrained">
      <h1 style={{ textAlign: 'center' }}>Firecasting</h1>
      <div style={{ opacity: 0.85, textAlign: 'center' }}>Welcome.</div>
      <div style={{ opacity: 0.75, margin: "2px 0", fontSize: 13, lineHeight: 1, textAlign: 'center' }}>Your best hours.</div>
      <div style={{ opacity: 0.75, margin: "2px 0", fontSize: 13, lineHeight: 1, textAlign: 'center' }}>Your best days.</div>
      <div style={{ opacity: 0.75, margin: "2px 0", fontSize: 13, lineHeight: 1, textAlign: 'center' }}>Yours - or theirs?</div>
      <div style={{ opacity: 0.75, margin: "2px 0", fontSize: 13, lineHeight: 1, textAlign: 'center' }}>Your life - or their business?</div>
      <div style={{ opacity: 0.75, margin: "2px 0", fontSize: 13, lineHeight: 1, textAlign: 'center' }}>Own your time. Or rent your life out.</div>
    </PageLayout>
  );
};

export default LandingPage;
