import { describe, expect, it } from 'vitest';

import { daysBetween, isAllowedNewDate, resolveRelativeDay, today, yesterday } from './dateRule';

describe('dateRule', () => {
  const now = new Date(2026, 10, 22, 23, 30); // 22 Nov 2026, 11:30 pm local

  it('uses the local date, not UTC', () => {
    expect(today(now)).toBe('2026-11-22');
    expect(yesterday(now)).toBe('2026-11-21');
  });

  it('crosses month and year boundaries', () => {
    expect(yesterday(new Date(2026, 2, 1))).toBe('2026-02-28');
    expect(yesterday(new Date(2027, 0, 1))).toBe('2026-12-31');
  });

  it('resolves relative days', () => {
    expect(resolveRelativeDay('today', now)).toBe('2026-11-22');
    expect(resolveRelativeDay('yesterday', now)).toBe('2026-11-21');
  });

  it('allows only today or yesterday for new movements', () => {
    expect(isAllowedNewDate('2026-11-22', now)).toBe(true);
    expect(isAllowedNewDate('2026-11-21', now)).toBe(true);
    expect(isAllowedNewDate('2026-11-20', now)).toBe(false);
    expect(isAllowedNewDate('2026-11-23', now)).toBe(false);
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-15', '2026-11-22')).toBe(7);
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
  });
});
