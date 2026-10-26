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

const state = {
  week: null,
  questions: [],
  options: [],
  answers: [],
  opened: new Set(),
  index: 0,
  mode: 'all',
  started: false,
  finished: false,
  attempt: 0,
  ticker: null,
  questionTimes: [],
  watch: null,
  sessionWatch: null,
  lastAnswerAt: 0,
};

const secs = (ms) => Math.round(ms / 1000);
const fmt = (ms) => {
  const s = secs(ms);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const base = () => ({ week: state.week.week, week_title: state.week.title });
const answeredCount = () => state.answers.filter(Boolean).length;

function totalMs() {
  return state.sessionWatch ? state.sessionWatch.read() : 0;
}

function shuffleOptions(question) {
  const options = [...question.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

function optionText(q, id) {
  const o = q.options.find((x) => x.id === id);
  return o ? `${o.id}. ${o.text}` : '-';
}

function showMessage(text) {
  root.replaceChildren(
    el('p', { class: 'message muted', text }),
                       el('p', {}, el('a', { href: 'index.html', text: 'Back to all weeks' }))
  );
}

// ---------- sequential per-question clock ----------

function stopQuestionClock() {
  if (!state.watch) return 0;
  const elapsed = state.watch.stop();
  if (state.started && !state.finished && state.mode === 'sequential') {
    if (!state.answers[state.index]) {
      state.questionTimes[state.index] = (state.questionTimes[state.index] || 0) + elapsed;
    }
  }
  return elapsed;
}

function startQuestionClock(index) {
  state.watch = createStopwatch();
  state.index = index;
  state.opened.add(index);
  if (!state.answers[index]) state.watch.start();
}

// ---------- navigator ----------

function questionStatus(index) {
  if (state.answers[index]) return 'answered';
  if (state.opened.has(index)) return 'unanswered';
  return 'unopened';
}

function renderNavigator() {
  return el('aside', { class: 'quiz-sidebar' },
            el('div', { class: 'mode-switch', role: 'group', 'aria-label': 'Question view mode' },
               el('button', {
                 class: `btn${state.mode === 'all' ? ' btn-primary' : ''}`,
                 type: 'button',
                 'aria-pressed': String(state.mode === 'all'),
                  onclick: () => setMode('all'),
                  text: 'All at once',
               }),
               el('button', {
                 class: `btn${state.mode === 'sequential' ? ' btn-primary' : ''}`,
                 type: 'button',
                 'aria-pressed': String(state.mode === 'sequential'),
                  onclick: () => setMode('sequential'),
                  text: 'Sequential',
               })
            ),
            el('h3', { class: 'navigator-title', text: 'Questions' }),
            el('div', { class: 'question-grid' },
               state.questions.map((_, i) => {
                 const status = questionStatus(i);
                 return el('button', {
                   class: `question-nav ${status}${i === state.index ? ' current' : ''}`,
                   type: 'button',
                   title: `Question ${i + 1}: ${status}`,
                   'aria-label': `Question ${i + 1}, ${status}`,
                   'aria-current': String(i === state.index),
                           onclick: () => navigateTo(i),
                           text: String(i + 1),
                 });
               })
            ),
            el('div', { class: 'navigator-legend' },
               el('span', { class: 'legend-item unopened', text: 'Not opened' }),
               el('span', { class: 'legend-item unanswered', text: 'Unanswered' }),
               el('span', { class: 'legend-item answered', text: 'Answered' })
            )
  );
}

function updateNavState() {
  const grid = document.querySelector('.question-grid');
  if (!grid) return;
  grid.querySelectorAll('.question-nav').forEach((btn, i) => {
    const status = questionStatus(i);
    btn.className = `question-nav ${status}${i === state.index ? ' current' : ''}`;
    btn.title = `Question ${i + 1}: ${status}`;
    btn.setAttribute('aria-label', `Question ${i + 1}, ${status}`);
    btn.setAttribute('aria-current', String(i === state.index));
  });
}

function navigateTo(index) {
  if (state.mode === 'sequential') {
    stopQuestionClock();
    startQuestionClock(index);
    renderSequential();
    return;
  }
  state.opened.add(index);
  state.index = index;
  updateNavState();
  document.getElementById(`question-${index}`)
  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setMode(mode) {
  if (state.mode === mode) return;
  if (state.mode === 'sequential') stopQuestionClock();
  state.mode = mode;
  if (mode === 'all') {
    renderAllQuestions();
  } else {
    startQuestionClock(state.index);
    renderSequential();
  }
}

// ---------- rendering ----------

function renderQuestionCard(index) {
  const q = state.questions[index];
  const answer = state.answers[index];
  const answered = Boolean(answer);

  const options = state.options[index].map((o, i) => {
    let className = 'option';
    if (answered) {
      if (o.id === q.correctOption) className += ' correct';
      else if (o.id === answer.selected) className += ' incorrect';
      else className += ' dim';
    }
    return el('li', {},
              el('button', {
                class: className,
                type: 'button',
                disabled: answered,               // real boolean → attribute added/removed
                'data-id': o.id,
                onclick: () => choose(index, o.id),
              },
              el('span', { class: 'key', text: `${String.fromCharCode(65 + i)}.` }),
                 el('span', { text: o.text })
              )
    );
  });

  return el('section', { class: 'panel question-card', id: `question-${index}` },
            el('h2', { class: 'question', text: `${index + 1}. ${q.question}` }),
            el('ul', { class: 'options' }, options),
            answered
            ? el('div', {
              class: `feedback ${answer.result === 'correct' ? 'ok' : 'bad'}`,
              text: answer.result === 'correct'
              ? 'Correct.'
              : `Incorrect. The correct answer is ${q.correctOption}.`,
            })
            : null
  );
}

function renderProgress() {
  const total = state.questions.length;
  const answered = answeredCount();
  return el('div', { id: 'quiz-progress' },
            el('div', { class: 'meta' },
               el('span', { text: `${answered} of ${total} answered` }),
               el('span', { id: 'timer', text: fmt(totalMs()) })
            ),
            el('div', { class: 'bar-track' },
               el('div', { class: 'bar-fill', style: `width:${(answered / total) * 100}%` })
            )
  );
}

function renderSubmitRow() {
  const all = answeredCount() === state.questions.length;
  return el('div', { class: 'actions submit-row', id: 'quiz-submit-row' },
            el('button', {
              class: 'btn btn-primary',
              type: 'button',
              disabled: !all,
              onclick: finish,
              text: `Submit answers (${answeredCount()}/${state.questions.length})`,
            })
  );
}

function renderAllQuestions() {
  root.replaceChildren(
    el('div', { class: 'quiz-layout' },
       el('div', { class: 'quiz-main' },
          renderProgress(),
          ...state.questions.map((_, i) => renderQuestionCard(i)),
          renderSubmitRow()
       ),
       renderNavigator()
    )
  );
}

function renderSequential() {
  root.replaceChildren(
    el('div', { class: 'quiz-layout' },
       el('div', { class: 'quiz-main' },
          renderProgress(),
          renderQuestionCard(state.index),
          el('div', { class: 'actions', id: 'quiz-submit-row' },
             el('button', {
               class: 'btn',
               type: 'button',
               disabled: state.index === 0,
               onclick: () => navigateTo(state.index - 1),
                text: 'Previous',
             }),
             el('button', {
               class: 'btn btn-primary',
               type: 'button',
               disabled: state.index === state.questions.length - 1,
               onclick: () => navigateTo(state.index + 1),
                text: 'Next',
             }),
             el('button', {
               class: 'btn btn-primary',
               type: 'button',
               disabled: answeredCount() !== state.questions.length,
                onclick: finish,
                text: 'Submit answers',
             })
          )
       ),
       renderNavigator()
    )
  );
}

function updateAfterAnswer(index) {
  if (state.mode === 'sequential') {
    renderSequential();
    return;
  }
  const card = document.getElementById(`question-${index}`);
  if (card) card.replaceWith(renderQuestionCard(index));

  const progress = document.getElementById('quiz-progress');
  if (progress) progress.replaceWith(renderProgress());

  const submit = document.getElementById('quiz-submit-row');
  if (submit) submit.replaceWith(renderSubmitRow());

  updateNavState();
}

// ---------- answers ----------

function choose(index, optionId) {
  if (state.answers[index] || state.finished) return;

  const q = state.questions[index];
  const result = optionId === q.correctOption ? 'correct' : 'incorrect';

  let timeMs = 0;
  if (state.mode === 'sequential') {
    if (index === state.index) timeMs = stopQuestionClock();
  } else {
    const t = totalMs();
    timeMs = Math.max(0, t - state.lastAnswerAt);
    state.lastAnswerAt = t;
  }

  state.answers[index] = {
    id: q.id,
    selected: optionId,
    correct: q.correctOption,
    result,
    timeMs,
  };

  track('answer_select', {
    ...base(),
        question_id: q.id,
        question_number: index + 1,
        selected_option: optionId,
        correct_option: q.correctOption,
        result,
        time_ms: timeMs,
        time_s: secs(timeMs),
  });

  updateAfterAnswer(index);
}

// ---------- results ----------

function finish() {
  if (state.finished) return;
  if (answeredCount() !== state.questions.length) return;

  if (state.mode === 'sequential') stopQuestionClock();
  state.finished = true;
  clearInterval(state.ticker);

  const total = state.questions.length;
  const score = state.answers.filter((a) => a.result === 'correct').length;
  const durationMs = state.sessionWatch ? state.sessionWatch.stop() : 0;

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
  clearInterval(state.ticker);

  state.index = 0;
  state.answers = [];
  state.opened = new Set();
  state.questionTimes = state.questions.map(() => 0);
  state.options = state.questions.map(shuffleOptions);
  state.mode = 'all';
  state.finished = false;
  state.started = true;
  state.attempt += 1;
  state.lastAnswerAt = 0;

  state.sessionWatch = createStopwatch();
  state.sessionWatch.start();

  track('quiz_start', {
    ...base(),
        total_questions: state.questions.length,
        attempt: state.attempt,
  });

  state.ticker = setInterval(() => {
    const t = document.getElementById('timer');
    if (t) t.textContent = fmt(totalMs());
  }, 1000);

    window.scrollTo(0, 0);
    renderAllQuestions();
}

function restart() {
  track('quiz_restart', { ...base(), attempt: state.attempt + 1 });
  start();
}

document.addEventListener('keydown', (e) => {
  if (!state.started || state.finished || state.mode !== 'sequential' ||
    e.metaKey || e.ctrlKey || e.altKey) return;

  const key = e.key.toLowerCase();
  if (key === 'arrowright' && state.index < state.questions.length - 1) { navigateTo(state.index + 1); return; }
  if (key === 'arrowleft' && state.index > 0) { navigateTo(state.index - 1); return; }
  if (state.answers[state.index]) return;

  const opts = state.options[state.index];
  const opt = opts.find((o) => o.id === key)
  || (/^[1-9]$/.test(key) ? opts[Number(key) - 1] : null);
  if (opt) choose(state.index, opt.id);
});

window.addEventListener('pagehide', () => {
  if (!state.started || state.finished) return;
  track('quiz_abandon', {
    ...base(),
        questions_answered: answeredCount(),
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

    track(`week${week.week}_view`, { ...base(), total_questions: state.questions.length });
    track('week_view', { ...base(), total_questions: state.questions.length });

    start();
  } catch (err) {
    titleEl.textContent = 'Quiz unavailable';
    showMessage('Could not load this quiz. If you opened the file directly, serve the folder over HTTP instead.');
    track('load_error', { page: 'quiz', message: String(err.message).slice(0, 100) });
  }
}

function params_week() {
  return String(new URLSearchParams(location.search).get('week')).slice(0, 20);
}

init();
