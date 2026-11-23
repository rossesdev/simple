import { describe, expect, it } from 'vitest';

import { balanceEffect, calculateMonthlyTotals, reverseBalanceEffect } from './balance';
import type { Movement } from './types';

function movement(overrides: Partial<Movement>): Movement {
  return {
    type: 'expense',
    amount: 20000,
    category: 'food',
    accountId: 'otros',
    description: 'Almuerzo',
    date: '2026-11-22',
    disabled: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('balanceEffect', () => {
  it('adds income to its account', () => {
    expect(
      balanceEffect(movement({ type: 'income', amount: 1500000, accountId: 'ahorros' })),
    ).toEqual([{ accountId: 'ahorros', delta: 1500000 }]);
  });

  it('subtracts an expense from its account', () => {
    expect(balanceEffect(movement({ accountId: 'nequi' }))).toEqual([
      { accountId: 'nequi', delta: -20000 },
    ]);
  });

  it('moves a transfer between accounts', () => {
    const transfer = movement({
      type: 'transfer',
      amount: 200000,
      category: null,
      accountId: 'ahorros',
      toAccountId: 'efectivo',
    });
    expect(balanceEffect(transfer)).toEqual([
      { accountId: 'ahorros', delta: -200000 },
      { accountId: 'efectivo', delta: 200000 },
    ]);
  });

  it('rejects a transfer without destination', () => {
    expect(() => balanceEffect(movement({ type: 'transfer', category: null }))).toThrow();
  });

  it('reverses an effect for edits and soft deletes', () => {
    expect(reverseBalanceEffect(movement({ accountId: 'nequi' }))).toEqual([
      { accountId: 'nequi', delta: 20000 },
    ]);
  });
});

describe('calculateMonthlyTotals', () => {
  it('sums enabled income and expenses of the month, ignoring transfers', () => {
    const movements = [
      movement({ type: 'income', amount: 4800000, category: 'salary' }),
      movement({ amount: 120000 }),
      movement({ amount: 999, disabled: true }),
      movement({ amount: 50000, date: '2026-10-31' }),
      movement({ type: 'transfer', amount: 200000, category: null, toAccountId: 'efectivo' }),
    ];
    expect(calculateMonthlyTotals(movements, '2026-11')).toEqual({
      income: 4800000,
      expense: 120000,
      balance: 4680000,
    });
  });
});
