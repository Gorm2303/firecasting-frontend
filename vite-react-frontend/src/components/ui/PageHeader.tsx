import React from 'react';

type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, className = '' }) => (
  <header className={['flex flex-wrap items-start justify-between gap-3', className].join(' ')}>
    <div>
      <h1 className="m-0 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle ? <div className="mt-1.5 text-sm text-card-fg/80">{subtitle}</div> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </header>
);
