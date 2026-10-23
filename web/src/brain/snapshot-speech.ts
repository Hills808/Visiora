import { DIRECTIONS } from './geometry.js';
import type { Sector } from './types.js';

export interface SnapshotPhrase {
  sector: Sector | null;
  noun: string;
  mode: 'present' | 'uncertain' | 'absent';
}
const join = (parts: string[]): string =>
  parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;

/** One direction per sector, with uncertainty scoped to its own noun group. */
export function snapshotSpeech(phrases: readonly SnapshotPhrase[]): string {
  const sectors = new Map<Sector | null, SnapshotPhrase[]>();
  for (const phrase of phrases) {
    const group = sectors.get(phrase.sector) ?? [];
    group.push(phrase);
    sectors.set(phrase.sector, group);
  }
  return [...sectors]
    .map(([sector, group]) => {
      if (sector === null) {
        const sentence = group.map((p) => p.noun).join('. ');
        return `${sentence[0].toLocaleUpperCase('pt-BR')}${sentence.slice(1)}.`;
      }
      const certain = group.filter((p) => p.mode === 'present').map((p) => p.noun);
      const uncertain = group.filter((p) => p.mode === 'uncertain').map((p) => p.noun);
      const absent = group.filter((p) => p.mode === 'absent').map((p) => p.noun);
      const clauses = [
        certain.length ? `há ${join(certain)}` : '',
        uncertain.length ? `talvez haja ${join(uncertain)}` : '',
        ...absent,
      ].filter(Boolean);
      return `${DIRECTIONS[sector]}, ${clauses.join('; ')}.`;
    })
    .join(' ');
}
