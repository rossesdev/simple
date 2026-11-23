import { type FormEvent, type ReactElement, useState } from 'react';

import { ACCOUNT_IDS, ACCOUNT_NAMES } from '../../domain/accounts';
import { categoriesForType, categoryLabel } from '../../domain/categories';
import { today, yesterday } from '../../domain/dateRule';
import { changeDraftType, parseAmountText } from '../../domain/draft';
import { formatAmount, formatDate } from '../../domain/format';
import type { MovementType } from '../../domain/types';
import {
  type MovementDraft,
  type MovementFieldErrors,
  type MovementInput,
  validateMovementInput,
} from '../../domain/validation';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { ModalLayout } from '../templates/ModalLayout';

interface MovementFormProps {
  /** create: date is Hoy/Ayer. edit: the saved movement's date is shown and kept. */
  mode: 'create' | 'edit';
  initial: MovementDraft;
  onSubmit: (input: MovementInput) => Promise<void>;
  onCancel: () => void;
  /** Edit only: soft delete. */
  onDelete?: () => Promise<void>;
}

const FORM_ID = 'movement-form';

const TYPE_LABELS: Record<MovementType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
};

// Expense first: it is the most common choice.
const TYPE_OPTIONS = (['expense', 'income', 'transfer'] as const).map((type) => ({
  value: type,
  label: TYPE_LABELS[type],
}));
const ACCOUNT_OPTIONS = ACCOUNT_IDS.map((id) => ({ value: id, label: ACCOUNT_NAMES[id] }));

export function MovementForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: MovementFormProps): ReactElement {
  const [draft, setDraft] = useState<MovementDraft>(initial);
  const [errors, setErrors] = useState<MovementFieldErrors>({});
  const [saveError, setSaveError] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isTransfer = draft.type === 'transfer';
  const categoryOptions = categoriesForType(draft.type).map((id) => ({
    value: id,
    label: categoryLabel(draft.type, id),
  }));
  const dateOptions = [
    { value: today(), label: 'Hoy' },
    { value: yesterday(), label: 'Ayer' },
  ];

  function update(changes: Partial<MovementDraft>): void {
    setDraft({ ...draft, ...changes });
    const touched = Object.keys(changes) as (keyof MovementFieldErrors)[];
    setErrors(
      Object.fromEntries(
        Object.entries(errors).filter(
          ([field]) => !touched.includes(field as keyof MovementFieldErrors),
        ),
      ),
    );
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const result = validateMovementInput(draft, { isNew: mode === 'create' });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    try {
      await onSubmit(result.data);
    } catch {
      setSaveError('No se pudo guardar. Intenta otra vez.');
    }
  }

  async function handleDelete(): Promise<void> {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    try {
      await onDelete?.();
    } catch {
      setSaveError('No se pudo eliminar. Intenta otra vez.');
    }
  }

  return (
    <ModalLayout
      title={mode === 'create' ? 'Nuevo movimiento' : 'Editar movimiento'}
      onClose={onCancel}
      actions={
        <>
          {mode === 'edit' && onDelete ? (
            <Button onClick={handleDelete}>{isConfirmingDelete ? '¿Eliminar?' : 'Eliminar'}</Button>
          ) : (
            <Button onClick={onCancel}>Cancelar</Button>
          )}
          <Button variant="primary" type="submit" form={FORM_ID}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormField label="Tipo" error={errors.type}>
          <Select
            options={TYPE_OPTIONS}
            value={draft.type}
            onChange={(event) => {
              setDraft(changeDraftType(draft, event.target.value as MovementType));
              setErrors({});
            }}
          />
        </FormField>

        <FormField label="Monto" error={errors.amount}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            hasError={Boolean(errors.amount)}
            className="font-mono"
            value={draft.amount > 0 ? formatAmount(draft.amount) : ''}
            onChange={(event) => update({ amount: parseAmountText(event.target.value) })}
          />
        </FormField>

        <FormField label="Descripción" error={errors.description}>
          <Input
            autoComplete="off"
            maxLength={120}
            hasError={Boolean(errors.description)}
            value={draft.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        </FormField>

        {!isTransfer && (
          <FormField label="Categoría" error={errors.category}>
            <Select
              options={categoryOptions}
              placeholder="Elige una categoría"
              hasError={Boolean(errors.category)}
              value={draft.category ?? ''}
              onChange={(event) => update({ category: event.target.value || null })}
            />
          </FormField>
        )}

        <FormField label={isTransfer ? 'Desde' : 'Cuenta'} error={errors.accountId}>
          <Select
            options={ACCOUNT_OPTIONS}
            hasError={Boolean(errors.accountId)}
            value={draft.accountId}
            onChange={(event) => update({ accountId: event.target.value })}
          />
        </FormField>

        {isTransfer && (
          <FormField label="Hacia" error={errors.toAccountId}>
            <Select
              options={ACCOUNT_OPTIONS}
              placeholder="Elige la cuenta destino"
              hasError={Boolean(errors.toAccountId)}
              value={draft.toAccountId ?? ''}
              onChange={(event) => update({ toAccountId: event.target.value })}
            />
          </FormField>
        )}

        {mode === 'create' ? (
          <FormField label="Fecha" error={errors.date}>
            <Select
              options={dateOptions}
              hasError={Boolean(errors.date)}
              value={draft.date}
              onChange={(event) => update({ date: event.target.value })}
            />
          </FormField>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-label text-ink-muted">Fecha</span>
            <span className="text-body">{formatDate(draft.date)}</span>
          </div>
        )}

        {saveError && <p className="text-label text-danger">{saveError}</p>}
      </form>
    </ModalLayout>
  );
}
