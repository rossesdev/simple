import { type ReactElement, type ReactNode, useState } from 'react';

import { Amount } from '../../components/atoms/Amount';
import { AccountBalanceModal } from '../../components/organisms/AccountBalanceModal';
import { AccountCard } from '../../components/organisms/AccountCard';
import { MainLayout } from '../../components/templates/MainLayout';
import { accountRepository } from '../../db/accountRepository';
import type { Account } from '../../domain/types';
import { useAccounts } from '../../hooks/useAccounts';

interface AccountsPageProps {
  nav: ReactNode;
}

export function AccountsPage({ nav }: AccountsPageProps): ReactElement {
  const accounts = useAccounts();
  const [editing, setEditing] = useState<Account | null>(null);
  const total = accounts?.reduce((sum, account) => sum + account.balance, 0) ?? 0;

  return (
    <MainLayout nav={nav}>
      <h1 className="text-title font-medium">Cuentas</h1>
      <div className="mt-6 flex flex-col gap-2">
        {accounts?.map((account) => (
          <AccountCard key={account.id} account={account} onSelect={() => setEditing(account)} />
        ))}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-4">
          <span className="text-label text-ink-muted">Total</span>
          <Amount value={total} type="balance" size="md" />
        </div>
      </div>

      {editing && (
        <AccountBalanceModal
          key={editing.id}
          account={editing}
          onSubmit={async (balance) => {
            await accountRepository.setBalance(editing.id, balance);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </MainLayout>
  );
}
