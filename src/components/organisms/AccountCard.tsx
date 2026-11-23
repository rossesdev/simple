import type { ReactElement } from 'react';

import type { Account } from '../../domain/types';
import { Amount } from '../atoms/Amount';

interface AccountCardProps {
  account: Account;
  onSelect: () => void;
}

export function AccountCard({ account, onSelect }: AccountCardProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between rounded-md bg-surface-1 px-4 py-[18px] text-left text-body active:bg-surface-2"
    >
      <span>{account.name}</span>
      <Amount value={account.balance} type={account.balance < 0 ? 'expense' : 'neutral'} />
    </button>
  );
}
