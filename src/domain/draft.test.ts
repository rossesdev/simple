import { describe, expect, it } from 'vitest';

import {
  changeDraftType,
  emptyDraft,
  formatBalanceText,
  parseAmountText,
  parseBalanceText,
} from './draft';

describe('draft', () => {
  it('starts as an expense from Otros dated today', () => {
    expect(emptyDraft(new Date(2026, 10, 22))).toEqual({
      type: 'expense',
      amount: 0,
      category: null,
      accountId: 'otros',
      description: '',
      date: '2026-11-22',
    });
  });

  it('keeps a category valid for the new type and drops one that is not', () => {
    const expense = { ...emptyDraft(), category: 'other' };
    expect(changeDraftType(expense, 'income').category).toBe('other');
    expect(changeDraftType({ ...expense, category: 'food' }, 'income').category).toBeNull();
  });

  it('keeps the destination only for transfers', () => {
    const transfer = { ...emptyDraft(), type: 'transfer' as const, toAccountId: 'nequi' };
    expect(changeDraftType(transfer, 'transfer').toAccountId).toBe('nequi');
    expect('toAccountId' in changeDraftType(transfer, 'expense')).toBe(false);
  });

  it('parses typed amounts', () => {
    expect(parseAmountText('20.000')).toBe(20000);
    expect(parseAmountText('$ 1.240.000')).toBe(1240000);
    expect(parseAmountText('')).toBe(0);
    expect(parseAmountText('abc')).toBe(0);
  });

  it('parses typed balances, including negatives', () => {
    expect(parseBalanceText('1.200.000')).toBe(1200000);
    expect(parseBalanceText('-15.000')).toBe(-15000);
    expect(parseBalanceText('\u2212 15.000')).toBe(-15000);
    expect(parseBalanceText('0')).toBe(0);
    expect(parseBalanceText('')).toBeNull();
    expect(parseBalanceText('-')).toBeNull();
  });

  it('reformats balances while typing', () => {
    expect(formatBalanceText('1200000')).toBe('1.200.000');
    expect(formatBalanceText('-15000')).toBe('\u221215.000');
    expect(formatBalanceText('-')).toBe('\u2212');
    expect(formatBalanceText('\u22120')).toBe('\u22120');
    expect(formatBalanceText('')).toBe('');
  });
});
