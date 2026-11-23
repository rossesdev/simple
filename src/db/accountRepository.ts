import { isAccountId } from '../domain/accounts';
import { type AppDatabase, db as defaultDb } from './db';

export interface AccountRepository {
  /** Overwrites the balance (Accounts screen). Movements are not touched. */
  setBalance(id: string, balance: number): Promise<void>;
}

export function createAccountRepository(db: AppDatabase = defaultDb): AccountRepository {
  return {
    async setBalance(id, balance) {
      if (!isAccountId(id)) throw new Error(`Unknown account: ${id}`);
      if (!Number.isSafeInteger(balance)) throw new Error('Balance must be an integer');
      const changed = await db.accounts.update(id, { balance });
      if (changed !== 1) throw new Error(`Account ${id} not found`);
    },
  };
}

export const accountRepository = createAccountRepository();
