import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const getFocusable = (root: HTMLElement): HTMLElement[] => {
  const nodes = root.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(nodes).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
};

const AppNavDrawer: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(min-width: 1400px)').matches;
  });

  const DRAWER_WIDTH_PX = 240;

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  const groups = useMemo<NavGroup[]>(
    () => [
      {
        title: 'Intro',
        items: [
          { label: 'Firecasting', to: '/', isActive: (p) => p === '/' },
          { label: 'Explainer', to: '/info', isActive: (p) => p === '/info' },
        ],
      },
      {
        title: 'Simulation',
        items: [
          {
            label: 'Tutor',
            to: '/tutorial',
            isActive: (p) => p.startsWith('/tutorial') || p.startsWith('/simulation/tutorial'),
          },
          { label: 'FIRE Simulator', to: '/simulation', isActive: (p) => p === '/simulation' },
          {
            label: 'Comparator',
            to: '/diff-scenarios',
            isActive: (p) => p === '/diff-scenarios' || p.startsWith('/simulation/diff'),
          },
          { label: 'Explorer', to: '/explore', isActive: (p) => p === '/explore' },
        ],
      },
      {
        title: 'Tools',
        items: [
          { label: 'Salary Taxator', to: '/salary-after-tax', isActive: (p) => p === '/salary-after-tax' },
          { label: 'Progress Tracker', to: '/progress-tracker', isActive: (p) => p === '/progress-tracker' },
          { label: 'Money Perspectivator', to: '/money-perspective', isActive: (p) => p === '/money-perspective' },
        ],
      },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1400px)');

    const onChange = () => setIsPinned(mq.matches);
    onChange();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    // Safari fallback
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  // If we become pinned, ensure the modal drawer is closed.
  useEffect(() => {
    if (isPinned) setOpen(false);
  }, [isPinned]);

  const onClose = useCallback(() => {
    setOpen(false);
    const last = lastActiveElementRef.current;
    if (last && typeof last.focus === 'function') last.focus();
  }, []);

  const onOpen = useCallback(() => {
    lastActiveElementRef.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
  }, []);

  const onNavigate = useCallback(
    (to: string) => {
      navigate(to);
      onClose();
    },
    [navigate, onClose]
  );

  useEffect(() => {
    if (!open || isPinned) return;
    // Wait for dialog to mount, then focus Close.
    queueMicrotask(() => {
      closeBtnRef.current?.focus();
    });
  }, [isPinned, open]);

  useEffect(() => {
    if (!open || isPinned) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Trap focus while the drawer is maximized (modal).
      if (e.key !== 'Tab') return;

      const root = dialogRef.current;
      if (!root) return;

      const focusable = getFocusable(root);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isPinned, onClose, open]);

  const DrawerNav = (
    <div role="navigation" aria-label="Primary">
      {groups.map((g, gi) => (
        <div key={g.title} style={{ marginTop: gi === 0 ? 0 : 10 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              margin: '12px 4px 4px 4px',
              opacity: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {g.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.items.map((it) => {
              const active = it.isActive(pathname);
              return (
                <button
                  key={it.to}
                  type="button"
                  data-nav-item="true"
                  onClick={() => onNavigate(it.to)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 10px',
                    borderRadius: 10,
                    border: '1px solid #444',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: 14,
                    fontWeight: active ? 800 : 600,
                    borderLeft: active ? '4px solid currentColor' : '4px solid transparent',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Pinned navigation: always visible at >= 1400px */}
      {isPinned ? (
        <aside
          aria-label="Navigation drawer"
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            width: DRAWER_WIDTH_PX,
            background: 'var(--fc-card-bg)',
            color: 'var(--fc-card-text)',
            borderRight: '1px solid var(--fc-card-border)',
            padding: 12,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflow: 'auto',
            flex: '0 0 auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Menu</div>
          </div>

          {DrawerNav}
        </aside>
      ) : (
        <>
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => (open ? onClose() : onOpen())}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #444',
              cursor: 'pointer',
              fontSize: 18,
              background: 'transparent',
              color: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
            title="Menu"
          >
            ☰
          </button>

          {open ? (
            <>
              <div
                role="presentation"
                onClick={onClose}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.35)',
                  zIndex: 20000,
                }}
              />

              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation drawer"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  height: '100vh',
                  width: `min(${DRAWER_WIDTH_PX}px, 85vw)`,
                  background: 'var(--fc-card-bg)',
                  color: 'var(--fc-card-text)',
                  borderRight: '1px solid var(--fc-card-border)',
                  padding: 12,
                  boxSizing: 'border-box',
                  zIndex: 20001,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 800 }}>Menu</div>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close navigation menu"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #444',
                      cursor: 'pointer',
                      fontSize: 14,
                      background: 'transparent',
                      color: 'inherit',
                    }}
                  >
                    Close
                  </button>
                </div>

                {DrawerNav}
              </div>
            </>
          ) : null}
        </>
      )}
    </>
  );
};

export default AppNavDrawer;
