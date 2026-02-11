// App.tsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import InfoPage from './pages/InfoPage';
import ExplorePage from './pages/ExplorePage';
import SimulationPage from './pages/SimulationPage';
import TutorialPage from './pages/TutorialPage';
import TutorialLandingPage from './pages/TutorialLandingPage';
import RunDiffPage from './pages/RunDiffPage';
import AppNavDrawer from './components/AppNavDrawer';
import SalaryAfterTaxPage from './pages/SalaryAfterTaxPage';
import ProgressTrackerPage from './pages/ProgressTrackerPage';
import MoneyPerspectivePage from './pages/MoneyPerspectivePage';
import LandingPage from './pages/LandingPage';

const App: React.FC = () => {
  const [isPinnedNav, setIsPinnedNav] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(min-width: 1400px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1400px)');
    const onChange = () => setIsPinnedNav(mq.matches);
    onChange();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      {isPinnedNav ? (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch' }}>
          <AppNavDrawer />

          <div style={{ flex: 1, minWidth: 0 }}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/tutorial" element={<TutorialLandingPage />} />
              <Route path="/tutorial/:mode" element={<TutorialPage />} />
              <Route path="/diff-scenarios" element={<RunDiffPage />} />
              <Route path="/salary-after-tax" element={<SalaryAfterTaxPage />} />
              <Route path="/progress-tracker" element={<ProgressTrackerPage />} />
              <Route path="/money-perspective" element={<MoneyPerspectivePage />} />
              <Route path="/simulation" element={<SimulationPage />} />
              <Route path="/simulation/tutorial" element={<TutorialLandingPage />} />
              <Route path="/simulation/tutorial/:mode" element={<TutorialPage />} />
              <Route path="/simulation/diff" element={<RunDiffPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/info" element={<InfoPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      ) : (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <header
            role="banner"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 15000,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderBottom: '1px solid #444',
              background: 'var(--fc-card-bg)',
              color: 'var(--fc-card-text)',
            }}
          >
            <AppNavDrawer />
            <Link
              to="/"
              aria-label="Go to Firecasting landing page"
              style={{ fontWeight: 800, lineHeight: 1.1, color: 'inherit', textDecoration: 'none' }}
            >
              Firecasting
            </Link>
          </header>

          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/tutorial" element={<TutorialLandingPage />} />
              <Route path="/tutorial/:mode" element={<TutorialPage />} />
              <Route path="/diff-scenarios" element={<RunDiffPage />} />
              <Route path="/salary-after-tax" element={<SalaryAfterTaxPage />} />
              <Route path="/progress-tracker" element={<ProgressTrackerPage />} />
              <Route path="/money-perspective" element={<MoneyPerspectivePage />} />
              <Route path="/simulation" element={<SimulationPage />} />
              <Route path="/simulation/tutorial" element={<TutorialLandingPage />} />
              <Route path="/simulation/tutorial/:mode" element={<TutorialPage />} />
              <Route path="/simulation/diff" element={<RunDiffPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/info" element={<InfoPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
