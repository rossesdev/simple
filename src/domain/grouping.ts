import { daysBetween, today } from './dateRule';
import type { Movement } from './types';

export const DAY_GROUPS = ['today', 'yesterday', 'lastWeek', 'restOfMonth'] as const;

export type DayGroup = (typeof DAY_GROUPS)[number];

export const DAY_GROUP_LABELS: Record<DayGroup, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  lastWeek: 'Última semana',
  restOfMonth: 'Resto del mes',
};

export interface MovementGroup {
  /** null for past months, which are not split by day. */
  group: DayGroup | null;
  movements: Movement[];
}

export interface MonthSection {
  /** 'YYYY-MM' */
  month: string;
  groups: MovementGroup[];
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function dayGroupOf(date: string, now: Date = new Date()): DayGroup {
  const daysAgo = daysBetween(date, today(now));
  if (daysAgo <= 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo <= 7) return 'lastWeek';
  return 'restOfMonth';
}

/**
 * Splits movements by month (newest first). The current month is grouped as
 * Hoy → Ayer → Última semana → Resto del mes. Order inside a group is kept as given.
 */
export function groupMovements(
  movements: readonly Movement[],
  now: Date = new Date(),
): MonthSection[] {
  const currentMonth = monthOf(today(now));
  const byMonth = new Map<string, Movement[]>();
  for (const movement of movements) {
    const month = monthOf(movement.date);
    byMonth.set(month, [...(byMonth.get(month) ?? []), movement]);
  }

  return [...byMonth.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const monthMovements = byMonth.get(month) ?? [];
      if (month !== currentMonth)
        return { month, groups: [{ group: null, movements: monthMovements }] };
      const groups = DAY_GROUPS.map((group) => ({
        group,
        movements: monthMovements.filter((movement) => dayGroupOf(movement.date, now) === group),
      })).filter(({ movements: groupMovements }) => groupMovements.length > 0);
      return { month, groups };
    });
}
