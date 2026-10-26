// Minimal element builder. Text is always set via textContent, never innerHTML.
// Attribute rules:
//   - class  → node.className
//   - text   → node.textContent
//   - onXxx  → addEventListener('xxx', fn)  (only if fn is a function)
//   - boolean HTML attributes (disabled, hidden, checked, selected, readonly,
//     required, autofocus, multiple, open, ...) → set if truthy, removed if falsy
//   - other attributes → setAttribute(name, String(value)) if not null/undefined
export function el(tag, attrs = {}, ...children) {
  const BOOLEAN_ATTRS = new Set([
    'disabled', 'hidden', 'checked', 'selected', 'readonly', 'required',
    'autofocus', 'multiple', 'open', 'novalidate', 'formnovalidate',
  ]);

  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') { node.className = v; continue; }
    if (k === 'text')  { node.textContent = v; continue; }
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2), v);
      continue;
    }
    if (BOOLEAN_ATTRS.has(k)) {
      if (v) node.setAttribute(k, '');
      else node.removeAttribute(k);
      continue;
    }
    if (v == null) continue;             // null / undefined → skip
    node.setAttribute(k, v);
  }
  node.append(...children.flat().filter((c) => c != null));
  return node;
}
