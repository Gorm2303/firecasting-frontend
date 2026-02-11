import React, { useEffect, useState } from 'react';

export type PageLayoutVariant = 'constrained' | 'wide';

type Props = {
  variant?: PageLayoutVariant;
  /** Max content width used by the constrained variant (in px). */
  maxWidthPx?: number;
  /** Outer padding around the page (in px). */
  paddingPx?: number;
  children: React.ReactNode;
};

const PINNED_NAV_WIDTH_PX = 240;

const usePinnedNav = (): boolean => {
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(min-width: 1400px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1400px)');

    const onChange = () => setIsPinned(mq.matches);
    onChange();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return isPinned;
};

const PageLayout: React.FC<Props> = ({
  variant = 'constrained',
  maxWidthPx = 980,
  paddingPx = 16,
  children,
}) => {
  const isPinnedNav = usePinnedNav();

  // In pinned layout, constrained pages are centered relative to the full viewport
  // by adding a right gutter equal to the pinned nav width.
  const pinnedRightGutterPx = isPinnedNav && variant === 'constrained' ? PINNED_NAV_WIDTH_PX : 0;

  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        paddingLeft: paddingPx,
        paddingRight: paddingPx + pinnedRightGutterPx,
        paddingTop: paddingPx,
        paddingBottom: paddingPx,
      }}
    >
      <div
        style={
          variant === 'constrained'
            ? { maxWidth: maxWidthPx, margin: '0 auto' }
            : { width: '100%' }
        }
      >
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
