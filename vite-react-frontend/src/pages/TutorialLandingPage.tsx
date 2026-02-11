import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';

const card: React.CSSProperties = {
  border: '1px solid var(--fc-card-border)',
  borderRadius: 12,
  padding: 16,
  background: 'var(--fc-card-bg)',
  color: 'var(--fc-card-text)',
};

const btn = (variant: 'primary' | 'ghost'): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid var(--fc-subtle-border)',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 750,
  };
  if (variant === 'primary') return { ...base, background: '#2e2e2e', color: '#fff', borderColor: '#2e2e2e' };
  return { ...base, background: 'transparent', color: 'var(--fc-card-text)' };
};

const TutorialLandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageLayout variant="constrained" maxWidthPx={900}>
      <h1 style={{ textAlign: 'center', marginBottom: 6 }}>Tutor</h1>
      <p style={{ textAlign: 'center', opacity: 0.85, marginTop: 0 }}>
        Choose a track. Both are interactive and use the real form.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 18 }}>
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Normal tutorial</div>
          <div style={{ opacity: 0.9, marginBottom: 12 }}>
            Great first run: pick start date, add/edit phases, and run a simulation.
          </div>
          <button type="button" onClick={() => navigate('/simulation/tutorial/normal')} style={btn('primary')}>
            Start normal tutorial
          </button>
        </div>

        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Advanced tutorial</div>
          <div style={{ opacity: 0.9, marginBottom: 12 }}>
            Dive into seeds, paths/batch size, inflation/fees, tax exemptions, and return models.
          </div>
          <button type="button" onClick={() => navigate('/simulation/tutorial/advanced')} style={btn('primary')}>
            Start advanced tutorial
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
          <button type="button" onClick={() => navigate('/simulation')} style={btn('ghost')}>
            Back to simulation
          </button>
        </div>
      </div>
    </PageLayout>
  );
};

export default TutorialLandingPage;
