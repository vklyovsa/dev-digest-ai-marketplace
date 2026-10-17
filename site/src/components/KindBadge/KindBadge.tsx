import type { EntryKind } from '../../data/types';
import { en } from '../../i18n/en';

interface Props {
  kind: EntryKind;
  large?: boolean;
}

export function KindBadge({ kind, large = false }: Props) {
  return (
    <span className={`badge${large ? ' badge-lg' : ''}`} data-kind={kind}>
      {en.kinds[kind].one}
    </span>
  );
}
