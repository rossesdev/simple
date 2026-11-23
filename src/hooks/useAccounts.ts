import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../db/db';
import { ACCOUNT_IDS } from '../domain/accounts';
import type { Account } from '../domain/types';

/** Accounts in their fixed order (Efectivo, Nequi, DaviPlata, Ahorros, Otros). undefined while loading. */
export function useAccounts(): Account[] | undefined {
  return useLiveQuery(async () => {
    const accounts = await db.accounts.toArray();
    return accounts.sort((a, b) => ACCOUNT_IDS.indexOf(a.id) - ACCOUNT_IDS.indexOf(b.id));
  });
}
