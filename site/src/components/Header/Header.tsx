import type { Theme } from '../../hooks/useTheme';
import { GLOBAL_SEARCH_ID } from '../../hooks/useGlobalShortcuts';
import { en } from '../../i18n/en';
import { navigate, paths, type Route } from '../../router';

interface Props {
  route: Route;
  repoUrl: string | null;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ route, repoUrl, theme, onToggleTheme }: Props) {
  const onSearch = route.name === 'search';
  const query = onSearch ? route.q : '';

  return (
    <header className="header">
      <a className="brand" href={paths.home()}>
        <span className="brand-mark" aria-hidden="true">
          ◆
        </span>
        <span className="brand-title">{en.brand.title}</span>
        <span className="brand-tag">{en.brand.tag}</span>
      </a>
      <div className="header-search">
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          id={GLOBAL_SEARCH_ID}
          data-search-input
          type="search"
          autoComplete="off"
          spellCheck={false}
          aria-label={en.header.searchLabel}
          placeholder={en.header.searchPlaceholder}
          value={query}
          onChange={(e) => {
            const q = e.target.value;
            navigate(paths.search(q, onSearch ? route.kind : null, onSearch ? route.plugin : null), { replace: onSearch });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
        />
        {!query && <span className="kbd">{en.header.shortcutHint}</span>}
      </div>
      <nav className="header-nav">
        <a href={paths.whatsNew()} aria-current={route.name === 'whats-new' ? 'page' : undefined}>
          {en.header.whatsNew}
        </a>
        <a href={paths.gettingStarted()} aria-current={route.name === 'getting-started' ? 'page' : undefined}>
          {en.header.gettingStarted}
        </a>
      </nav>
      <button
        type="button"
        className="icon-btn"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? en.header.themeToLight : en.header.themeToDark}
        title={theme === 'dark' ? en.header.themeToLight : en.header.themeToDark}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      {repoUrl && (
        <a className="dim" href={repoUrl} target="_blank" rel="noopener noreferrer">
          {en.brand.github}
        </a>
      )}
    </header>
  );
}
