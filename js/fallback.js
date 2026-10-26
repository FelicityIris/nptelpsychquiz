// Plain (non-module) script on purpose: it still runs when a module fails to
// load, e.g. when an old cached file no longer matches the newer ones.
// If the page is stuck on "Loading", it shows a hint about hard refreshing
// and clearing site data.
(function () {
  var page = location.pathname.split('/').pop() || 'index.html';

  function track(name) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, { transport_type: 'beacon', page: page });
    }
  }

  // The footer help section is always available; count how often it is opened
  var help = document.querySelector('details.help');
  if (help) {
    help.addEventListener('toggle', function () { if (help.open) track('help_open'); });
  }

  // True while the page has not finished loading its content
  function isStuck() {
    var h1 = document.getElementById('week-title'); // quiz page heading
    return Boolean(document.getElementById('loading')) // home page placeholder row
      || Boolean(h1 && h1.textContent.trim() === 'Loading...');
  }

  function showHint() {
    if (!isStuck() || document.querySelector('.notice')) return;

    var note = document.createElement('p');
    note.className = 'notice';
    note.textContent = 'This is taking longer than expected. Your browser may be using an old saved copy of the site. '
      + 'Try a hard refresh (Ctrl+Shift+R, or Cmd+Shift+R on Mac). '
      + 'If that does not help, see "Something not working?" at the bottom of the page.';

    var head = document.querySelector('.page-head');
    if (head) head.after(note);
    if (help) help.open = true;
    track('stale_hint_shown');

    // Remove the hint again if the page does finish loading
    var poll = setInterval(function () {
      if (!isStuck()) { note.remove(); clearInterval(poll); }
    }, 1000);
  }

  // A script error while the page is still loading (typically a module that no
  // longer matches its imports): check again shortly, once a healthy page is done
  window.addEventListener('error', function () { setTimeout(showHint, 1500); });

  // Fallback for slow or silent failures
  setTimeout(showHint, 6000);
})();
