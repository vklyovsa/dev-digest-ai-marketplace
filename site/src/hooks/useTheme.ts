import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'ddm-theme';

function initialTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  return current === 'light' ? 'light' : 'dark';
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable: the theme still applies for this visit */
    }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return [theme, toggle];
}
