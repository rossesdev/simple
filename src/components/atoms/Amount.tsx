import type { ReactElement } from 'react';

import { formatBalance, formatSignedAmount } from '../../domain/format';
import type { MovementType } from '../../domain/types';

type AmountSize = 'xl' | 'md' | 'sm';

interface AmountProps {
  value: number;
  type: MovementType | 'balance' | 'neutral';
  size?: AmountSize;
}

const SIZE_CLASSES: Record<AmountSize, string> = {
  xl: 'text-amount-xl font-medium',
  md: 'text-amount-md font-medium',
  sm: 'text-amount-sm',
};

const COLOR_CLASSES: Record<AmountProps['type'], string> = {
  income: 'text-income',
  expense: 'text-expense',
  transfer: 'text-transfer',
  balance: 'text-ink',
  neutral: 'text-ink',
};

/** COP amount in mono. income/expense/transfer get sign + color; balance gets $; neutral is plain. */
export function Amount({ value, type, size = 'md' }: AmountProps): ReactElement {
  const text =
    type === 'balance'
      ? formatBalance(value)
      : formatSignedAmount(type === 'neutral' ? 'transfer' : type, value);
  return (
    <span className={`font-mono whitespace-nowrap ${SIZE_CLASSES[size]} ${COLOR_CLASSES[type]}`}>
      {text}
    </span>
  );
}
