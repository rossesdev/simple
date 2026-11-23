import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../db/db';
import { calculateMonthlyTotals, type MonthlyTotals } from '../domain/balance';

/** Income, expenses and balance for `month` ('YYYY-MM'). undefined while loading. */
export function useMonthlyBalance(month: string): MonthlyTotals | undefined {
  return useLiveQuery(async () => {
    const movements = await db.movements.where('date').startsWith(`${month}-`).toArray();
    return calculateMonthlyTotals(movements, month);
  }, [month]);
}
