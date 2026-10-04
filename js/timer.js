// Stopwatch that only counts time while the tab is visible,
// so switching tabs does not inflate the time taken per question.
export function createStopwatch() {
  let elapsed = 0;
  let last = 0;        // timestamp of the current running segment, 0 if paused
  let running = false;

  const pause = () => {
    if (last) { elapsed += performance.now() - last; last = 0; }
  };
  const resume = () => {
    if (running && !last) last = performance.now();
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));

  return {
    start() {
      elapsed = 0;
      running = true;
      last = document.hidden ? 0 : performance.now();
    },
    // Stop and return elapsed milliseconds.
    stop() {
      pause();
      running = false;
      return Math.round(elapsed);
    },
    // Elapsed milliseconds without stopping.
    read() {
      return Math.round(elapsed + (last ? performance.now() - last : 0));
    },
  };
}
