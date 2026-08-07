import React from 'react';

const fieldBase =
  'w-full box-border rounded-md border border-card-border bg-card text-card-fg px-3 py-2.5 text-sm ' +
  'placeholder:text-card-muted focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => <input ref={ref} className={[fieldBase, className].join(' ')} {...rest} />
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', rows = 3, ...rest }, ref) => (
    <textarea ref={ref} rows={rows} className={[fieldBase, 'resize-y', className].join(' ')} {...rest} />
  )
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', ...rest }, ref) => (
    <select ref={ref} className={['fc-themed-select', fieldBase, className].join(' ')} {...rest} />
  )
);
Select.displayName = 'Select';
