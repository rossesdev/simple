import type { MovementType } from './types';

const THIN_SPACE = ' ';
const MINUS_SIGN = '−';

// useGrouping 'always' so 4-digit amounts also get a dot (1.000), whatever the browser's CLDR data.
const copFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
  useGrouping: 'always',
});

const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });

/** 1240000 → '1.240.000' */
export function formatAmount(amount: number): string {
  return copFormatter.format(Math.abs(amount));
}

/** Row amount: income '+ 1.500.000', expense '− 20.000', transfer '200.000'. */
export function formatSignedAmount(type: MovementType, amount: number): string {
  if (type === 'income') return `+${THIN_SPACE}${formatAmount(amount)}`;
  if (type === 'expense') return `${MINUS_SIGN}${THIN_SPACE}${formatAmount(amount)}`;
  return formatAmount(amount);
}

/** Big balance: '$ 1.240.000', or '− $ 1.240.000' when negative. */
export function formatBalance(balance: number): string {
  const formatted = `$${THIN_SPACE}${formatAmount(balance)}`;
  return balance < 0 ? `${MINUS_SIGN}${THIN_SPACE}${formatted}` : formatted;
}

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** '2026-11-22' → '22 de noviembre de 2026' */
export function formatDate(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

/** '2026-11' → 'Noviembre 2026' */
export function formatMonth(month: string): string {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const label = monthFormatter.format(new Date(year, monthNumber - 1, 1)).replace(' de ', ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
