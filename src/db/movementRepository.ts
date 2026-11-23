import { type BalanceDelta, balanceEffect, reverseBalanceEffect } from '../domain/balance';
import type { Movement } from '../domain/types';
import {
  type MovementFieldErrors,
  type MovementInput,
  validateMovementInput,
} from '../domain/validation';
import { type AppDatabase, db as defaultDb } from './db';

export interface MovementRepository {
  /** Saves new movements in one transaction (one sentence can hold several). Returns their ids. */
  createMany(inputs: readonly unknown[], rawText?: string): Promise<number[]>;
  /** Keeps the original `date` and `createdAt`; only `updatedAt` changes. */
  update(id: number, input: unknown): Promise<void>;
  /** Soft delete: hidden and excluded from every balance. */
  disable(id: number): Promise<void>;
}

export class InvalidMovementError extends Error {
  constructor(readonly errors: MovementFieldErrors) {
    super(`Invalid movement: ${Object.keys(errors).join(', ')}`);
    this.name = 'InvalidMovementError';
  }
}

export function createMovementRepository(db: AppDatabase = defaultDb): MovementRepository {
  async function applyDeltas(deltas: readonly BalanceDelta[]): Promise<void> {
    for (const { accountId, delta } of deltas) {
      const changed = await db.accounts
        .where('id')
        .equals(accountId)
        .modify((account) => {
          account.balance += delta;
        });
      if (changed !== 1) throw new Error(`Unknown account: ${accountId}`);
    }
  }

  async function getActive(id: number): Promise<Movement> {
    const movement = await db.movements.get(id);
    if (!movement || movement.disabled) throw new Error(`Movement ${id} not found`);
    return movement;
  }

  return {
    async createMany(inputs, rawText) {
      const now = new Date();
      const valid = inputs.map((input) => validOrThrow(input, { isNew: true, now }));
      return db.transaction('rw', db.movements, db.accounts, async () => {
        const ids: number[] = [];
        for (const input of valid) {
          const movement: Movement = {
            ...input,
            ...(rawText ? { rawText } : {}),
            disabled: false,
            createdAt: now.getTime(),
            updatedAt: now.getTime(),
          };
          // `++id` is auto-increment, so add() always returns the new number.
          ids.push((await db.movements.add(movement)) as number);
          await applyDeltas(balanceEffect(movement));
        }
        return ids;
      });
    },

    async update(id, input) {
      const valid = validOrThrow(input, { isNew: false });
      await db.transaction('rw', db.movements, db.accounts, async () => {
        const previous = await getActive(id);
        const next: Movement = {
          ...previous,
          ...valid,
          date: previous.date,
          createdAt: previous.createdAt,
          updatedAt: Date.now(),
        };
        // A transfer edited into an expense or income must lose its old destination.
        if (!valid.toAccountId) delete next.toAccountId;
        await applyDeltas([...reverseBalanceEffect(previous), ...balanceEffect(next)]);
        await db.movements.put(next);
      });
    },

    async disable(id) {
      await db.transaction('rw', db.movements, db.accounts, async () => {
        const movement = await getActive(id);
        await applyDeltas(reverseBalanceEffect(movement));
        await db.movements.update(id, { disabled: true, updatedAt: Date.now() });
      });
    },
  };
}

function validOrThrow(input: unknown, options: { isNew: boolean; now?: Date }): MovementInput {
  const result = validateMovementInput(input, options);
  if (!result.success) throw new InvalidMovementError(result.errors);
  return result.data;
}

export const movementRepository = createMovementRepository();
