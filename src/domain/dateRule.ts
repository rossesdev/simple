export const RELATIVE_DAYS = ['today', 'yesterday'] as const;

export type RelativeDay = (typeof RELATIVE_DAYS)[number];

/** 'YYYY-MM-DD' in the phone's local time zone (not UTC, which would shift evening movements). */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function today(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function yesterday(now: Date = new Date()): string {
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
}

export function resolveRelativeDay(day: RelativeDay, now: Date = new Date()): string {
  return day === 'today' ? today(now) : yesterday(now);
}

/** A new movement can only be dated today or yesterday. Edits keep their original date. */
export function isAllowedNewDate(date: string, now: Date = new Date()): boolean {
  return date === today(now) || date === yesterday(now);
}

/** Whole days from `from` to `to`, both 'YYYY-MM-DD'. */
export function daysBetween(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / msPerDay);
}

function parseIsoDate(date: string): Date {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}
