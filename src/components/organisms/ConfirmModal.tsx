import type { ReactElement } from 'react';

import { ACCOUNT_NAMES, isAccountId } from '../../domain/accounts';
import type { DraftWithErrors, MovementFieldErrors } from '../../domain/validation';
import { Button } from '../atoms/Button';
import { MovementRow } from '../molecules/MovementRow';
import { ModalLayout } from '../templates/ModalLayout';

interface ConfirmModalProps {
  items: readonly DraftWithErrors[];
  /** "No, guardar": save as shown. Only offered when every movement is valid. */
  onSave: () => void;
  /** "Sí, editar": open the form for the movement at `index`. */
  onEdit: (index: number) => void;
  onClose: () => void;
}

function accountName(id: string | undefined): string {
  return id && isAccountId(id) ? ACCOUNT_NAMES[id] : '—';
}

function firstError(errors: MovementFieldErrors): string | undefined {
  return Object.values(errors)[0];
}

export function ConfirmModal({ items, onSave, onEdit, onClose }: ConfirmModalProps): ReactElement {
  const firstInvalidIndex = items.findIndex(({ errors }) => firstError(errors));
  const hasErrors = firstInvalidIndex !== -1;

  return (
    <ModalLayout
      title="Esto se va a guardar"
      onClose={onClose}
      actions={
        hasErrors ? (
          <Button variant="primary" onClick={() => onEdit(firstInvalidIndex)}>
            Corregir
          </Button>
        ) : (
          <>
            <Button onClick={() => onEdit(0)}>Sí, editar</Button>
            <Button variant="primary" onClick={onSave}>
              No, guardar
            </Button>
          </>
        )
      }
    >
      <p className="text-label text-ink-muted">
        {hasErrors
          ? 'Falta información. Toca un movimiento para corregirlo.'
          : '¿Quieres cambiar algo?'}
      </p>
      {items.map(({ draft, errors }, index) => (
        <MovementRow
          key={index}
          movement={draft}
          accountName={accountName(draft.accountId)}
          toAccountName={draft.toAccountId ? accountName(draft.toAccountId) : undefined}
          errorMessage={firstError(errors)}
          onSelect={() => onEdit(index)}
        />
      ))}
    </ModalLayout>
  );
}
