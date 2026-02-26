// App.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppNavDrawer from './components/AppNavDrawer';
import AppRoutes from './AppRoutes';

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
            <AppRoutes />
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
            <AppRoutes />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
