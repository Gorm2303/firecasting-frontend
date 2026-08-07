import React from 'react';

type FieldRowProps = {
  label: React.ReactNode;
  htmlFor?: string;
  info?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Label | control | optional info-button row. Stacks on narrow viewports. */
export const FieldRow: React.FC<FieldRowProps> = ({ label, htmlFor, info, children, className = '' }) => (
  <div
    className={[
      'grid grid-cols-1 items-center gap-1.5',
      'sm:grid-cols-[minmax(140px,0.9fr)_minmax(0,1.3fr)_auto] sm:gap-2.5',
      className,
    ].join(' ')}
  >
    <label htmlFor={htmlFor} className="text-sm font-medium text-card-fg/90">
      {label}
    </label>
    <div className="min-w-0">{children}</div>
    {info ? <div className="flex justify-end sm:justify-start">{info}</div> : null}
  </div>
);
