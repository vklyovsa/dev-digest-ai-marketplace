import { useEffect } from 'react';
import { Footer } from './components/Footer/Footer';
import { Header } from './components/Header/Header';
import { Toast } from './components/Toast/Toast';
import { repoUrl } from './data/catalog';
import type { Catalog } from './data/types';
import { useCatalog } from './data/useCatalog';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTheme } from './hooks/useTheme';
import { en } from './i18n/en';
import { useRoute, type Route } from './router';
import { Artifact } from './screens/Artifact/Artifact';
import { GettingStarted } from './screens/GettingStarted/GettingStarted';
import { Home } from './screens/Home/Home';
import { NotFound } from './screens/NotFound/NotFound';
import { Plugin } from './screens/Plugin/Plugin';
import { Search } from './screens/Search/Search';
import { WhatsNew } from './screens/WhatsNew/WhatsNew';
import { useSearch } from './search/useSearch';

function Screen({ route, catalog }: { route: Route; catalog: Catalog }) {
  const search = useSearch(catalog);
  switch (route.name) {
    case 'home':
      return <Home catalog={catalog} />;
    case 'search':
      return <Search catalog={catalog} search={search} q={route.q} kind={route.kind} plugin={route.plugin} />;
    case 'plugin':
      return <Plugin key={route.pluginName} catalog={catalog} name={route.pluginName} />;
    case 'artifact':
      return <Artifact key={route.id} catalog={catalog} id={route.id} />;
    case 'whats-new':
      return <WhatsNew releases={catalog.releases} />;
    case 'getting-started':
      return <GettingStarted catalog={catalog} />;
    case 'not-found':
      return <NotFound message={en.notFound.text(route.path)} />;
  }
}

export function App() {
  const route = useRoute();
  const state = useCatalog();
  const [theme, toggleTheme] = useTheme();
  useGlobalShortcuts();

  useEffect(() => {
    if (route.name !== 'search') window.scrollTo(0, 0);
  }, [route]);

  return (
    <>
      <Header
        route={route}
        repoUrl={state.status === 'ready' ? repoUrl(state.catalog) : null}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      {state.status === 'loading' && <div className="state">{en.common.loading}</div>}
      {state.status === 'error' && (
        <div className="state">
          <p>{en.common.loadFailed}</p>
          <p className="faint mono">{state.error}</p>
          <p className="faint">{en.common.loadFailedHint}</p>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <Screen route={route} catalog={state.catalog} />
          <Footer index={state.catalog.index} />
        </>
      )}
      <Toast />
    </>
  );
}
