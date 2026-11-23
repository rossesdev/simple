import { Dexie, type EntityTable } from 'dexie';

import { ACCOUNT_IDS, ACCOUNT_NAMES } from '../domain/accounts';
import type { Account, Movement, Setting } from '../domain/types';

export class AppDatabase extends Dexie {
  movements!: EntityTable<Movement, 'id'>;
  accounts!: EntityTable<Account, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'simple-track') {
    super(name);
    // Schema changes go through a new db.version(n) with a migration, never by editing this one.
    // `disabled` is not indexed: IndexedDB cannot index booleans, so it is filtered in memory.
    this.version(1).stores({
      movements: '++id, date, type, category, accountId',
      accounts: 'id',
      settings: 'key',
    });
    // The app moved from Gemini to Groq: the old key is useless, don't keep it around.
    this.version(2)
      .stores({})
      .upgrade((tx) => tx.table('settings').delete('geminiApiKey'));

    // Runs once, when the database is first created.
    this.on('populate', (tx) =>
      tx
        .table<Account, string>('accounts')
        .bulkAdd(ACCOUNT_IDS.map((id) => ({ id, name: ACCOUNT_NAMES[id], balance: 0 }))),
    );
  }
}

export const db = new AppDatabase();
