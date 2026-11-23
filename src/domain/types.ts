import type { AccountId } from './accounts';
import type { Category } from './categories';

export const MOVEMENT_TYPES = ['income', 'expense', 'transfer'] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

export interface Movement {
  id?: number;
  type: MovementType;
  /** COP, integer, > 0. */
  amount: number;
  /** null for transfers. */
  category: Category | null;
  /** Source account (or receiving account for income). */
  accountId: AccountId;
  /** Only for transfers. */
  toAccountId?: AccountId;
  description: string;
  /** 'YYYY-MM-DD' local date. Set on create (today or yesterday) and never changed by an edit. */
  date: string;
  /** Original spoken sentence. */
  rawText?: string;
  /** Soft delete flag. */
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Account {
  id: AccountId;
  name: string;
  /** Current balance in COP. */
  balance: number;
}

export interface Setting {
  key: string;
  value: string;
}
