export const ACCOUNT_IDS = ['efectivo', 'nequi', 'daviplata', 'ahorros', 'otros'] as const;

export type AccountId = (typeof ACCOUNT_IDS)[number];

export const ACCOUNT_NAMES: Record<AccountId, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'DaviPlata',
  ahorros: 'Ahorros',
  otros: 'Otros',
};

/** Used when the sentence names no payment method. */
export const DEFAULT_ACCOUNT_ID: AccountId = 'otros';

export function isAccountId(value: string): value is AccountId {
  return (ACCOUNT_IDS as readonly string[]).includes(value);
}
