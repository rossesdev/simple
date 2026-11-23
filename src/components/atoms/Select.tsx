import type { ReactElement, SelectHTMLAttributes } from 'react';

import { FIELD_CLASSES, fieldBorderClass } from './Input';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  placeholder?: string;
  hasError?: boolean;
}

/** Native select: the phone's own picker is the easiest to use with one thumb. */
export function Select({
  options,
  placeholder,
  hasError = false,
  className = '',
  ...props
}: SelectProps): ReactElement {
  return (
    <select
      aria-invalid={hasError || undefined}
      className={`${FIELD_CLASSES} ${fieldBorderClass(hasError)} appearance-none ${className}`}
      {...props}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
