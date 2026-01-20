import React from 'react';

type Props = {
  label: string;
  children: React.ReactNode;
};

export default function InfoTooltip({ label, children }: Props) {
  const [open, setOpen] = React.useState(false);
  const tooltipId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 6 }}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((v) => !v)}
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
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1000,
            width: 260,
            maxWidth: '70vw',
            border: '1px solid #444',
            borderRadius: 10,
            padding: '10px 12px',
            background: '#1f1f1f',
            color: '#eee',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            fontSize: 13,
            lineHeight: 1.35,
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
