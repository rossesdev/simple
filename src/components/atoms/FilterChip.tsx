import type { ReactElement } from 'react';

interface FilterChipProps {
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

export function FilterChip({ label, isActive = false, onClick }: FilterChipProps): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`h-chip shrink-0 rounded-full border px-3.5 text-label ${
        isActive ? 'border-accent text-ink' : 'border-line text-ink-muted'
      }`}
    >
      {label}
    </button>
  );
}
