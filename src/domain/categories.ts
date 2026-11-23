import type { MovementType } from './types';

export const EXPENSE_CATEGORY_LABELS = {
  food: 'Comida y restaurantes',
  groceries: 'Mercado',
  transport: 'Transporte',
  housing: 'Vivienda',
  utilities: 'Servicios',
  subscriptions: 'Suscripciones',
  health: 'Salud',
  entertainment: 'Entretenimiento',
  shopping: 'Compras',
  pets: 'Mascotas',
  debts: 'Deudas',
  other: 'Otros',
} as const;

export const INCOME_CATEGORY_LABELS = {
  salary: 'Salario',
  freelance: 'Freelance',
  apartment: 'Apartamento',
  other: 'Otros',
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORY_LABELS;
export type IncomeCategory = keyof typeof INCOME_CATEGORY_LABELS;
export type Category = ExpenseCategory | IncomeCategory;

const LABELS_BY_TYPE: Record<MovementType, Readonly<Record<string, string>>> = {
  expense: EXPENSE_CATEGORY_LABELS,
  income: INCOME_CATEGORY_LABELS,
  transfer: {},
};

export function categoriesForType(type: MovementType): Category[] {
  return Object.keys(LABELS_BY_TYPE[type]) as Category[];
}

/** Transfers have no category, so only `null` is valid for them. */
export function isCategoryValidForType(
  type: MovementType,
  category: string | null,
): category is Category | null {
  if (type === 'transfer') return category === null;
  return category !== null && Object.hasOwn(LABELS_BY_TYPE[type], category);
}

export function categoryLabel(type: MovementType, category: string | null): string {
  if (category === null || !Object.hasOwn(LABELS_BY_TYPE[type], category)) return '';
  return LABELS_BY_TYPE[type][category] ?? '';
}
