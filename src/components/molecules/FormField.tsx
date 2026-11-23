import type { ReactElement, ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

/** Label above, control, and the field's error in danger below. */
export function FormField({ label, error, children }: FormFieldProps): ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-ink-muted">{label}</span>
      {children}
      {error && <span className="text-label text-danger">{error}</span>}
    </label>
  );
}
