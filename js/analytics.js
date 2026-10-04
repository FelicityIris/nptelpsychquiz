// Thin wrapper around gtag. The gtag snippet is loaded in each HTML <head>.
// Safe to call when gtag is blocked (ad blockers): calls become no-ops.
const send = (...args) => {
  if (typeof window.gtag === 'function') window.gtag(...args);
};

// Send a custom event. Beacon transport survives page navigation.
export function track(name, params = {}) {
  send('event', name, { transport_type: 'beacon', ...params });
}

// Attach anonymous user-level properties (e.g. theme).
export function setUserProps(props) {
  send('set', 'user_properties', props);
}

// Any <a data-track="event_name"> fires that event when clicked.
export function initLinkTracking() {
  const handler = (e) => {
    const a = e.target.closest('a[data-track]');
    if (!a) return;
    track(a.dataset.track, {
      link_url: a.href,
      link_location: a.closest('footer') ? 'footer' : 'content',
    });
  };
  document.addEventListener('click', handler);
  document.addEventListener('auxclick', handler); // middle click
}
