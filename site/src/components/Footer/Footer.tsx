import type { CatalogIndex } from '../../data/types';
import { en } from '../../i18n/en';

interface Props {
  index: CatalogIndex;
}

export function Footer({ index }: Props) {
  return <footer className="footer">{en.footer.generated(index.generatedAt.slice(0, 16).replace('T', ' '), index.commit)}</footer>;
}
