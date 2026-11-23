import { useLiveQuery } from 'dexie-react-hooks';

import { settingsRepository } from '../db/settingsRepository';

/** The stored Gemini key; null when there is none yet, undefined while loading. */
export function useApiKey(): string | null | undefined {
  return useLiveQuery(async () => (await settingsRepository.getApiKey()) ?? null);
}
