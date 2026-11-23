import { type ReactElement, useState } from 'react';

import { BottomNav, type MainTab } from './components/organisms/BottomNav';
import { AccountsPage } from './features/accounts/AccountsPage';
import { HomePage } from './features/home/HomePage';
import { SetupPage } from './features/setup/SetupPage';
import { useApiKey } from './hooks/useApiKey';

export function App(): ReactElement | null {
  const apiKey = useApiKey();
  const [tab, setTab] = useState<MainTab>('movements');

  if (apiKey === undefined) return null;
  if (apiKey === null) return <SetupPage />;

  const nav = <BottomNav active={tab} onNavigate={setTab} />;
  return tab === 'movements' ? <HomePage nav={nav} /> : <AccountsPage nav={nav} />;
}
