import { type AppDatabase, db as defaultDb } from './db';

const GROQ_API_KEY = 'groqApiKey';

export interface SettingsRepository {
  getApiKey(): Promise<string | undefined>;
  setApiKey(apiKey: string): Promise<void>;
}

export function createSettingsRepository(db: AppDatabase = defaultDb): SettingsRepository {
  return {
    async getApiKey() {
      return (await db.settings.get(GROQ_API_KEY))?.value;
    },
    async setApiKey(apiKey) {
      const trimmed = apiKey.trim();
      if (!trimmed) throw new Error('Empty API key');
      await db.settings.put({ key: GROQ_API_KEY, value: trimmed });
    },
  };
}

export const settingsRepository = createSettingsRepository();
