import React from 'react';

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  active?: boolean;
};

/** Small pill-shaped action button, for toolbars of many low-emphasis actions (Save draft, Export, ...). */
export const chipButtonClass =
  'inline-flex items-center gap-1.5 rounded-full border border-card-border bg-transparent px-2.5 py-1 text-xs ' +
  'text-card-fg disabled:opacity-50 disabled:cursor-default enabled:cursor-pointer enabled:hover:border-accent ' +
  'whitespace-nowrap no-underline';

export const Chip: React.FC<ChipProps> = ({ className = '', active = false, ...rest }) => (
  <span
    className={[
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
      active ? 'bg-card-fg text-card border-transparent' : 'border-card-border text-card-fg bg-transparent',
      className,
    ].join(' ')}
    {...rest}
  />
);
