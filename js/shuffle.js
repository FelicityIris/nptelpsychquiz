// Options like "All of these" or "None of the above" only make sense at the
// end of the list, so they stay pinned there when answer choices are shuffled.
const PINNED = /^(all|none) of (these|the above)\b/i;

// Fisher-Yates on a copy; the input is left untouched.
export function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Shuffled copy of a question's options, with "all/none of these" kept last.
export function shuffleOptions(question) {
  const free = question.options.filter((o) => !PINNED.test(o.text.trim()));
  const pinned = question.options.filter((o) => PINNED.test(o.text.trim()));
  return [...shuffle(free), ...pinned];
}
