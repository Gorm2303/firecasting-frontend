import React, { useState } from 'react';
import InfoPage from './pages/InfoPage';
import ExplorePage from './pages/ExplorePage';
import SimulationPage from './pages/SimulationPage';

type Page = 'simulation' | 'explore' | 'info';

interface Props {
  page: Page;
  setPage: (p: Page) => void;
}

const BottomPageTabs: React.FC<Props> = ({ page, setPage }) => (
  <nav className="bottom-page-tabs" role="tablist" aria-label="Page navigation">
    <button
      role="tab"
      aria-selected={page === 'simulation'}
      aria-current={page === 'simulation' ? 'page' : undefined}
      onClick={() => setPage('simulation')}
      className={`bottom-page-tabs__btn ${page === 'simulation' ? 'is-active' : ''}`}
    >
      <div style={{ fontSize: 'medium' }}>Simulation 🤖</div>
    </button>

    <button
      role="tab"
      aria-selected={page === 'explore'}
      aria-current={page === 'explore' ? 'page' : undefined}
      onClick={() => setPage('explore')}
      className={`bottom-page-tabs__btn ${page === 'explore' ? 'is-active' : ''}`}
    >
      <div style={{ fontSize: 'medium' }}>Explore 📚</div>
    </button>

    <button
      role="tab"
      aria-selected={page === 'info'}
      aria-current={page === 'info' ? 'page' : undefined}
      onClick={() => setPage('info')}
      className={`bottom-page-tabs__btn ${page === 'info' ? 'is-active' : ''}`}
    >
      <div style={{ fontSize: 'medium' }}>Information ℹ️</div>
    </button>
  </nav>
);

const TAB_BAR_RESERVED_HEIGHT = 80;

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('simulation');

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
      <div style={{ display: page === 'simulation' ? 'block' : 'none' }}>
        <SimulationPage />
      </div>

      <div style={{ display: page === 'explore' ? 'block' : 'none' }}>
        <ExplorePage />
      </div>

      <div style={{ display: page === 'info' ? 'block' : 'none' }}>
        <InfoPage />
      </div>

      <BottomPageTabs page={page} setPage={setPage} />
    </div>
  );
};

export default App;
