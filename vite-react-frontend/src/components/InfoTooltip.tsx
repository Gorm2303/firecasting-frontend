import React from 'react';

type Props = {
  label: string;
  children: React.ReactNode;
};

export default function InfoTooltip({ label, children }: Props) {
  const [open, setOpen] = React.useState(false);
  const tooltipId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const tooltipRef = React.useRef<HTMLSpanElement | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ left: number; top: number; visible: boolean }>(
    () => ({ left: 0, top: 0, visible: false })
  );

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open) return;

    const GAP_PX = 6;
    const VIEWPORT_PADDING_PX = 8;

    const recompute = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const triggerRect = trigger.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();

      const maxLeft = Math.max(VIEWPORT_PADDING_PX, window.innerWidth - tipRect.width - VIEWPORT_PADDING_PX);
      const left = Math.min(Math.max(VIEWPORT_PADDING_PX, triggerRect.left), maxLeft);

      const preferBelowTop = triggerRect.bottom + GAP_PX;
      const belowWouldOverflow = preferBelowTop + tipRect.height + VIEWPORT_PADDING_PX > window.innerHeight;

      let top = preferBelowTop;
      if (belowWouldOverflow) {
        const aboveTop = triggerRect.top - GAP_PX - tipRect.height;
        if (aboveTop >= VIEWPORT_PADDING_PX) {
          top = aboveTop;
        } else {
          // Clamp within viewport if it can't fully fit above or below.
          top = Math.min(
            Math.max(VIEWPORT_PADDING_PX, preferBelowTop),
            Math.max(VIEWPORT_PADDING_PX, window.innerHeight - tipRect.height - VIEWPORT_PADDING_PX)
          );
        }
      }

      setTooltipPos({ left, top, visible: true });
    };

    // Compute twice: first mount and then after layout settles.
    recompute();
    const raf = window.requestAnimationFrame(recompute);

    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open]);

  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 6 }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) setTooltipPos({ left: 0, top: 0, visible: false });
            return next;
          });
        }}
        onBlur={(e) => {
          // If focus moved outside of this control, close.
          const current = e.currentTarget;
          queueMicrotask(() => {
            if (document.activeElement && current.contains(document.activeElement)) return;
            setOpen(false);
          });
        }}
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: '1px solid #666',
          background: 'transparent',
          color: 'inherit',
          fontSize: 12,
          lineHeight: '16px',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.9,
        }}
        title="More info"
      >
        i
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            zIndex: 1000,
            width: 260,
            maxWidth: 'min(320px, calc(100vw - 16px))',
            maxHeight: 'min(60vh, calc(100vh - 16px))',
            overflowY: 'auto',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'normal',
            border: '1px solid #444',
            borderRadius: 10,
            padding: '10px 12px',
            background: '#1f1f1f',
            color: '#eee',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            fontSize: 13,
            lineHeight: 1.35,
            visibility: tooltipPos.visible ? 'visible' : 'hidden',
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
