import { track, setUserProps } from './analytics.js';

const KEY = 'theme';

// Wire up the toggle button. The initial theme is applied by an inline
// script in each page head to avoid a flash on load.
export function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');

  const apply = (theme) => {
    root.dataset.theme = theme;
    if (btn) btn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    setUserProps({ theme });
  };

  apply(root.dataset.theme === 'light' ? 'light' : 'dark');

  btn?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage unavailable */ }
    track('theme_toggle', { theme: next });
  });
}
