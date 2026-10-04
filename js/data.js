// Data loading. New weeks only need an entry in data/categories.json
// and a matching question file; no code changes.
const CATEGORIES_PATH = 'data/categories.json';

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

// Returns { course, weeks } with weeks sorted by week number.
export async function loadCategories() {
  const data = await fetchJSON(CATEGORIES_PATH);
  data.weeks.sort((a, b) => a.week - b.week);
  return data;
}

// Returns the question array for one week file.
export async function loadQuestions(file) {
  const questions = await fetchJSON(file);
  if (!Array.isArray(questions)) throw new Error(`${file} is not a question list`);
  return questions;
}
