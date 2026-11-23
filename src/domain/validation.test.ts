import { describe, expect, it } from 'vitest';

import { parseGeminiResponse, validateMovementInput } from './validation';

const now = new Date(2026, 10, 22, 12, 0);

const validExpense = {
  type: 'expense',
  amount: 20000,
  category: 'food',
  accountId: 'otros',
  description: 'Almuerzo',
  date: '2026-11-22',
};

describe('validateMovementInput', () => {
  it('accepts a valid new expense', () => {
    expect(validateMovementInput(validExpense, { isNew: true, now })).toEqual({
      success: true,
      data: validExpense,
    });
  });

  it('reports missing amount in Spanish', () => {
    const result = validateMovementInput({ ...validExpense, amount: 0 }, { isNew: true, now });
    expect(result).toEqual({ success: false, errors: { amount: 'Falta el monto' } });
  });

  it('rejects decimals and unknown accounts', () => {
    const result = validateMovementInput(
      { ...validExpense, amount: 10.5, accountId: 'bancolombia' },
      { isNew: true, now },
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(result.errors).sort()).toEqual(['accountId', 'amount']);
  });

  it('rejects a category from another type', () => {
    const result = validateMovementInput(
      { ...validExpense, category: 'salary' },
      { isNew: true, now },
    );
    expect(result).toEqual({ success: false, errors: { category: 'Elige una categoría' } });
  });

  it('rejects prototype keys as categories', () => {
    const result = validateMovementInput(
      { ...validExpense, category: 'toString' },
      { isNew: true, now },
    );
    expect(result.success).toBe(false);
  });

  it('enforces transfer rules', () => {
    const transfer = { ...validExpense, type: 'transfer', category: null };
    const missingTarget = validateMovementInput(transfer, { isNew: true, now });
    expect(missingTarget).toEqual({
      success: false,
      errors: { toAccountId: 'Elige la cuenta destino' },
    });

    const sameAccount = validateMovementInput(
      { ...transfer, toAccountId: 'otros' },
      { isNew: true, now },
    );
    expect(sameAccount.success).toBe(false);

    const withCategory = validateMovementInput(
      { ...transfer, category: 'food', toAccountId: 'nequi' },
      { isNew: true, now },
    );
    expect(withCategory).toEqual({
      success: false,
      errors: { category: 'Las transferencias no llevan categoría' },
    });

    expect(
      validateMovementInput({ ...transfer, toAccountId: 'nequi' }, { isNew: true, now }).success,
    ).toBe(true);
  });

  it('rejects a destination account on non-transfers', () => {
    const result = validateMovementInput(
      { ...validExpense, toAccountId: 'nequi' },
      { isNew: true, now },
    );
    expect(result.success).toBe(false);
  });

  it('applies the today/yesterday rule only to new movements', () => {
    const old = { ...validExpense, date: '2026-11-10' };
    expect(validateMovementInput(old, { isNew: true, now })).toEqual({
      success: false,
      errors: { date: 'Solo se puede registrar hoy o ayer' },
    });
    expect(validateMovementInput(old, { isNew: false, now }).success).toBe(true);
  });
});

describe('parseGeminiResponse', () => {
  it('turns the Foundations example into two valid drafts', () => {
    // "Me gasté 120 mil en una suscripción con Nequi y le aboné 20 mil a la deuda del apartamento desde ahorros"
    const json = {
      movements: [
        {
          type: 'expense',
          amount: 120000,
          category: 'subscriptions',
          accountId: 'nequi',
          toAccountId: null,
          description: 'Suscripción',
          date: 'today',
        },
        {
          type: 'expense',
          amount: 20000,
          category: 'debts',
          accountId: 'ahorros',
          toAccountId: null,
          description: 'Abono deuda del apartamento',
          date: 'today',
        },
      ],
    };
    const drafts = parseGeminiResponse(json, now);
    expect(drafts).toHaveLength(2);
    expect(drafts?.[0]).toEqual({
      type: 'expense',
      amount: 120000,
      category: 'subscriptions',
      accountId: 'nequi',
      description: 'Suscripción',
      date: '2026-11-22',
    });
    for (const draft of drafts ?? []) {
      expect(validateMovementInput(draft, { isNew: true, now }).success).toBe(true);
    }
  });

  it('returns null for a wrong shape or an invented date', () => {
    expect(parseGeminiResponse({ movements: [] }, now)).toBeNull();
    expect(parseGeminiResponse('not json', now)).toBeNull();
    expect(
      parseGeminiResponse(
        {
          movements: [
            {
              type: 'expense',
              amount: 1000,
              category: 'food',
              accountId: 'otros',
              toAccountId: null,
              description: 'x',
              date: '2026-11-01',
            },
          ],
        },
        now,
      ),
    ).toBeNull();
  });
});
