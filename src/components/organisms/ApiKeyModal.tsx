import { type FormEvent, type ReactElement, useState } from 'react';

import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { FormField } from '../molecules/FormField';
import { ModalLayout } from '../templates/ModalLayout';

interface ApiKeyModalProps {
  /** Resolves when Gemini accepts the key; rejects with a message to show otherwise. */
  onSubmit: (apiKey: string) => Promise<void>;
}

const FORM_ID = 'api-key-form';

/** Shown when Gemini rejects the stored key. It can't be closed until a working key is saved. */
export function ApiKeyModal({ onSubmit }: ApiKeyModalProps): ReactElement {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (isChecking) return;
    if (!apiKey.trim()) {
      setError('Falta la API key');
      return;
    }
    setIsChecking(true);
    try {
      await onSubmit(apiKey.trim());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo verificar.');
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <ModalLayout
      title="Tu API key no funciona"
      actions={
        <Button variant="primary" type="submit" form={FORM_ID}>
          {isChecking ? 'Verificando…' : 'Guardar y reintentar'}
        </Button>
      }
    >
      <p className="text-label text-ink-muted">
        Gemini la rechazó. Pega una key nueva de{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
        >
          aistudio.google.com/apikey
        </a>
        .
      </p>
      <form id={FORM_ID} noValidate onSubmit={handleSubmit}>
        <FormField label="API key de Gemini" error={error}>
          <Input
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            hasError={Boolean(error)}
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              setError('');
            }}
          />
        </FormField>
      </form>
    </ModalLayout>
  );
}
