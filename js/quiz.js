import { initTheme } from './theme.js';
import { initLinkTracking, track } from './analytics.js';
import { loadCategories, loadQuestions } from './data.js';
import { saveResult } from './storage.js';
import { createStopwatch } from './timer.js';
import { el } from './dom.js';

initTheme();
initLinkTracking();

const root = document.getElementById('quiz');
const titleEl = document.getElementById('week-title');
const descEl = document.getElementById('week-desc');
const crumbEl = document.getElementById('crumb-week');
const weekNum = Number(new URLSearchParams(location.search).get('week'));

const watch = createStopwatch(); // time on the current question

const state = {
  week: null,
  questions: [],
  index: 0,
  answers: [],      // one entry per answered question
  started: false,
  finished: false,
  attempt: 0,       // attempts in this page session
  ticker: null,
};

// ---------- helpers ----------

const secs = (ms) => Math.round(ms / 1000);
const fmt = (ms) => {
  const s = secs(ms);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const optionText = (q, id) => {
  const o = q.options.find((x) => x.id === id);
  return o ? `${o.id}. ${o.text}` : '-';
};
// Params attached to every quiz event
const base = () => ({ week: state.week.week, week_title: state.week.title });

// Time on completed questions plus the one in progress
function totalMs() {
  const done = state.answers.reduce((sum, a) => sum + a.timeMs, 0);
  return done + (state.answers[state.index] || state.finished ? 0 : watch.read());
}

function showMessage(text) {
  root.replaceChildren(
    el('p', { class: 'message muted', text }),
    el('p', {}, el('a', { href: 'index.html', text: 'Back to all weeks' }))
  );
}

// ---------- question view ----------

function showQuestion() {
  const q = state.questions[state.index];
  const total = state.questions.length;
  const isLast = state.index === total - 1;

  const options = q.options.map((o) =>
    el('li', {},
      el('button', { class: 'option', type: 'button', 'data-id': o.id, onclick: () => choose(o.id) },
        el('span', { class: 'key', text: `${o.id}.` }),
        el('span', { text: o.text })
      )
    )
  );

  root.replaceChildren(
    el('div', { class: 'meta' },
      el('span', { text: `Question ${state.index + 1} of ${total}` }),
      el('span', { id: 'timer', text: fmt(totalMs()) })
    ),
    el('div', { class: 'bar-track' },
      el('div', { class: 'bar-fill', id: 'fill', style: `width:${(state.index / total) * 100}%` })
    ),
    el('section', { class: 'panel' },
      el('h2', { class: 'question', text: q.question }),
      el('ul', { class: 'options' }, options),
      el('div', { class: 'feedback', id: 'feedback' }),
      el('div', { class: 'actions' },
        el('button', {
          class: 'btn btn-primary', id: 'next', type: 'button', disabled: '',
          onclick: next, text: isLast ? 'Finish' : 'Next question',
        })
      )
    )
  );

  watch.start();
}

function choose(optId) {
  if (state.answers[state.index]) return; // already answered

  const q = state.questions[state.index];
  const total = state.questions.length;
  const timeMs = watch.stop();
  const result = optId === q.correctOption ? 'correct' : 'incorrect';

  state.answers[state.index] = { id: q.id, selected: optId, correct: q.correctOption, result, timeMs };

  // Lock options and mark the right and wrong choices
  root.querySelectorAll('.option').forEach((btn) => {
    const id = btn.dataset.id;
    btn.disabled = true;
    if (id === q.correctOption) btn.classList.add('correct');
    else if (id === optId) btn.classList.add('incorrect');
    else btn.classList.add('dim');
  });

  const fb = document.getElementById('feedback');
  fb.className = `feedback ${result === 'correct' ? 'ok' : 'bad'}`;
  fb.textContent = result === 'correct'
    ? 'Correct.'
    : `Incorrect. The correct answer is ${q.correctOption}.`;

  document.getElementById('fill').style.width = `${((state.index + 1) / total) * 100}%`;
  const nextBtn = document.getElementById('next');
  nextBtn.disabled = false;
  nextBtn.focus();

  track('answer_select', {
    ...base(),
    question_id: q.id,
    question_number: state.index + 1,
    selected_option: optId,
    correct_option: q.correctOption,
    result,
    time_ms: timeMs,
    time_s: secs(timeMs),
  });
}

function next() {
  if (state.index + 1 < state.questions.length) {
    state.index += 1;
    showQuestion();
  } else {
    finish();
  }
}

// ---------- result view ----------

function finish() {
  state.finished = true;
  clearInterval(state.ticker);

  const total = state.questions.length;
  const score = state.answers.filter((a) => a.result === 'correct').length;
  const durationMs = state.answers.reduce((sum, a) => sum + a.timeMs, 0);

  saveResult(state.week.week, { score, total, date: new Date().toISOString() });

  track('quiz_complete', {
    ...base(),
    attempt: state.attempt,
    score,
    total_questions: total,
    percent: Math.round((score / total) * 100),
    duration_s: secs(durationMs),
    avg_question_s: secs(durationMs / total),
  });

  showResults(score, total, durationMs);
}

function showResults(score, total, durationMs) {
  const rows = state.questions.map((q, i) => {
    const a = state.answers[i];
    return el('tr', {},
      el('td', { text: String(i + 1) }),
      el('td', { text: q.question }),
      el('td', { class: a.result === 'correct' ? 'ok' : 'bad', text: optionText(q, a.selected) }),
      el('td', { text: optionText(q, q.correctOption) }),
      el('td', { class: 'num', text: `${(a.timeMs / 1000).toFixed(1)} s` })
    );
  });

  root.replaceChildren(
    el('section', { class: 'panel' },
      el('p', { class: 'score' },
        `${score} / ${total}`,
        el('small', { text: `${Math.round((score / total) * 100)}%, ${fmt(durationMs)} total` })
      ),
      el('div', { class: 'actions' },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: restart, text: 'Retry this week' }),
        el('a', { class: 'btn', href: 'index.html', text: 'All weeks' })
      )
    ),
    el('div', { class: 'table-wrap review' },
      el('table', { class: 'data' },
        el('thead', {}, el('tr', {},
          el('th', { text: '#' }),
          el('th', { text: 'Question' }),
          el('th', { text: 'Your answer' }),
          el('th', { text: 'Correct answer' }),
          el('th', { class: 'num', text: 'Time' })
        )),
        el('tbody', {}, rows)
      )
    )
  );
}

// ---------- lifecycle ----------

function start() {
  state.index = 0;
  state.answers = [];
  state.finished = false;
  state.started = true;
  state.attempt += 1;

  track('quiz_start', { ...base(), total_questions: state.questions.length, attempt: state.attempt });

  clearInterval(state.ticker);
  state.ticker = setInterval(() => {
    const t = document.getElementById('timer');
    if (t) t.textContent = fmt(totalMs());
  }, 1000);

  window.scrollTo(0, 0);
  showQuestion();
}

function restart() {
  track('quiz_restart', { ...base(), attempt: state.attempt + 1 });
  start();
}

// Keyboard: a-d or 1-4 pick an option; right arrow moves on after answering.
document.addEventListener('keydown', (e) => {
  if (!state.started || state.finished || e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();

  if (state.answers[state.index]) {
    if (key === 'arrowright') next();
    return;
  }
  const q = state.questions[state.index];
  const opt = q.options.find((o) => o.id === key)
    || (/^[1-9]$/.test(key) ? q.options[Number(key) - 1] : null);
  if (opt) choose(opt.id);
});

// Record quizzes left unfinished, with how far the person got.
window.addEventListener('pagehide', () => {
  if (!state.started || state.finished) return;
  track('quiz_abandon', {
    ...base(),
    questions_answered: state.answers.length,
    total_questions: state.questions.length,
    time_spent_s: secs(totalMs()),
  });
});

async function init() {
  try {
    const { weeks } = await loadCategories();
    const week = weeks.find((w) => w.week === weekNum);

    if (!week) {
      titleEl.textContent = 'Week not found';
      showMessage('There is no quiz for this week number.');
      track('load_error', { page: 'quiz', message: `unknown week: ${params_week()}` });
      return;
    }

    state.week = week;
    document.title = `Week ${week.week}: ${week.title} - Psychology of Stress, Health and Well-Being`;
    titleEl.textContent = `Week ${week.week}: ${week.title}`;
    descEl.textContent = week.description;
    crumbEl.textContent = `Week ${week.week}`;

    state.questions = await loadQuestions(week.file);
    if (!state.questions.length) throw new Error('No questions in this week');

    // Both a per-week event (week1_view) and a generic one for easier reporting
    track(`week${week.week}_view`, { ...base(), total_questions: state.questions.length });
    track('week_view', { ...base(), total_questions: state.questions.length });

    start();
  } catch (err) {
    titleEl.textContent = 'Quiz unavailable';
    showMessage('Could not load this quiz. If you opened the file directly, serve the folder over HTTP instead.');
    track('load_error', { page: 'quiz', message: String(err.message).slice(0, 100) });
  }
}

// Raw week query value, trimmed for analytics
function params_week() {
  return String(new URLSearchParams(location.search).get('week')).slice(0, 20);
}

init();
