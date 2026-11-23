import { DEFAULT_ACCOUNT_ID } from './accounts';
import { isCategoryValidForType } from './categories';
import { today } from './dateRule';
import { formatAmount } from './format';
import type { Movement, MovementType } from './types';
import type { MovementDraft } from './validation';

export function emptyDraft(now: Date = new Date()): MovementDraft {
  return {
    type: 'expense',
    amount: 0,
    category: null,
    accountId: DEFAULT_ACCOUNT_ID,
    description: '',
    date: today(now),
  };
}

export function draftFromMovement(movement: Movement): MovementDraft {
  const { type, amount, category, accountId, toAccountId, description, date } = movement;
  return {
    type,
    amount,
    category,
    accountId,
    ...(toAccountId ? { toAccountId } : {}),
    description,
    date,
  };
}

/** Switching type drops a category that doesn't belong to it and the destination of non-transfers. */
export function changeDraftType(draft: MovementDraft, type: MovementType): MovementDraft {
  const { toAccountId, ...rest } = draft;
  return {
    ...rest,
    type,
    category: isCategoryValidForType(type, draft.category) ? draft.category : null,
    ...(type === 'transfer' && toAccountId ? { toAccountId } : {}),
  };
}

/** Typed balance ("1.200.000", "-15.000", "− 15.000") → integer COP, may be negative; null when empty. */
export function parseBalanceText(text: string): number | null {
  if (!/\d/.test(text)) return null;
  const amount = parseAmountText(text);
  return /^\s*[-−]/.test(text) ? -amount : amount;
}

/** Reformats a balance while it is typed: "-15000" → "−15.000". Keeps a lone minus sign. */
export function formatBalanceText(text: string): string {
  const sign = /^\s*[-−]/.test(text) ? '−' : '';
  const balance = parseBalanceText(text);
  return balance === null ? sign : `${sign}${formatAmount(balance)}`;
}

/** Typed amount text ("20.000", "20000", "$ 20.000") → integer COP; 0 when empty. */
export function parseAmountText(text: string): number {
  const digits = text.replace(/\D/g, '').slice(0, 12);
  return digits ? Number(digits) : 0;
}
