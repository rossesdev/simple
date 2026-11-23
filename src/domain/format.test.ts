import { describe, expect, it } from 'vitest';

import { formatAmount, formatBalance, formatMonth, formatSignedAmount } from './format';

describe('format', () => {
  it('uses dots for thousands and no decimals', () => {
    expect(formatAmount(1240000)).toBe('1.240.000');
    expect(formatAmount(1000)).toBe('1.000');
    expect(formatAmount(500)).toBe('500');
  });

  it('signs row amounts by type with a thin space', () => {
    expect(formatSignedAmount('income', 1500000)).toBe('+ 1.500.000');
    expect(formatSignedAmount('expense', 20000)).toBe('− 20.000');
    expect(formatSignedAmount('transfer', 200000)).toBe('200.000');
  });

  it('formats the big balance with $', () => {
    expect(formatBalance(1240000)).toBe('$ 1.240.000');
    expect(formatBalance(-5000)).toBe('− $ 5.000');
  });

  it('formats month labels', () => {
    expect(formatMonth('2026-11')).toBe('Noviembre 2026');
  });
});
