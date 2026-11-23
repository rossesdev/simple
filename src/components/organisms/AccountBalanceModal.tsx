import { type FormEvent, type ReactElement, useState } from 'react';

import { formatBalanceText, parseBalanceText } from '../../domain/draft';
import type { Account } from '../../domain/types';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { FormField } from '../molecules/FormField';
import { ModalLayout } from '../templates/ModalLayout';

interface AccountBalanceModalProps {
  account: Account;
  onSubmit: (balance: number) => Promise<void>;
  onCancel: () => void;
}

const FORM_ID = 'account-balance-form';

/** Edits only the balance of one account. */
export function AccountBalanceModal({
  account,
  onSubmit,
  onCancel,
}: AccountBalanceModalProps): ReactElement {
  const [text, setText] = useState(formatBalanceText(String(account.balance)));
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const balance = parseBalanceText(text);
    if (balance === null) {
      setError('Falta el saldo');
      return;
    }
    try {
      await onSubmit(balance);
    } catch {
      setError('No se pudo guardar. Intenta otra vez.');
    }
  }

  return (
    <ModalLayout
      title={account.name}
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" type="submit" form={FORM_ID}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit}>
        <FormField label="Saldo" error={error}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            hasError={Boolean(error)}
            className="font-mono"
            value={text}
            onChange={(event) => {
              setText(formatBalanceText(event.target.value));
              setError('');
            }}
          />
        </FormField>
      </form>
    </ModalLayout>
  );
}
