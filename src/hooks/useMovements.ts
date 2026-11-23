import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../db/db';
import { filterMovements, type MovementFilters } from '../domain/filters';
import type { Movement } from '../domain/types';

/** Enabled movements matching the filters; re-renders on every DB change. undefined while loading. */
export function useMovements(filters: MovementFilters = {}): Movement[] | undefined {
  const { from, to, search, sort } = filters;
  return useLiveQuery(
    async () => filterMovements(await db.movements.toArray(), { from, to, search, sort }),
    [from, to, search, sort],
  );
}
