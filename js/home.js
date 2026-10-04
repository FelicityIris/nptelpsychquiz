import { initTheme } from './theme.js';
import { initLinkTracking, track } from './analytics.js';
import { loadCategories, loadQuestions } from './data.js';
import { getResult } from './storage.js';
import { el } from './dom.js';

initTheme();
initLinkTracking();

const rows = document.getElementById('week-rows');

function showError(message) {
  rows.replaceChildren(el('tr', {}, el('td', { colspan: '5', class: 'status', text: message })));
}

async function render() {
  try {
    const { weeks } = await loadCategories();

    // Question counts come from the week files; a failed file shows a dash.
    const counts = await Promise.all(
      weeks.map((w) => loadQuestions(w.file).then((q) => q.length).catch(() => null))
    );

    rows.replaceChildren(
      ...weeks.map((w, i) => {
        const last = getResult(w.week);
        return el('tr', {},
          el('td', { text: `Week ${w.week}` }),
          el('td', {}, el('a', { href: `quiz.html?week=${w.week}`, text: w.title })),
          el('td', { class: 'hide-sm muted', text: w.description }),
          el('td', { class: 'num', text: counts[i] ?? '-' }),
          el('td', { class: 'num', text: last ? `${last.score} / ${last.total}` : '-' })
        );
      })
    );

    track('home_view', { week_count: weeks.length });
  } catch (err) {
    showError('Could not load the week list. If you opened this file directly, serve the folder over HTTP instead.');
    track('load_error', { page: 'home', message: String(err.message).slice(0, 100) });
  }
}

render();
