import { POLICY } from './config.mjs';

const date = new Intl.DateTimeFormat('en-US', {
  timeZone: POLICY.budgetTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourMs = 60 * 60 * 1000;
// A bounded search avoids assuming a fixed UTC offset or the host machine's timezone.
const searchRadiusMs = 48 * hourMs;
export function budgetDay(at) {
  const parts = Object.fromEntries(date.formatToParts(at).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function midnight(day) {
  const anchor = Date.parse(day + 'T00:00:00Z');
  let low = anchor - searchRadiusMs,
    high = anchor + searchRadiusMs;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (budgetDay(middle) < day) low = middle + 1;
    else high = middle;
  }
  return low;
}
let cached;
export function budgetWindow(at) {
  const day = budgetDay(at);
  if (cached?.day !== day) {
    const tomorrow = new Date(Date.parse(day + 'T00:00:00Z') + 24 * hourMs)
      .toISOString()
      .slice(0, 10);
    cached = Object.freeze({ day, start: midnight(day), end: midnight(tomorrow) });
  }
  return cached;
}
