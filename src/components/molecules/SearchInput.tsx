import { IconSearch } from '@tabler/icons-react';
import type { ReactElement } from 'react';

import { Input } from '../atoms/Input';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: SearchInputProps): ReactElement {
  return (
    <label className="relative block">
      <IconSearch
        size={20}
        stroke={1.75}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <Input
        type="search"
        enterKeyHint="search"
        placeholder="Buscar descripción o categoría"
        aria-label="Buscar"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-12"
      />
    </label>
  );
}
