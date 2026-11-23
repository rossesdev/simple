import type { ReactElement } from 'react';

import { ACCOUNT_NAMES } from '../../domain/accounts';
import { formatMonth } from '../../domain/format';
import { DAY_GROUP_LABELS, type MonthSection } from '../../domain/grouping';
import type { Movement } from '../../domain/types';
import { MovementRow } from '../molecules/MovementRow';

interface MovementListProps {
  sections: readonly MonthSection[];
  onSelect: (movement: Movement) => void;
}

export function MovementList({ sections, onSelect }: MovementListProps): ReactElement {
  if (sections.length === 0) {
    return <p className="py-8 text-center text-label text-ink-muted">Sin movimientos</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map(({ month, groups }) => (
        <section key={month} className="flex flex-col gap-4">
          <h2 className="text-caption text-ink-muted uppercase">{formatMonth(month)}</h2>
          {groups.map(({ group, movements }) => (
            <div key={group ?? month} className="flex flex-col gap-2">
              {group && <h3 className="text-label text-ink-muted">{DAY_GROUP_LABELS[group]}</h3>}
              {movements.map((movement) => (
                <MovementRow
                  key={movement.id}
                  movement={movement}
                  accountName={ACCOUNT_NAMES[movement.accountId]}
                  toAccountName={
                    movement.toAccountId ? ACCOUNT_NAMES[movement.toAccountId] : undefined
                  }
                  onSelect={() => onSelect(movement)}
                />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
