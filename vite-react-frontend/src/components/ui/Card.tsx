import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  dashed?: boolean;
};

export const Card: React.FC<CardProps> = ({ className = '', dashed = false, ...rest }) => (
  <div
    className={[
      'bg-card text-card-fg rounded-lg p-3.5',
      dashed ? 'border border-dashed border-card-border' : 'border border-card-border',
      className,
    ].join(' ')}
    {...rest}
  />
);

export const Panel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...rest }) => (
  <div className={['border border-card-border rounded-md p-3', className].join(' ')} {...rest} />
);
