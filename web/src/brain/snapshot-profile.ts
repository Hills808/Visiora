import { CONFIG } from '../config.js';
import type { Verbosity } from './types.js';

export interface SnapshotSpeechProfile {
  briefingWords: number;
  updateWords: number;
  maxItems: number;
}
/** Browser preference only; does not change model, prompt, capture cadence or snapshot age. */
export function snapshotProfile(verbosity: Verbosity = 'balanced'): SnapshotSpeechProfile {
  return CONFIG.online.speechProfiles[verbosity];
}
