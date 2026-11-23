import { describe, expect, it } from 'vitest';

import { dayGroupOf, groupMovements } from './grouping';
import type { Movement } from './types';

const now = new Date(2026, 10, 22, 12, 0);

function movementOn(date: string, id: number): Movement {
  return {
    id,
    type: 'expense',
    amount: 1000,
    category: 'food',
    accountId: 'otros',
    description: 'x',
    date,
    disabled: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('grouping', () => {
  it('assigns day groups', () => {
    expect(dayGroupOf('2026-11-22', now)).toBe('today');
    expect(dayGroupOf('2026-11-21', now)).toBe('yesterday');
    expect(dayGroupOf('2026-11-15', now)).toBe('lastWeek');
    expect(dayGroupOf('2026-11-14', now)).toBe('restOfMonth');
  });

  it('splits by month, newest first, and groups only the current month', () => {
    const sections = groupMovements(
      [
        movementOn('2026-10-30', 1),
        movementOn('2026-11-22', 2),
        movementOn('2026-11-03', 3),
        movementOn('2026-11-21', 4),
      ],
      now,
    );
    expect(sections.map((section) => section.month)).toEqual(['2026-11', '2026-10']);
    expect(sections[0]?.groups.map((g) => [g.group, g.movements.map((m) => m.id)])).toEqual([
      ['today', [2]],
      ['yesterday', [4]],
      ['restOfMonth', [3]],
    ]);
    expect(sections[1]?.groups).toEqual([
      { group: null, movements: [movementOn('2026-10-30', 1)] },
    ]);
  });
});
