import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ' +
  'transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-card-fg text-card border border-transparent hover:opacity-90',
  secondary:
    'bg-transparent text-card-fg border border-card-border hover:border-accent',
  ghost: 'bg-transparent text-card-fg border border-transparent hover:bg-subtle',
};

export const buttonClasses = (variant: ButtonVariant = 'secondary', className = ''): string =>
  [base, variantClasses[variant], className].filter(Boolean).join(' ');

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', className = '', type = 'button', ...rest }, ref) => (
    <button ref={ref} type={type} className={buttonClasses(variant, className)} {...rest} />
  )
);
Button.displayName = 'Button';

type LinkButtonProps = LinkProps & {
  variant?: ButtonVariant;
};

export const LinkButton: React.FC<LinkButtonProps> = ({ variant = 'secondary', className = '', ...rest }) => (
  <Link className={buttonClasses(variant, className) + ' no-underline'} {...rest} />
);
