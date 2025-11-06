// App.tsx
import React from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import InfoPage from './pages/InfoPage';
import ExplorePage from './pages/ExplorePage';
import SimulationPage from './pages/SimulationPage';
import TutorialPage from './pages/TutorialPage';

const TAB_BAR_RESERVED_HEIGHT = 80;

const BottomPageTabs: React.FC = () => (
  <nav className="bottom-page-tabs" role="tablist" aria-label="Page navigation">
    <NavLink
      to="/simulation"
      role="tab"
      className={({ isActive }) => `bottom-page-tabs__btn ${isActive ? 'is-active' : ''}`}
    >
      <div style={{ fontSize: 'medium' }}>Simulation 🤖</div>
    </NavLink>

    <NavLink
      to="/explore"
      role="tab"
      className={({ isActive }) => `bottom-page-tabs__btn ${isActive ? 'is-active' : ''}`}
    >
      <div style={{ fontSize: 'medium' }}>Explore 📚</div>
    </NavLink>

    <NavLink
      to="/info"
      role="tab"
      className={({ isActive }) => `bottom-page-tabs__btn ${isActive ? 'is-active' : ''}`}
    >
      <div style={{ fontSize: 'medium' }}>Information ℹ️</div>
    </NavLink>
  </nav>
);

const App: React.FC = () => {
  return (
    <div
      style={{
        minWidth: '98vw',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: `calc(${TAB_BAR_RESERVED_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {/* Routed content */}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/simulation" replace />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/simulation/tutorial" element={<TutorialPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="*" element={<Navigate to="/simulation" replace />} />
        </Routes>
      </div>

      {/* Bottom tabs (links) */}
      <BottomPageTabs />
    </div>
  );
};

export default App;
