import { type FormEvent, type ReactElement, useState } from 'react';

import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import { accountRepository } from '../../db/accountRepository';
import { settingsRepository } from '../../db/settingsRepository';
import { ACCOUNT_IDS, ACCOUNT_NAMES, type AccountId } from '../../domain/accounts';
import { formatBalanceText, parseBalanceText } from '../../domain/draft';

const EMPTY_BALANCES = Object.fromEntries(ACCOUNT_IDS.map((id) => [id, ''])) as Record<
  AccountId,
  string
>;

/** First run only: shown while there is no Gemini key on the phone. */
export function SetupPage(): ReactElement {
  const [apiKey, setApiKey] = useState('');
  const [balances, setBalances] = useState(EMPTY_BALANCES);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!apiKey.trim()) {
      setError('Falta la API key');
      return;
    }
    try {
      for (const id of ACCOUNT_IDS) {
        const balance = parseBalanceText(balances[id]);
        if (balance !== null) await accountRepository.setBalance(id, balance);
      }
      // Saved last: once the key exists the app leaves this screen.
      await settingsRepository.setApiKey(apiKey);
    } catch {
      setError('No se pudo guardar. Intenta otra vez.');
    }
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 pt-8 pb-[max(24px,env(safe-area-inset-bottom))]">
      <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-title font-medium">Antes de empezar</h1>
          <p className="text-label text-ink-muted">
            Pega tu API key de Gemini. Se guarda solo en este teléfono. La creas gratis en{' '}
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
        </header>

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

        <section className="flex flex-col gap-3">
          <h2 className="text-label text-ink-muted">Saldos iniciales (opcional)</h2>
          {ACCOUNT_IDS.map((id) => (
            <FormField key={id} label={ACCOUNT_NAMES[id]}>
              <Input
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                className="font-mono"
                value={balances[id]}
                onChange={(event) =>
                  setBalances({ ...balances, [id]: formatBalanceText(event.target.value) })
                }
              />
            </FormField>
          ))}
        </section>

        <Button variant="primary" type="submit" className="mt-auto">
          Guardar
        </Button>
      </form>
    </main>
  );
}
