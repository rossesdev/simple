import { useState } from 'react';

import { movementRepository } from '../db/movementRepository';
import { settingsRepository } from '../db/settingsRepository';
import { checkDraft, type DraftWithErrors, type MovementInput } from '../domain/validation';
import { AiError, type AiErrorKind, type AiService, groqService } from '../services/groq';

/** What a retry starts from: the audio if transcription failed, else the text. */
export type VoiceSource = { audio: Blob } | { transcript: string };

export type VoiceStep =
  | { step: 'idle' }
  | { step: 'transcribing' }
  | { step: 'parsing'; transcript: string }
  | { step: 'confirm'; transcript: string; items: DraftWithErrors[] }
  | { step: 'editing'; transcript: string; items: DraftWithErrors[]; index: number }
  /** No source: nothing worth retrying (e.g. silence). */
  | { step: 'error'; message: string; source?: VoiceSource }
  | { step: 'invalid-key'; source: VoiceSource };

const ERROR_MESSAGES: Record<AiErrorKind, string> = {
  'invalid-key': 'Groq rechazó la API key.',
  quota: 'Llegaste al límite gratis de Groq. Intenta más tarde.',
  'too-large': 'La grabación es muy larga. Intenta con una frase más corta.',
  network: 'Sin conexión. Intenta otra vez.',
  'bad-response': 'No entendí la frase. Intenta otra vez o escríbelo.',
  unknown: 'Groq no respondió. Intenta otra vez.',
};

const SAVE_ERROR = 'No se pudo guardar. Intenta otra vez.';
export const NOT_HEARD = 'No te escuché. Intenta otra vez.';

interface Failure {
  source: VoiceSource;
  error: unknown;
}

export interface VoiceEntry {
  state: VoiceStep;
  /** Sends a finished recording to Groq: transcription, then parsing. */
  submitAudio: (audio: Blob) => Promise<void>;
  retry: () => Promise<void>;
  /** "No, guardar": saves every movement as shown. */
  saveAll: () => Promise<void>;
  edit: (index: number) => void;
  /** Form result for the movement being edited; saves everything once all are valid. */
  saveEdited: (input: MovementInput) => Promise<void>;
  backToConfirm: () => void;
  /** Rejects with a message while Groq refuses the new key. */
  submitApiKey: (apiKey: string) => Promise<void>;
  cancel: () => void;
}

const isInvalidKey = (error: unknown): boolean =>
  error instanceof AiError && error.kind === 'invalid-key';

/** Voice flow after recording: transcription → parsing → confirmation → optional edit → save. */
export function useVoiceEntry(ai: AiService = groqService): VoiceEntry {
  const [state, setState] = useState<VoiceStep>({ step: 'idle' });

  function showError({ source, error }: Failure): void {
    if (isInvalidKey(error)) {
      setState({ step: 'invalid-key', source });
      return;
    }
    const message = error instanceof AiError ? ERROR_MESSAGES[error.kind] : SAVE_ERROR;
    setState({ step: 'error', message, source });
  }

  /**
   * Runs the source through Groq up to the confirmation. Returns the failure, if any, with the
   * step to retry from. `isQuiet` skips the progress steps (the key modal shows its own).
   */
  async function run(
    source: VoiceSource,
    apiKey: string,
    isQuiet = false,
  ): Promise<Failure | null> {
    let current = source;
    try {
      if ('audio' in current) {
        if (!isQuiet) setState({ step: 'transcribing' });
        const transcript = await ai.transcribe(current.audio, apiKey);
        if (!transcript) {
          setState({ step: 'error', message: NOT_HEARD });
          return null;
        }
        current = { transcript };
      }
      const { transcript } = current;
      if (!isQuiet) setState({ step: 'parsing', transcript });
      const drafts = await ai.parse(transcript, apiKey);
      setState({ step: 'confirm', transcript, items: drafts.map((draft) => checkDraft(draft)) });
      return null;
    } catch (error) {
      return { source: current, error };
    }
  }

  async function submit(source: VoiceSource): Promise<void> {
    const failure = await run(source, (await settingsRepository.getApiKey()) ?? '');
    if (failure) showError(failure);
  }

  async function save(transcript: string, items: readonly DraftWithErrors[]): Promise<void> {
    try {
      await movementRepository.createMany(
        items.map(({ draft }) => draft),
        transcript,
      );
      setState({ step: 'idle' });
    } catch (error) {
      showError({ source: { transcript }, error });
    }
  }

  return {
    state,
    submitAudio: (audio) => submit({ audio }),

    async retry() {
      if (state.step === 'error' && state.source) await submit(state.source);
    },

    async saveAll() {
      if (state.step === 'confirm') await save(state.transcript, state.items);
    },

    edit(index) {
      if (state.step === 'confirm') setState({ ...state, step: 'editing', index });
    },

    async saveEdited(input) {
      if (state.step !== 'editing') return;
      const items = state.items.map((item, index) =>
        index === state.index ? { draft: input, errors: {} } : item,
      );
      const isAllValid = items.every(({ errors }) => Object.keys(errors).length === 0);
      if (isAllValid) await save(state.transcript, items);
      else setState({ step: 'confirm', transcript: state.transcript, items });
    },

    backToConfirm() {
      if (state.step === 'editing') setState({ ...state, step: 'confirm' });
    },

    async submitApiKey(apiKey) {
      if (state.step !== 'invalid-key') return;
      const failure = await run(state.source, apiKey, true);
      if (failure && isInvalidKey(failure.error)) {
        throw new Error('Groq rechazó esta key. Revisa que esté completa.', {
          cause: failure.error,
        });
      }
      // The key works; any other failure (quota, network) is shown as usual.
      await settingsRepository.setApiKey(apiKey);
      if (failure) showError(failure);
    },

    cancel() {
      setState({ step: 'idle' });
    },
  };
}
