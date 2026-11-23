import { IconList, IconWallet } from '@tabler/icons-react';
import type { ReactElement } from 'react';

export type MainTab = 'movements' | 'accounts';

interface BottomNavProps {
  active: MainTab;
  onNavigate: (tab: MainTab) => void;
}

const TABS = [
  { id: 'movements', label: 'Movimientos', Icon: IconList },
  { id: 'accounts', label: 'Cuentas', Icon: IconWallet },
] as const;

export function BottomNav({ active, onNavigate }: BottomNavProps): ReactElement {
  return (
    <nav className="flex border-t border-line">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(id)}
            className={`flex min-h-control flex-1 flex-col items-center justify-center gap-1 text-caption ${
              isActive ? 'text-ink' : 'text-ink-muted'
            }`}
          >
            <Icon size={22} stroke={1.75} className={isActive ? 'text-accent' : ''} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
