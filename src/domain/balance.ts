import type { AccountId } from './accounts';
import type { Movement } from './types';

export interface BalanceDelta {
  accountId: AccountId;
  delta: number;
}

export interface MonthlyTotals {
  income: number;
  expense: number;
  balance: number;
}

type BalanceFields = Pick<Movement, 'type' | 'amount' | 'accountId' | 'toAccountId'>;

/** How a movement changes account balances when it is saved. */
export function balanceEffect(movement: BalanceFields): BalanceDelta[] {
  const { type, amount, accountId, toAccountId } = movement;
  if (type === 'income') return [{ accountId, delta: amount }];
  if (type === 'expense') return [{ accountId, delta: -amount }];
  if (!toAccountId) throw new Error('Transfer without toAccountId');
  return [
    { accountId, delta: -amount },
    { accountId: toAccountId, delta: amount },
  ];
}

/** Undoes a saved movement's effect: used when it is edited or disabled. */
export function reverseBalanceEffect(movement: BalanceFields): BalanceDelta[] {
  return balanceEffect(movement).map(({ accountId, delta }) => ({ accountId, delta: -delta }));
}

/** Income minus expenses of enabled movements in `month` ('YYYY-MM'). Transfers are ignored. */
export function calculateMonthlyTotals(
  movements: readonly Movement[],
  month: string,
): MonthlyTotals {
  let income = 0;
  let expense = 0;
  for (const movement of movements) {
    if (movement.disabled || !movement.date.startsWith(`${month}-`)) continue;
    if (movement.type === 'income') income += movement.amount;
    if (movement.type === 'expense') expense += movement.amount;
  }
  return { income, expense, balance: income - expense };
}
