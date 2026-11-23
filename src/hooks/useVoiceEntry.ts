import { useState } from 'react';

import { movementRepository } from '../db/movementRepository';
import { settingsRepository } from '../db/settingsRepository';
import { checkDraft, type DraftWithErrors, type MovementInput } from '../domain/validation';
import {
  geminiParser,
  ParserError,
  type ParserErrorKind,
  type ParserService,
} from '../services/gemini';

export type VoiceStep =
  | { step: 'idle' }
  | { step: 'parsing'; transcript: string }
  | { step: 'confirm'; transcript: string; items: DraftWithErrors[] }
  | { step: 'editing'; transcript: string; items: DraftWithErrors[]; index: number }
  | { step: 'error'; transcript: string; message: string }
  | { step: 'invalid-key'; transcript: string };

const ERROR_MESSAGES: Record<ParserErrorKind, string> = {
  'invalid-key': 'Gemini rechazó la API key.',
  quota: 'Llegaste al límite gratis de Gemini. Intenta más tarde.',
  network: 'Sin conexión. Intenta otra vez.',
  'bad-response': 'No entendí la frase. Intenta otra vez o escríbelo.',
  unknown: 'Gemini no respondió. Intenta otra vez.',
};

const SAVE_ERROR = 'No se pudo guardar. Intenta otra vez.';

export interface VoiceEntry {
  state: VoiceStep;
  /** Sends a finished transcript to Gemini. */
  submitTranscript: (transcript: string) => Promise<void>;
  retry: () => Promise<void>;
  /** "No, guardar": saves every movement as shown. */
  saveAll: () => Promise<void>;
  edit: (index: number) => void;
  /** Form result for the movement being edited; saves everything once all are valid. */
  saveEdited: (input: MovementInput) => Promise<void>;
  backToConfirm: () => void;
  /** Rejects with a message while Gemini refuses the new key. */
  submitApiKey: (apiKey: string) => Promise<void>;
  cancel: () => void;
}

/** Voice flow after recording: Gemini parsing → confirmation → optional edit → save. */
export function useVoiceEntry(parser: ParserService = geminiParser): VoiceEntry {
  const [state, setState] = useState<VoiceStep>({ step: 'idle' });

  function showError(transcript: string, error: unknown): void {
    if (error instanceof ParserError && error.kind === 'invalid-key') {
      setState({ step: 'invalid-key', transcript });
      return;
    }
    const message = error instanceof ParserError ? ERROR_MESSAGES[error.kind] : SAVE_ERROR;
    setState({ step: 'error', transcript, message });
  }

  async function parseWith(transcript: string, apiKey: string): Promise<void> {
    const drafts = await parser.parse(transcript, apiKey);
    setState({ step: 'confirm', transcript, items: drafts.map((draft) => checkDraft(draft)) });
  }

  async function submitTranscript(transcript: string): Promise<void> {
    setState({ step: 'parsing', transcript });
    try {
      await parseWith(transcript, (await settingsRepository.getApiKey()) ?? '');
    } catch (error) {
      showError(transcript, error);
    }
  }

  async function save(transcript: string, items: readonly DraftWithErrors[]): Promise<void> {
    try {
      await movementRepository.createMany(
        items.map(({ draft }) => draft),
        transcript,
      );
      setState({ step: 'idle' });
    } catch (error) {
      showError(transcript, error);
    }
  }

  return {
    state,
    submitTranscript,

    async retry() {
      if ('transcript' in state) await submitTranscript(state.transcript);
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
      const { transcript } = state;
      try {
        await parseWith(transcript, apiKey);
      } catch (error) {
        if (error instanceof ParserError && error.kind === 'invalid-key') {
          throw new Error('Gemini rechazó esta key. Revisa que esté completa.', { cause: error });
        }
        // The key may be fine; the problem is elsewhere (quota, network).
        await settingsRepository.setApiKey(apiKey);
        showError(transcript, error);
        return;
      }
      await settingsRepository.setApiKey(apiKey);
    },

    cancel() {
      setState({ step: 'idle' });
    },
  };
}
