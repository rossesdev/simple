import { describe, expect, it } from 'vitest';

import { filterMovements } from './filters';
import type { Movement } from './types';

function movement(id: number, overrides: Partial<Movement>): Movement {
  return {
    id,
    type: 'expense',
    amount: 1000,
    category: 'food',
    accountId: 'otros',
    description: 'Almuerzo',
    date: '2026-11-22',
    disabled: false,
    createdAt: id,
    updatedAt: id,
    ...overrides,
  };
}

const movements = [
  movement(1, {
    date: '2026-11-20',
    amount: 50000,
    description: 'Netflix',
    category: 'subscriptions',
  }),
  movement(2, { date: '2026-11-22', amount: 20000 }),
  movement(3, { date: '2026-11-22', amount: 9000, description: 'Café' }),
  movement(4, { date: '2026-11-21', amount: 70000, disabled: true }),
];

const ids = (list: Movement[]): (number | undefined)[] => list.map((m) => m.id);

describe('filterMovements', () => {
  it('hides disabled movements and sorts newest first', () => {
    expect(ids(filterMovements(movements))).toEqual([3, 2, 1]);
  });

  it('filters by inclusive date range', () => {
    expect(ids(filterMovements(movements, { from: '2026-11-20', to: '2026-11-21' }))).toEqual([1]);
  });

  it('searches description and category label, ignoring case and accents', () => {
    expect(ids(filterMovements(movements, { search: 'cafe' }))).toEqual([3]);
    expect(ids(filterMovements(movements, { search: 'SUSCRIP' }))).toEqual([1]);
  });

  it('sorts by amount', () => {
    expect(ids(filterMovements(movements, { sort: 'amountAsc' }))).toEqual([3, 2, 1]);
    expect(ids(filterMovements(movements, { sort: 'amountDesc' }))).toEqual([1, 2, 3]);
  });
});
