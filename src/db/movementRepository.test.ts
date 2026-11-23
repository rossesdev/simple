import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AccountId } from '../domain/accounts';
import { today, yesterday } from '../domain/dateRule';
import { AppDatabase } from './db';
import {
  createMovementRepository,
  InvalidMovementError,
  type MovementRepository,
} from './movementRepository';
import { createSettingsRepository } from './settingsRepository';
import { createAccountRepository } from './accountRepository';

let db: AppDatabase;
let repository: MovementRepository;
let testNumber = 0;

beforeEach(() => {
  db = new AppDatabase(`test-${++testNumber}`);
  repository = createMovementRepository(db);
});

afterEach(async () => {
  await db.delete();
});

async function balances(): Promise<Record<AccountId, number>> {
  const accounts = await db.accounts.toArray();
  return Object.fromEntries(accounts.map((a) => [a.id, a.balance])) as Record<AccountId, number>;
}

const lunch = {
  type: 'expense',
  amount: 20000,
  category: 'food',
  accountId: 'nequi',
  description: 'Almuerzo',
  date: today(),
};

describe('movementRepository', () => {
  it('seeds the five accounts at zero', async () => {
    expect(await balances()).toEqual({ efectivo: 0, nequi: 0, daviplata: 0, ahorros: 0, otros: 0 });
  });

  it('creates several movements in one transaction and updates balances', async () => {
    const ids = await repository.createMany(
      [
        lunch,
        {
          type: 'income',
          amount: 1500000,
          category: 'salary',
          accountId: 'ahorros',
          description: 'Sueldo',
          date: yesterday(),
        },
        {
          type: 'transfer',
          amount: 200000,
          category: null,
          accountId: 'ahorros',
          toAccountId: 'efectivo',
          description: 'Retiro',
          date: today(),
        },
      ],
      'frase original',
    );
    expect(ids).toHaveLength(3);
    expect(await balances()).toMatchObject({ nequi: -20000, ahorros: 1300000, efectivo: 200000 });
    const saved = await db.movements.get(ids[0] ?? -1);
    expect(saved).toMatchObject({ rawText: 'frase original', disabled: false });
    expect(saved?.createdAt).toBe(saved?.updatedAt);
  });

  it('saves nothing when any movement is invalid', async () => {
    await expect(repository.createMany([lunch, { ...lunch, amount: 0 }])).rejects.toBeInstanceOf(
      InvalidMovementError,
    );
    expect(await db.movements.count()).toBe(0);
    expect((await balances()).nequi).toBe(0);
  });

  it('rejects dates other than today or yesterday on create', async () => {
    await expect(repository.createMany([{ ...lunch, date: '2020-01-01' }])).rejects.toBeInstanceOf(
      InvalidMovementError,
    );
  });

  it('edits: reverses the old effect, applies the new one, keeps date and createdAt', async () => {
    const [id = -1] = await repository.createMany([{ ...lunch, date: yesterday() }]);
    const before = await db.movements.get(id);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await repository.update(id, { ...lunch, amount: 35000, accountId: 'efectivo', date: today() });

    const after = await db.movements.get(id);
    expect(after).toMatchObject({ amount: 35000, accountId: 'efectivo', date: yesterday() });
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.updatedAt).toBeGreaterThan(before?.updatedAt ?? Infinity);
    expect(await balances()).toMatchObject({ nequi: 0, efectivo: -35000 });
  });

  it('drops the destination when a transfer is edited into an expense', async () => {
    const [id = -1] = await repository.createMany([
      { ...lunch, type: 'transfer', category: null, accountId: 'ahorros', toAccountId: 'efectivo' },
    ]);
    await repository.update(id, { ...lunch, accountId: 'ahorros' });
    expect((await db.movements.get(id))?.toAccountId).toBeUndefined();
    expect(await balances()).toMatchObject({ ahorros: -20000, efectivo: 0 });
  });

  it('soft deletes: keeps the record, reverses its effect, and refuses to do it twice', async () => {
    const [id = -1] = await repository.createMany([lunch]);
    await repository.disable(id);
    expect((await db.movements.get(id))?.disabled).toBe(true);
    expect((await balances()).nequi).toBe(0);
    await expect(repository.disable(id)).rejects.toThrow();
    await expect(repository.update(id, lunch)).rejects.toThrow();
    expect((await balances()).nequi).toBe(0);
  });
});

describe('settingsRepository', () => {
  it('stores the trimmed API key and rejects an empty one', async () => {
    const settings = createSettingsRepository(db);
    expect(await settings.getApiKey()).toBeUndefined();
    await settings.setApiKey('  abc123  ');
    expect(await settings.getApiKey()).toBe('abc123');
    await expect(settings.setApiKey('   ')).rejects.toThrow();
  });
});

describe('accountRepository', () => {
  it('overwrites one balance and rejects bad input', async () => {
    const accounts = createAccountRepository(db);
    await accounts.setBalance('nequi', -15000);
    expect((await balances()).nequi).toBe(-15000);
    await expect(accounts.setBalance('bancolombia', 1)).rejects.toThrow();
    await expect(accounts.setBalance('nequi', 1.5)).rejects.toThrow();
  });
});
