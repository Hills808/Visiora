import { CONFIG } from '../config.js';
import { DIRECTIONS, quantizeSteps } from './geometry.js';
import { LEX } from './lexicon.js';
import type { Fact } from './types.js';
const NUMBERS = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
];
export function numberWord(n: number, gender: 'm' | 'f' = 'm'): string {
  return gender === 'f' && n === 1
    ? 'uma'
    : gender === 'f' && n === 2
      ? 'duas'
      : (NUMBERS[n] ?? String(n));
}
export function distancePhrase(range: number | undefined, step: number): string {
  if (range === undefined || !Number.isFinite(range) || range <= 0) return '';
  if (range / step > 22) return 'bem longe';
  const count = quantizeSteps(range, step);
  return count === 1 ? 'a um passo' : `a uns ${numberWord(count)} passos`;
}
export function countPhrase(cls: string, count: number): string {
  const lex = LEX[cls];
  return `${count === 1 ? (lex.gender === 'f' ? 'uma' : 'um') : numberWord(count, lex.gender)} ${count === 1 ? lex.name : lex.plural}`;
}
function join(items: string[]): string {
  return items.length < 2
    ? items[0]
    : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}
export function words(text: string): number {
  return text.trim().split(/\s+/).length;
}
export function describeGroup(input: Fact[], step: number): { text: string; facts: Fact[] } {
  const sector = input[0].sector;
  let facts = input.filter((f) => f.sector === sector).slice(0, CONFIG.speech.maxItems);
  let text = '';
  do {
    const classes = [...new Set(facts.map((f) => f.cls))];
    const items = classes.map((cls) => {
      const members = facts.filter((f) => f.cls === cls);
      const known = members.every((f) => f.range !== undefined);
      const range = known ? Math.min(...members.map((f) => f.range!)) : undefined;
      const distance = distancePhrase(range, step);
      return `${countPhrase(cls, members.length)}${distance ? ` ${members.length > 1 ? distance.replace('a uns', 'a partir de') : distance}` : ''}`;
    });
    const uncertainty = facts.some((f) => f.score < 0.65) ? 'talvez haja' : 'há';
    text = `${DIRECTIONS[sector]}, ${uncertainty} ${join(items)}.`;
    if (words(text) <= CONFIG.speech.maxWords || facts.length === 1) break;
    facts = facts.slice(0, -1);
  } while (facts.length);
  return { text, facts };
}
export function oldMemory(fact: Fact, step: number): { text: string; facts: Fact[] } {
  const rendered = describeGroup([{ ...fact, range: undefined }], step);
  return {
    text: `${rendered.text} Vi há uns ${Math.max(1, Math.round(fact.age / 1000))} segundos; pode ter mudado.`,
    facts: rendered.facts,
  };
}
