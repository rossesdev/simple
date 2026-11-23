import { type AppDatabase, db as defaultDb } from './db';

const GEMINI_API_KEY = 'geminiApiKey';

export interface SettingsRepository {
  getApiKey(): Promise<string | undefined>;
  setApiKey(apiKey: string): Promise<void>;
}

export function createSettingsRepository(db: AppDatabase = defaultDb): SettingsRepository {
  return {
    async getApiKey() {
      return (await db.settings.get(GEMINI_API_KEY))?.value;
    },
    async setApiKey(apiKey) {
      const trimmed = apiKey.trim();
      if (!trimmed) throw new Error('Empty API key');
      await db.settings.put({ key: GEMINI_API_KEY, value: trimmed });
    },
  };
}

export const settingsRepository = createSettingsRepository();
