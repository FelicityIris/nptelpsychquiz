// Last result per week, kept in the browser only (never sent anywhere).
const key = (week) => `nptelquiz:week-${week}`;

export function getResult(week) {
  try {
    return JSON.parse(localStorage.getItem(key(week)));
  } catch (e) {
    return null;
  }
}

export function saveResult(week, result) {
  try {
    localStorage.setItem(key(week), JSON.stringify(result));
  } catch (e) { /* storage unavailable */ }
}
