import { categoryLabel } from './categories';
import type { Movement } from './types';

export type MovementSort = 'newest' | 'amountAsc' | 'amountDesc';

export interface MovementFilters {
  /** 'YYYY-MM-DD', inclusive. */
  from?: string;
  /** 'YYYY-MM-DD', inclusive. */
  to?: string;
  /** Matches description or category label, ignoring case and accents. */
  search?: string;
  sort?: MovementSort;
}

/** Enabled movements that match the filters, sorted (newest first by default). */
export function filterMovements(
  movements: readonly Movement[],
  filters: MovementFilters = {},
): Movement[] {
  const { from, to, search, sort = 'newest' } = filters;
  const query = normalize(search ?? '');

  const matches = movements.filter((movement) => {
    if (movement.disabled) return false;
    if (from && movement.date < from) return false;
    if (to && movement.date > to) return false;
    if (!query) return true;
    const text = `${movement.description} ${categoryLabel(movement.type, movement.category)}`;
    return normalize(text).includes(query);
  });

  return matches.sort((a, b) => {
    if (sort === 'amountAsc') return a.amount - b.amount;
    if (sort === 'amountDesc') return b.amount - a.amount;
    return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
  });
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
