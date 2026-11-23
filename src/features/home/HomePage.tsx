import { type ReactElement, type ReactNode, useRef, useState } from 'react';

import { Amount } from '../../components/atoms/Amount';
import { Button } from '../../components/atoms/Button';
import { FilterChip } from '../../components/atoms/FilterChip';
import { SearchInput } from '../../components/molecules/SearchInput';
import { ApiKeyModal } from '../../components/organisms/ApiKeyModal';
import { ConfirmModal } from '../../components/organisms/ConfirmModal';
import { MicButton } from '../../components/organisms/MicButton';
import { MovementForm } from '../../components/organisms/MovementForm';
import { MovementList } from '../../components/organisms/MovementList';
import { MainLayout } from '../../components/templates/MainLayout';
import { movementRepository } from '../../db/movementRepository';
import { today } from '../../domain/dateRule';
import { draftFromMovement, emptyDraft } from '../../domain/draft';
import type { MovementSort } from '../../domain/filters';
import { formatMonth } from '../../domain/format';
import { groupMovements, monthOf } from '../../domain/grouping';
import type { Movement } from '../../domain/types';
import type { MovementDraft } from '../../domain/validation';
import { useMonthlyBalance } from '../../hooks/useMonthlyBalance';
import { useMovements } from '../../hooks/useMovements';
import { useRecorder } from '../../hooks/useRecorder';
import { NOT_HEARD, useVoiceEntry } from '../../hooks/useVoiceEntry';

interface HomePageProps {
  nav: ReactNode;
}

type OpenForm = { mode: 'create'; draft: MovementDraft } | { mode: 'edit'; movement: Movement };

const NEXT_SORT: Record<MovementSort, MovementSort> = {
  newest: 'amountDesc',
  amountDesc: 'amountAsc',
  amountAsc: 'newest',
};

const SORT_LABELS: Record<MovementSort, string> = {
  newest: 'Monto',
  amountDesc: 'Monto ↓',
  amountAsc: 'Monto ↑',
};

export function HomePage({ nav }: HomePageProps): ReactElement {
  /** 'YYYY-MM' picked in the date chip; null shows every month. */
  const [month, setMonth] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sort, setSort] = useState<MovementSort>('newest');
  const [form, setForm] = useState<OpenForm | null>(null);
  const monthInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const voice = useVoiceEntry();
  const recorder = useRecorder((audio) => {
    if (!audio) {
      setNotice(NOT_HEARD);
      return;
    }
    void voice.submitAudio(audio);
  });
  const voiceError = voice.state.step === 'error' ? voice.state.message : '';
  const canRetry = voice.state.step === 'error' && voice.state.source !== undefined;
  const errorMessage = recorder.error || notice || voiceError;
  const isParsing = voice.state.step === 'transcribing' || voice.state.step === 'parsing';

  const balanceMonth = month ?? monthOf(today());
  const totals = useMonthlyBalance(balanceMonth);
  const movements = useMovements({
    ...(month ? { from: `${month}-01`, to: `${month}-31` } : {}),
    search,
    sort,
  });

  return (
    <MainLayout
      nav={nav}
      action={
        <MicButton
          isRecording={recorder.isRecording}
          isLoading={isParsing}
          onToggle={() => {
            if (isParsing) return;
            setNotice('');
            voice.cancel();
            recorder.toggle();
          }}
        />
      }
    >
      {recorder.isRecording || isParsing ? (
        <section className="flex flex-col gap-8" aria-live="polite">
          <h1 className="text-title font-medium">
            {recorder.isRecording ? 'Escuchando…' : 'Entendiendo…'}
          </h1>
          {voice.state.step === 'parsing' ? (
            <p className="text-transcript text-ink-muted">{voice.state.transcript}</p>
          ) : (
            <p className="text-transcript text-ink-muted">
              Di algo como “almuerzo 20 mil con Nequi”
            </p>
          )}
        </section>
      ) : (
        <>
          <header className="flex flex-col gap-1">
            <span className="text-label text-ink-muted">{formatMonth(balanceMonth)}</span>
            <Amount value={totals?.balance ?? 0} type="balance" size="xl" />
            <span className="flex gap-4">
              <Amount value={totals?.income ?? 0} type="income" size="sm" />
              <Amount value={totals?.expense ?? 0} type="expense" size="sm" />
            </span>
          </header>

          <div className="mt-6 flex gap-2 overflow-x-auto">
            <FilterChip
              label={month ? formatMonth(month) : 'Fecha'}
              isActive={month !== null}
              onClick={() => monthInputRef.current?.showPicker()}
            />
            <FilterChip
              label="Buscar"
              isActive={isSearchOpen || search !== ''}
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            />
            <FilterChip
              label={SORT_LABELS[sort]}
              isActive={sort !== 'newest'}
              onClick={() => setSort(NEXT_SORT[sort])}
            />
            {/* The native month picker includes a "clear" action, which removes the date filter. */}
            <input
              ref={monthInputRef}
              type="month"
              aria-label="Mes"
              className="sr-only"
              tabIndex={-1}
              value={month ?? ''}
              max={monthOf(today())}
              onChange={(event) => setMonth(event.target.value || null)}
            />
          </div>

          {(isSearchOpen || search !== '') && (
            <div className="mt-3">
              <SearchInput value={search} onChange={setSearch} />
            </div>
          )}

          <div className="mt-6">
            {movements && (
              <MovementList
                sections={groupMovements(movements)}
                onSelect={(movement) => setForm({ mode: 'edit', movement })}
              />
            )}
          </div>
        </>
      )}

      {errorMessage && !recorder.isRecording && (
        <div className="fixed inset-x-6 bottom-48 flex flex-col gap-3 rounded-md bg-surface-2 p-4">
          <span className="text-label text-danger">{errorMessage}</span>
          <div className="flex gap-3 [&>*]:h-11 [&>*]:flex-1">
            <Button
              onClick={() => {
                setNotice('');
                recorder.clearError();
                voice.cancel();
                setForm({ mode: 'create', draft: emptyDraft() });
              }}
            >
              Escribir
            </Button>
            {canRetry && (
              <Button variant="primary" onClick={() => void voice.retry()}>
                Reintentar
              </Button>
            )}
          </div>
        </div>
      )}

      {voice.state.step === 'confirm' && (
        <ConfirmModal
          items={voice.state.items}
          onSave={() => void voice.saveAll()}
          onEdit={voice.edit}
          onClose={voice.cancel}
        />
      )}
      {voice.state.step === 'editing' && voice.state.items[voice.state.index] && (
        <MovementForm
          key={voice.state.index}
          mode="create"
          initial={voice.state.items[voice.state.index]!.draft}
          onSubmit={voice.saveEdited}
          onCancel={voice.backToConfirm}
        />
      )}
      {voice.state.step === 'invalid-key' && <ApiKeyModal onSubmit={voice.submitApiKey} />}

      {form?.mode === 'create' && (
        <MovementForm
          mode="create"
          initial={form.draft}
          onSubmit={async (input) => {
            await movementRepository.createMany([input]);
            setForm(null);
          }}
          onCancel={() => setForm(null)}
        />
      )}
      {form?.mode === 'edit' && form.movement.id !== undefined && (
        <MovementForm
          key={form.movement.id}
          mode="edit"
          initial={draftFromMovement(form.movement)}
          onSubmit={async (input) => {
            await movementRepository.update(form.movement.id ?? -1, input);
            setForm(null);
          }}
          onDelete={async () => {
            await movementRepository.disable(form.movement.id ?? -1);
            setForm(null);
          }}
          onCancel={() => setForm(null)}
        />
      )}
    </MainLayout>
  );
}
