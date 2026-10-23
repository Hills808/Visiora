import { CONFIG } from './config.js';
import type { Verbosity } from './brain/types.js';
export interface Preferences {
  output: 'voice' | 'reader';
  rate: number;
  verbosity: Verbosity;
  theme: 'light' | 'dark';
  largeText: boolean;
  economy: boolean;
  keepHistory: boolean;
  voiceURI: string;
}
export const DEFAULTS: Preferences = {
  output: 'voice',
  rate: 1,
  verbosity: 'balanced',
  theme: 'light',
  largeText: false,
  economy: false,
  keepHistory: false,
  voiceURI: '',
};
export interface HistoryItem {
  text: string;
  time: string;
  source: 'camera' | 'demo';
}
export function loadPreferences(storage: Storage): Preferences {
  const raw = storage.getItem(CONFIG.storage.preferences);
  if (!raw) return { ...DEFAULTS };
  if (raw.length > CONFIG.storage.maxBytes)
    throw new Error('Preferências muito grandes. Restaure os ajustes.');
  const data = JSON.parse(raw) as Partial<Preferences>;
  return {
    output: data.output === 'reader' ? 'reader' : 'voice',
    rate:
      typeof data.rate === 'number' && data.rate >= 0.7 && data.rate <= 1.5
        ? data.rate
        : DEFAULTS.rate,
    verbosity: ['essential', 'balanced', 'detailed'].includes(data.verbosity ?? '')
      ? data.verbosity!
      : 'balanced',
    theme: data.theme === 'dark' ? 'dark' : 'light',
    largeText: data.largeText === true,
    economy: data.economy === true,
    keepHistory: data.keepHistory === true,
    voiceURI: typeof data.voiceURI === 'string' ? data.voiceURI : '',
  };
}
export function savePreferences(storage: Storage, preferences: Preferences): void {
  storage.setItem(CONFIG.storage.preferences, JSON.stringify(preferences));
}
export function history(storage: Storage): HistoryItem[] {
  const value = storage.getItem(CONFIG.storage.history);
  if (!value) return [];
  if (value.length > CONFIG.storage.maxBytes) throw new Error('Histórico acima do limite local.');
  const data: unknown = JSON.parse(value);
  if (!Array.isArray(data)) throw new Error('Histórico inválido.');
  return data
    .filter(
      (item): item is HistoryItem =>
        !!item &&
        typeof item.text === 'string' &&
        typeof item.time === 'string' &&
        ['camera', 'demo'].includes(item.source),
    )
    .slice(-CONFIG.speech.maxHistory);
}
export function recordHistory(storage: Storage, item: HistoryItem, preferences: Preferences): void {
  if (preferences.keepHistory)
    storage.setItem(
      CONFIG.storage.history,
      JSON.stringify([...history(storage), item].slice(-CONFIG.speech.maxHistory)),
    );
}
export async function clearData(storage: Storage): Promise<void> {
  storage.removeItem(CONFIG.storage.preferences);
  storage.removeItem(CONFIG.storage.history);
  if (typeof caches !== 'undefined')
    for (const key of await caches.keys()) if (key.startsWith('visiora-')) await caches.delete(key);
}
