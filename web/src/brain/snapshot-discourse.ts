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
  sceneCorrection: boolean;
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
    const key = `${concept(item)}:${sector}`;
    const group = groups.get(key);
    if (group) {
      group.count++;
      // Mixed certainty must not split one quantity into two repeated announcements.
      if (item.uncertain && !group.item.uncertain) group.item = { ...group.item, uncertain: true };
    } else groups.set(key, { key, item, count: 1, sector, seenAt: result.stamp.capturedAtMs });
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
  private sceneCorrections = 0;
  private missing = new Map<
    string,
    { frame: number; firstAt: number; lastAt: number; count: number }
  >();
  private candidate: { label: string; count: number; frame: number; at: number } | null = null;
  clear(): void {
    this.announced.clear();
    this.scene = null;
    this.candidate = null;
    this.needsOrientation = true;
    this.sceneCorrections = 0;
    this.missing.clear();
    this.revision++;
  }
  forgetDirections(): void {
    this.announced.clear();
    this.needsOrientation = true;
    this.candidate = null;
    this.sceneCorrections = 0;
    this.missing.clear();
    this.revision++;
  }
  observe(result: AnalysisResult): void {
    const groups = snapshotGroups(result),
      at = result.stamp.capturedAtMs;
    for (const [key, old] of this.announced) {
      // Presence and position differ: an identified person with box:null is not an absence.
      const present =
        result.evidence.observations.some(
          (item) => item.kind !== 'text' && concept(item) === concept(old.item),
        ) || groups.some((group) => this.sameReference(old, group));
      if (present) {
        old.seenAt = at;
        this.missing.delete(key);
      } else if (at - old.seenAt > CONFIG.online.referenceMemoryMs) {
        this.announced.delete(key);
        this.missing.delete(key);
      } else {
        const previous = this.missing.get(key);
        if (previous?.frame === result.stamp.frameId) continue;
        const consecutive = previous && at - previous.lastAt <= CONFIG.online.referenceMemoryMs;
        this.missing.set(key, {
          frame: result.stamp.frameId,
          firstAt: consecutive ? previous.firstAt : at,
          lastAt: at,
          count: consecutive ? previous.count + 1 : 1,
        });
      }
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
    // A lower count alone is not new presence; do not alternate one/two-person announcements.
    if (spokenCount(old) < spokenCount(current)) return false;
    if (concept(old.item) !== concept(current.item)) {
      if (old.item.kind !== 'object' || current.item.kind !== 'object') return false;
      const before = normalizeVisual(old.item.label),
        after = normalizeVisual(current.item.label);
      const family = CONFIG.online.discourseLabelFamilies.some(
        (labels) => labels.includes(before) && labels.includes(after),
      );
      const a = old.item.box!,
        b = current.item.box!;
      const intersection =
        Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
        Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      const union = a.width * a.height + b.width * b.height - intersection;
      if (!family || intersection / union < CONFIG.online.discourseLabelOverlap) return false;
    }
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
      this.sceneCorrections < CONFIG.online.sceneCorrectionsPerView &&
      (this.scene === null ||
        newView ||
        (sceneLabel !== '' &&
          (this.scene === '' ||
            (this.candidate?.label === sceneLabel &&
              this.candidate.count >= CONFIG.online.sceneConfirmationFrames))));
    const orientation = this.needsOrientation || newView;
    const acknowledgment: SnapshotDelivery = {
      revision: this.revision,
      scene: null,
      items: [],
      clearReferences: false,
      removedKeys: [],
      orientation,
      sceneCorrection: sceneChanged && !orientation,
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
    const prefix =
      orientation || sceneChanged
        ? result.evidence.scene
          ? `${newView && !sceneChanged ? 'Neste enquadramento, o ambiente' : 'O ambiente'} parecia ${result.evidence.scene.label}. `
          : 'Não identifiquei o lugar nesta captura. '
        : '';
    if (orientation || sceneChanged) acknowledgment.scene = sceneLabel;
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
    const known = [...this.announced.values()];
    const matches = new Map(
      groups.map((group) => {
        const compatible = known.filter((old) => this.sameReference(old, group));
        const exact = compatible.filter((old) => concept(old.item) === concept(group.item));
        return [group, exact.length ? exact : compatible];
      }),
    );
    // Only a unique one-to-one refinement can suppress speech; ambiguous groups remain eligible.
    const previousFor = (group: SnapshotGroup): SpokenGroup | undefined => {
      const candidates = matches.get(group)!;
      if (candidates.length !== 1) return undefined;
      const old = candidates[0]!;
      return groups.filter((current) => matches.get(current)!.includes(old)).length === 1
        ? old
        : undefined;
    };
    // Preserve the provider's usefulness order inside each certainty tier; never guess roles from names.
    for (const group of [...groups].sort(
      (a, b) => Number(a.item.uncertain) - Number(b.item.uncertain),
    )) {
      const old = previousFor(group);
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
    const missing = known.filter((old) => {
      const absence = this.missing.get(old.key);
      return (
        absence &&
        absence.count >= CONFIG.online.missingConfirmationFrames &&
        result.stamp.capturedAtMs - absence.firstAt >= CONFIG.online.missingConfirmationSpanMs
      );
    });
    if (!orientation && !groups.length && missing.length && missing.length === known.length) {
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
    if (delivery.clearReferences) {
      this.announced.clear();
      this.missing.clear();
    }
    if (delivery.scene !== null) {
      if (delivery.orientation) {
        this.announced.clear();
        this.missing.clear();
      }
      this.scene = delivery.scene;
    }
    if (delivery.orientation) {
      this.needsOrientation = false;
      this.sceneCorrections = 0;
    } else if (delivery.sceneCorrection) this.sceneCorrections++;
    for (const key of delivery.removedKeys) {
      this.announced.delete(key);
      this.missing.delete(key);
    }
    for (const group of delivery.items) {
      this.announced.set(group.key, { ...group, spokenAt: at });
      this.missing.delete(group.key);
    }
    while (this.announced.size > CONFIG.online.autoMemoryLimit) {
      const key = this.announced.keys().next().value!;
      this.announced.delete(key);
      this.missing.delete(key);
    }
    return true;
  }
}
