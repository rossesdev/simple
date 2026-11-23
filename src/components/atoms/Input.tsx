import type { InputHTMLAttributes, ReactElement } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const FIELD_CLASSES =
  'h-control w-full rounded-md bg-surface-1 px-4 text-body text-ink placeholder:text-ink-muted outline-none';

export function fieldBorderClass(hasError: boolean): string {
  return hasError ? 'border-[1.5px] border-danger' : 'border border-line focus:border-accent';
}

export function Input({ hasError = false, className = '', ...props }: InputProps): ReactElement {
  return (
    <input
      aria-invalid={hasError || undefined}
      className={`${FIELD_CLASSES} ${fieldBorderClass(hasError)} ${className}`}
      {...props}
    />
  );
}
