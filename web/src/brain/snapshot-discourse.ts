import { CONFIG } from '../config.js';
import type { AnalysisResult, VisualItem } from '../perception/evidence.js';
import { angularDistance, bearingFromX, sectorOf, SECTORS } from './geometry.js';
import { snapshotSpeech, type SnapshotPhrase } from './snapshot-speech.js';
import type { Sector } from './types.js';

export const normalizeVisual = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
const concept = (item: VisualItem): string =>
  `${item.kind}:${normalizeVisual(item.kind === 'person' ? 'pessoa' : item.label)}`;
export interface SnapshotGroup {
  key: string;
  item: VisualItem;
  count: number;
  sector: Sector;
  seenAt: number;
}
interface SpokenGroup extends SnapshotGroup {
  spokenAt: number;
}
export interface SnapshotDelivery {
  revision: number;
  scene: string | null;
  items: SnapshotGroup[];
  clearReferences: boolean;
  removedKeys: string[];
  orientation: boolean;
}
export interface SnapshotPlan {
  text: string;
  acknowledgment: SnapshotDelivery;
  briefing: boolean;
}
export function snapshotGroups(
  result: AnalysisResult,
  observations = result.evidence.observations,
): SnapshotGroup[] {
  const groups = new Map<string, SnapshotGroup>();
  for (const item of observations) {
    if (!item.box || item.kind === 'text') continue;
    const sector = sectorOf(bearingFromX(item.box.x + item.box.width / 2));
    const key = `${concept(item)}:${sector}:${item.uncertain}`;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { key, item, count: 1, sector, seenAt: result.stamp.capturedAtMs });
  }
  return [...groups.values()];
}
export function snapshotItem(group: SnapshotGroup): SnapshotPhrase {
  const { item, count, sector } = group;
  return {
    sector,
    mode: item.uncertain ? 'uncertain' : 'present',
    noun:
      item.kind === 'person'
        ? count > 1
          ? `cerca de ${count} pessoas`
          : 'uma pessoa'
        : `${count > 1 ? 'mais de ' : ''}${item.article} ${item.label}`,
  };
}
/** Delivery memory is linguistic, not tracking or a map of current positions. */
export class SnapshotDiscourse {
  private announced = new Map<string, SpokenGroup>();
  private scene: string | null = null;
  private revision = 0;
  private needsOrientation = true;
  private candidate: { label: string; count: number; frame: number; at: number } | null = null;
  clear(): void {
    this.announced.clear();
    this.scene = null;
    this.candidate = null;
    this.needsOrientation = true;
    this.revision++;
  }
  forgetDirections(): void {
    this.announced.clear();
    this.needsOrientation = true;
    this.candidate = null;
    this.revision++;
  }
  observe(result: AnalysisResult): void {
    const groups = snapshotGroups(result),
      at = result.stamp.capturedAtMs;
    for (const [key, old] of this.announced) {
      if (groups.some((group) => this.sameReference(old, group))) old.seenAt = at;
      else if (at - old.seenAt > CONFIG.online.referenceMemoryMs) this.announced.delete(key);
    }
    const label = normalizeVisual(result.evidence.scene?.label ?? ''),
      candidate = this.candidate;
    if (candidate?.frame === result.stamp.frameId) return; // A second question is not a second visual sample.
    this.candidate = {
      label,
      frame: result.stamp.frameId,
      at,
      count:
        candidate?.label === label && at - candidate.at <= CONFIG.online.sceneConfirmationGapMs
          ? candidate.count + 1
          : 1,
    };
  }
  private sameReference(old: SnapshotGroup, current: SnapshotGroup): boolean {
    const spokenCount = (group: SnapshotGroup): number =>
      group.item.kind === 'person' ? group.count : Math.min(2, group.count);
    if (concept(old.item) !== concept(current.item) || spokenCount(old) !== spokenCount(current))
      return false;
    if (old.sector === current.sector) return true;
    const bearing = bearingFromX(current.item.box!.x + current.item.box!.width / 2);
    const halfSector = 360 / CONFIG.space.sectors / 2;
    return (
      angularDistance(bearing, (SECTORS.indexOf(old.sector) * 360) / CONFIG.space.sectors) <=
      halfSector + CONFIG.online.sectorHysteresisDegrees
    );
  }
  plan(
    result: AnalysisResult,
    prefixWords: number,
    newView = false,
    contextOnly = false,
  ): SnapshotPlan | null {
    const sceneLabel = normalizeVisual(result.evidence.scene?.label ?? '');
    const sceneChanged =
      sceneLabel !== this.scene &&
      (this.scene === null ||
        newView ||
        (sceneLabel !== '' &&
          (this.scene === '' ||
            (this.candidate?.label === sceneLabel &&
              this.candidate.count >= CONFIG.online.sceneConfirmationFrames))));
    const orientation = this.needsOrientation || newView || sceneChanged;
    const acknowledgment: SnapshotDelivery = {
      revision: this.revision,
      scene: null,
      items: [],
      clearReferences: false,
      removedKeys: [],
      orientation,
    };
    if (contextOnly) {
      if (!result.evidence.scene || sceneLabel === this.scene) return null;
      acknowledgment.scene = sceneLabel;
      acknowledgment.clearReferences = true;
      acknowledgment.orientation = false; // Context does not replace a briefing from the new view.
      return {
        text: `O ambiente parecia ${result.evidence.scene.label}.`,
        acknowledgment,
        briefing: false,
      };
    }
    const prefix = orientation
      ? result.evidence.scene
        ? `${newView && !sceneChanged ? 'Neste enquadramento, o ambiente' : 'O ambiente'} parecia ${result.evidence.scene.label}. `
        : 'Não identifiquei o lugar nesta captura. '
      : '';
    if (orientation) acknowledgment.scene = sceneLabel;
    const groups = snapshotGroups(result);
    const phrases: SnapshotPhrase[] = [];
    const budget =
      (orientation ? CONFIG.speech.briefingWords : CONFIG.speech.maxWords) - prefixWords;
    const append = (phrase: SnapshotPhrase): boolean => {
      if (
        phrases.length >= CONFIG.speech.maxItems ||
        (prefix + snapshotSpeech([...phrases, phrase])).trim().split(/\s+/).length > budget
      )
        return false;
      phrases.push(phrase);
      return true;
    };
    // Preserve the provider's usefulness order inside each certainty tier; never guess roles from names.
    for (const group of [...groups].sort(
      (a, b) => Number(a.item.uncertain) - Number(b.item.uncertain),
    )) {
      const old = [...this.announced.values()].find((value) => this.sameReference(value, group));
      if (!orientation && old && (!old.item.uncertain || group.item.uncertain)) continue;
      if (append(snapshotItem(group))) {
        acknowledgment.items.push(group);
        for (const previous of this.announced.values())
          if (
            previous.key !== group.key &&
            !groups.some((value) => value.key === previous.key) &&
            concept(previous.item) === concept(group.item)
          )
            acknowledgment.removedKeys.push(previous.key);
      }
    }
    const missing = [...this.announced.values()].filter(
      (old) => !groups.some((group) => concept(old.item) === concept(group.item)),
    );
    if (!orientation && !groups.length && missing.length) {
      acknowledgment.clearReferences = true;
      append({
        sector: null,
        mode: 'absent',
        noun: 'não confirmei as referências anteriores nesta captura',
      });
    } else if (!orientation) {
      const concepts = new Set<string>();
      for (const old of missing.sort(
        (a, b) => Number(b.item.kind === 'person') - Number(a.item.kind === 'person'),
      )) {
        if (concepts.has(concept(old.item))) continue;
        concepts.add(concept(old.item));
        // Missing observations have no current direction. Never borrow an earlier box for this phrase.
        const phrase: SnapshotPhrase = {
          sector: null,
          mode: 'absent',
          noun:
            old.item.kind === 'person'
              ? 'não identifiquei pessoas nesta captura'
              : `não confirmei ${old.item.article} ${old.item.label} nesta captura`,
        };
        // An absence that loses to useful current news is retired, not queued for a later stale reminder.
        if (append(phrase) || acknowledgment.items.length > 0)
          acknowledgment.removedKeys.push(
            ...missing
              .filter((value) => concept(value.item) === concept(old.item))
              .map((value) => value.key),
          );
      }
    }
    if (!prefix && !phrases.length) return null;
    return {
      text: (prefix + snapshotSpeech(phrases)).trim(),
      acknowledgment,
      briefing: orientation,
    };
  }
  complete(delivery: SnapshotDelivery, at: number): boolean {
    if (delivery.revision !== this.revision) return false;
    if (delivery.clearReferences) this.announced.clear();
    if (delivery.scene !== null) {
      if (delivery.scene !== this.scene || delivery.orientation) this.announced.clear();
      this.scene = delivery.scene;
    }
    if (delivery.orientation) this.needsOrientation = false;
    for (const key of delivery.removedKeys) this.announced.delete(key);
    for (const group of delivery.items) this.announced.set(group.key, { ...group, spokenAt: at });
    while (this.announced.size > CONFIG.online.autoMemoryLimit)
      this.announced.delete(this.announced.keys().next().value!);
    return true;
  }
}
