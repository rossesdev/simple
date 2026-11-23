import type { ReactElement } from 'react';

import { categoryLabel } from '../../domain/categories';
import type { Movement } from '../../domain/types';
import { Amount } from '../atoms/Amount';

interface MovementRowProps {
  /** A saved movement or an unvalidated draft (category may still be wrong). */
  movement: Pick<Movement, 'type' | 'amount' | 'description'> & { category: string | null };
  accountName: string;
  toAccountName?: string;
  /** Shown in danger in place of the sub line (confirmation modal). */
  errorMessage?: string;
  onSelect?: () => void;
}

export function MovementRow({
  movement,
  accountName,
  toAccountName,
  errorMessage,
  onSelect,
}: MovementRowProps): ReactElement {
  const subLine =
    movement.type === 'transfer'
      ? `${accountName} → ${toAccountName ?? '—'}`
      : [categoryLabel(movement.type, movement.category), accountName].filter(Boolean).join(' · ');
  const hasValidAmount = Number.isInteger(movement.amount) && movement.amount > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-4 rounded-md bg-surface-1 px-4 py-3.5 text-left active:bg-surface-2 ${
        errorMessage ? 'border-[1.5px] border-danger' : ''
      }`}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-body">{movement.description || 'Sin descripción'}</span>
        {errorMessage ? (
          <span className="text-label text-danger">{errorMessage}</span>
        ) : (
          <span className="truncate text-label text-ink-muted">{subLine}</span>
        )}
      </span>
      {hasValidAmount ? (
        <Amount value={movement.amount} type={movement.type} />
      ) : (
        <span className="font-mono text-amount-md text-ink-muted">—</span>
      )}
    </button>
  );
}
